import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import yahooFinance from 'yahoo-finance2';
import { generateDailyQuests } from "./lib/quiz-generator";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register integration routes
  registerChatRoutes(app);
  registerImageRoutes(app);

  // === Users ===
  app.get(api.users.get.path, async (req, res) => {
    const user = await storage.getUser(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  });

  app.post(api.users.create.path, async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      const user = await storage.createUser(input);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === Stocks ===
  app.get(api.stocks.search.path, async (req, res) => {
    const query = req.query.query as string;
    if (!query) return res.json([]);
    
    try {
      // Try local search first
      let results = await storage.searchStocks(query);
      
      // If no local results, maybe try Yahoo Finance search?
      // For now, let's trust our seed data + yahoo fetch for details
      // Or we can use yahoo search:
      if (results.length === 0) {
          try {
            const yResults = await yahooFinance.search(query);
            // Map yResults to simple stock objects (not saving them yet)
            // We just return them to frontend
            const mapped = yResults.quotes.filter((q: any) => q.isYahooFinance === true || !q.isYahooFinance).map((q: any) => ({
                id: 0,
                symbol: q.symbol,
                name: q.shortname || q.longname || q.symbol,
                sector: q.sector || "Unknown",
                lastPrice: null,
                changePercent: null,
                updatedAt: null
            }));
            return res.json(mapped);
          } catch (yErr) {
            console.error("Yahoo search error", yErr);
          }
      }
      
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get(api.stocks.quote.path, async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    try {
        // Fetch real data
        const quote = await yahooFinance.quote(symbol);
        
        // Update or create in DB cache
        let stock = await storage.getStockBySymbol(symbol);
        
        const price = quote.regularMarketPrice?.toString() || "0";
        const change = quote.regularMarketChangePercent?.toString() || "0";
        const name = quote.shortName || quote.longName || symbol;

        if (stock) {
            stock = await storage.updateStockPrice(stock.id, price, change);
        } else {
            stock = await storage.createStock({
                symbol,
                name,
                sector: "Unknown", // Quote doesn't always have sector, need profile
                lastPrice: price,
                changePercent: change
            });
        }
        
        res.json({
            symbol: stock.symbol,
            price: parseFloat(stock.lastPrice || "0"),
            change: 0, // Simplified for now
            changePercent: parseFloat(stock.changePercent || "0"),
            name: stock.name
        });
    } catch (err) {
        // Fallback to DB if Yahoo fails
        const stock = await storage.getStockBySymbol(symbol);
        if (stock) {
             return res.json({
                symbol: stock.symbol,
                price: parseFloat(stock.lastPrice || "0"),
                change: 0,
                changePercent: parseFloat(stock.changePercent || "0"),
                name: stock.name
            });
        }
        res.status(404).json({ message: "Stock not found" });
    }
  });

  // === Quests ===
  app.get(api.quests.list.path, async (req, res) => {
    const userId = Number(req.query.userId);
    let quests = await storage.getQuests(userId);
    
    // If no active quests, generate new ones
    const activeQuests = quests.filter(q => !q.isCompleted);
    if (activeQuests.length === 0) {
        const newQuests = await generateDailyQuests(userId);
        for (const q of newQuests) {
            await storage.createQuest(q);
        }
        quests = await storage.getQuests(userId);
    }
    
    res.json(quests.filter(q => !q.isCompleted));
  });

  app.post(api.quests.complete.path, async (req, res) => {
    const questId = Number(req.params.id);
    const { userId, answerIndex } = req.body;
    
    // Check quest in DB (not exposed in storage properly to get single quest, let's assume we fetch list and find it or add getQuest)
    // Adding getQuest to storage would be better, but for now filtering list is okay for MVP (small lists)
    const quests = await storage.getQuests(userId);
    const quest = quests.find(q => q.id === questId);

    if (!quest) return res.status(404).json({ message: "Quest not found" });
    if (quest.isCompleted) return res.status(400).json({ message: "Already completed" });

    const correct = quest.correctAnswer === answerIndex;
    
    if (correct) {
        await storage.completeQuest(questId, userId);
        
        // Update user stats
        const user = await storage.getUser(userId);
        if (user) {
            const newXp = user.xp + quest.xpReward;
            // Simple level up logic: level = floor(xp / 100) + 1
            const newLevel = Math.floor(newXp / 100) + 1;
            // Update streak if not updated today (mock logic)
            const newStreak = user.streak + (user.lastDailyQuestAt ? 0 : 1); // Simplistic
            
            await storage.updateUserStreak(userId, newStreak, newXp, newLevel);
            
            return res.json({
                success: true,
                xpGained: quest.xpReward,
                correct: true,
                explanation: quest.explanation || "Correct!",
                newLevel,
                newStreak
            });
        }
    }

    res.json({
        success: false,
        xpGained: 0,
        correct: false,
        explanation: "Try again!"
    });
  });

  // === Watchlist ===
  app.get(api.watchlist.list.path, async (req, res) => {
      const userId = Number(req.query.userId);
      const watchlist = await storage.getWatchlist(userId);
      res.json(watchlist);
  });

  app.post(api.watchlist.add.path, async (req, res) => {
      try {
          const input = api.watchlist.add.input.parse(req.body);
          // Ensure stock exists in stocks table first (fetch quote to fill it)
          // For now assume it exists or we create it
          let stock = await storage.getStockBySymbol(input.symbol);
          if (!stock) {
               // Try to fetch it to create it
               try {
                   const quote = await yahooFinance.quote(input.symbol);
                   stock = await storage.createStock({
                       symbol: input.symbol,
                       name: quote.shortName || input.symbol,
                       sector: "Unknown",
                       lastPrice: (quote.regularMarketPrice || 0).toString(),
                       changePercent: (quote.regularMarketChangePercent || 0).toString()
                   });
               } catch (e) {
                   // Create dummy if fetch fails
                   stock = await storage.createStock({
                       symbol: input.symbol,
                       name: input.symbol,
                       sector: "Unknown",
                       lastPrice: "0",
                       changePercent: "0"
                   });
               }
          }
          
          const item = await storage.addToWatchlist(input.userId, input.symbol);
          res.status(201).json(item);
      } catch (err) {
          res.status(400).json({ message: "Invalid request" });
      }
  });

  app.delete(api.watchlist.remove.path, async (req, res) => {
      const symbol = req.params.symbol;
      const userId = Number(req.query.userId); // passed as query in delete usually or body
      if (!userId) return res.status(400).json({ message: "UserId required" });
      
      await storage.removeFromWatchlist(userId, symbol);
      res.status(204).send();
  });

  // Seed Data (if empty)
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
    // Seed a default user
    const existingUser = await storage.getUserByUsername("guest");
    if (!existingUser) {
        const user = await storage.createUser({
            username: "guest",
            password: "password", // Dummy
        });
        console.log("Seeded guest user", user.id);
        
        // Seed some stocks
        const initialStocks = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN"];
        for (const sym of initialStocks) {
            try {
                // Try fetching real data
                const quote = await yahooFinance.quote(sym);
                await storage.createStock({
                    symbol: sym,
                    name: quote.shortName || sym,
                    sector: "Technology", // Mock
                    lastPrice: (quote.regularMarketPrice || 100).toString(),
                    changePercent: (quote.regularMarketChangePercent || 0).toString()
                });
                // Add to watchlist
                await storage.addToWatchlist(user.id, sym);
            } catch (e) {
                console.log("Failed to seed stock", sym);
            }
        }
    }
}
