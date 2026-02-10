import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { generateDailyQuests, generatePracticeQuest } from "./lib/quiz-generator";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { getStockQuote, getMultipleQuotes, getStockFundamentals, searchStocks, getStockHistory, getStockInfo, getMarketNews, getStockNews } from "./stockService";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication FIRST (before other routes)
  await setupAuth(app);
  registerAuthRoutes(app);

  // Register integration routes
  registerChatRoutes(app);
  registerImageRoutes(app);

  // Helper to get user ID from session
  const getUserId = (req: any): string | null => {
    return req.user?.claims?.sub || null;
  };

  // === User Profiles (authenticated) ===
  app.get(api.profiles.get.path, isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    let profile = await storage.getUserProfile(userId);
    if (!profile) {
      // Get language and skill level from session (set during registration/guest login)
      const sessionLanguage = req.user?.language || "en";
      const sessionLevel = req.user?.level || "beginner";
      
      // Auto-create profile for new users (use upsert to handle race conditions)
      profile = await storage.upsertUserProfile({
        id: userId,
        nickname: req.user?.claims?.first_name || "Player",
        language: sessionLanguage,
        favoriteStocks: [],
        skillLevel: sessionLevel,
      });
    }
    
    // Get user's authType from users table (if authenticated via local/guest)
    const user = await storage.getUser(userId);
    const authType = user?.authType || "oidc";
    
    res.json({ ...profile, authType });
  });

  app.post(api.profiles.replenishHearts.path, isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const { amount } = req.body;
    const profile = await storage.replenishHearts(userId, amount);
    res.json(profile);
  });

  app.patch(api.profiles.updateLanguage.path, isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const { language } = api.profiles.updateLanguage.input.parse(req.body);
    const profile = await storage.updateUserLanguage(userId, language);
    
    // Clear existing quests so they regenerate in the new language
    await storage.clearQuests(userId);
    
    res.json(profile);
  });

  // Update skill level
  app.patch("/api/profiles/skill-level", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const { skillLevel } = req.body;
    if (!["beginner", "intermediate", "advanced"].includes(skillLevel)) {
      return res.status(400).json({ message: "Invalid skill level" });
    }
    
    const profile = await storage.updateSkillLevel(userId, skillLevel);
    
    // Clear existing quests so they regenerate for the new level
    await storage.clearQuests(userId);
    
    res.json(profile);
  });

  // Check if current user is a guest
  app.get("/api/auth/status", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const isGuest = userId?.startsWith("guest_") || req.user?.authType === "guest";
    res.json({ 
      isGuest, 
      userId,
      authType: req.user?.authType || "oidc"
    });
  });

  // Legacy user routes (backward compatibility)
  app.get(api.users.get.path, async (req, res) => {
    const userId = req.params.id;
    const profile = await storage.getUserProfile(userId);
    if (!profile) return res.status(404).json({ message: "User not found" });
    res.json(profile);
  });

  app.post(api.users.replenishHearts.path, async (req, res) => {
    const userId = req.params.id;
    const { amount } = req.body;
    const profile = await storage.replenishHearts(userId, amount);
    res.json(profile);
  });

  app.patch(api.users.updateLanguage.path, async (req, res) => {
    const userId = req.params.id;
    const { language } = api.users.updateLanguage.input.parse(req.body);
    const profile = await storage.updateUserLanguage(userId, language);
    await storage.clearQuests(userId);
    res.json(profile);
  });

  // === Clubs ===
  app.get(api.clubs.list.path, async (req, res) => {
    const clubs = await storage.getClubs();
    res.json(clubs);
  });

  app.get(api.clubs.getUserClubs.path, isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const userClubs = await storage.getUserClubs(userId);
    res.json(userClubs);
  });

  app.post(api.clubs.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const clubData = req.body;
      const club = await storage.createClub(clubData, userId);
      res.status(201).json(club);
    } catch (err) {
      res.status(400).json({ message: "Failed to create club" });
    }
  });

  app.post(api.clubs.join.path, isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const clubId = Number(req.params.id);
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
  app.get(api.quests.list.path, isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    let profile = await storage.getUserProfile(userId);
    if (!profile) {
      // Use upsert to handle race conditions
      profile = await storage.upsertUserProfile({
        id: userId,
        nickname: req.user?.claims?.first_name || "Player",
        language: "en",
        favoriteStocks: []
      });
    }
    
    let quests = await storage.getQuests(userId);
    
    // If no active quests, generate new ones
    const activeQuests = quests.filter(q => !q.isCompleted);
    if (activeQuests.length === 0) {
        const skillLevel = (profile.skillLevel as 'beginner' | 'intermediate' | 'advanced') || 'beginner';
        const newQuests = await generateDailyQuests(userId, profile.language || 'en', skillLevel);
        for (const q of newQuests) {
            await storage.createQuest(q);
        }
        quests = await storage.getQuests(userId);
    }
    
    res.json(quests.filter(q => !q.isCompleted));
  });

  // === Practice Mode Routes (MUST be before :id routes) ===
  app.get("/api/quests/practice", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const profile = await storage.getUserProfile(userId);
    
    try {
      const practiceQuest = await generatePracticeQuest(userId, profile?.language || 'en');
      res.json(practiceQuest);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate practice quest" });
    }
  });

  app.post("/api/quests/practice/complete", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const { answerIndex, correctAnswer } = req.body;
    
    const correct = correctAnswer === answerIndex;
    
    if (correct) {
      const profile = await storage.getUserProfile(userId);
      if (profile) {
        const newXp = profile.xp + 5; // Reduced XP for practice
        const newLevel = Math.floor(newXp / 100) + 1;
        
        await storage.updateUserStats(userId, profile.streak, newXp, newLevel, profile.hearts);
        
        return res.json({
          success: true,
          xpGained: 5,
          correct: true,
          newXp,
          newLevel
        });
      }
    }
    
    // Don't lose hearts in practice mode
    return res.json({
      success: false,
      xpGained: 0,
      correct: false
    });
  });

  app.post(api.quests.complete.path, isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const questId = Number(req.params.id);
    const { answerIndex } = req.body;
    
    const quests = await storage.getQuests(userId);
    const quest = quests.find(q => q.id === questId);

    if (!quest) return res.status(404).json({ message: "Quest not found" });
    if (quest.isCompleted) return res.status(400).json({ message: "Already completed" });

    const correct = quest.correctAnswer === answerIndex;
    
    if (correct) {
        await storage.completeQuest(questId, userId);
        
        const profile = await storage.getUserProfile(userId);
        if (profile) {
            const newXp = profile.xp + quest.xpReward;
            const newLevel = Math.floor(newXp / 100) + 1;
            const newStreak = profile.streak + (profile.lastDailyQuestAt ? 0 : 1);
            
            await storage.updateUserStats(userId, newStreak, newXp, newLevel, profile.hearts);
            
            return res.json({
                success: true,
                xpGained: quest.xpReward,
                correct: true,
                explanation: quest.explanation || "Correct!",
                newLevel,
                newStreak,
                newHearts: profile.hearts
            });
        }
    } else {
      // Lose a heart on wrong answer
      const profile = await storage.getUserProfile(userId);
      if (profile) {
        const newHearts = Math.max(0, profile.hearts - 1);
        await storage.updateUserStats(userId, profile.streak, profile.xp, profile.level, newHearts);
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
  app.get(api.watchlist.list.path, isAuthenticated, async (req, res) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      const watchlist = await storage.getWatchlist(userId);
      res.json(watchlist);
  });

  app.post(api.watchlist.add.path, isAuthenticated, async (req, res) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
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
          
          const item = await storage.addToWatchlist(userId, input.symbol);
          res.status(201).json(item);
      } catch (err) {
          res.status(400).json({ message: "Invalid request" });
      }
  });

  app.delete(api.watchlist.remove.path, isAuthenticated, async (req, res) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      const symbol = req.params.symbol;
      await storage.removeFromWatchlist(userId, symbol);
      res.status(204).send();
  });

  // === Market Mood (Fear & Greed) ===
  interface MoodCache {
    index: number;
    labelEn: string;
    labelKo: string;
    dinoAdviceEn: string;
    dinoAdviceKo: string;
    timestamp: number;
  }
  let cachedMood: MoodCache | null = null;
  const MOOD_CACHE_DURATION = 1000 * 60 * 60; // 1 hour

  // === Exchange Rate API ===
  let cachedExchangeRate: { rate: number; source: string; timestamp: number } | null = null;
  const EXCHANGE_RATE_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  app.get("/api/exchange-rate", async (_req, res) => {
    if (cachedExchangeRate && Date.now() - cachedExchangeRate.timestamp < EXCHANGE_RATE_CACHE_DURATION) {
      return res.json(cachedExchangeRate);
    }

    try {
      const response = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await response.json();
      if (data.result === "success" && data.rates?.KRW) {
        cachedExchangeRate = {
          rate: data.rates.KRW,
          source: "er-api.com",
          timestamp: Date.now(),
        };
        return res.json(cachedExchangeRate);
      }
    } catch (error) {
      console.error("Exchange rate API error:", error);
    }

    try {
      const response2 = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
      const data2 = await response2.json();
      if (data2.rates?.KRW) {
        cachedExchangeRate = {
          rate: data2.rates.KRW,
          source: "exchangerate-api.com",
          timestamp: Date.now(),
        };
        return res.json(cachedExchangeRate);
      }
    } catch (error2) {
      console.error("Fallback exchange rate API error:", error2);
    }

    res.json({ rate: 1380, source: "fallback", timestamp: Date.now() });
  });

  const labelTranslations: Record<string, string> = {
    "Extreme Fear": "극심한 공포",
    "Fear": "공포",
    "Neutral": "중립",
    "Greed": "탐욕",
    "Extreme Greed": "극심한 탐욕"
  };

  app.get("/api/market/mood", async (req, res) => {
    const lang = (req.query.lang as string) || "en";
    const isKorean = lang === "ko";

    // Check cache first
    if (cachedMood && Date.now() - cachedMood.timestamp < MOOD_CACHE_DURATION) {
      return res.json({ 
        index: cachedMood.index, 
        label: isKorean ? cachedMood.labelKo : cachedMood.labelEn, 
        dinoAdvice: isKorean ? cachedMood.dinoAdviceKo : cachedMood.dinoAdviceEn 
      });
    }

    try {
      // Fetch CNN Fear & Greed Index via Python service
      const response = await fetch("http://127.0.0.1:5001/fear-greed");
      const data = await response.json();
      
      let fngValue: number;
      let fngClassification: string;
      
      if (data.score != null && data.source === "cnn") {
        fngValue = data.score;
        fngClassification = data.rating || "Neutral";
        // Capitalize rating from CNN (e.g. "greed" -> "Greed", "extreme fear" -> "Extreme Fear")
        fngClassification = fngClassification.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      } else {
        // Fallback to alternative.me crypto index if CNN fails
        const altResponse = await fetch("https://api.alternative.me/fng/?limit=1");
        const altData = await altResponse.json();
        fngValue = parseInt(altData.data?.[0]?.value || "50");
        fngClassification = altData.data?.[0]?.value_classification || "Neutral";
      }

      let dinoAdviceEn = "Stay calm and invest wisely!";
      let dinoAdviceKo = "침착하게 현명하게 투자하세요!";
      
      if (fngValue <= 25) {
        dinoAdviceEn = "It's a scary market, but Dino sees opportunity! Stay calm and look for bargains.";
        dinoAdviceKo = "무서운 시장이지만, 디노는 기회를 봐요! 침착하게 저가 매수 기회를 찾아보세요.";
      } else if (fngValue <= 45) {
        dinoAdviceEn = "Humans are nervous today. Maybe a good time to nibble on quality stocks!";
        dinoAdviceKo = "오늘 사람들이 불안해하고 있어요. 우량주를 조금씩 매수할 좋은 타이밍일 수도 있어요!";
      } else if (fngValue <= 55) {
        dinoAdviceEn = "The market is balanced. Keep learning and stick to your strategy!";
        dinoAdviceKo = "시장이 균형을 이루고 있어요. 계속 공부하고 전략을 유지하세요!";
      } else if (fngValue <= 75) {
        dinoAdviceEn = "Be careful, humans are getting greedy! Don't chase prices too high.";
        dinoAdviceKo = "조심하세요, 사람들이 탐욕스러워지고 있어요! 추격 매수에 주의하세요!";
      } else {
        dinoAdviceEn = "Whoa! Everyone's too greedy today. Dino says be extra cautious!";
        dinoAdviceKo = "와! 모두가 너무 탐욕스러운 상태예요. 디노는 특히 조심하라고 해요!";
      }

      const labelKo = labelTranslations[fngClassification] || "중립";

      cachedMood = { 
        index: fngValue, 
        labelEn: fngClassification, 
        labelKo,
        dinoAdviceEn, 
        dinoAdviceKo, 
        timestamp: Date.now() 
      };
      
      res.json({ 
        index: fngValue, 
        label: isKorean ? labelKo : fngClassification, 
        dinoAdvice: isKorean ? dinoAdviceKo : dinoAdviceEn 
      });
    } catch (err) {
      // Fallback to reasonable default if API fails
      res.json({ 
        index: 50, 
        label: isKorean ? "중립" : "Neutral", 
        dinoAdvice: isKorean ? "침착하게 현명하게 투자하세요!" : "Stay calm and invest wisely!" 
      });
    }
  });

  // === Live Stock Quotes (powered by yfinance) ===
  // Fallback stock prices for when yfinance fails (approximate market values)
  const fallbackStockPrices: Record<string, { price: number; name: string }> = {
    "SPY": { price: 580.50, name: "SPDR S&P 500 ETF" },
    "QQQ": { price: 495.25, name: "Invesco QQQ Trust" },
    "DIA": { price: 425.75, name: "SPDR Dow Jones ETF" },
    "AAPL": { price: 195.50, name: "Apple Inc." },
    "MSFT": { price: 425.00, name: "Microsoft Corporation" },
    "GOOGL": { price: 175.25, name: "Alphabet Inc." },
    "AMZN": { price: 195.75, name: "Amazon.com Inc." },
    "NVDA": { price: 875.50, name: "NVIDIA Corporation" },
    "TSLA": { price: 245.00, name: "Tesla Inc." },
    "META": { price: 525.25, name: "Meta Platforms Inc." },
  };
  
  app.get("/api/stocks/live", async (req, res) => {
    const symbolsParam = req.query.symbols as string;
    if (!symbolsParam) {
      return res.status(400).json({ message: "symbols parameter required" });
    }
    
    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
    console.log(`[Stock API] Fetching quotes for: ${symbols.join(', ')}`);
    
    try {
      const quotes = await getMultipleQuotes(symbols);
      console.log(`[Stock API] Received ${quotes.length} quotes`);
      
      // Check if we got valid data (price > 0)
      const hasValidData = quotes.some(q => q.price > 0);
      
      if (!hasValidData) {
        console.log("[Stock API] No valid prices from yfinance, using fallback data");
        const fallbackQuotes = symbols.map(symbol => {
          const fallback = fallbackStockPrices[symbol] || { price: 100.00, name: symbol };
          return {
            symbol,
            name: fallback.name,
            price: fallback.price,
            change: 0,
            changePercent: 0,
            isMarketOpen: false,
            lastUpdated: new Date().toISOString(),
            isStale: true,
            isFallback: true,
          };
        });
        
        const fallbackTimestamp = new Date().toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true,
          timeZone: 'America/New_York'
        }) + ' ET';
        
        return res.json({
          quotes: fallbackQuotes,
          dinoMessage: "Market data is temporarily unavailable. Showing recent prices!",
          isMarketOpen: false,
          fetchedAtFormatted: fallbackTimestamp,
          source: "fallback",
        });
      }
      
      const hasStaleData = quotes.some(q => q.isStale);
      
      // Get formatted timestamp from first quote if available
      const fetchedAtFormatted = quotes[0]?.lastUpdatedFormatted || new Date().toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true,
        timeZone: 'America/New_York'
      }) + ' ET';
      
      res.json({
        quotes,
        dinoMessage: hasStaleData 
          ? "The market is resting now, but here's the last known price!"
          : null,
        isMarketOpen: quotes[0]?.isMarketOpen ?? false,
        fetchedAtFormatted,
        source: "live",
      });
    } catch (error: any) {
      console.error("[Stock API] Error fetching quotes:", error.message);
      
      // Return fallback data instead of error
      const fallbackQuotes = symbols.map(symbol => {
        const fallback = fallbackStockPrices[symbol] || { price: 100.00, name: symbol };
        return {
          symbol,
          name: fallback.name,
          price: fallback.price,
          change: 0,
          changePercent: 0,
          isMarketOpen: false,
          lastUpdated: new Date().toISOString(),
          isStale: true,
          isFallback: true,
        };
      });
      
      const fallbackTimestamp = new Date().toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true,
        timeZone: 'America/New_York'
      }) + ' ET';
      
      res.json({
        quotes: fallbackQuotes,
        dinoMessage: "Dino couldn't reach the market. Here are recent prices!",
        isMarketOpen: false,
        fetchedAtFormatted: fallbackTimestamp,
        source: "fallback",
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

  // === Stock Info (detailed company information) ===
  app.get("/api/stocks/info/:symbol", async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const lang = (req.query.lang as string) || "en";
    
    try {
      const info = await getStockInfo(symbol);
      
      // Always include descriptionKo field for consistent API response
      info.descriptionKo = null;
      
      // Translate description to Korean if requested and description exists
      if (lang === "ko" && info.description) {
        try {
          const translationResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a Korean translator. Translate the company description to natural, easy-to-understand Korean. Keep it concise but informative." },
              { role: "user", content: `Translate this company description to Korean:\n\n${info.description}` }
            ],
            max_tokens: 500,
          });
          info.descriptionKo = translationResponse.choices[0]?.message?.content || null;
        } catch (err) {
          console.error("Translation error:", err);
        }
      }
      
      res.json(info);
    } catch (error: any) {
      console.error("Info error:", error.message);
      res.status(500).json({ 
        message: "Failed to fetch stock info",
        dinoMessage: "Dino couldn't load the company info. Try again later!"
      });
    }
  });

  // Stock-specific news
  app.get("/api/stocks/news/:symbol", async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const lang = (req.query.lang as string) || "en";
    
    try {
      const news = await getStockNews(symbol);
      
      // Add Korean summaries if requested
      if (lang === "ko" && news.length > 0) {
        const newsWithSummaries = await Promise.all(
          news.slice(0, 5).map(async (item) => {
            try {
              const summaryResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: "You are a Korean financial news summarizer. Create a 1-sentence Korean summary of the news headline. Be concise and natural." },
                  { role: "user", content: `Summarize this news headline in Korean (1 sentence):\n\n${item.title}` }
                ],
                max_tokens: 100,
              });
              return {
                ...item,
                koreanSummary: summaryResponse.choices[0]?.message?.content || item.title
              };
            } catch (err) {
              return { ...item, koreanSummary: null };
            }
          })
        );
        return res.json({ news: newsWithSummaries, symbol });
      }
      
      res.json({ news, symbol });
    } catch (error: any) {
      console.error("Stock news error:", error.message);
      res.json({ news: [], symbol });
    }
  });

  // === Market News ===
  // Fallback news data when API fails (educational market trends)
  const fallbackNews = [
    {
      title: "S&P 500 continues steady growth as tech sector leads gains",
      publisher: "Market Watch",
      link: "https://www.marketwatch.com",
      publishedAt: Math.floor(Date.now() / 1000) - 3600,
      relatedSymbol: "SPY",
      thumbnail: null,
      koreanSummary: "S&P 500이 기술 섹터 주도로 꾸준한 성장세를 이어가고 있습니다."
    },
    {
      title: "Federal Reserve signals potential rate decisions ahead",
      publisher: "Reuters",
      link: "https://www.reuters.com",
      publishedAt: Math.floor(Date.now() / 1000) - 7200,
      relatedSymbol: "SPY",
      thumbnail: null,
      koreanSummary: "연방준비제도가 향후 금리 결정에 대한 신호를 보내고 있습니다."
    },
    {
      title: "Tech giants report strong quarterly earnings",
      publisher: "CNBC",
      link: "https://www.cnbc.com",
      publishedAt: Math.floor(Date.now() / 1000) - 10800,
      relatedSymbol: "QQQ",
      thumbnail: null,
      koreanSummary: "대형 기술 기업들이 강한 분기 실적을 보고했습니다."
    },
    {
      title: "Market volatility expected as economic data releases approach",
      publisher: "Bloomberg",
      link: "https://www.bloomberg.com",
      publishedAt: Math.floor(Date.now() / 1000) - 14400,
      relatedSymbol: "VIX",
      thumbnail: null,
      koreanSummary: "경제 지표 발표를 앞두고 시장 변동성이 예상됩니다."
    }
  ];
  
  app.get("/api/news", async (req, res) => {
    const lang = (req.query.lang as string) || 'en';
    
    try {
      console.log("[News API] Fetching market news...");
      const newsItems = await getMarketNews();
      console.log(`[News API] Received ${newsItems.length} news items from yfinance`);
      
      // Use fallback if no news items returned
      if (!newsItems || newsItems.length === 0) {
        console.log("[News API] No news from yfinance, using fallback data");
        return res.json({ news: fallbackNews, count: fallbackNews.length, source: "fallback" });
      }
      
      // If Korean language requested, generate AI summaries
      if (lang === 'ko' && newsItems.length > 0) {
        const newsWithSummaries = await Promise.all(
          newsItems.slice(0, 5).map(async (item) => {
            try {
              const summaryResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: "You are a financial news translator. Provide a concise 1-sentence Korean summary of the given English headline. Keep it simple and educational." },
                  { role: "user", content: `Headline: ${item.title}` }
                ],
                max_tokens: 100,
              });
              
              return {
                ...item,
                koreanSummary: summaryResponse.choices[0]?.message?.content || item.title
              };
            } catch (summaryError) {
              console.error("[News API] Korean summary generation failed:", summaryError);
              return { ...item, koreanSummary: item.title };
            }
          })
        );
        
        return res.json({ news: newsWithSummaries, count: newsWithSummaries.length, source: "live" });
      }
      
      res.json({ news: newsItems.slice(0, 5), count: Math.min(newsItems.length, 5), source: "live" });
    } catch (error: any) {
      console.error("[News API] Error fetching news:", error.message || error);
      console.log("[News API] Returning fallback news data");
      res.json({ news: fallbackNews, count: fallbackNews.length, source: "fallback" });
    }
  });

  // === Mark News as Read (for quest progress) ===
  let newsReadCount: Record<number, number> = {}; // Simple in-memory tracker per user
  
  app.post("/api/news/read", async (req, res) => {
    const { userId } = req.body;
    
    if (!newsReadCount[userId]) {
      newsReadCount[userId] = 0;
    }
    newsReadCount[userId]++;
    
    res.json({ 
      count: newsReadCount[userId],
      message: newsReadCount[userId] >= 3 ? "Quest complete!" : `${3 - newsReadCount[userId]} more to go!`
    });
  });

  app.get("/api/news/read-count", async (req, res) => {
    const userId = Number(req.query.userId) || 1;
    res.json({ count: newsReadCount[userId] || 0 });
  });

  // === Breaking News Quiz ===
  // Category-based option mapping for quiz questions
  type QuizCategory = 'valuation' | 'impact' | 'technical' | 'trend' | 'default';
  
  const categoryOptions: Record<QuizCategory, { en: [string, string]; ko: [string, string] }> = {
    valuation: { en: ['Overvalued (고평가)', 'Undervalued (저평가)'], ko: ['고평가 (Overvalued)', '저평가 (Undervalued)'] },
    impact:    { en: ['Good News (호재)', 'Bad News (악재)'],         ko: ['호재 (Good News)', '악재 (Bad News)'] },
    technical: { en: ['Overbought (과매수)', 'Oversold (과매도)'],    ko: ['과매수 (Overbought)', '과매도 (Oversold)'] },
    trend:     { en: ['Upward (상승)', 'Downward (하락)'],            ko: ['상승 (Upward)', '하락 (Downward)'] },
    default:   { en: ['Yes (맞음)', 'No (틀림)'],                     ko: ['맞음 (Yes)', '틀림 (No)'] },
  };

  function detectQuizCategory(headline: string): QuizCategory {
    const text = headline.toLowerCase();
    const valuationKeywords = ['p/e', 'per', 'valuation', 'overvalued', 'undervalued', 'expensive', 'cheap', 'fair value', 'multiple', 'premium', 'discount', '고평가', '저평가', '밸류에이션', 'psr', 'pbr', 'ev/ebitda'];
    const impactKeywords = ['news', 'event', 'impact', 'announcement', 'earnings', 'report', 'revenue', 'buyback', 'dividend', 'merger', 'acquisition', 'layoff', 'recall', 'antitrust', 'rate cut', 'rate hike', 'expansion', 'margin', 'fcf', 'cash flow', 'eps', '실적', '매출', '발표', '호재', '악재', '영향', '자사주', '배당', '매입', '인수', '합병', '해고', '리콜', '금리', '인하', '인상', '확장', '마진', '현금흐름'];
    const technicalKeywords = ['rsi', 'indicator', 'overbought', 'oversold', 'macd', 'bollinger', 'moving average', 'support', 'resistance', 'stochastic', '과매수', '과매도', '지표', '이동평균'];
    const trendKeywords = ['trend', 'direction', 'outlook', 'forecast', 'predict', 'future', 'upward', 'downward', 'rise', 'fall', 'growth', 'decline', '추세', '전망', '방향', '상승', '하락', '성장', '둔화'];

    if (valuationKeywords.some(kw => text.includes(kw))) return 'valuation';
    if (technicalKeywords.some(kw => text.includes(kw))) return 'technical';
    if (impactKeywords.some(kw => text.includes(kw))) return 'impact';
    if (trendKeywords.some(kw => text.includes(kw))) return 'trend';
    return 'default';
  }

  function mapAnswerToIndex(correctAnswer: string, category: QuizCategory): number {
    const answer = correctAnswer.toLowerCase().trim();
    const firstOptionAnswers = [
      'bullish', 'overvalued', 'good news', 'overbought', 'upward', 'yes',
      '고평가', '호재', '과매수', '상승', '맞음',
      'good', 'positive', 'up',
    ];
    if (firstOptionAnswers.some(token => answer.includes(token))) return 0;
    return 1;
  }

  app.get("/api/news/quiz", async (req, res) => {
    const lang = (req.query.lang as string) || "en";
    const isKorean = lang === "ko";
    
    // Try AI-generated fundamental quiz with real stock data
    try {
      const symbols = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'META'];
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
      const fundamentals = await getStockFundamentals(randomSymbol);
      
      if (fundamentals && fundamentals.price > 0) {
        const peStr = fundamentals.peRatio ? `P/E Ratio: ${fundamentals.peRatio.toFixed(1)}` : '';
        const divStr = fundamentals.dividendYield ? `Dividend Yield: ${(fundamentals.dividendYield * 100).toFixed(2)}%` : '';
        const capStr = fundamentals.marketCap ? `Market Cap: $${(fundamentals.marketCap / 1e9).toFixed(0)}B` : '';
        const betaStr = fundamentals.beta ? `Beta: ${fundamentals.beta.toFixed(2)}` : '';
        const epsStr = fundamentals.eps ? `EPS: $${fundamentals.eps.toFixed(2)}` : '';
        const highStr = fundamentals.fiftyTwoWeekHigh ? `52W High: $${fundamentals.fiftyTwoWeekHigh.toFixed(2)}` : '';
        const lowStr = fundamentals.fiftyTwoWeekLow ? `52W Low: $${fundamentals.fiftyTwoWeekLow.toFixed(2)}` : '';
        const sectorStr = fundamentals.sector || '';
        
        const fundamentalsContext = [peStr, divStr, capStr, betaStr, epsStr, highStr, lowStr, sectorStr].filter(Boolean).join(', ');
        
        const categoryInfo = `
Categories (pick the most appropriate one):
- "valuation": Questions about whether a stock is overvalued or undervalued (P/E, multiples, fair value)
- "impact": Questions about whether news/events are positive or negative for the stock (earnings, announcements, macro events)
- "technical": Questions about technical indicators (RSI, overbought/oversold conditions)
- "trend": Questions about price direction or future outlook

For the correctAnswer field:
- If category is "valuation": use "overvalued" or "undervalued"
- If category is "impact": use "good news" or "bad news"
- If category is "technical": use "overbought" or "oversold"
- If category is "trend": use "upward" or "downward"`;

        const prompt = isKorean
          ? `${fundamentals.name} (${fundamentals.symbol})의 실시간 펀더멘털 데이터를 기반으로 투자자 교육용 퀴즈 문제 1개를 만들어주세요.

현재 데이터: 주가 $${fundamentals.price.toFixed(2)}, 등락 ${fundamentals.changePercent.toFixed(2)}%, ${fundamentalsContext}

규칙:
- 단순한 "주가 올랐다/내렸다" 문제는 절대 금지
- PER, 배당수익률, 시가총액, 베타, EPS, 52주 고저 등 펀더멘털 지표를 활용한 분석적 질문
- headline과 explanation은 자연스럽고 전문적인 한국어로 작성
- 중요: category와 correctAnswer는 반드시 영어로 작성하세요
${categoryInfo}

JSON 형식으로 정확히 반환:
{"headline": "한국어 질문 내용", "category": "valuation|impact|technical|trend", "correctAnswer": "영어로: overvalued/undervalued/good news/bad news/overbought/oversold/upward/downward", "explanation": "한국어 2-3문장의 전문적인 해설"}`
          : `Create 1 professional investment quiz question based on real fundamentals data for ${fundamentals.name} (${fundamentals.symbol}).

Current data: Price $${fundamentals.price.toFixed(2)}, Change ${fundamentals.changePercent.toFixed(2)}%, ${fundamentalsContext}

Rules:
- NEVER create simple "stock went up/down" questions
- Use fundamental metrics: P/E ratio, dividend yield, market cap, beta, EPS, 52-week range analysis
- Professional, educational tone
${categoryInfo}

Return EXACTLY this JSON:
{"headline": "question text", "category": "valuation|impact|technical|trend", "correctAnswer": "answer matching category", "explanation": "2-3 sentence professional explanation"}`;

        const aiResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
          max_tokens: 500,
          response_format: { type: "json_object" },
        });

        const content = aiResponse.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.headline && parsed.correctAnswer && parsed.explanation) {
            const aiCategory = (['valuation', 'impact', 'technical', 'trend'].includes(parsed.category))
              ? parsed.category as QuizCategory
              : detectQuizCategory(parsed.headline);
            const opts = categoryOptions[aiCategory];
            const correctIdx = mapAnswerToIndex(parsed.correctAnswer, aiCategory);
            
            return res.json({
              id: `ai-${Date.now()}`,
              headline: parsed.headline,
              symbol: fundamentals.symbol,
              companyName: fundamentals.name,
              category: aiCategory,
              options: isKorean ? opts.ko : opts.en,
              correctAnswerIndex: correctIdx,
              explanation: parsed.explanation,
              isRealTime: true,
            });
          }
        }
      }
    } catch (error) {
      console.error("[Quiz] AI fundamental quiz generation failed:", error);
    }
    
    // Fallback to professional curated quizzes with categories
    const fallbackEn = [
      {
        id: "f1",
        headline: "A major tech company reports EPS of $6.50, beating Wall Street's estimate of $5.80 by 12%. Revenue grew 15% YoY. How should investors interpret this?",
        symbol: "AAPL",
        companyName: "Apple Inc.",
        category: "impact" as QuizCategory,
        correctAnswerIndex: 0,
        explanation: "Beating EPS estimates by a significant margin (12%) combined with strong revenue growth signals robust business performance. This typically drives institutional buying and price appreciation."
      },
      {
        id: "f2",
        headline: "A semiconductor company's P/E ratio has expanded from 25x to 65x over 12 months while earnings growth has slowed from 40% to 15%. What does this valuation suggest?",
        symbol: "NVDA",
        companyName: "NVIDIA Corp",
        category: "valuation" as QuizCategory,
        correctAnswerIndex: 0,
        explanation: "When P/E expansion outpaces earnings growth, the stock becomes overvalued. Slowing growth combined with stretched multiples increases downside risk as the market may reprice to reflect lower growth expectations."
      },
      {
        id: "f3",
        headline: "The Federal Reserve signals two additional rate cuts this quarter. How does this typically impact growth stocks with high forward P/E ratios?",
        symbol: "QQQ",
        companyName: "Invesco QQQ Trust",
        category: "impact" as QuizCategory,
        correctAnswerIndex: 0,
        explanation: "Rate cuts lower the discount rate used in DCF models, making future cash flows more valuable today. Growth stocks with earnings weighted toward the future benefit disproportionately from lower rates."
      },
      {
        id: "f4",
        headline: "An EV manufacturer's free cash flow turns negative for the second consecutive quarter while capital expenditure increases 45% for factory expansion. What's the investment signal?",
        symbol: "TSLA",
        companyName: "Tesla, Inc.",
        category: "impact" as QuizCategory,
        correctAnswerIndex: 0,
        explanation: "Negative FCF driven by aggressive capex investment (not operational losses) often signals future growth capacity. Factory expansion positions the company for higher production volume and revenue, which is long-term positive."
      },
      {
        id: "f5",
        headline: "A cloud computing giant's operating margin expands from 25% to 32% while competitors report margin compression. Revenue growth remains at 22% YoY. What does this indicate for the stock's direction?",
        symbol: "MSFT",
        companyName: "Microsoft Corp",
        category: "trend" as QuizCategory,
        correctAnswerIndex: 0,
        explanation: "Expanding margins amid industry-wide compression demonstrates superior operational efficiency and pricing power. Combined with solid revenue growth, this indicates a competitive moat that should drive share price upward."
      },
      {
        id: "f6",
        headline: "A major retailer's inventory-to-sales ratio has increased 35% above its 5-year average, while same-store sales declined 3% last quarter. What risk does this present?",
        symbol: "AMZN",
        companyName: "Amazon.com Inc.",
        category: "impact" as QuizCategory,
        correctAnswerIndex: 1,
        explanation: "Rising inventory relative to sales typically leads to markdowns and margin pressure. Combined with declining same-store sales, this signals weakening demand and potential earnings disappointments ahead."
      },
      {
        id: "f7",
        headline: "A social media company announces a $40B share buyback program representing 8% of its market cap. Trailing P/E is 18x, below its 5-year average of 24x. Is the stock overvalued or undervalued?",
        symbol: "META",
        companyName: "Meta Platforms",
        category: "valuation" as QuizCategory,
        correctAnswerIndex: 1,
        explanation: "Large buyback programs at below-average valuations signal the stock is undervalued. Management is signaling confidence, and reducing share count will boost EPS, creating a positive feedback loop for price appreciation."
      },
      {
        id: "f8",
        headline: "10-year Treasury yields spike to 5.2% while the yield curve remains inverted. Corporate bond spreads have widened 80 basis points. How does this impact equity markets?",
        symbol: "SPY",
        companyName: "S&P 500 ETF",
        category: "impact" as QuizCategory,
        correctAnswerIndex: 1,
        explanation: "Rising yields increase the risk-free rate, making equities relatively less attractive. An inverted yield curve historically predicts recessions, and widening credit spreads signal increasing default risk and risk aversion."
      }
    ];

    const fallbackKo = [
      {
        id: "f1",
        headline: "한 대형 테크 기업이 EPS $6.50을 기록하며 월가 예상치 $5.80을 12% 상회했습니다. 매출은 전년 대비 15% 성장했습니다. 투자자는 이를 어떻게 해석해야 할까요?",
        symbol: "AAPL",
        companyName: "Apple Inc.",
        category: "impact" as QuizCategory,
        correctAnswerIndex: 0,
        explanation: "EPS 예상치를 12%나 큰 폭으로 초과 달성하고 견고한 매출 성장까지 보여준 것은 탄탄한 사업 실적을 의미합니다. 이는 기관 매수세를 유입시키고 주가 상승으로 이어지는 경우가 많습니다."
      },
      {
        id: "f2",
        headline: "한 반도체 기업의 PER이 12개월간 25배에서 65배로 확대되었지만, 이익 성장률은 40%에서 15%로 둔화되었습니다. 이 밸류에이션을 어떻게 판단해야 할까요?",
        symbol: "NVDA",
        companyName: "NVIDIA Corp",
        category: "valuation" as QuizCategory,
        correctAnswerIndex: 0,
        explanation: "PER 확대가 이익 성장을 크게 앞서면 밸류에이션 갭이 발생합니다. 성장 둔화와 높은 멀티플이 결합되면 시장이 낮아진 성장 기대를 반영해 주가를 재조정할 하방 리스크가 커집니다."
      },
      {
        id: "f3",
        headline: "연준이 이번 분기 2차례 추가 금리 인하를 시사했습니다. 높은 Forward PER을 가진 성장주에 이는 일반적으로 어떤 영향을 미칠까요?",
        symbol: "QQQ",
        companyName: "Invesco QQQ Trust",
        category: "impact" as QuizCategory,
        correctAnswerIndex: 0,
        explanation: "금리 인하는 DCF 모델의 할인율을 낮춰 미래 현금흐름의 현재 가치를 높입니다. 미래 이익 비중이 큰 성장주는 금리 하락의 수혜를 가장 크게 받습니다."
      },
      {
        id: "f4",
        headline: "한 EV 제조사의 잉여현금흐름(FCF)이 2분기 연속 적자를 기록했지만, 공장 확장을 위한 설비투자(Capex)는 45% 증가했습니다. 이 투자 신호는 무엇을 의미할까요?",
        symbol: "TSLA",
        companyName: "Tesla, Inc.",
        category: "impact" as QuizCategory,
        correctAnswerIndex: 0,
        explanation: "영업 손실이 아닌 공격적 설비투자로 인한 FCF 적자는 미래 성장 역량 확보를 의미하는 경우가 많습니다. 공장 확장은 생산량과 매출 증가를 위한 포석이므로 장기적으로 긍정적입니다."
      },
      {
        id: "f5",
        headline: "한 클라우드 대기업의 영업이익률이 25%에서 32%로 확대되었고, 경쟁사들은 마진 압축을 보고했습니다. 매출 성장률은 전년 대비 22%를 유지 중입니다. 이 종목의 주가 방향은 어떻게 될까요?",
        symbol: "MSFT",
        companyName: "Microsoft Corp",
        category: "trend" as QuizCategory,
        correctAnswerIndex: 0,
        explanation: "업계 전반의 마진 압축 속에서도 마진이 확대되는 것은 뛰어난 운영 효율성과 가격 결정력을 보여줍니다. 견고한 매출 성장과 결합되면 경쟁 해자가 있다는 신호로, 주가 상승을 견인할 수 있습니다."
      },
      {
        id: "f6",
        headline: "한 대형 유통업체의 재고 대비 매출 비율이 5년 평균보다 35% 높아졌고, 기존점 매출은 지난 분기 3% 감소했습니다. 이는 어떤 리스크를 제시할까요?",
        symbol: "AMZN",
        companyName: "Amazon.com Inc.",
        category: "impact" as QuizCategory,
        correctAnswerIndex: 1,
        explanation: "매출 대비 재고 증가는 할인 판매와 마진 압박으로 이어지는 경우가 많습니다. 기존점 매출 감소와 결합되면 수요 약화와 향후 실적 부진 가능성을 시사합니다."
      },
      {
        id: "f7",
        headline: "한 소셜미디어 기업이 시가총액의 8%에 해당하는 $400억 규모의 자사주 매입을 발표했습니다. Trailing PER은 18배로 5년 평균 24배보다 낮습니다. 이 종목의 밸류에이션은 어떤 수준일까요?",
        symbol: "META",
        companyName: "Meta Platforms",
        category: "valuation" as QuizCategory,
        correctAnswerIndex: 1,
        explanation: "평균 이하의 밸류에이션에서 대규모 자사주 매입은 매우 긍정적인 신호입니다. 경영진이 주가가 저평가되었다고 판단하는 것이며, 유통 주식 수 감소가 EPS를 높여 주가 상승의 선순환을 만듭니다."
      },
      {
        id: "f8",
        headline: "10년 국채 수익률이 5.2%로 급등하고 수익률 곡선 역전이 지속 중입니다. 회사채 스프레드는 80bp 확대되었습니다. 이는 주식 시장에 어떤 영향을 미칠까요?",
        symbol: "SPY",
        companyName: "S&P 500 ETF",
        category: "impact" as QuizCategory,
        correctAnswerIndex: 1,
        explanation: "금리 상승은 무위험 수익률을 높여 주식의 상대적 매력을 떨어뜨립니다. 수익률 곡선 역전은 역사적으로 경기 침체를 예고하며, 신용 스프레드 확대는 부도 위험 증가와 위험 회피 심리를 나타냅니다."
      }
    ];
    
    const headlines = isKorean ? fallbackKo : fallbackEn;
    const randomHeadline = headlines[Math.floor(Math.random() * headlines.length)];
    const opts = categoryOptions[randomHeadline.category];
    res.json({ 
      ...randomHeadline, 
      options: isKorean ? opts.ko : opts.en,
      isRealTime: false 
    });
  });

  // Seed initial stock data (if empty)
  await seedStockData();

  return httpServer;
}

async function seedStockData() {
    // Just seed some initial stocks (users are created via auth now)
    const existingStocks = await storage.getAllStocks();
    if (existingStocks.length === 0) {
        const initialStocks = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN"];
        for (const sym of initialStocks) {
            try {
                const quote = await getStockQuote(sym);
                await storage.createStock({
                    symbol: sym,
                    name: quote.name || sym,
                    sector: "Technology",
                    lastPrice: (quote.price || 100).toString(),
                    changePercent: (quote.changePercent || 0).toString()
                });
                console.log(`Seeded stock: ${sym}`);
            } catch (e) {
                console.log("Failed to seed stock", sym);
            }
        }
    }
}
