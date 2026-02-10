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

  // === Breaking News Quiz Engine (v2 - Anti-Repetition, Level-Aware, Multi-Source) ===
  type QuizCategory = 'valuation' | 'impact' | 'technical' | 'movement';

  const categoryOptions: Record<QuizCategory, { en: [string, string]; ko: [string, string] }> = {
    valuation: { en: ['Overvalued (고평가)', 'Undervalued (저평가)'], ko: ['고평가 (Overvalued)', '저평가 (Undervalued)'] },
    impact:    { en: ['Good News (호재)', 'Bad News (악재)'],         ko: ['호재 (Good News)', '악재 (Bad News)'] },
    technical: { en: ['Overbought (과매수)', 'Oversold (과매도)'],    ko: ['과매수 (Overbought)', '과매도 (Oversold)'] },
    movement:  { en: ['Upward (상승)', 'Downward (하락)'],            ko: ['상승 (Upward)', '하락 (Downward)'] },
  };

  type DataSource = 'live_news' | 'pe_ratios' | 'dividend_yield' | 'technical_rsi' | 'fear_greed';

  const dataSourceToCategory: Record<DataSource, QuizCategory> = {
    live_news: 'impact',
    pe_ratios: 'valuation',
    dividend_yield: 'impact',
    technical_rsi: 'technical',
    fear_greed: 'movement',
  };

  const quizHistory: Map<string, string[]> = new Map();
  const MAX_HISTORY = 10;

  function addToHistory(sessionKey: string, quizId: string) {
    const history = quizHistory.get(sessionKey) || [];
    history.push(quizId);
    if (history.length > MAX_HISTORY) history.shift();
    quizHistory.set(sessionKey, history);
  }

  function isInHistory(sessionKey: string, quizId: string): boolean {
    const history = quizHistory.get(sessionKey) || [];
    return history.includes(quizId);
  }

  const sessionSourceIndex: Map<string, number> = new Map();

  function getNextDataSource(sessionKey: string): DataSource {
    const sources: DataSource[] = ['live_news', 'pe_ratios', 'dividend_yield', 'technical_rsi', 'fear_greed'];
    const current = sessionSourceIndex.get(sessionKey) ?? -1;
    const next = (current + 1) % sources.length;
    sessionSourceIndex.set(sessionKey, next);
    return sources[next];
  }

  function mapAnswerToIndex(correctAnswer: string): number {
    const answer = correctAnswer.toLowerCase().trim();
    const firstOptionTokens = [
      'overvalued', 'good news', 'overbought', 'upward',
      '고평가', '호재', '과매수', '상승',
      'good', 'positive', 'up', 'bullish',
    ];
    if (firstOptionTokens.some(token => answer.includes(token))) return 0;
    return 1;
  }

  function clampIndex(idx: number): 0 | 1 {
    return (idx === 0 || idx === 1) ? idx as 0 | 1 : 1;
  }

  async function fetchFearGreedScore(): Promise<{ score: number; rating: string } | null> {
    try {
      const response = await fetch("http://127.0.0.1:5001/fear-greed", { signal: AbortSignal.timeout(5000) });
      const data = await response.json();
      if (data.score != null) return { score: data.score, rating: data.rating || 'Neutral' };
    } catch {}
    return null;
  }

  function buildAIPrompt(
    source: DataSource,
    fundamentals: any,
    fundamentalsContext: string,
    isKorean: boolean,
    level: string,
    templateVariant: number,
    fgData?: { score: number; rating: string } | null,
  ): string {
    const cat = dataSourceToCategory[source];
    const opts = categoryOptions[cat];
    const optionLabels = isKorean ? opts.ko : opts.en;
    const levelLabel = level === 'advanced' ? 'advanced/professional' : level === 'intermediate' ? 'intermediate' : 'beginner-friendly';

    const categoryAnswerGuide: Record<QuizCategory, string> = {
      valuation: 'use "overvalued" or "undervalued"',
      impact: 'use "good news" or "bad news"',
      technical: 'use "overbought" or "oversold"',
      movement: 'use "upward" or "downward"',
    };

    let dataFocus = '';
    let templateHint = '';

    if (source === 'pe_ratios') {
      dataFocus = 'Focus on P/E ratio, forward P/E, and price multiples relative to sector averages and earnings growth.';
      const templates = [
        'Ask whether the stock appears overvalued or undervalued based on its P/E ratio vs historical average.',
        'Ask if the current price-to-earnings multiple is justified given the earnings growth trajectory.',
        'Create a scenario comparing this stock\'s valuation to its sector peers and ask for an assessment.',
      ];
      templateHint = templates[templateVariant % templates.length];
    } else if (source === 'dividend_yield') {
      dataFocus = 'Focus on dividend yield, payout sustainability, and dividend policy signals.';
      const templates = [
        'Ask whether a change in dividend yield signals positive or negative news for the company.',
        'Ask about the investment implications of the current dividend yield compared to sector averages.',
        'Create a scenario about dividend sustainability based on payout ratio and free cash flow, and ask for impact assessment.',
      ];
      templateHint = templates[templateVariant % templates.length];
    } else if (source === 'technical_rsi') {
      dataFocus = 'Focus on RSI levels, overbought/oversold conditions, and momentum indicators.';
      const templates = [
        'Ask whether the stock\'s current momentum indicators suggest it is overbought or oversold.',
        'Present a scenario with specific RSI readings and ask for a technical assessment.',
        'Ask about the implications of divergence between price action and technical indicators.',
      ];
      templateHint = templates[templateVariant % templates.length];
    } else if (source === 'fear_greed') {
      const fgContext = fgData ? `Fear & Greed Index: ${fgData.score}/100 (${fgData.rating})` : 'Fear & Greed Index: ~50 (Neutral)';
      dataFocus = `Focus on market sentiment. ${fgContext}. Relate sentiment to likely market direction.`;
      const templates = [
        'Ask about the likely near-term market direction based on the current Fear & Greed reading.',
        'Create a scenario linking investor sentiment levels to expected market behavior.',
        'Ask what the current sentiment extreme (or neutral) suggests about the market\'s next likely move.',
      ];
      templateHint = templates[templateVariant % templates.length];
    } else {
      dataFocus = 'Focus on a recent news event, earnings report, or macro announcement and its impact on the stock.';
      const templates = [
        'Ask whether a specific earnings or revenue data point is positive or negative for the stock.',
        'Present a macro event (interest rates, trade policy, regulation) and ask about its impact.',
        'Ask about the implications of a specific corporate action (buyback, M&A, expansion) on the stock.',
      ];
      templateHint = templates[templateVariant % templates.length];
    }

    const levelGuidance = level === 'beginner'
      ? 'Use simple language. Explain financial terms briefly. Focus on basic concepts like "earnings beat = good for stock".'
      : level === 'advanced'
      ? 'Use professional financial language. Include specific metrics and ratios. Expect the reader to understand DCF, multiples, and technical analysis.'
      : 'Use moderate financial language. Include metrics but provide enough context for learning.';

    if (isKorean) {
      return `${fundamentals.name} (${fundamentals.symbol})의 실시간 데이터를 기반으로 투자자 교육용 퀴즈 문제 1개를 만들어주세요.

현재 데이터: 주가 $${fundamentals.price.toFixed(2)}, 등락 ${fundamentals.changePercent.toFixed(2)}%, ${fundamentalsContext}

데이터 초점: ${dataFocus}
문제 패턴: ${templateHint}
난이도: ${levelLabel} - ${levelGuidance}

규칙:
- 단순한 "주가 올랐다/내렸다" 문제는 절대 금지
- headline과 explanation은 자연스럽고 전문적인 한국어로 작성
- 중요: category와 correctAnswer는 반드시 영어로 작성하세요
- category는 반드시 "${cat}"으로 설정
- correctAnswer는 반드시 ${categoryAnswerGuide[cat]}
- 이전 문제와 다른 새로운 관점의 질문을 만들어주세요

JSON 형식으로 정확히 반환:
{"headline": "한국어 질문 내용", "category": "${cat}", "correctAnswer": "${categoryAnswerGuide[cat]}", "explanation": "한국어 2-3문장의 전문적인 해설"}`;
    }

    return `Create 1 professional investment quiz question based on real data for ${fundamentals.name} (${fundamentals.symbol}).

Current data: Price $${fundamentals.price.toFixed(2)}, Change ${fundamentals.changePercent.toFixed(2)}%, ${fundamentalsContext}

Data focus: ${dataFocus}
Question pattern: ${templateHint}
Difficulty: ${levelLabel} - ${levelGuidance}

Rules:
- NEVER create simple "stock went up/down" questions
- category MUST be "${cat}"
- correctAnswer MUST ${categoryAnswerGuide[cat]}
- Create a unique question that differs from previous ones

Return EXACTLY this JSON:
{"headline": "question text", "category": "${cat}", "correctAnswer": "answer matching category", "explanation": "2-3 sentence professional explanation"}`;
  }

  // Level-aware fallback quizzes organized by data source
  interface FallbackQuiz {
    id: string;
    headline: string;
    symbol: string;
    companyName: string;
    category: QuizCategory;
    correctAnswerIndex: 0 | 1;
    explanation: string;
    source: DataSource;
    level: 'beginner' | 'advanced';
  }

  const fallbackQuizzesEn: FallbackQuiz[] = [
    { id: "fb1", source: "live_news", level: "beginner", symbol: "AAPL", companyName: "Apple Inc.", category: "impact", correctAnswerIndex: 0, headline: "Apple reports quarterly revenue of $94 billion, beating analyst expectations of $89 billion. Is this earnings surprise positive or negative for the stock?", explanation: "Beating revenue expectations by $5B shows strong demand for Apple products. This typically leads to institutional buying and share price increases." },
    { id: "fb2", source: "live_news", level: "beginner", symbol: "TSLA", companyName: "Tesla, Inc.", category: "impact", correctAnswerIndex: 1, headline: "An EV manufacturer faces a major recall affecting 500,000 vehicles due to a software defect. How does this news impact investor sentiment?", explanation: "Large-scale recalls damage brand reputation, increase costs, and create uncertainty. This is typically bad news that pressures the stock price downward." },
    { id: "fb3", source: "live_news", level: "advanced", symbol: "QQQ", companyName: "Invesco QQQ Trust", category: "impact", correctAnswerIndex: 0, headline: "The Federal Reserve signals two additional rate cuts this quarter while inflation remains below target. How does this typically impact growth stocks with high forward P/E ratios?", explanation: "Rate cuts lower the discount rate in DCF models, increasing the present value of future cash flows. Growth stocks with earnings weighted toward the future benefit disproportionately from monetary easing." },
    { id: "fb4", source: "live_news", level: "advanced", symbol: "SPY", companyName: "S&P 500 ETF", category: "impact", correctAnswerIndex: 1, headline: "10-year Treasury yields spike to 5.2% while the yield curve remains inverted. Corporate bond spreads have widened 80bps. How does this impact equity markets?", explanation: "Rising yields increase the risk-free rate, making equities relatively less attractive. An inverted yield curve historically predicts recessions, and widening credit spreads signal increasing default risk." },

    { id: "fb5", source: "pe_ratios", level: "beginner", symbol: "NVDA", companyName: "NVIDIA Corp", category: "valuation", correctAnswerIndex: 0, headline: "A semiconductor company trades at a P/E of 65x while the industry average is 25x and its earnings growth is slowing from 40% to 15%. Is this stock overvalued or undervalued?",  explanation: "A P/E of 65x is 2.6 times the industry average. When the high multiple isn't supported by proportionally high growth, the stock is considered overvalued with elevated downside risk." },
    { id: "fb6", source: "pe_ratios", level: "beginner", symbol: "META", companyName: "Meta Platforms", category: "valuation", correctAnswerIndex: 1, headline: "A social media company has a P/E of 18x, well below its 5-year average of 24x, while revenue growth has accelerated to 20%. Is the stock overvalued or undervalued?", explanation: "Trading below historical P/E while growth is accelerating suggests the market hasn't fully priced in the improvement. This combination typically indicates the stock is undervalued." },
    { id: "fb7", source: "pe_ratios", level: "advanced", symbol: "GOOGL", companyName: "Alphabet Inc.", category: "valuation", correctAnswerIndex: 1, headline: "An advertising giant trades at 22x forward earnings with a PEG ratio of 0.9x. Free cash flow yield is 5.2%, above the S&P 500 average of 3.8%. What does this valuation suggest?", explanation: "A PEG ratio below 1.0 indicates the stock is undervalued relative to its growth rate. The superior FCF yield further confirms attractive valuation, suggesting the market is underpricing this company's fundamentals." },
    { id: "fb8", source: "pe_ratios", level: "advanced", symbol: "NVDA", companyName: "NVIDIA Corp", category: "valuation", correctAnswerIndex: 0, headline: "A chip maker's EV/EBITDA multiple has expanded to 55x, 3 standard deviations above its 10-year mean of 28x. Forward earnings estimates have been revised down 8% in the past quarter. How should this be assessed?", explanation: "An EV/EBITDA multiple 3 standard deviations above the mean combined with negative earnings revisions is a strong overvaluation signal. Mean reversion in multiples could lead to significant price corrections." },

    { id: "fb9", source: "dividend_yield", level: "beginner", symbol: "AAPL", companyName: "Apple Inc.", category: "impact", correctAnswerIndex: 0, headline: "A major tech company increases its quarterly dividend by 10% and announces a $90 billion share buyback program. Is this positive or negative for investors?", explanation: "Dividend increases and large buyback programs signal management confidence in future cash flows. This returns capital to shareholders and supports the stock price, which is clearly positive news." },
    { id: "fb10", source: "dividend_yield", level: "beginner", symbol: "AMZN", companyName: "Amazon.com Inc.", category: "impact", correctAnswerIndex: 1, headline: "A company with a 4% dividend yield suddenly cuts its dividend by 50% citing cash flow concerns. The payout ratio had reached 95%. How should investors view this?", explanation: "A dividend cut signals financial stress and typically causes sharp selling. A 95% payout ratio was unsustainable, and the cut confirms management is concerned about maintaining financial flexibility." },
    { id: "fb11", source: "dividend_yield", level: "advanced", symbol: "MSFT", companyName: "Microsoft Corp", category: "impact", correctAnswerIndex: 0, headline: "A software company's dividend yield has dropped to 0.7% from 1.2% last year, but this is entirely driven by a 70% share price appreciation rather than a dividend cut. What does this signal?", explanation: "When dividend yield falls because the stock price rises sharply, it indicates strong capital appreciation. The company is still paying dividends; the lower yield reflects investor enthusiasm and price momentum, which is positive." },
    { id: "fb12", source: "dividend_yield", level: "advanced", symbol: "SPY", companyName: "S&P 500 ETF", category: "impact", correctAnswerIndex: 1, headline: "A utility company's dividend yield has risen to 6.5%, double the sector average of 3.2%. The stock has fallen 30% in 6 months while debt-to-equity has climbed to 2.8x. Is this an opportunity or a warning?", explanation: "An abnormally high dividend yield from price decline (not dividend increase) combined with rising leverage is a distress signal. The market is pricing in potential dividend cuts or financial instability." },

    { id: "fb13", source: "technical_rsi", level: "beginner", symbol: "TSLA", companyName: "Tesla, Inc.", category: "technical", correctAnswerIndex: 0, headline: "A stock's RSI (Relative Strength Index) has reached 82. RSI above 70 is generally considered a warning level. Is this stock overbought or oversold?", explanation: "An RSI of 82 is well above the 70 overbought threshold. This means the stock has risen rapidly and may be due for a pullback as buying momentum could be exhausted." },
    { id: "fb14", source: "technical_rsi", level: "beginner", symbol: "AMZN", companyName: "Amazon.com Inc.", category: "technical", correctAnswerIndex: 1, headline: "After a market sell-off, a stock's RSI has dropped to 22. RSI below 30 typically indicates an extreme condition. Is this stock overbought or oversold?", explanation: "An RSI of 22 is significantly below the 30 oversold threshold. This suggests the stock has been sold off heavily and may be due for a bounce as selling pressure becomes exhausted." },
    { id: "fb15", source: "technical_rsi", level: "advanced", symbol: "MSFT", companyName: "Microsoft Corp", category: "technical", correctAnswerIndex: 0, headline: "A large-cap stock shows RSI divergence: price made a new 52-week high but RSI peaked at 68, below its previous peak of 78. MACD histogram is also declining. What does this indicate?", explanation: "Bearish RSI divergence (price up, RSI lower high) combined with declining MACD signals weakening momentum despite new price highs. This classic technical pattern suggests the stock may be overbought and vulnerable to reversal." },
    { id: "fb16", source: "technical_rsi", level: "advanced", symbol: "GOOGL", companyName: "Alphabet Inc.", category: "technical", correctAnswerIndex: 1, headline: "A stock has RSI at 25 with bullish divergence (price at new lows but RSI showing higher lows). Volume on down days is declining while accumulation/distribution line is rising. Assessment?", explanation: "Bullish RSI divergence combined with declining selling volume and rising accumulation signals smart money is quietly buying. This oversold condition with positive divergence often precedes significant reversals." },

    { id: "fb17", source: "fear_greed", level: "beginner", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 0, headline: "The CNN Fear & Greed Index reads 78 ('Greed'). When investors are this greedy, market momentum is typically strong. Which direction is the market likely trending?", explanation: "A greed reading of 78 reflects strong bullish sentiment and buying pressure. While extreme greed can signal a potential reversal, the current momentum usually pushes markets upward in the near term." },
    { id: "fb18", source: "fear_greed", level: "beginner", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 1, headline: "The Fear & Greed Index has plunged to 15 ('Extreme Fear'). When investor panic reaches these levels, what direction does selling pressure typically push the market?", explanation: "Extreme fear at 15 means investors are panic-selling. This intense selling pressure pushes markets downward. However, contrarian investors note that extreme fear often marks bottoms." },
    { id: "fb19", source: "fear_greed", level: "advanced", symbol: "QQQ", companyName: "Invesco QQQ Trust", category: "movement", correctAnswerIndex: 0, headline: "The Fear & Greed Index shifted from 'Extreme Fear' (12) to 'Fear' (35) over 2 weeks, while put/call ratio declined from 1.4 to 0.9 and VIX dropped from 35 to 22. What direction does this improving sentiment suggest?", explanation: "Rapid sentiment improvement from extreme fear, declining put/call ratios, and falling VIX all indicate a fear washout has occurred. This pattern of recovering sentiment with confirming technical signals typically precedes sustained upward moves." },
    { id: "fb20", source: "fear_greed", level: "advanced", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 1, headline: "The Fear & Greed Index hit 92 ('Extreme Greed') while margin debt reaches all-time highs and IPO activity surges. Market breadth shows only 40% of S&P stocks above their 200-day MA despite index highs. Expected direction?", explanation: "Extreme greed (92) combined with record margin debt, IPO euphoria, and deteriorating breadth (narrow rally) is a classic late-cycle topping pattern. This combination of sentiment excess and weakening internals suggests the market is likely to reverse downward." },
  ];

  const fallbackQuizzesKo: FallbackQuiz[] = [
    { id: "fb1", source: "live_news", level: "beginner", symbol: "AAPL", companyName: "Apple Inc.", category: "impact", correctAnswerIndex: 0, headline: "애플이 분기 매출 $940억을 기록하며 월가 예상치 $890억을 크게 상회했습니다. 이 어닝 서프라이즈는 주가에 긍정적일까요, 부정적일까요?", explanation: "매출 예상치를 $50억이나 초과 달성한 것은 애플 제품에 대한 강한 수요를 보여줍니다. 이는 기관 매수세를 유입시키고 주가 상승으로 이어지는 경우가 많습니다." },
    { id: "fb2", source: "live_news", level: "beginner", symbol: "TSLA", companyName: "Tesla, Inc.", category: "impact", correctAnswerIndex: 1, headline: "한 EV 제조사가 소프트웨어 결함으로 50만 대 규모의 대형 리콜을 발표했습니다. 이 뉴스는 투자자 심리에 어떤 영향을 미칠까요?", explanation: "대규모 리콜은 브랜드 평판을 손상시키고, 비용을 증가시키며, 불확실성을 만듭니다. 이는 전형적으로 주가에 부담을 주는 악재입니다." },
    { id: "fb3", source: "live_news", level: "advanced", symbol: "QQQ", companyName: "Invesco QQQ Trust", category: "impact", correctAnswerIndex: 0, headline: "연준이 이번 분기 2차례 추가 금리 인하를 시사하고, 인플레이션은 목표치를 하회하고 있습니다. 높은 Forward PER을 가진 성장주에 이는 어떤 영향을 미칠까요?", explanation: "금리 인하는 DCF 모델의 할인율을 낮춰 미래 현금흐름의 현재 가치를 높입니다. 미래 이익 비중이 큰 성장주는 통화 완화의 수혜를 가장 크게 받습니다." },
    { id: "fb4", source: "live_news", level: "advanced", symbol: "SPY", companyName: "S&P 500 ETF", category: "impact", correctAnswerIndex: 1, headline: "10년 국채 수익률이 5.2%로 급등하고 수익률 곡선 역전이 지속 중입니다. 회사채 스프레드는 80bp 확대되었습니다. 이는 주식 시장에 어떤 영향을 미칠까요?", explanation: "금리 상승은 무위험 수익률을 높여 주식의 상대적 매력을 떨어뜨립니다. 수익률 곡선 역전은 역사적으로 경기 침체를 예고하며, 스프레드 확대는 위험 회피 심리를 나타냅니다." },

    { id: "fb5", source: "pe_ratios", level: "beginner", symbol: "NVDA", companyName: "NVIDIA Corp", category: "valuation", correctAnswerIndex: 0, headline: "한 반도체 기업의 PER이 65배로 업종 평균 25배의 2.6배에 달하며, 이익 성장률은 40%에서 15%로 둔화되고 있습니다. 이 종목은 고평가일까요, 저평가일까요?", explanation: "PER 65배는 업종 평균의 2.6배입니다. 높은 멀티플에 비례하는 성장이 뒷받침되지 않으면 밸류에이션 리스크가 커지며 고평가로 판단됩니다." },
    { id: "fb6", source: "pe_ratios", level: "beginner", symbol: "META", companyName: "Meta Platforms", category: "valuation", correctAnswerIndex: 1, headline: "한 소셜미디어 기업의 PER이 18배로 5년 평균 24배보다 낮은 반면, 매출 성장률은 20%로 가속화되고 있습니다. 이 종목은 고평가일까요, 저평가일까요?", explanation: "역사적 PER보다 낮은 수준에서 성장이 가속화된다면 시장이 아직 개선을 충분히 반영하지 못한 것입니다. 이는 전형적으로 저평가 신호입니다." },
    { id: "fb7", source: "pe_ratios", level: "advanced", symbol: "GOOGL", companyName: "Alphabet Inc.", category: "valuation", correctAnswerIndex: 1, headline: "한 광고 대기업의 Forward PER이 22배, PEG 비율은 0.9배입니다. FCF 수익률은 5.2%로 S&P 500 평균 3.8%를 상회합니다. 이 밸류에이션은 어떤 수준일까요?", explanation: "PEG 비율 1.0 미만은 성장률 대비 저평가를 의미합니다. 우수한 FCF 수익률도 매력적인 밸류에이션을 확인해주며, 시장이 이 기업의 펀더멘털을 할인하고 있음을 시사합니다." },
    { id: "fb8", source: "pe_ratios", level: "advanced", symbol: "NVDA", companyName: "NVIDIA Corp", category: "valuation", correctAnswerIndex: 0, headline: "한 칩 제조사의 EV/EBITDA 배수가 55배로 10년 평균 28배의 3 표준편차 위입니다. 분기 실적 전망치도 8% 하향 조정되었습니다. 어떻게 평가해야 할까요?", explanation: "EV/EBITDA가 10년 평균의 3 표준편차 위이고 실적 전망까지 하향된 것은 강력한 고평가 신호입니다. 멀티플의 평균 회귀가 진행되면 상당한 가격 조정이 발생할 수 있습니다." },

    { id: "fb9", source: "dividend_yield", level: "beginner", symbol: "AAPL", companyName: "Apple Inc.", category: "impact", correctAnswerIndex: 0, headline: "한 대형 테크 기업이 분기 배당금을 10% 인상하고 $900억 규모의 자사주 매입 프로그램을 발표했습니다. 이는 투자자에게 긍정적일까요, 부정적일까요?", explanation: "배당 인상과 대규모 자사주 매입은 경영진의 미래 현금흐름에 대한 자신감을 의미합니다. 주주에게 자본을 환원하고 주가를 지지하는 확실한 호재입니다." },
    { id: "fb10", source: "dividend_yield", level: "beginner", symbol: "AMZN", companyName: "Amazon.com Inc.", category: "impact", correctAnswerIndex: 1, headline: "배당 수익률 4%의 기업이 현금흐름 우려를 이유로 배당금을 50% 삭감했습니다. 배당성향은 95%에 달했습니다. 투자자는 이를 어떻게 봐야 할까요?", explanation: "배당금 삭감은 재무적 압박을 의미하며 급격한 매도를 유발합니다. 배당성향 95%는 지속 불가능한 수준이었고, 삭감은 경영진의 재무 유연성 우려를 확인합니다." },
    { id: "fb11", source: "dividend_yield", level: "advanced", symbol: "MSFT", companyName: "Microsoft Corp", category: "impact", correctAnswerIndex: 0, headline: "한 소프트웨어 기업의 배당 수익률이 작년 1.2%에서 0.7%로 하락했지만, 이는 배당 삭감이 아닌 주가 70% 상승에 의한 것입니다. 이 신호는 무엇을 의미할까요?", explanation: "주가 급등으로 배당 수익률이 하락한 것은 강한 자본 이득을 나타냅니다. 배당금은 유지되고 있으며, 낮아진 수익률은 투자자들의 열광과 가격 모멘텀을 반영하는 긍정적 신호입니다." },
    { id: "fb12", source: "dividend_yield", level: "advanced", symbol: "SPY", companyName: "S&P 500 ETF", category: "impact", correctAnswerIndex: 1, headline: "한 유틸리티 기업의 배당 수익률이 6.5%로 섹터 평균 3.2%의 2배에 달합니다. 6개월간 주가는 30% 하락했고 부채비율은 2.8배로 상승했습니다. 이는 기회일까요 경고일까요?", explanation: "배당 인상이 아닌 주가 하락에 의한 비정상적 고배당 수익률과 레버리지 상승은 위험 신호입니다. 시장은 배당 삭감이나 재무 불안정성을 가격에 반영하고 있습니다." },

    { id: "fb13", source: "technical_rsi", level: "beginner", symbol: "TSLA", companyName: "Tesla, Inc.", category: "technical", correctAnswerIndex: 0, headline: "한 종목의 RSI(상대강도지수)가 82에 도달했습니다. 일반적으로 RSI 70 이상은 경고 수준으로 간주됩니다. 이 종목은 과매수일까요, 과매도일까요?", explanation: "RSI 82는 과매수 임계값 70을 크게 상회합니다. 주가가 급격히 상승했으며, 매수 모멘텀이 소진되면서 단기 조정이 올 수 있음을 의미합니다." },
    { id: "fb14", source: "technical_rsi", level: "beginner", symbol: "AMZN", companyName: "Amazon.com Inc.", category: "technical", correctAnswerIndex: 1, headline: "시장 급락 후 한 종목의 RSI가 22까지 하락했습니다. RSI 30 미만은 일반적으로 극단적인 상태를 나타냅니다. 이 종목은 과매수일까요, 과매도일까요?", explanation: "RSI 22는 과매도 임계값 30을 크게 하회합니다. 급격한 매도세를 겪었으며, 매도 압력이 소진되면서 반등할 가능성이 있음을 시사합니다." },
    { id: "fb15", source: "technical_rsi", level: "advanced", symbol: "MSFT", companyName: "Microsoft Corp", category: "technical", correctAnswerIndex: 0, headline: "대형주가 RSI 다이버전스를 보이고 있습니다: 주가는 52주 신고가를 기록했지만 RSI는 68로 이전 고점 78에 미치지 못합니다. MACD 히스토그램도 하락 중입니다. 이는 무엇을 의미할까요?", explanation: "약세 RSI 다이버전스(주가 상승, RSI 더 낮은 고점)와 MACD 하락은 신고가에도 불구하고 모멘텀이 약화되고 있음을 의미합니다. 이는 과매수 상태에서 반전 가능성이 있는 전형적인 기술적 패턴입니다." },
    { id: "fb16", source: "technical_rsi", level: "advanced", symbol: "GOOGL", companyName: "Alphabet Inc.", category: "technical", correctAnswerIndex: 1, headline: "한 종목의 RSI가 25이며 강세 다이버전스(주가는 신저가이나 RSI는 상승)를 보이고 있습니다. 하락일의 거래량은 감소하고 매집/분배 라인은 상승 중입니다. 평가는?", explanation: "강세 RSI 다이버전스와 매도 거래량 감소, 매집 라인 상승은 스마트 머니의 조용한 매수를 의미합니다. 긍정적 다이버전스가 있는 과매도 상태는 의미 있는 반전의 전조인 경우가 많습니다." },

    { id: "fb17", source: "fear_greed", level: "beginner", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 0, headline: "CNN 공포·탐욕 지수가 78('탐욕')을 기록하고 있습니다. 투자자들의 탐욕이 이 수준일 때, 시장은 어느 방향으로 움직이는 경향이 있을까요?", explanation: "탐욕 78은 강한 강세 심리와 매수 압력을 반영합니다. 극단적 탐욕은 반전 신호가 될 수 있지만, 현재의 모멘텀은 보통 단기적으로 시장을 상승 방향으로 밀어올립니다." },
    { id: "fb18", source: "fear_greed", level: "beginner", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 1, headline: "공포·탐욕 지수가 15('극단적 공포')까지 급락했습니다. 투자자 공포가 이 수준에 도달하면, 매도 압력은 시장을 어느 방향으로 밀어갈까요?", explanation: "극단적 공포 15는 투자자들이 패닉 매도 중임을 의미합니다. 이 강렬한 매도 압력은 시장을 하락 방향으로 밀어갑니다. 다만 역발상 투자자들은 극단적 공포가 종종 바닥을 표시한다고 봅니다." },
    { id: "fb19", source: "fear_greed", level: "advanced", symbol: "QQQ", companyName: "Invesco QQQ Trust", category: "movement", correctAnswerIndex: 0, headline: "공포·탐욕 지수가 2주간 '극단적 공포'(12)에서 '공포'(35)로 회복되고, 풋/콜 비율은 1.4에서 0.9로 하락, VIX는 35에서 22로 떨어졌습니다. 이 심리 개선은 어느 방향을 시사할까요?", explanation: "극단적 공포에서 빠르게 회복하고, 풋/콜 비율과 VIX가 동반 하락하는 것은 공포 세척이 완료되었음을 나타냅니다. 기술적 확인 신호와 함께 심리가 회복되는 이 패턴은 지속적 상승의 전조입니다." },
    { id: "fb20", source: "fear_greed", level: "advanced", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 1, headline: "공포·탐욕 지수가 92('극단적 탐욕')를 기록하며 신용 매수 잔고가 사상 최고치를 경신하고 IPO가 급증하고 있습니다. 반면 S&P 종목 중 200일 이동평균 위의 비율은 40%에 불과합니다. 예상되는 시장 방향은?", explanation: "극단적 탐욕(92)에 기록적 레버리지, IPO 열풍, 시장 너비 악화(좁은 랠리)가 결합된 것은 전형적인 후기 사이클 천장 패턴입니다. 이 과도한 심리와 내부 약화의 조합은 하락 반전 가능성을 시사합니다." },
  ];

  app.get("/api/news/quiz", async (req, res) => {
    const lang = (req.query.lang as string) || "en";
    const isKorean = lang === "ko";
    const level = (req.query.level as string) || "beginner";
    const sessionKey = `${req.ip || 'default'}-${lang}`;
    const dataSource = getNextDataSource(sessionKey);
    const category = dataSourceToCategory[dataSource];
    const templateVariant = Math.floor(Math.random() * 3);

    try {
      const symbols = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'META'];
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
      const fundamentals = await getStockFundamentals(randomSymbol);

      let fgData: { score: number; rating: string } | null = null;
      if (dataSource === 'fear_greed') {
        fgData = await fetchFearGreedScore();
      }

      if (fundamentals && fundamentals.price > 0) {
        const peStr = fundamentals.peRatio ? `P/E Ratio: ${fundamentals.peRatio.toFixed(1)}` : '';
        const divStr = fundamentals.dividendYield ? `Dividend Yield: ${(fundamentals.dividendYield * 100).toFixed(2)}%` : '';
        const capStr = fundamentals.marketCap ? `Market Cap: $${(fundamentals.marketCap / 1e9).toFixed(0)}B` : '';
        const betaStr = fundamentals.beta ? `Beta: ${fundamentals.beta.toFixed(2)}` : '';
        const epsStr = fundamentals.eps ? `EPS: $${fundamentals.eps.toFixed(2)}` : '';
        const highStr = fundamentals.fiftyTwoWeekHigh ? `52W High: $${fundamentals.fiftyTwoWeekHigh.toFixed(2)}` : '';
        const lowStr = fundamentals.fiftyTwoWeekLow ? `52W Low: $${fundamentals.fiftyTwoWeekLow.toFixed(2)}` : '';
        const sectorStr = fundamentals.sector || '';
        const fgStr = fgData ? `Fear & Greed Index: ${fgData.score}/100 (${fgData.rating})` : '';
        const fundamentalsContext = [peStr, divStr, capStr, betaStr, epsStr, highStr, lowStr, sectorStr, fgStr].filter(Boolean).join(', ');

        const prompt = buildAIPrompt(dataSource, fundamentals, fundamentalsContext, isKorean, level, templateVariant, fgData);

        const aiResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.9,
          max_tokens: 500,
          response_format: { type: "json_object" },
        });

        const content = aiResponse.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed.headline && parsed.correctAnswer && parsed.explanation) {
            const aiCategory = (['valuation', 'impact', 'technical', 'movement'].includes(parsed.category))
              ? parsed.category as QuizCategory
              : category;
            const opts = categoryOptions[aiCategory];
            const correctIdx = clampIndex(mapAnswerToIndex(parsed.correctAnswer));
            const quizId = `ai-${dataSource}-${Date.now()}`;

            addToHistory(sessionKey, quizId);

            return res.json({
              id: quizId,
              headline: parsed.headline,
              symbol: fundamentals.symbol,
              companyName: fundamentals.name,
              category: aiCategory,
              options: isKorean ? opts.ko : opts.en,
              correctAnswerIndex: correctIdx,
              explanation: parsed.explanation,
              isRealTime: true,
              source: dataSource,
            });
          }
        }
      }
    } catch (error) {
      console.error("[Quiz] AI quiz generation failed:", error);
    }

    const fallbacks = isKorean ? fallbackQuizzesKo : fallbackQuizzesEn;
    const levelFiltered = fallbacks.filter(q =>
      (level === 'advanced' || level === 'intermediate') ? q.level === 'advanced' : q.level === 'beginner'
    );
    const sourceFiltered = levelFiltered.filter(q => q.source === dataSource);
    let candidates = sourceFiltered.filter(q => !isInHistory(sessionKey, q.id));
    if (candidates.length === 0) candidates = levelFiltered.filter(q => !isInHistory(sessionKey, q.id));
    if (candidates.length === 0) candidates = fallbacks;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const opts = categoryOptions[chosen.category];

    addToHistory(sessionKey, chosen.id);

    res.json({
      ...chosen,
      options: isKorean ? opts.ko : opts.en,
      isRealTime: false,
      source: chosen.source,
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
