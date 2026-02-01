import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { generateDailyQuests } from "./lib/quiz-generator";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { getStockQuote, getMultipleQuotes, getRealTimeQuizQuestion, searchStocks, getStockHistory } from "./stockService";

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

  app.post(api.users.replenishHearts.path, async (req, res) => {
    const userId = Number(req.params.id);
    const { amount } = req.body;
    const user = await storage.replenishHearts(userId, amount);
    res.json(user);
  });

  app.patch(api.users.updateLanguage.path, async (req, res) => {
    const userId = Number(req.params.id);
    const { language } = api.users.updateLanguage.input.parse(req.body);
    const user = await storage.updateUserLanguage(userId, language);
    
    // Clear existing quests so they regenerate in the new language
    await storage.clearQuests(userId);
    
    res.json(user);
  });

  // === Clubs ===
  app.get(api.clubs.list.path, async (req, res) => {
    const clubs = await storage.getClubs();
    res.json(clubs);
  });

  app.get(api.clubs.getUserClubs.path, async (req, res) => {
    const userId = Number(req.params.id);
    const userClubs = await storage.getUserClubs(userId);
    res.json(userClubs);
  });

  app.post(api.clubs.create.path, async (req, res) => {
    try {
      const { creatorId, ...clubData } = req.body;
      const club = await storage.createClub(clubData, creatorId);
      res.status(201).json(club);
    } catch (err) {
      res.status(400).json({ message: "Failed to create club" });
    }
  });

  app.post(api.clubs.join.path, async (req, res) => {
    const clubId = Number(req.params.id);
    const { userId } = req.body;
    await storage.joinClub(userId, clubId);
    res.json({ success: true });
  });

  // === Stocks (powered by yfinance) ===
  app.get(api.stocks.search.path, async (req, res) => {
    const query = req.query.query as string;
    if (!query || query.length < 1) return res.json([]);
    
    try {
      const searchResults = await searchStocks(query);
      
      // Map to expected format
      const results = searchResults.map(r => ({
        id: 0,
        symbol: r.symbol,
        name: r.name,
        sector: r.type,
        lastPrice: null,
        changePercent: null,
        updatedAt: null
      }));
      
      res.json(results);
    } catch (err: any) {
      console.error("Stock search error:", err.message);
      res.status(500).json({ 
        message: "Search failed",
        dinoMessage: "Dino couldn't search right now. Please try again later!"
      });
    }
  });

  app.get(api.stocks.quote.path, async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    try {
        // Fetch real data from yfinance service
        const quote = await getStockQuote(symbol);
        
        // Update or create in DB cache
        let stock = await storage.getStockBySymbol(symbol);
        
        const price = quote.price.toString();
        const change = quote.changePercent.toString();

        if (stock) {
            stock = await storage.updateStockPrice(stock.id, price, change);
        } else {
            stock = await storage.createStock({
                symbol,
                name: quote.name,
                sector: "Unknown",
                lastPrice: price,
                changePercent: change
            });
        }
        
        res.json({
            symbol: quote.symbol,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            name: quote.name
        });
    } catch (err) {
        // Fallback to DB cache if yfinance fails
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
    const user = await storage.getUser(userId);
    let quests = await storage.getQuests(userId);
    
    // If no active quests, generate new ones
    const activeQuests = quests.filter(q => !q.isCompleted);
    if (activeQuests.length === 0) {
        const newQuests = await generateDailyQuests(userId, user?.language || 'en');
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
        
        const user = await storage.getUser(userId);
        if (user) {
            const newXp = user.xp + quest.xpReward;
            const newLevel = Math.floor(newXp / 100) + 1;
            const newStreak = user.streak + (user.lastDailyQuestAt ? 0 : 1);
            
            await storage.updateUserStats(userId, newStreak, newXp, newLevel, user.hearts);
            
            return res.json({
                success: true,
                xpGained: quest.xpReward,
                correct: true,
                explanation: quest.explanation || "Correct!",
                newLevel,
                newStreak,
                newHearts: user.hearts
            });
        }
    } else {
      // Lose a heart on wrong answer
      const user = await storage.getUser(userId);
      if (user) {
        const newHearts = Math.max(0, user.hearts - 1);
        await storage.updateUserStats(userId, user.streak, user.xp, user.level, newHearts);
        return res.json({
          success: false,
          xpGained: 0,
          correct: false,
          explanation: quest.explanation || "Wrong answer! You lost a heart.",
          newHearts
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
      const userId = Number(req.query.userId) || 1; // Default to user 1 for MVP
      const watchlist = await storage.getWatchlist(userId);
      res.json(watchlist);
  });

  app.post(api.watchlist.add.path, async (req, res) => {
      try {
          const input = api.watchlist.add.input.parse(req.body);
          // Ensure stock exists in stocks table first (fetch quote to fill it)
          let stock = await storage.getStockBySymbol(input.symbol);
          if (!stock) {
               // Try to fetch it to create it using yfinance service
               try {
                   const quote = await getStockQuote(input.symbol);
                   stock = await storage.createStock({
                       symbol: input.symbol,
                       name: quote.name || input.symbol,
                       sector: "Unknown",
                       lastPrice: (quote.price || 0).toString(),
                       changePercent: (quote.changePercent || 0).toString()
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

  // === Market Mood (Fear & Greed) ===
  let cachedMood: { index: number; label: string; dinoAdvice: string; timestamp: number } | null = null;
  const MOOD_CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

  app.get("/api/market/mood", async (req, res) => {
    // Check cache first
    if (cachedMood && Date.now() - cachedMood.timestamp < MOOD_CACHE_DURATION) {
      return res.json({ index: cachedMood.index, label: cachedMood.label, dinoAdvice: cachedMood.dinoAdvice });
    }

    try {
      // Fetch from Alternative.me Fear & Greed Index API
      const response = await fetch("https://api.alternative.me/fng/?limit=1");
      const data = await response.json();
      const fngValue = parseInt(data.data?.[0]?.value || "50");
      const fngClassification = data.data?.[0]?.value_classification || "Neutral";

      let dinoAdvice = "Stay calm and invest wisely!";
      if (fngValue <= 25) {
        dinoAdvice = "It's a scary market, but Dino sees opportunity! Stay calm and look for bargains.";
      } else if (fngValue <= 45) {
        dinoAdvice = "Humans are nervous today. Maybe a good time to nibble on quality stocks!";
      } else if (fngValue <= 55) {
        dinoAdvice = "The market is balanced. Keep learning and stick to your strategy!";
      } else if (fngValue <= 75) {
        dinoAdvice = "Be careful, humans are getting greedy! Don't chase prices too high.";
      } else {
        dinoAdvice = "Whoa! Everyone's too greedy today. Dino says be extra cautious!";
      }

      cachedMood = { index: fngValue, label: fngClassification, dinoAdvice, timestamp: Date.now() };
      res.json({ index: fngValue, label: fngClassification, dinoAdvice });
    } catch (err) {
      // Fallback to reasonable default if API fails
      res.json({ index: 50, label: "Neutral", dinoAdvice: "Stay calm and invest wisely!" });
    }
  });

  // === Live Stock Quotes (powered by yfinance) ===
  app.get("/api/stocks/live", async (req, res) => {
    const symbolsParam = req.query.symbols as string;
    if (!symbolsParam) {
      return res.status(400).json({ message: "symbols parameter required" });
    }
    
    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
    
    try {
      const quotes = await getMultipleQuotes(symbols);
      const hasStaleData = quotes.some(q => q.isStale);
      
      res.json({
        quotes,
        dinoMessage: hasStaleData 
          ? "The market is resting now, but here's the last known price!"
          : null,
        isMarketOpen: quotes[0]?.isMarketOpen ?? false,
      });
    } catch (error: any) {
      console.error("Live quotes error:", error.message);
      res.status(500).json({ 
        message: "Failed to fetch quotes",
        dinoMessage: "The market is resting now. Try again later!"
      });
    }
  });

  app.get("/api/stocks/live/:symbol", async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    
    try {
      const quote = await getStockQuote(symbol);
      res.json({
        ...quote,
        dinoMessage: quote.isStale 
          ? "The market is resting now, but here's the last known price!"
          : null,
      });
    } catch (error: any) {
      console.error("Single quote error:", error.message);
      res.status(500).json({ 
        message: "Failed to fetch quote",
        dinoMessage: "Dino couldn't find that stock. Try again later!"
      });
    }
  });

  // === Stock History for Charts ===
  app.get("/api/stocks/history/:symbol", async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const period = (req.query.period as string) || '1mo';
    const interval = (req.query.interval as string) || '1d';
    
    try {
      const history = await getStockHistory(symbol, period, interval);
      res.json({
        symbol,
        period,
        interval,
        data: history,
        count: history.length
      });
    } catch (error: any) {
      console.error("History error:", error.message);
      res.status(500).json({ 
        message: "Failed to fetch history",
        dinoMessage: "Dino couldn't load the chart data. Try again later!"
      });
    }
  });

  // === Breaking News Quiz ===
  app.get("/api/news/quiz", async (req, res) => {
    // Try to get a real-time quiz question first (50% chance)
    if (Math.random() > 0.5) {
      try {
        const realTimeQuestion = await getRealTimeQuizQuestion();
        if (realTimeQuestion) {
          return res.json({
            id: `rt-${Date.now()}`,
            ...realTimeQuestion,
            isRealTime: true,
          });
        }
      } catch (error) {
        console.error("Failed to get real-time quiz:", error);
      }
    }

    // Fallback to educational headlines
    const educationalHeadlines = [
      {
        id: "1",
        headline: "Apple reports record quarterly revenue, beating analyst expectations by 15%",
        symbol: "AAPL",
        companyName: "Apple Inc.",
        correctAnswer: "bullish" as const,
        explanation: "Record revenue and beating expectations typically drives stock prices up. This is positive news for investors!"
      },
      {
        id: "2",
        headline: "Tesla recalls 2 million vehicles due to safety concerns with autopilot system",
        symbol: "TSLA",
        companyName: "Tesla, Inc.",
        correctAnswer: "bearish" as const,
        explanation: "Large recalls create costs and negative publicity, which usually pressures stock prices downward."
      },
      {
        id: "3",
        headline: "NVIDIA announces new AI chip that's 10x faster than previous generation",
        symbol: "NVDA",
        companyName: "NVIDIA Corp",
        correctAnswer: "bullish" as const,
        explanation: "Breakthrough products, especially in hot sectors like AI, boost investor confidence and drive prices up!"
      },
      {
        id: "4",
        headline: "Microsoft faces major antitrust investigation from EU regulators",
        symbol: "MSFT",
        companyName: "Microsoft Corp",
        correctAnswer: "bearish" as const,
        explanation: "Antitrust investigations can lead to fines and restrictions, creating uncertainty that typically hurts stock prices."
      },
      {
        id: "5",
        headline: "Amazon expands same-day delivery to 50 new cities, expects 30% growth",
        symbol: "AMZN",
        companyName: "Amazon.com Inc.",
        correctAnswer: "bullish" as const,
        explanation: "Expansion and strong growth projections signal business strength, which is positive for the stock!"
      },
      {
        id: "6",
        headline: "Meta lays off 10,000 employees in major cost-cutting restructure",
        symbol: "META",
        companyName: "Meta Platforms",
        correctAnswer: "bullish" as const,
        explanation: "While layoffs sound negative, cost-cutting often improves profitability and can boost stock prices!"
      },
      {
        id: "7",
        headline: "Federal Reserve announces unexpected interest rate hike of 0.5%",
        symbol: "SPY",
        companyName: "S&P 500 ETF",
        correctAnswer: "bearish" as const,
        explanation: "Higher interest rates make borrowing more expensive and often lead to stock market declines."
      },
      {
        id: "8",
        headline: "Google Cloud revenue grows 28% year-over-year, exceeding forecasts",
        symbol: "GOOGL",
        companyName: "Alphabet Inc.",
        correctAnswer: "bullish" as const,
        explanation: "Strong cloud growth shows the company is diversifying beyond ads, which investors love!"
      }
    ];
    
    const randomHeadline = educationalHeadlines[Math.floor(Math.random() * educationalHeadlines.length)];
    res.json({ ...randomHeadline, isRealTime: false });
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
        
        // Seed some stocks using yfinance service
        const initialStocks = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN"];
        for (const sym of initialStocks) {
            try {
                // Try fetching real data from yfinance
                const quote = await getStockQuote(sym);
                await storage.createStock({
                    symbol: sym,
                    name: quote.name || sym,
                    sector: "Technology",
                    lastPrice: (quote.price || 100).toString(),
                    changePercent: (quote.changePercent || 0).toString()
                });
                // Add to watchlist
                await storage.addToWatchlist(user.id, sym);
            } catch (e) {
                console.log("Failed to seed stock", sym);
            }
        }
    }
}
