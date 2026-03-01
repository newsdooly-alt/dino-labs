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
import { getEventsByMonth } from "./economicCalendarData";
import { SUPER_INVESTORS, getSuperInvestorById } from "./superInvestorData";
import { calculateLevel, xpForNextLevel } from "@shared/leveling";

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

    // Super Investor Portfolios
    app.get("/api/super-investors", isAuthenticated, (_req, res) => {
      res.json(SUPER_INVESTORS);
    });

    app.get("/api/super-investors/:id", isAuthenticated, (req, res) => {
      const investor = getSuperInvestorById(req.params.id);
      if (!investor) {
        return res.status(404).json({ message: "Investor not found" });
      }
      res.json(investor);
    });

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

  // Update profile settings (nickname, themeColor)
  app.patch("/api/profiles/settings", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const settingsSchema = z.object({
      nickname: z.string().min(1).max(30).optional(),
      themeColor: z.enum(["green", "blue", "pink"]).optional(),
    });
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid settings", errors: parsed.error.issues });
    }
    const updates: { nickname?: string; themeColor?: string } = {};
    if (parsed.data.nickname !== undefined) updates.nickname = parsed.data.nickname;
    if (parsed.data.themeColor !== undefined) updates.themeColor = parsed.data.themeColor;
    
    const profile = await storage.updateProfileSettings(userId, updates);
    res.json(profile);
  });

  // Leaderboard
  app.get("/api/leaderboard", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    const profiles = await storage.getLeaderboard(50);
    
    const leaderboard = profiles.map((p, idx) => ({
      id: p.id,
      nickname: p.nickname || "Player",
      totalXp: p.totalXp,
      level: calculateLevel(p.totalXp),
      streak: p.streak,
      isMe: p.id === userId,
    }));
    
    res.json(leaderboard);
  });

  // Level info endpoint
  app.get("/api/profiles/level-info", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    const profile = await storage.getUserProfile(userId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    
    const level = calculateLevel(profile.totalXp);
    const xpForCurrent = xpForNextLevel(level);
    
    let xpAccumulated = 0;
    for (let l = 1; l < level; l++) {
      xpAccumulated += Math.floor(100 * Math.pow(l, 1.2));
    }
    const xpInCurrentLevel = profile.totalXp - xpAccumulated;
    
    res.json({
      level,
      totalXp: profile.totalXp,
      xpInCurrentLevel,
      xpForNextLevel: xpForCurrent,
      streak: profile.streak,
    });
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
      
      const results = searchResults.map(r => ({
        id: 0,
        symbol: r.symbol,
        name: r.name,
        sector: r.type,
        lastPrice: null,
        changePercent: null,
        updatedAt: null,
        region: r.region || 'United States',
        currency: (r as any).currency || 'USD',
        isKorean: (r as any).isKorean || false,
        market: (r as any).market || null,
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
    
    res.json(quests);
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
            const newTotalXp = profile.totalXp + quest.xpReward;
            const newLevel = calculateLevel(newTotalXp);
            const newStreak = profile.streak + (profile.lastDailyQuestAt ? 0 : 1);
            
            await storage.updateUserStats(userId, newStreak, newXp, newLevel, profile.hearts, quest.xpReward);
            
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
      const enriched = await Promise.all(watchlist.map(async (item) => {
        const stock = await storage.getStockBySymbol(item.symbol);
        return { ...item, stockName: stock?.name || item.symbol };
      }));
      res.json(enriched);
  });

  app.post(api.watchlist.add.path, isAuthenticated, async (req, res) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      try {
          const body = req.body as { symbol: string; name?: string };
          const input = api.watchlist.add.input.parse(body);
          const clientName = body.name;
          // Ensure stock exists in stocks table first (fetch quote to fill it)
          let stock = await storage.getStockBySymbol(input.symbol);
          if (!stock) {
               // Try to fetch it to create it using yfinance service
               try {
                   const quote = await getStockQuote(input.symbol);
                   stock = await storage.createStock({
                       symbol: input.symbol,
                       name: clientName || quote.name || input.symbol,
                       sector: "Unknown",
                       lastPrice: (quote.price || 0).toString(),
                       changePercent: (quote.changePercent || 0).toString()
                   });
               } catch (e) {
                   // Create dummy if fetch fails
                   stock = await storage.createStock({
                       symbol: input.symbol,
                       name: clientName || input.symbol,
                       sector: "Unknown",
                       lastPrice: "0",
                       changePercent: "0"
                   });
               }
          } else if (clientName && stock.name !== clientName) {
              // Update the stored name if client provided a better one (e.g., Korean name)
              await storage.updateStockName(input.symbol, clientName);
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
  
  app.get("/api/stocks/recommended", async (req, res) => {
    try {
      const pythonRes = await fetch("http://127.0.0.1:5001/recommended");
      if (!pythonRes.ok) throw new Error("Python service error");
      const data = await pythonRes.json();
      res.json(data);
    } catch (error: any) {
      console.error("[Recommended] Error:", error.message);
      res.status(500).json({ error: error.message, recommended: [] });
    }
  });

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

  // === Global Macro Dashboard ===
  const MACRO_SYMBOLS = [
    "ES=F", "NQ=F", "YM=F", "^N225",
    "GC=F", "CL=F", "HG=F",
    "DX-Y.NYB", "USDKRW=X",
    "^TNX", "^IRX",
    "^VIX", "BTC-USD"
  ];

  const MACRO_PYTHON_URL = 'http://localhost:5001';

  app.get("/api/macro/dashboard", async (req, res) => {
    try {
      const symbolsStr = MACRO_SYMBOLS.join(',');

      // Use dedicated macro/quotes endpoint (bypasses health check, has its own cache)
      const [quotesResult, sparklineResult] = await Promise.allSettled([
        fetch(`${MACRO_PYTHON_URL}/macro/quotes?symbols=${symbolsStr}`, {
          signal: AbortSignal.timeout(25000)
        }).then(r => r.ok ? r.json() : { quotes: [] }).catch(() => ({ quotes: [] })),
        fetch(`${MACRO_PYTHON_URL}/macro/sparklines?symbols=${symbolsStr}`, {
          signal: AbortSignal.timeout(20000)
        }).then(r => r.ok ? r.json() : { sparklines: {} }).catch(() => ({ sparklines: {} }))
      ]);

      const rawQuotes: any[] = quotesResult.status === 'fulfilled'
        ? (quotesResult.value?.quotes || [])
        : [];

      const sparklines: Record<string, number[]> = 
        (sparklineResult.status === 'fulfilled' ? sparklineResult.value?.sparklines : {}) || {};

      const quoteMap: Record<string, any> = {};
      for (const q of rawQuotes) {
        quoteMap[q.symbol] = q;
      }

      console.log(`[Macro Dashboard] Got ${rawQuotes.length} quotes, symbols with price: ${rawQuotes.filter((q: any) => q.price > 0).map((q: any) => q.symbol).join(', ')}`);

      const tnxQuote = quoteMap['^TNX'];
      const vixQuote = quoteMap['^VIX'];

      const correlationSignals: Record<string, { label: string; direction: 'pressure' | 'support' | 'fear' | 'neutral' }[]> = {};

      if (tnxQuote && tnxQuote.changePercent > 0.5) {
        correlationSignals['NQ=F'] = correlationSignals['NQ=F'] || [];
        correlationSignals['NQ=F'].push({ label: 'Yield Rising', direction: 'pressure' });
        correlationSignals['ES=F'] = correlationSignals['ES=F'] || [];
        correlationSignals['ES=F'].push({ label: 'Yield Rising', direction: 'pressure' });
      } else if (tnxQuote && tnxQuote.changePercent < -0.5) {
        correlationSignals['NQ=F'] = correlationSignals['NQ=F'] || [];
        correlationSignals['NQ=F'].push({ label: 'Yield Falling', direction: 'support' });
        correlationSignals['ES=F'] = correlationSignals['ES=F'] || [];
        correlationSignals['ES=F'].push({ label: 'Yield Falling', direction: 'support' });
      }

      if (vixQuote && vixQuote.price > 25) {
        correlationSignals['ES=F'] = correlationSignals['ES=F'] || [];
        correlationSignals['ES=F'].push({ label: 'High Fear', direction: 'fear' });
        correlationSignals['NQ=F'] = correlationSignals['NQ=F'] || [];
        correlationSignals['NQ=F'].push({ label: 'High Fear', direction: 'fear' });
      }

      const dxQuote = quoteMap['DX-Y.NYB'];
      if (dxQuote && dxQuote.changePercent > 0.4) {
        correlationSignals['GC=F'] = correlationSignals['GC=F'] || [];
        correlationSignals['GC=F'].push({ label: 'Strong Dollar', direction: 'pressure' });
      }

      const clQuote = quoteMap['CL=F'];
      if (clQuote && clQuote.changePercent > 2) {
        correlationSignals['ES=F'] = correlationSignals['ES=F'] || [];
        correlationSignals['ES=F'].push({ label: 'Oil Spike', direction: 'pressure' });
      }

      const categories = [
        {
          id: 'futures',
          label: 'Equity Futures',
          labelKo: '주식 선물',
          symbols: ['ES=F', 'NQ=F', 'YM=F', '^N225'],
          icon: 'trending-up',
        },
        {
          id: 'commodities',
          label: 'Commodities',
          labelKo: '원자재',
          symbols: ['GC=F', 'CL=F', 'HG=F'],
          icon: 'package',
        },
        {
          id: 'forex',
          label: 'Forex',
          labelKo: '외환',
          symbols: ['DX-Y.NYB', 'USDKRW=X'],
          icon: 'dollar-sign',
        },
        {
          id: 'bonds',
          label: 'Bonds & Rates',
          labelKo: '채권 & 금리',
          symbols: ['^TNX', '^IRX'],
          icon: 'percent',
          invertedSignal: true,
        },
        {
          id: 'sentiment',
          label: 'Sentiment & Crypto',
          labelKo: '심리 & 크립토',
          symbols: ['^VIX', 'BTC-USD'],
          icon: 'activity',
          invertedSignal: true,
        },
      ];

      const assets = MACRO_SYMBOLS.map(symbol => {
        const q = quoteMap[symbol] || {
          symbol,
          name: symbol,
          price: 0,
          change: 0,
          changePercent: 0,
          isMarketOpen: false,
          lastUpdated: new Date().toISOString(),
          isStale: true,
        };
        if (!q.price || q.price === 0) {
          console.warn(`[Macro Dashboard] Zero price for ${symbol}. Raw:`, JSON.stringify(q));
        }
        return {
          ...q,
          sparkline: sparklines[symbol] || [],
          correlations: correlationSignals[symbol] || [],
        };
      });

      const fetchedAt = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York'
      }) + ' ET';

      res.json({
        assets,
        categories,
        fetchedAt,
        correlationSignals,
      });
    } catch (error: any) {
      console.error("[Macro Dashboard] Error:", error.message);
      res.status(500).json({ error: "Failed to fetch macro data" });
    }
  });

  // === RRG (Relative Rotation Graph) ===
  app.get("/api/rrg/data", async (req, res) => {
    try {
      const benchmark = (req.query.benchmark as string) || 'SPY';
      const sectors = (req.query.sectors as string) || 'XLK,XLF,XLV,XLE,XLY,XLP,XLI,XLB,XLRE,XLU,XLC';
      const tail = (req.query.tail as string) || '10';

      const response = await fetch(
        `${MACRO_PYTHON_URL}/rrg/data?benchmark=${benchmark}&sectors=${sectors}&tail=${tail}`,
        { signal: AbortSignal.timeout(30000) }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(500).json({ error: err.error || 'RRG computation failed', sectors: [] });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("[RRG] Error:", error.message);
      res.status(500).json({ error: "RRG data unavailable", sectors: [] });
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
  
  const marketOverviewFallback = {
    title: "Market Overview: Major indices mixed as investors weigh economic data and earnings season",
    publisher: "Market Analysis",
    link: "https://finance.yahoo.com",
    publishedAt: Math.floor(Date.now() / 1000) - 1800,
    relatedSymbol: "SPY",
    thumbnail: null,
    koreanSummary: "시장 전체 상황: 투자자들이 경제 지표와 실적 시즌을 주시하는 가운데 주요 지수가 혼조세를 보이고 있습니다.",
    isMarketOverview: true,
  };

  const marketOverviewKeywords = ['market', 'index', 'indices', 's&p', 'dow', 'nasdaq', 'wall street', 'fed', 'economy', 'inflation', 'gdp', 'jobs', 'employment', 'rate', 'recession', 'rally', 'sell-off', 'bull', 'bear'];

  function isMarketOverviewArticle(title: string): boolean {
    const lower = title.toLowerCase();
    return marketOverviewKeywords.some(kw => lower.includes(kw));
  }

  let cachedAllNews: any[] = [];
  let newsCacheTime = 0;
  const NEWS_CACHE_DURATION = 5 * 60 * 1000;

  app.get("/api/news", async (req, res) => {
    const lang = (req.query.lang as string) || 'en';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 5;
    
    try {
      const now = Date.now();
      if (cachedAllNews.length === 0 || (now - newsCacheTime) > NEWS_CACHE_DURATION) {
        console.log("[News API] Fetching market news...");
        const newsItems = await getMarketNews();
        console.log(`[News API] Received ${newsItems.length} news items from yfinance`);
        
        if (newsItems && newsItems.length > 0) {
          cachedAllNews = newsItems.map(item => ({
            ...item,
            isMarketOverview: isMarketOverviewArticle(item.title),
          }));
          newsCacheTime = now;
        }
      }
      
      let allNews = cachedAllNews.length > 0 ? [...cachedAllNews] : [...fallbackNews];
      
      const hasOverview = allNews.slice(0, 3).some(n => n.isMarketOverview);
      if (!hasOverview) {
        const overviewIdx = allNews.findIndex(n => n.isMarketOverview);
        if (overviewIdx > 2) {
          const overview = allNews.splice(overviewIdx, 1)[0];
          allNews.splice(0, 0, overview);
        } else if (overviewIdx === -1) {
          allNews.unshift(marketOverviewFallback);
        }
      }
      
      const total = allNews.length;
      const startIdx = (page - 1) * limit;
      const pageItems = allNews.slice(startIdx, startIdx + limit);
      const hasMore = startIdx + limit < total;
      
      if (lang === 'ko' && pageItems.length > 0) {
        const newsWithSummaries = await Promise.all(
          pageItems.map(async (item) => {
            if (item.koreanSummary) return item;
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
              return { ...item, koreanSummary: item.title };
            }
          })
        );
        
        return res.json({ news: newsWithSummaries, count: newsWithSummaries.length, total, page, hasMore, source: "live" });
      }
      
      res.json({ news: pageItems, count: pageItems.length, total, page, hasMore, source: cachedAllNews.length > 0 ? "live" : "fallback" });
    } catch (error: any) {
      console.error("[News API] Error fetching news:", error.message || error);
      const startIdx = (page - 1) * limit;
      const pageItems = fallbackNews.slice(startIdx, startIdx + limit);
      res.json({ news: pageItems, count: pageItems.length, total: fallbackNews.length, page, hasMore: startIdx + limit < fallbackNews.length, source: "fallback" });
    }
  });

  // === Mark News as Read (for quest progress) ===
  const newsReadCount: Record<string, { count: number; date: string }> = {};

  function getTodayDate(): string {
    return new Date().toISOString().split("T")[0];
  }

  function getUserNewsCount(userId: string): number {
    const entry = newsReadCount[userId];
    if (!entry || entry.date !== getTodayDate()) return 0;
    return entry.count;
  }
  
  app.post("/api/news/read", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const today = getTodayDate();
    if (!newsReadCount[userId] || newsReadCount[userId].date !== today) {
      newsReadCount[userId] = { count: 0, date: today };
    }
    newsReadCount[userId].count++;
    const count = newsReadCount[userId].count;
    
    res.json({ 
      count,
      message: count >= 3 ? "Quest complete!" : `${3 - count} more to go!`
    });
  });

  app.get("/api/news/read-count", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    res.json({ count: getUserNewsCount(userId) });
  });

  // === Breaking News Quiz Engine (v4 - 20 Sources, 100+ Categories, Market-Aware) ===
  type QuizCategory = 'valuation' | 'impact' | 'technical' | 'movement';

  const categoryOptions: Record<QuizCategory, { en: [string, string]; ko: [string, string] }> = {
    valuation: { en: ['Overvalued (고평가)', 'Undervalued (저평가)'], ko: ['고평가 (Overvalued)', '저평가 (Undervalued)'] },
    impact:    { en: ['Good News (호재)', 'Bad News (악재)'],         ko: ['호재 (Good News)', '악재 (Bad News)'] },
    technical: { en: ['Overbought (과매수)', 'Oversold (과매도)'],    ko: ['과매수 (Overbought)', '과매도 (Oversold)'] },
    movement:  { en: ['Upward (상승)', 'Downward (하락)'],            ko: ['상승 (Upward)', '하락 (Downward)'] },
  };

  type DataSource = 'live_news' | 'pe_ratios' | 'dividend_yield' | 'technical_rsi' | 'fear_greed' | 'earnings' | 'macro_events' | 'moving_average' | 'industry_trends' | 'kospi_news' | 'market_cap_analysis' | 'revenue_growth' | 'debt_equity' | 'sector_rotation' | 'insider_trading' | 'short_interest' | 'options_flow' | 'global_markets' | 'commodity_impact' | 'currency_fx';

  const dataSourceToCategory: Record<DataSource, QuizCategory> = {
    live_news: 'impact',
    pe_ratios: 'valuation',
    dividend_yield: 'impact',
    technical_rsi: 'technical',
    fear_greed: 'movement',
    earnings: 'impact',
    macro_events: 'movement',
    moving_average: 'technical',
    industry_trends: 'impact',
    kospi_news: 'impact',
    market_cap_analysis: 'valuation',
    revenue_growth: 'impact',
    debt_equity: 'valuation',
    sector_rotation: 'movement',
    insider_trading: 'impact',
    short_interest: 'technical',
    options_flow: 'movement',
    global_markets: 'movement',
    commodity_impact: 'impact',
    currency_fx: 'movement',
  };

  const quizHistory: Map<string, string[]> = new Map();
  const templateHistory: Map<string, string[]> = new Map();
  const MAX_HISTORY = 10;

  function addToHistory(sessionKey: string, quizId: string, templateKey?: string) {
    const history = quizHistory.get(sessionKey) || [];
    history.push(quizId);
    if (history.length > MAX_HISTORY) history.shift();
    quizHistory.set(sessionKey, history);

    if (templateKey) {
      const tHistory = templateHistory.get(sessionKey) || [];
      tHistory.push(templateKey);
      if (tHistory.length > MAX_HISTORY) tHistory.shift();
      templateHistory.set(sessionKey, tHistory);
    }
  }

  function isInHistory(sessionKey: string, quizId: string): boolean {
    const history = quizHistory.get(sessionKey) || [];
    return history.includes(quizId);
  }

  function isTemplateInHistory(sessionKey: string, templateKey: string): boolean {
    const history = templateHistory.get(sessionKey) || [];
    return history.includes(templateKey);
  }

  const sessionSourceIndex: Map<string, number> = new Map();

  function getNextDataSource(sessionKey: string): DataSource {
    const sources: DataSource[] = [
      'live_news', 'pe_ratios', 'earnings', 'technical_rsi', 'fear_greed',
      'dividend_yield', 'macro_events', 'moving_average', 'industry_trends', 'kospi_news',
      'market_cap_analysis', 'revenue_growth', 'debt_equity', 'sector_rotation', 'insider_trading',
      'short_interest', 'options_flow', 'global_markets', 'commodity_impact', 'currency_fx',
    ];
    const current = sessionSourceIndex.get(sessionKey) ?? -1;
    const next = (current + 1) % sources.length;
    sessionSourceIndex.set(sessionKey, next);
    return sources[next];
  }

  function ensureBoldKeywords(text: string, symbol: string, companyName: string): string {
    if (text.includes('**')) return text;
    let result = text;
    if (companyName && result.includes(companyName)) {
      result = result.replace(new RegExp(`\\b${companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), `**${companyName}**`);
    }
    if (symbol && result.includes(symbol)) {
      result = result.replace(new RegExp(`\\b${symbol}\\b`, 'g'), `**${symbol}**`);
    }
    const metrics = ['P/E', 'EPS', 'RSI', 'MACD', 'GDP', 'CPI', 'VIX', 'FCF', 'ROE', 'ROA'];
    for (const m of metrics) {
      if (result.includes(m) && !result.includes(`**${m}`)) {
        result = result.replace(new RegExp(`\\b${m.replace('/', '\\/')}\\b`), `**${m}**`);
        break;
      }
    }
    const percentMatch = result.match(/\d+\.?\d*%/);
    if (percentMatch && !result.includes(`**${percentMatch[0]}`)) {
      result = result.replace(percentMatch[0], `**${percentMatch[0]}**`);
    }
    return result;
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
    currencySymbol: string = '$',
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

    const sourceTemplates: Record<string, { focus: string; templates: string[] }> = {
      pe_ratios: {
        focus: 'Focus on P/E ratio, forward P/E, and price multiples relative to sector averages and earnings growth.',
        templates: [
          'Ask whether the stock appears overvalued or undervalued based on its P/E ratio vs historical average.',
          'Ask if the current price-to-earnings multiple is justified given the earnings growth trajectory.',
          'Create a scenario comparing this stock\'s valuation to its sector peers and ask for an assessment.',
        ],
      },
      dividend_yield: {
        focus: 'Focus on dividend yield, payout sustainability, and dividend policy signals.',
        templates: [
          'Ask whether a change in dividend yield signals positive or negative news for the company.',
          'Ask about the investment implications of the current dividend yield compared to sector averages.',
          'Create a scenario about dividend sustainability based on payout ratio and free cash flow.',
        ],
      },
      technical_rsi: {
        focus: 'Focus on RSI levels, overbought/oversold conditions, and momentum indicators.',
        templates: [
          'Ask whether the stock\'s current momentum indicators suggest it is overbought or oversold.',
          'Present a scenario with specific RSI readings and ask for a technical assessment.',
          'Ask about the implications of divergence between price action and technical indicators.',
        ],
      },
      fear_greed: {
        focus: `Focus on market sentiment. ${fgData ? `Fear & Greed Index: ${fgData.score}/100 (${fgData.rating})` : 'Fear & Greed Index: ~50 (Neutral)'}. Relate sentiment to likely market direction.`,
        templates: [
          'Ask about the likely near-term market direction based on the current Fear & Greed reading.',
          'Create a scenario linking investor sentiment levels to expected market behavior.',
          'Ask what the current sentiment extreme (or neutral) suggests about the market\'s next likely move.',
        ],
      },
      earnings: {
        focus: 'Focus on earnings reports: revenue beats/misses, EPS surprises, guidance changes, and margin trends.',
        templates: [
          'Present an earnings surprise scenario (revenue beat or miss) and ask if it is positive or negative for the stock.',
          'Create a question about forward guidance revision and its impact on investor sentiment.',
          'Ask about the implications of operating margin expansion or compression in the latest quarterly report.',
        ],
      },
      macro_events: {
        focus: 'Focus on macroeconomic events: Federal Reserve policy, inflation data, employment reports, GDP, trade policy.',
        templates: [
          'Present a Fed rate decision scenario and ask about the likely market direction.',
          'Create a question about CPI/inflation data release and its impact on equity markets.',
          'Ask about the market implications of a major trade policy change or tariff announcement.',
        ],
      },
      moving_average: {
        focus: 'Focus on moving averages: golden cross, death cross, 50-day MA, 200-day MA, support/resistance levels.',
        templates: [
          'Present a golden cross or death cross scenario and ask if the stock is overbought or oversold.',
          'Ask about a stock breaking above or below its 200-day moving average and what it signals.',
          'Create a question about price testing a key support/resistance level defined by moving averages.',
        ],
      },
      industry_trends: {
        focus: 'Focus on industry/sector trends: AI boom, EV adoption, cloud computing growth, semiconductor cycles, regulatory changes.',
        templates: [
          'Present an industry trend (AI, EV, cloud) and ask if it is positive or negative for a related company.',
          'Ask about the impact of a regulatory change on a specific industry sector.',
          'Create a question about competitive dynamics shifting within an industry and the impact on incumbents.',
        ],
      },
      live_news: {
        focus: 'Focus on a recent news event, earnings report, or macro announcement and its impact on the stock.',
        templates: [
          'Ask whether a specific earnings or revenue data point is positive or negative for the stock.',
          'Present a macro event (interest rates, trade policy, regulation) and ask about its impact.',
          'Ask about the implications of a specific corporate action (buyback, M&A, expansion) on the stock.',
        ],
      },
      kospi_news: {
        focus: 'Focus on Korean stock market (KOSPI/KOSDAQ) specific topics: Samsung, Hyundai, SK, LG, Naver, Kakao, Korean semiconductor industry, K-wave/entertainment companies, Bank of Korea policy, KRW exchange rates, Korean EV battery industry, or KOSPI index movements.',
        templates: [
          'Present a scenario about a major Korean company (Samsung, Hyundai, SK Hynix) and ask about the impact of a specific event on its stock price.',
          'Ask about the implications of Bank of Korea interest rate decisions or Korean economic data on the KOSPI index.',
          'Create a question about Korean industry competitiveness (semiconductors, batteries, entertainment) in the global market.',
        ],
      },
      market_cap_analysis: {
        focus: 'Focus on market capitalization trends, large-cap vs small-cap dynamics, market cap relative to revenue/earnings, and whether the company size justifies its valuation.',
        templates: [
          'Ask whether a company\'s market cap is justified given its revenue multiple compared to peers.',
          'Present a scenario where market cap has grown faster than fundamentals and ask for a valuation assessment.',
          'Create a question about market cap concentration in an index and what it signals about the stock\'s valuation.',
        ],
      },
      revenue_growth: {
        focus: 'Focus on revenue growth trends: year-over-year growth rates, revenue acceleration/deceleration, organic vs. acquisition-driven growth, and revenue quality.',
        templates: [
          'Present a revenue growth acceleration or deceleration scenario and ask whether it is positive or negative for the stock.',
          'Ask about the implications of a company shifting from high growth to stable growth on investor sentiment.',
          'Create a question about revenue quality (recurring vs. one-time) and its impact on the stock.',
        ],
      },
      debt_equity: {
        focus: 'Focus on debt-to-equity ratios, leverage levels, interest coverage, credit ratings, and balance sheet health relative to industry norms.',
        templates: [
          'Ask whether a company\'s debt-to-equity ratio suggests it is overvalued or undervalued given industry benchmarks.',
          'Present a scenario of rising leverage amid falling earnings and ask for a valuation assessment.',
          'Create a question about how a credit rating change impacts the perceived valuation of the company.',
        ],
      },
      sector_rotation: {
        focus: 'Focus on sector rotation patterns: money flowing from defensive to cyclical sectors (or vice versa), sector performance divergence, and business cycle positioning.',
        templates: [
          'Ask about the likely market direction when institutional money rotates from growth to value sectors.',
          'Present a scenario of capital flowing into defensive sectors and ask what it signals for market direction.',
          'Create a question about sector ETF flow data and what the rotation pattern suggests about the market cycle.',
        ],
      },
      insider_trading: {
        focus: 'Focus on insider buying/selling patterns: CEO purchases, cluster buying, Form 4 filings, insider selling after lockup expiration, and what insider activity signals.',
        templates: [
          'Present a scenario of significant insider buying by multiple executives and ask if it is positive or negative news.',
          'Ask about the implications of a CEO selling a large stake shortly after earnings guidance was raised.',
          'Create a question about cluster insider buying at a multi-year low and its signal for investors.',
        ],
      },
      short_interest: {
        focus: 'Focus on short interest levels, days-to-cover ratios, short squeeze potential, and changes in short positions as contrarian or confirming indicators.',
        templates: [
          'Ask whether elevated short interest with declining borrow availability suggests the stock is overbought or oversold.',
          'Present a short squeeze scenario with rapidly rising short interest and ask for a technical assessment.',
          'Create a question about declining short interest after a prolonged sell-off and what it signals technically.',
        ],
      },
      options_flow: {
        focus: 'Focus on unusual options activity: large call/put sweeps, put-call ratio shifts, implied volatility skew, and what smart money positioning in the options market signals.',
        templates: [
          'Ask what a surge in call option volume with rising implied volatility suggests about expected market direction.',
          'Present a scenario of heavy put buying ahead of earnings and ask about the expected directional move.',
          'Create a question about put-call ratio extremes and what they historically signal for near-term market direction.',
        ],
      },
      global_markets: {
        focus: 'Focus on international market movements: European/Asian market performance, global risk-on/risk-off dynamics, cross-market correlations, and how overseas sessions impact U.S. markets.',
        templates: [
          'Ask about the likely U.S. market direction when Asian and European markets rally overnight on stimulus news.',
          'Present a scenario of emerging market currency crises and ask about the expected direction for global equities.',
          'Create a question about divergence between U.S. and international markets and what it signals for direction.',
        ],
      },
      commodity_impact: {
        focus: 'Focus on commodity price movements: oil price shocks, gold as a safe haven, copper as an economic indicator, agricultural commodities, and their impact on related equities.',
        templates: [
          'Ask whether a sharp rise in oil prices is positive or negative news for airline and transportation stocks.',
          'Present a scenario of surging gold prices amid geopolitical tensions and ask about the impact on mining stocks.',
          'Create a question about copper price trends and what they signal about industrial sector health.',
        ],
      },
      currency_fx: {
        focus: 'Focus on foreign exchange movements: USD strength/weakness, EUR/USD, USD/JPY, emerging market currencies, and how currency moves impact multinational earnings and trade competitiveness.',
        templates: [
          'Ask about the likely direction of export-heavy stocks when the domestic currency strengthens significantly.',
          'Present a scenario of rapid dollar weakening and ask about the expected impact on U.S. market direction.',
          'Create a question about currency hedging costs rising and what it signals for multinational stock direction.',
        ],
      },
    };

    const sourceConfig = sourceTemplates[source] || sourceTemplates['live_news'];
    dataFocus = sourceConfig.focus;
    templateHint = sourceConfig.templates[templateVariant % sourceConfig.templates.length];

    const levelGuidance = level === 'beginner'
      ? 'Use simple language. Explain financial terms briefly. Focus on basic concepts like "earnings beat = good for stock".'
      : level === 'advanced'
      ? 'Use professional financial language. Include specific metrics and ratios. Expect the reader to understand DCF, multiples, and technical analysis.'
      : 'Use moderate financial language. Include metrics but provide enough context for learning.';

    if (isKorean) {
      return `${fundamentals.name} (${fundamentals.symbol})의 실시간 데이터를 기반으로 투자자 교육용 퀴즈 문제 1개를 만들어주세요.

오늘 날짜: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
현재 데이터: 주가 ${currencySymbol}${currencySymbol === '₩' ? Math.round(fundamentals.price).toLocaleString() : fundamentals.price.toFixed(2)}, 등락 ${fundamentals.changePercent.toFixed(2)}%, 오늘 세션 변동: ${fundamentals.changePercent.toFixed(2)}%, ${fundamentalsContext}

데이터 초점: ${dataFocus}
문제 패턴: ${templateHint}
난이도: ${levelLabel} - ${levelGuidance}

규칙:
- 단순한 "주가 올랐다/내렸다" 문제는 절대 금지
- headline과 explanation은 자연스럽고 전문적인 한국어로 작성
- 중요: 핵심 키워드(기업명, 수치, 금융 용어)를 **볼드체**로 감싸세요. 예: **애플**, **P/E 25배**, **RSI 75**
- 중요: category와 correctAnswer는 반드시 영어로 작성하세요
- category는 반드시 "${cat}"으로 설정
- correctAnswer는 반드시 ${categoryAnswerGuide[cat]}
- 이전 문제와 다른 새로운 관점의 질문을 만들어주세요
- 관련이 있을 때 오늘의 실제 시장 상황과 날짜를 질문에 반영하세요

JSON 형식으로 정확히 반환:
{"headline": "한국어 질문 내용 (핵심어 **볼드**)", "category": "${cat}", "correctAnswer": "${categoryAnswerGuide[cat]}", "explanation": "한국어 2-3문장의 전문적인 해설 (핵심어 **볼드**)"}`;
    }

    return `Create 1 professional investment quiz question based on real data for ${fundamentals.name} (${fundamentals.symbol}).

Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Current data: Price ${currencySymbol}${currencySymbol === '₩' ? Math.round(fundamentals.price).toLocaleString() : fundamentals.price.toFixed(2)}, Change ${fundamentals.changePercent.toFixed(2)}%, Today's session change: ${fundamentals.changePercent.toFixed(2)}%, ${fundamentalsContext}

Data focus: ${dataFocus}
Question pattern: ${templateHint}
Difficulty: ${levelLabel} - ${levelGuidance}

Rules:
- NEVER create simple "stock went up/down" questions
- Wrap key terms in **bold**: company names, percentages, financial metrics. Example: **Apple**, **P/E 25x**, **RSI 75**
- category MUST be "${cat}"
- correctAnswer MUST ${categoryAnswerGuide[cat]}
- Create a unique question that differs from previous ones
- Reference today's actual market conditions and date in your question when relevant.

Return EXACTLY this JSON:
{"headline": "question text with **bold keywords**", "category": "${cat}", "correctAnswer": "answer matching category", "explanation": "2-3 sentence explanation with **bold keywords**"}`;
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

    { id: "fb21", source: "earnings", level: "beginner", symbol: "AAPL", companyName: "Apple Inc.", category: "impact", correctAnswerIndex: 0, headline: "**Apple** reports **EPS of $2.18**, beating Wall Street's estimate of **$1.95** by **12%**. iPhone revenue grew **8%** year-over-year. Is this earnings report positive or negative?", explanation: "Beating **EPS estimates** by 12% while showing strong **iPhone revenue** growth signals robust consumer demand. This kind of **earnings surprise** typically drives institutional buying and share price appreciation." },
    { id: "fb22", source: "earnings", level: "beginner", symbol: "TSLA", companyName: "Tesla, Inc.", category: "impact", correctAnswerIndex: 1, headline: "**Tesla** misses revenue expectations at **$21.3B** vs. **$23.1B** estimated. **Gross margins** compress to **17.6%** from **25.1%** a year ago due to aggressive price cuts. How should investors view this?", explanation: "Missing revenue by nearly **$2B** while **gross margins** collapse from 25% to under 18% reveals severe pricing pressure. This **margin compression** signals profitability concerns and is clearly negative for the stock." },
    { id: "fb23", source: "earnings", level: "advanced", symbol: "NVDA", companyName: "NVIDIA Corp", category: "impact", correctAnswerIndex: 0, headline: "**NVIDIA** delivers **$35.1B** in quarterly revenue, up **122% YoY**, with **data center** revenue surging **154%**. Forward guidance of **$37.5B** exceeds consensus by **$2B**. Assessment?", explanation: "**Triple-digit revenue growth** with **data center** acceleration and a guidance beat of **$2B** above consensus is exceptionally bullish. The forward guidance lift signals management confidence in sustained **AI infrastructure** demand." },
    { id: "fb24", source: "earnings", level: "advanced", symbol: "META", companyName: "Meta Platforms", category: "impact", correctAnswerIndex: 1, headline: "**Meta** beats on revenue but announces **$15B** incremental **CapEx** for AI infrastructure, raising total spend guidance to **$40B**. **Operating margins** expected to compress **400bps**. Impact?", explanation: "While revenue beat is positive, a **$15B CapEx surge** with **400bps margin compression** introduces significant execution risk. Markets often punish aggressive spending that delays **free cash flow** generation, making this net negative." },

    { id: "fb25", source: "macro_events", level: "beginner", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 0, headline: "The **Federal Reserve** announces a **0.25% rate cut**, the first reduction in **two years**. **Inflation** has cooled to **2.1%**, near the **2% target**. What direction will the market likely move?", explanation: "A **rate cut** reduces borrowing costs and makes stocks more attractive relative to bonds. With **inflation** near target, the cut signals the Fed is pivoting to support growth, which historically pushes **equities upward**." },
    { id: "fb26", source: "macro_events", level: "beginner", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 1, headline: "**CPI inflation** surges to **4.8%**, far above the expected **3.5%**. The **10-year Treasury yield** jumps to **4.9%** in response. Which direction is the market likely heading?", explanation: "A surprise **inflation spike** to 4.8% forces the Fed to maintain or raise rates, increasing borrowing costs. Higher **Treasury yields** make bonds more competitive with stocks, creating downward pressure on **equity prices**." },
    { id: "fb27", source: "macro_events", level: "advanced", symbol: "QQQ", companyName: "Invesco QQQ Trust", category: "movement", correctAnswerIndex: 0, headline: "**Non-farm payrolls** come in at **+150K**, a Goldilocks number vs. **+250K** expected. **Wage growth** moderates to **3.2%**. The market prices in **3 rate cuts** for the next year. Direction?", explanation: "A softer-than-expected **jobs report** with moderating **wage growth** reduces inflation pressure without signaling recession. This 'Goldilocks' scenario supports **rate cut** expectations, which is bullish for **growth stocks** and the broader market." },
    { id: "fb28", source: "macro_events", level: "advanced", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 1, headline: "The **U.S.** announces **25% tariffs** on **$300B** of imports from a major trading partner. **Retaliatory tariffs** are expected within days. The **VIX** spikes to **28**. Expected market direction?", explanation: "Escalating **trade wars** with **$300B in tariffs** disrupt supply chains, raise input costs, and compress margins. The **VIX** spike to 28 confirms rising fear. **Retaliatory tariffs** amplify the damage, making a **downward** move highly probable." },

    { id: "fb29", source: "moving_average", level: "beginner", symbol: "AAPL", companyName: "Apple Inc.", category: "technical", correctAnswerIndex: 0, headline: "**Apple's** stock price breaks above its **200-day moving average** on heavy volume after trading below it for **3 months**. The **50-day MA** is also curling upward. Is this stock overbought or oversold?", explanation: "Breaking above the **200-day MA** after months below it is typically a strong bullish signal. However, the rapid move on heavy volume can push **RSI** into overbought territory in the near term, suggesting the stock may be **overbought** for a short pullback." },
    { id: "fb30", source: "moving_average", level: "beginner", symbol: "MSFT", companyName: "Microsoft Corp", category: "technical", correctAnswerIndex: 1, headline: "**Microsoft** has fallen **15%** below its **200-day moving average**. The stock hits its **52-week low** and the **50-day MA** crosses below the **200-day MA** (a **death cross**). Assessment?", explanation: "A **death cross** (50-day crossing below 200-day) combined with trading **15% below** the long-term average signals sustained selling pressure. This pattern historically indicates the stock is deeply **oversold** with potential for a bounce." },
    { id: "fb31", source: "moving_average", level: "advanced", symbol: "GOOGL", companyName: "Alphabet Inc.", category: "technical", correctAnswerIndex: 0, headline: "**Alphabet** forms a **golden cross** (50-day MA crosses above 200-day MA) but **RSI** reads **74** and the stock is **12%** above its 200-day MA. Bollinger Bands show the upper band being tested. Assessment?", explanation: "While the **golden cross** is a longer-term bullish signal, the **RSI at 74**, price stretched **12% above** the 200-day MA, and testing the upper **Bollinger Band** all suggest short-term **overbought** conditions. A consolidation or pullback is likely before the uptrend continues." },
    { id: "fb32", source: "moving_average", level: "advanced", symbol: "AMZN", companyName: "Amazon.com Inc.", category: "technical", correctAnswerIndex: 1, headline: "**Amazon** trades at its **200-week moving average**, a level that has acted as support in **4 of the last 5 major corrections**. Weekly **RSI** shows bullish divergence at **28**. Volume on the last down day was the **lowest in 6 months**. Assessment?", explanation: "Testing a historically reliable **200-week MA support** with **bullish RSI divergence** at 28 and declining selling volume strongly suggests an **oversold** condition. This confluence of support signals often precedes meaningful reversals." },

    { id: "fb33", source: "industry_trends", level: "beginner", symbol: "NVDA", companyName: "NVIDIA Corp", category: "impact", correctAnswerIndex: 0, headline: "Global **AI spending** is projected to reach **$500B** by next year, up **40%** from current levels. Major cloud providers including **Microsoft**, **Google**, and **Amazon** announce expanded **GPU orders**. Impact on chip makers?", explanation: "A **40% increase** in global **AI spending** directly benefits semiconductor companies that make **GPUs**. Expanded orders from major cloud providers confirm growing demand, which is clearly **positive** for chip makers like NVIDIA." },
    { id: "fb34", source: "industry_trends", level: "beginner", symbol: "TSLA", companyName: "Tesla, Inc.", category: "impact", correctAnswerIndex: 1, headline: "New regulations require all **EV manufacturers** to source **80%** of battery materials domestically within **2 years**. Current domestic sourcing is only **35%**. How does this impact the **EV industry**?", explanation: "Requiring **80% domestic sourcing** when the industry is at only **35%** forces massive supply chain restructuring, increasing costs and potentially slowing production. This regulatory burden is **negative** for EV makers in the near term." },
    { id: "fb35", source: "industry_trends", level: "advanced", symbol: "CRM", companyName: "Salesforce Inc.", category: "impact", correctAnswerIndex: 0, headline: "Enterprise **SaaS companies** report average **net revenue retention** of **115%**, indicating existing customers are spending **15% more** annually. **AI-powered features** drive **25%** of new contract value. Impact assessment?", explanation: "**Net revenue retention** above 115% proves strong **upsell momentum** and product stickiness. **AI features** driving 25% of new contract value shows successful monetization of emerging technology. Both metrics are **positive** for the SaaS sector." },
    { id: "fb36", source: "industry_trends", level: "advanced", symbol: "AAPL", companyName: "Apple Inc.", category: "impact", correctAnswerIndex: 1, headline: "**Smartphone** global shipments decline **8% YoY** for the third consecutive quarter. Average **replacement cycles** extend to **4.5 years** from **3.2 years**. **Emerging market** competition intensifies with **40%** cheaper alternatives. Impact?", explanation: "A sustained **8% decline** in shipments with lengthening **replacement cycles** signals market saturation. **Emerging market** price competition eroding premium positioning makes this **negative** for established smartphone manufacturers." },

    { id: "fb37", source: "kospi_news", level: "beginner", symbol: "005930.KS", companyName: "Samsung Electronics", category: "impact", correctAnswerIndex: 0, headline: "**Samsung Electronics** announces mass production of next-gen **HBM4** memory chips **6 months** ahead of competitors. Major AI chip manufacturers have placed **large-scale orders**. How does this news impact Samsung?", explanation: "Early **HBM4** mass production secures competitive advantage in the high-value AI memory market. Confirmed **large-scale orders** translate directly to revenue growth, making this clearly **positive** news." },
    { id: "fb38", source: "kospi_news", level: "beginner", symbol: "000660.KS", companyName: "SK Hynix", category: "impact", correctAnswerIndex: 0, headline: "**SK Hynix** reports **HBM** revenue surging **250% YoY**, now accounting for **40%** of total DRAM revenue. A long-term supply agreement with **NVIDIA** has also been signed. What does this mean for **SK Hynix**?", explanation: "**HBM revenue growing 250%** and reaching **40%** of total sales demonstrates dominance in high-margin AI memory. The **NVIDIA** long-term contract ensures demand stability, making this clearly **positive**." },
    { id: "fb39", source: "kospi_news", level: "beginner", symbol: "005380.KS", companyName: "Hyundai Motor", category: "impact", correctAnswerIndex: 1, headline: "**Hyundai Motor's** U.S. **EV sales** decline **15%** quarter-over-quarter. Fewer models qualify for **IRA (Inflation Reduction Act)** subsidies, weakening price competitiveness. What is the impact?", explanation: "A **15% drop** in U.S. EV sales reflects slowing growth in the fastest-growing market. Loss of **IRA subsidy** eligibility weakens price competitiveness, making this short-term **negative** news." },
    { id: "fb40", source: "kospi_news", level: "intermediate", symbol: "035420.KS", companyName: "Naver Corp", category: "impact", correctAnswerIndex: 0, headline: "**Naver** announces Japan market entry for its proprietary **HyperCLOVA X** AI model. Through a joint venture with **SoftBank**, it will provide enterprise AI services with initial contracts worth **$380M**. Impact assessment?", explanation: "Japan market expansion with **SoftBank** as a powerful partner signals global growth for **HyperCLOVA X**. The **$380M** initial contract proves AI business monetization, making this **positive** news." },
    { id: "fb41", source: "kospi_news", level: "intermediate", symbol: "035720.KS", companyName: "Kakao Corp", category: "impact", correctAnswerIndex: 1, headline: "The Korean government enforces the **Platform Fair Competition Act**, imposing **self-preferencing bans** on major platforms including **Kakao**. Violations carry penalties up to **6%** of revenue. What is the impact?", explanation: "The **Platform Fair Competition Act** constrains Kakao's ecosystem cross-selling strategy, while the **6% revenue penalty** risk weighs on profitability. Regulatory tightening is **negative** for platform companies." },
    { id: "fb42", source: "kospi_news", level: "advanced", symbol: "373220.KS", companyName: "LG Energy Solution", category: "impact", correctAnswerIndex: 0, headline: "**LG Energy Solution** achieves **400Wh/kg** energy density in **solid-state battery** prototype testing, **1.5x** current lithium-ion battery performance. Mass production target set for **2027**. Impact on the battery industry?", explanation: "Achieving **400Wh/kg** energy density represents a technological breakthrough in next-gen batteries. **1.5x** performance improvement over current tech with a concrete production timeline boosts investor confidence, making this **positive**." },
    { id: "fb43", source: "kospi_news", level: "advanced", symbol: "068270.KS", companyName: "Celltrion", category: "impact", correctAnswerIndex: 0, headline: "**Celltrion's** biosimilar **Zymfentra** receives **FDA** approval for subcutaneous self-injection. The U.S. market size is **$12B**, and it will launch at **30%** below the originator drug price. Impact assessment?", explanation: "**FDA** approval in a **$12B** U.S. market opens a massive revenue opportunity. **30%** price competitiveness supports market share capture, making this **positive** for the biosimilar company." },
    { id: "fb44", source: "kospi_news", level: "beginner", symbol: "259960.KS", companyName: "Krafton", category: "impact", correctAnswerIndex: 0, headline: "**Krafton's** **PUBG** surpasses **$10B** in lifetime global revenue. Its new game **Dark and Darker Mobile** reaches **20M** pre-registrations, raising expectations for the next hit title. What does this mean?", explanation: "Breaking **$10B** lifetime revenue proves the IP's sustained monetization power. **20M pre-registrations** for the new title show strong early demand, making this **positive** for the gaming company." },

    { id: "fb45", source: "market_cap_analysis", level: "beginner", symbol: "AAPL", companyName: "Apple Inc.", category: "valuation", correctAnswerIndex: 0, headline: "**Apple's** market cap reaches **$3.5 trillion**, trading at **9x revenue** while the tech sector average is **5x revenue**. Revenue growth has slowed to **2%** annually. Is this stock overvalued or undervalued?", explanation: "A **9x revenue** multiple is nearly double the sector average, and **2% revenue growth** does not justify the premium. The massive **$3.5T market cap** appears stretched relative to fundamentals, suggesting **overvaluation**." },
    { id: "fb46", source: "market_cap_analysis", level: "advanced", symbol: "MSFT", companyName: "Microsoft Corp", category: "valuation", correctAnswerIndex: 1, headline: "**Microsoft** trades at **$2.8T** market cap with a **price-to-FCF ratio** of **28x**, below its 5-year average of **35x**. **Cloud revenue** is growing at **29%** and now represents **55%** of total revenue. Assessment?", explanation: "Trading below historical **price-to-FCF** multiples while **cloud revenue** accelerates to 55% of the mix signals improving business quality. The market cap is well-supported by **high-margin recurring revenue**, suggesting the stock is **undervalued**." },

    { id: "fb47", source: "revenue_growth", level: "beginner", symbol: "AMZN", companyName: "Amazon.com Inc.", category: "impact", correctAnswerIndex: 0, headline: "**Amazon** reports **quarterly revenue** of **$170B**, up **14% YoY**, accelerating from **9%** growth last quarter. **AWS** revenue growth reaccelerates to **19%**. Is this positive or negative?", explanation: "Revenue growth **accelerating** from 9% to 14% shows improving business momentum. **AWS** reacceleration to 19% confirms strengthening cloud demand. Growth acceleration is clearly **positive** for investor sentiment." },
    { id: "fb48", source: "revenue_growth", level: "advanced", symbol: "CRM", companyName: "Salesforce Inc.", category: "impact", correctAnswerIndex: 1, headline: "**Salesforce** reports **$9.5B** quarterly revenue, up **8% YoY**, decelerating from **11%** last quarter. **Organic growth** excluding acquisitions is only **5%**. Management attributes slowdown to **enterprise spending caution**. Impact?", explanation: "Revenue growth **decelerating** from 11% to 8% with organic growth at just **5%** signals weakening demand. **Enterprise spending caution** suggests the slowdown may persist, making this **negative** for the stock." },

    { id: "fb49", source: "debt_equity", level: "beginner", symbol: "META", companyName: "Meta Platforms", category: "valuation", correctAnswerIndex: 1, headline: "**Meta** has a **debt-to-equity ratio** of **0.25x**, well below the tech sector average of **0.8x**. The company holds **$65B** in cash and equivalents with **zero net debt**. How should this balance sheet be assessed?", explanation: "A **D/E ratio** of 0.25x with **$65B cash** and no net debt represents exceptional financial strength. This fortress balance sheet provides flexibility for buybacks, M&A, and investment, suggesting the stock may be **undervalued**." },
    { id: "fb50", source: "debt_equity", level: "advanced", symbol: "NFLX", companyName: "Netflix Inc.", category: "valuation", correctAnswerIndex: 0, headline: "A media company's **debt-to-equity** surges to **2.5x** from **1.2x** after a **$15B** acquisition. **Interest coverage** drops to **3.2x** while **EBITDA margins** compress **500bps**. The **credit rating** is placed on negative watch. Assessment?", explanation: "**D/E doubling** to 2.5x with deteriorating **interest coverage** at 3.2x and a negative credit watch signals balance sheet stress. Combined with **margin compression**, the elevated leverage suggests **overvaluation** given increased financial risk." },

    { id: "fb51", source: "sector_rotation", level: "beginner", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 1, headline: "Institutional investors are **rotating** heavily from **technology** and **growth stocks** into **utilities**, **healthcare**, and **consumer staples**. The **defensive sector ETFs** have outperformed by **8%** over the past month. Expected market direction?", explanation: "Rotation into **defensive sectors** like utilities and healthcare signals institutional investors are preparing for economic slowdown. This risk-off behavior historically precedes market weakness, suggesting a **downward** direction." },
    { id: "fb52", source: "sector_rotation", level: "advanced", symbol: "QQQ", companyName: "Invesco QQQ Trust", category: "movement", correctAnswerIndex: 0, headline: "Fund flow data shows **$25B** rotating from **bonds and cash** into **cyclical sectors**: **industrials** (+$8B), **financials** (+$7B), and **materials** (+$5B) over two weeks. The **ISM Manufacturing PMI** rebounds to **52.5** from **48.7**. Direction?", explanation: "Massive rotation from safety assets into **cyclical sectors** combined with **PMI** crossing above 50 signals an economic recovery narrative. This risk-on rotation with improving manufacturing data points to **upward** market momentum." },

    { id: "fb53", source: "insider_trading", level: "beginner", symbol: "GOOGL", companyName: "Alphabet Inc.", category: "impact", correctAnswerIndex: 0, headline: "Three **Alphabet** executives purchase a combined **$12M** in company stock on the open market within one week. The **CEO** alone bought **$5M** worth of shares, his largest personal purchase in **3 years**. Is this positive or negative?", explanation: "**Cluster insider buying** by multiple executives, especially a large **CEO purchase**, signals strong management confidence in the company's future. Insiders rarely risk personal capital unless they believe the stock is undervalued, making this clearly **positive**." },
    { id: "fb54", source: "insider_trading", level: "advanced", symbol: "TSLA", companyName: "Tesla, Inc.", category: "impact", correctAnswerIndex: 1, headline: "A CEO sells **$4.5B** in company stock over 10 days via a **10b5-1 plan** filed just **45 days** after raising full-year guidance. Two other C-suite officers also sell **$800M** combined. The insider **sell-to-buy ratio** hits **50:1**. Impact?", explanation: "**$5.3B** in combined insider selling with a **50:1 sell-to-buy ratio** shortly after a guidance raise raises serious concerns. The concentrated selling window despite positive guidance suggests insiders may lack conviction, making this **negative** for sentiment." },

    { id: "fb55", source: "short_interest", level: "beginner", symbol: "AMD", companyName: "Advanced Micro Devices", category: "technical", correctAnswerIndex: 0, headline: "**AMD's** short interest surges to **12%** of float, up from **5%** three months ago. **Days-to-cover** reaches **8 days** as borrow fees spike to **15%** annually. Is this stock overbought or oversold?", explanation: "While high **short interest** at 12% reflects bearish bets, the elevated **days-to-cover** of 8 and spiking **borrow fees** create short squeeze potential. The stock is technically in **overbought** territory due to the squeeze dynamics pushing prices higher." },
    { id: "fb56", source: "short_interest", level: "advanced", symbol: "NVDA", companyName: "NVIDIA Corp", category: "technical", correctAnswerIndex: 1, headline: "**Short interest** in a chip stock drops from **9%** to **2.5%** of float over 6 weeks after a **40% price decline**. **Put open interest** is also declining while **call skew** normalizes. The **days-to-cover** ratio falls to **1.2 days**. Assessment?", explanation: "Rapidly declining **short interest** from 9% to 2.5% after a major selloff means bears are covering positions, reducing downward pressure. Combined with normalizing **options skew** and low **days-to-cover**, this suggests the stock is **oversold** and shorts see limited further downside." },

    { id: "fb57", source: "options_flow", level: "beginner", symbol: "AAPL", companyName: "Apple Inc.", category: "movement", correctAnswerIndex: 0, headline: "Unusual **options activity** detected: **$50M** in **call sweeps** on **Apple** at the **$200 strike**, expiring in 2 weeks. The **put-call ratio** drops to **0.5**, well below the 6-month average of **0.85**. Expected direction?", explanation: "Large **call sweeps** worth $50M represent aggressive bullish bets by institutional traders. A **put-call ratio** of 0.5 (far below average) shows overwhelming call buying, signaling expected **upward** movement." },
    { id: "fb58", source: "options_flow", level: "advanced", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 1, headline: "**SPY options** show **$2B** in protective **put buying** at the **$420 strike** by a single institutional block. **Implied volatility** on 30-day puts jumps **40%** while the **VIX term structure** inverts. **Call-put open interest ratio** drops to **0.7**. Direction?", explanation: "A **$2B put block** signals major institutional hedging. **Inverted VIX term structure** means near-term fear exceeds long-term, a classic pre-decline signal. Combined with the low **call-put ratio**, smart money is positioned for **downward** movement." },

    { id: "fb59", source: "global_markets", level: "beginner", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 0, headline: "Overnight, **European markets** rally **2.5%** after the **ECB** announces a surprise stimulus package. **Asian markets** close up **1.8%** with **Japan's Nikkei** hitting a new all-time high. What direction will the U.S. market likely open?", explanation: "Strong rallies across **European** and **Asian** markets create positive momentum that typically carries into U.S. trading. The **ECB stimulus** adds global liquidity, and international strength signals risk-on sentiment, pointing to an **upward** U.S. open." },
    { id: "fb60", source: "global_markets", level: "advanced", symbol: "QQQ", companyName: "Invesco QQQ Trust", category: "movement", correctAnswerIndex: 1, headline: "**China's** stock market falls **6%** in one session as property developer defaults trigger **$300B** in contagion fears. **European banks** with China exposure drop **4%**. The **MSCI Emerging Markets Index** enters a bear market, down **22%**. Direction for U.S. equities?", explanation: "A **6% China crash** with contagion spreading to **European banks** and emerging markets entering a **bear market** creates systemic risk-off pressure. Cross-market correlations tighten during crises, making **downward** pressure on U.S. equities highly likely." },

    { id: "fb61", source: "commodity_impact", level: "beginner", symbol: "AAPL", companyName: "Apple Inc.", category: "impact", correctAnswerIndex: 1, headline: "**Oil prices** surge **25%** to **$110/barrel** after major supply disruptions in the Middle East. **Transportation costs** spike and **consumer spending** forecasts are revised downward. How does this impact most consumer-facing companies?", explanation: "A **25% oil price surge** increases transportation and production costs for consumer companies while reducing **consumer spending** power. Higher energy costs act as a tax on consumers and businesses, making this broadly **negative** for consumer-facing stocks." },
    { id: "fb62", source: "commodity_impact", level: "advanced", symbol: "GOOGL", companyName: "Alphabet Inc.", category: "impact", correctAnswerIndex: 0, headline: "**Copper prices** rise **18%** over 3 months to **$5.20/lb**, driven by global **data center construction** and **EV infrastructure** buildout. **Mining stocks** lag copper's advance with copper-to-gold ratio at a **2-year high**. Impact on industrial demand-linked sectors?", explanation: "**Copper** rising 18% on **data center** and **EV** demand signals robust industrial expansion. The high **copper-to-gold ratio** confirms risk-on conditions. Strong copper demand driven by secular growth trends is **positive** for industrial and infrastructure sectors." },

    { id: "fb63", source: "currency_fx", level: "beginner", symbol: "MSFT", companyName: "Microsoft Corp", category: "movement", correctAnswerIndex: 1, headline: "The **U.S. dollar** strengthens **8%** against a basket of major currencies over the past quarter. **Multinational companies** with over **50%** international revenue face significant **currency headwinds**. What direction does this push export-heavy stock prices?", explanation: "A stronger **dollar** reduces the value of overseas earnings when converted back to USD. For companies with **50%+ international revenue**, an **8% dollar appreciation** creates substantial headwinds, pushing stock prices **downward**." },
    { id: "fb64", source: "currency_fx", level: "advanced", symbol: "AAPL", companyName: "Apple Inc.", category: "movement", correctAnswerIndex: 0, headline: "The **Dollar Index (DXY)** falls **5%** in 6 weeks as the **Fed** signals rate cuts while **ECB** and **BOJ** hold rates. **USD/JPY** drops from **155 to 142** and **EUR/USD** rises to **1.15**. Impact on U.S. multinational earnings direction?", explanation: "A **5% DXY decline** provides a **tailwind** to multinational earnings as foreign revenues translate into more dollars. Favorable **USD/JPY** and **EUR/USD** moves boost major markets like Japan and Europe for U.S. exporters, pointing to **upward** earnings revisions." },
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

    { id: "fb21", source: "earnings", level: "beginner", symbol: "AAPL", companyName: "Apple Inc.", category: "impact", correctAnswerIndex: 0, headline: "**애플**이 **EPS $2.18**을 기록하며 월가 예상치 **$1.95**를 **12%** 상회했습니다. **아이폰** 매출은 전년 대비 **8%** 증가했습니다. 이 실적 발표는 긍정적일까요, 부정적일까요?", explanation: "**EPS 예상치**를 12% 초과 달성하며 **아이폰 매출** 성장세가 강한 것은 소비자 수요가 견조함을 보여줍니다. 이런 **어닝 서프라이즈**는 기관 매수를 유도해 주가 상승으로 이어집니다." },
    { id: "fb22", source: "earnings", level: "beginner", symbol: "TSLA", companyName: "Tesla, Inc.", category: "impact", correctAnswerIndex: 1, headline: "**테슬라**의 매출이 **$213억**으로 예상치 **$231억**에 미달했습니다. 공격적 가격 인하로 **총이익률**이 1년 전 **25.1%**에서 **17.6%**로 급락했습니다. 투자자는 이를 어떻게 봐야 할까요?", explanation: "매출이 약 **$20억** 부족하면서 **총이익률**이 25%에서 18% 미만으로 급락한 것은 심각한 가격 경쟁 압력을 드러냅니다. 이런 **마진 압축**은 수익성 우려 신호로 명백한 악재입니다." },
    { id: "fb23", source: "earnings", level: "advanced", symbol: "NVDA", companyName: "NVIDIA Corp", category: "impact", correctAnswerIndex: 0, headline: "**엔비디아**가 분기 매출 **$351억**을 달성하며 전년 대비 **122%** 성장했습니다. **데이터센터** 매출은 **154%** 급증했고, 향후 가이던스 **$375억**은 컨센서스를 **$20억** 상회합니다. 평가는?", explanation: "**세 자릿수 매출 성장**에 **데이터센터** 가속화, 컨센서스 **$20억** 초과 가이던스는 극도로 강세입니다. 가이던스 상향은 지속적인 **AI 인프라** 수요에 대한 경영진의 자신감을 반영합니다." },
    { id: "fb24", source: "earnings", level: "advanced", symbol: "META", companyName: "Meta Platforms", category: "impact", correctAnswerIndex: 1, headline: "**메타**는 매출 예상치를 상회했지만 AI 인프라를 위해 **$150억** 추가 **설비투자**를 발표했습니다. 총 지출 가이던스는 **$400억**으로 상향되었고, **영업이익률**은 **400bp** 하락이 예상됩니다. 영향은?", explanation: "매출 초과는 긍정적이지만, **$150억 설비투자 급증**과 **400bp 마진 압축**은 상당한 실행 리스크를 수반합니다. 시장은 **잉여현금흐름** 생성을 지연시키는 공격적 지출에 부정적으로 반응하는 경향이 있습니다." },

    { id: "fb25", source: "macro_events", level: "beginner", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 0, headline: "**연준**이 **2년 만에** 처음으로 **0.25%** 금리 인하를 발표했습니다. **인플레이션**은 **목표치 2%**에 근접한 **2.1%**로 하락했습니다. 시장은 어느 방향으로 움직일까요?", explanation: "**금리 인하**는 차입 비용을 낮추고 채권 대비 주식의 매력을 높입니다. **인플레이션**이 목표치에 근접한 상태에서의 인하는 성장 지원으로의 전환을 의미하며, 역사적으로 **주식시장 상승**으로 이어집니다." },
    { id: "fb26", source: "macro_events", level: "beginner", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 1, headline: "**소비자물가지수(CPI)** 인플레이션이 예상 **3.5%**를 크게 상회하는 **4.8%**로 급등했습니다. **10년 국채금리**가 **4.9%**로 급등했습니다. 시장은 어느 방향으로 향할까요?", explanation: "예상을 크게 초과한 **인플레이션** 급등은 연준의 금리 유지 또는 인상을 강제합니다. 높아진 **국채금리**는 채권의 경쟁력을 높여 **주가 하락** 압력을 만듭니다." },
    { id: "fb27", source: "macro_events", level: "advanced", symbol: "QQQ", companyName: "Invesco QQQ Trust", category: "movement", correctAnswerIndex: 0, headline: "**비농업 고용**이 예상치 **+25만 명** 대비 **+15만 명**으로 발표되었습니다. **임금 상승률**은 **3.2%**로 안정화되었고, 시장은 내년 **3회 금리인하**를 반영하고 있습니다. 시장 방향은?", explanation: "예상보다 완만한 **고용 보고서**와 안정적인 **임금 상승률**은 경기침체 신호 없이 인플레이션 압력을 줄입니다. 이 '골디락스' 시나리오는 **금리인하** 기대를 지지하며 **성장주**에 긍정적입니다." },
    { id: "fb28", source: "macro_events", level: "advanced", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 1, headline: "**미국**이 주요 교역국으로부터 **$3,000억** 규모 수입품에 **25% 관세**를 발표했습니다. **보복관세**가 수일 내 예상되며, **VIX**가 **28**로 급등했습니다. 예상되는 시장 방향은?", explanation: "**$3,000억 규모 관세**에 의한 **무역전쟁** 격화는 공급망을 교란하고 투입 비용을 높여 마진을 압축합니다. **VIX 28** 급등은 공포 확산을 확인하며, **보복관세**는 피해를 증폭시켜 **하락** 가능성이 높습니다." },

    { id: "fb29", source: "moving_average", level: "beginner", symbol: "AAPL", companyName: "Apple Inc.", category: "technical", correctAnswerIndex: 0, headline: "**애플** 주가가 **3개월간** **200일 이동평균** 아래에서 거래되다가 강한 거래량과 함께 이를 돌파했습니다. **50일 이동평균**도 상승 전환 중입니다. 이 종목은 과매수일까요, 과매도일까요?", explanation: "**200일 이동평균** 돌파는 강력한 강세 신호이지만, 급격한 상승으로 단기적으로 **RSI**가 과매수 영역에 진입할 수 있어 일시적으로 **과매수** 상태일 수 있습니다." },
    { id: "fb30", source: "moving_average", level: "beginner", symbol: "MSFT", companyName: "Microsoft Corp", category: "technical", correctAnswerIndex: 1, headline: "**마이크로소프트**가 **200일 이동평균** 아래로 **15%** 하락했습니다. **52주 신저가**를 기록하며 **50일 MA**가 **200일 MA** 아래로 교차하는 **데드크로스**가 발생했습니다. 평가는?", explanation: "**데드크로스**(50일이 200일 아래로 교차)와 장기 평균 **15% 하회**는 지속적인 매도 압력을 의미합니다. 이 패턴은 역사적으로 종목이 깊은 **과매도** 상태이며 반등 가능성이 있음을 나타냅니다." },
    { id: "fb31", source: "moving_average", level: "advanced", symbol: "GOOGL", companyName: "Alphabet Inc.", category: "technical", correctAnswerIndex: 0, headline: "**알파벳**이 **골든크로스**(50일 MA가 200일 MA 상향 교차)를 형성했지만 **RSI**가 **74**이고 주가가 200일 MA 위 **12%**에 위치합니다. **볼린저밴드** 상단 터치 중입니다. 평가는?", explanation: "**골든크로스**는 장기 강세 신호이나, **RSI 74**, 200일 MA 위 **12%** 이격, **볼린저밴드** 상단 터치는 모두 단기 **과매수** 상태를 시사합니다. 상승 추세 지속 전 조정이 올 가능성이 높습니다." },
    { id: "fb32", source: "moving_average", level: "advanced", symbol: "AMZN", companyName: "Amazon.com Inc.", category: "technical", correctAnswerIndex: 1, headline: "**아마존**이 **200주 이동평균**에서 거래 중입니다. 이 수준은 지난 **5번의 대규모 조정 중 4번**에서 지지선으로 작동했습니다. 주간 **RSI**가 **28**에서 강세 다이버전스를 보이고 있습니다. 평가는?", explanation: "역사적으로 신뢰할 수 있는 **200주 MA 지지선** 테스트에 **RSI 28의 강세 다이버전스**, 감소하는 매도 거래량은 강한 **과매도** 상태를 시사합니다. 이런 지지 신호의 집중은 의미 있는 반전의 전조인 경우가 많습니다." },

    { id: "fb33", source: "industry_trends", level: "beginner", symbol: "NVDA", companyName: "NVIDIA Corp", category: "impact", correctAnswerIndex: 0, headline: "글로벌 **AI 지출**이 내년 **$5,000억**에 달할 전망으로 현재 대비 **40%** 증가합니다. **마이크로소프트**, **구글**, **아마존** 등 주요 클라우드 업체들이 **GPU 주문** 확대를 발표했습니다. 반도체 기업에 미치는 영향은?", explanation: "글로벌 **AI 지출 40% 증가**는 **GPU** 제조 반도체 기업에 직접적인 수혜입니다. 주요 클라우드 업체의 주문 확대는 수요 증가를 확인해주며 명확한 **호재**입니다." },
    { id: "fb34", source: "industry_trends", level: "beginner", symbol: "TSLA", companyName: "Tesla, Inc.", category: "impact", correctAnswerIndex: 1, headline: "새로운 규정이 모든 **EV 제조사**에게 **2년 이내** 배터리 소재의 **80%**를 국내에서 조달하도록 요구합니다. 현재 국내 조달 비율은 **35%**에 불과합니다. **EV 산업**에 미치는 영향은?", explanation: "현재 **35%**인 국내 조달을 **80%**로 높이도록 요구하는 것은 대규모 공급망 재편을 강제하여 비용을 증가시키고 생산을 지연시킬 수 있습니다. 이 규제 부담은 단기적으로 EV 기업에 **악재**입니다." },
    { id: "fb35", source: "industry_trends", level: "advanced", symbol: "CRM", companyName: "Salesforce Inc.", category: "impact", correctAnswerIndex: 0, headline: "기업용 **SaaS** 기업들의 평균 **순매출유지율(NRR)**이 **115%**를 기록하며 기존 고객의 연간 지출이 **15%** 증가하고 있습니다. **AI 기능**이 신규 계약 가치의 **25%**를 차지합니다. 영향 평가는?", explanation: "**순매출유지율 115%** 이상은 강한 **업셀 모멘텀**과 제품 충성도를 입증합니다. **AI 기능**이 신규 계약의 25%를 차지하는 것은 신기술의 성공적 수익화를 보여주며, 두 지표 모두 SaaS 섹터에 **긍정적**입니다." },
    { id: "fb36", source: "industry_trends", level: "advanced", symbol: "AAPL", companyName: "Apple Inc.", category: "impact", correctAnswerIndex: 1, headline: "글로벌 **스마트폰** 출하량이 **3분기 연속** 전년 대비 **8%** 감소했습니다. 평균 **교체 주기**가 **3.2년**에서 **4.5년**으로 늘어났고, **신흥시장**에서 **40%** 저렴한 대안 제품과의 경쟁이 심화됩니다. 영향은?", explanation: "지속적인 출하량 **8% 감소**와 **교체 주기** 연장은 시장 포화를 의미합니다. **신흥시장** 가격 경쟁이 프리미엄 포지셔닝을 침식하는 것은 기존 스마트폰 제조사에 **악재**입니다." },

    { id: "fb37", source: "kospi_news", level: "beginner", symbol: "005930.KS", companyName: "삼성전자", category: "impact", correctAnswerIndex: 0,
      headline: "**삼성전자**가 차세대 **HBM4** 메모리 반도체 양산을 경쟁사보다 **6개월** 앞당겨 시작한다고 발표했습니다. 주요 AI 칩 제조사들의 **대량 주문**이 확인되었습니다. 이 소식은 삼성전자에 어떤 영향을 미칠까요?",
      explanation: "**HBM4** 조기 양산은 고부가가치 AI 메모리 시장에서 경쟁 우위를 확보하는 것을 의미합니다. **대량 주문** 확인은 매출 성장으로 직결되어 명확한 **호재**입니다." },
    { id: "fb38", source: "kospi_news", level: "beginner", symbol: "000660.KS", companyName: "SK하이닉스", category: "impact", correctAnswerIndex: 0,
      headline: "**SK하이닉스**의 **HBM** 매출이 전년 대비 **250%** 증가하며 전체 DRAM 매출의 **40%**를 차지했습니다. **NVIDIA**와의 장기 공급 계약도 체결되었습니다. 이 실적은 **SK하이닉스**에 어떤 의미일까요?",
      explanation: "**HBM 매출 250% 성장**과 전체 매출 **40%** 비중은 고수익 AI 메모리 시장에서의 지배력을 보여줍니다. **NVIDIA** 장기 계약은 수요 안정성을 높이는 명확한 **호재**입니다." },
    { id: "fb39", source: "kospi_news", level: "beginner", symbol: "005380.KS", companyName: "현대자동차", category: "impact", correctAnswerIndex: 1,
      headline: "**현대자동차**의 미국 시장 **EV 판매**가 전분기 대비 **15%** 감소했습니다. **IRA(인플레이션감축법)** 보조금 적격 차종이 줄어들며 가격 경쟁력이 약화되고 있습니다. 이 소식의 영향은?",
      explanation: "미국 **EV 판매 15% 감소**는 가장 빠르게 성장하는 시장에서의 성장 둔화를 의미합니다. **IRA 보조금** 미적격으로 인한 가격 경쟁력 약화는 단기 **악재**입니다." },
    { id: "fb40", source: "kospi_news", level: "intermediate", symbol: "035420.KS", companyName: "네이버", category: "impact", correctAnswerIndex: 0,
      headline: "**네이버**가 자체 개발 **하이퍼클로바X** AI 모델의 일본 시장 진출을 발표했습니다. **소프트뱅크**와의 합작법인을 통해 일본 기업용 AI 서비스를 제공하며, 초기 계약 규모가 **₩5,000억**에 달합니다. 영향 평가는?",
      explanation: "일본 시장 진출과 **소프트뱅크**라는 강력한 파트너십은 **하이퍼클로바X**의 글로벌 확장을 의미합니다. **₩5,000억** 초기 계약은 AI 사업의 수익화를 증명하는 **호재**입니다." },
    { id: "fb41", source: "kospi_news", level: "intermediate", symbol: "035720.KS", companyName: "카카오", category: "impact", correctAnswerIndex: 1,
      headline: "정부가 **플랫폼 공정경쟁법**을 시행하여 **카카오**를 포함한 대형 플랫폼 기업에 **자사 서비스 우대 금지** 의무를 부과했습니다. 위반 시 매출의 최대 **6%**가 과징금으로 부과됩니다. 영향은?",
      explanation: "**플랫폼 공정경쟁법**은 카카오의 생태계 내 교차 판매 전략을 제약하며, **매출 6% 과징금** 위험은 수익성에 부담을 줍니다. 규제 강화는 플랫폼 기업에 **악재**입니다." },
    { id: "fb42", source: "kospi_news", level: "advanced", symbol: "373220.KS", companyName: "LG에너지솔루션", category: "impact", correctAnswerIndex: 0,
      headline: "**LG에너지솔루션**이 **전고체 배터리** 시제품 테스트에서 에너지 밀도 **400Wh/kg**을 달성했습니다. 이는 현재 리튬이온 배터리의 **1.5배** 수준이며, **2027년** 양산 목표를 발표했습니다. 배터리 업계에 미치는 영향은?",
      explanation: "**400Wh/kg** 에너지 밀도 달성은 차세대 배터리 기술에서의 기술적 돌파구입니다. 현재 기술 대비 **1.5배** 성능 향상과 구체적 양산 일정은 투자자 신뢰를 높이는 **호재**입니다." },
    { id: "fb43", source: "kospi_news", level: "advanced", symbol: "068270.KS", companyName: "셀트리온", category: "impact", correctAnswerIndex: 0,
      headline: "**셀트리온**의 바이오시밀러 **짐펜트라**가 미국 **FDA** 자가주사 승인을 획득했습니다. 미국 시장 규모는 **$120억**이며, 오리지널 약물 대비 **30%** 저렴한 가격으로 출시됩니다. 영향 평가는?",
      explanation: "**$120억** 규모 미국 시장에서 **FDA** 승인은 대규모 매출 기회를 의미합니다. **30%** 가격 경쟁력은 시장 점유율 확보에 유리하며, 바이오시밀러 기업에 **호재**입니다." },
    { id: "fb44", source: "kospi_news", level: "beginner", symbol: "259960.KS", companyName: "크래프톤", category: "impact", correctAnswerIndex: 0,
      headline: "**크래프톤**의 **배틀그라운드** 글로벌 누적 매출이 **$100억**을 돌파했습니다. 신규 게임 **다크앤다커 모바일**의 사전 등록 수가 **2,000만 건**을 기록하며 차기 히트작 기대감이 높아지고 있습니다. 이 소식은?",
      explanation: "**$100억** 누적 매출 돌파는 IP의 지속적 수익 창출력을 증명합니다. 신작 **사전 등록 2,000만 건**은 강한 초기 수요를 보여주며, 게임사에 **호재**입니다." },

    { id: "fb45", source: "market_cap_analysis", level: "beginner", symbol: "AAPL", companyName: "애플", category: "valuation", correctAnswerIndex: 0, headline: "**애플**의 시가총액이 **$3.5조**에 도달했으며, **매출 대비 9배**로 거래되고 있습니다. 테크 섹터 평균은 **5배**이며 매출 성장률은 연 **2%**로 둔화되었습니다. 이 종목은 고평가일까요, 저평가일까요?", explanation: "**매출 대비 9배** 멀티플은 섹터 평균의 거의 2배이며, **2% 매출 성장**은 이 프리미엄을 정당화하지 못합니다. **$3.5조** 시가총액은 펀더멘털 대비 과도하여 **고평가**를 시사합니다." },
    { id: "fb46", source: "market_cap_analysis", level: "advanced", symbol: "MSFT", companyName: "마이크로소프트", category: "valuation", correctAnswerIndex: 1, headline: "**마이크로소프트**가 **$2.8조** 시가총액에 **FCF 대비 28배**로 거래 중이며, 이는 5년 평균 **35배**보다 낮습니다. **클라우드 매출**이 **29%** 성장하며 전체 매출의 **55%**를 차지합니다. 평가는?", explanation: "역사적 **FCF 배수** 아래에서 거래되면서 **클라우드 매출**이 가속화되는 것은 사업 품질 개선을 의미합니다. **고마진 반복 매출**이 시가총액을 뒷받침하며 **저평가**를 시사합니다." },

    { id: "fb47", source: "revenue_growth", level: "beginner", symbol: "AMZN", companyName: "아마존", category: "impact", correctAnswerIndex: 0, headline: "**아마존**이 분기 매출 **$1,700억**을 보고하며 전년 대비 **14%** 성장했습니다. 전분기 **9%** 성장에서 가속화되었고 **AWS** 매출 성장률도 **19%**로 재가속되었습니다. 이는 긍정적일까요, 부정적일까요?", explanation: "매출 성장이 9%에서 **14%로 가속**된 것은 사업 모멘텀 개선을 보여줍니다. **AWS**의 19% 재가속은 클라우드 수요 강화를 확인하며 투자 심리에 명확한 **호재**입니다." },
    { id: "fb48", source: "revenue_growth", level: "advanced", symbol: "CRM", companyName: "세일즈포스", category: "impact", correctAnswerIndex: 1, headline: "**세일즈포스**가 분기 매출 **$95억**을 보고하며 전년 대비 **8%** 성장했지만, 전분기 **11%**에서 둔화되었습니다. 인수를 제외한 **유기적 성장**은 **5%**에 불과합니다. 경영진은 **기업 지출 신중론**을 원인으로 꼽았습니다. 영향은?", explanation: "매출 성장이 11%에서 **8%로 감속**되고 유기적 성장이 **5%**에 그치는 것은 수요 약화를 의미합니다. **기업 지출 신중론**은 둔화 지속 가능성을 시사하며 주식에 **악재**입니다." },

    { id: "fb49", source: "debt_equity", level: "beginner", symbol: "META", companyName: "메타", category: "valuation", correctAnswerIndex: 1, headline: "**메타**의 **부채비율**이 **0.25배**로 테크 섹터 평균 **0.8배**보다 훨씬 낮습니다. 현금 및 현금성 자산이 **$650억**이며 **순부채는 제로**입니다. 이 재무제표를 어떻게 평가해야 할까요?", explanation: "**부채비율 0.25배**에 **$650억 현금**, 순부채 제로는 탁월한 재무 건전성을 의미합니다. 이 요새 같은 재무제표는 자사주매입, M&A, 투자 유연성을 제공하며 **저평가**를 시사합니다." },
    { id: "fb50", source: "debt_equity", level: "advanced", symbol: "NFLX", companyName: "넷플릭스", category: "valuation", correctAnswerIndex: 0, headline: "한 미디어 기업의 **부채비율**이 **$150억** 인수 후 **1.2배**에서 **2.5배**로 급등했습니다. **이자보상비율**은 **3.2배**로 하락하고 **EBITDA 마진**은 **500bp** 압축되었습니다. **신용등급**도 부정적 관찰 대상에 올랐습니다. 평가는?", explanation: "**부채비율 2배 이상 상승**과 **이자보상비율 3.2배** 악화, 신용등급 부정적 관찰은 재무제표 스트레스를 의미합니다. **마진 압축**과 결합된 높은 레버리지는 재무 리스크 증가에 따른 **고평가**를 시사합니다." },

    { id: "fb51", source: "sector_rotation", level: "beginner", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 1, headline: "기관 투자자들이 **기술주**와 **성장주**에서 **유틸리티**, **헬스케어**, **필수소비재**로 대규모 **로테이션** 중입니다. 지난 한 달간 **방어주 ETF**가 **8%** 아웃퍼폼했습니다. 예상되는 시장 방향은?", explanation: "유틸리티, 헬스케어 등 **방어 섹터**로의 로테이션은 기관 투자자들이 경기 둔화에 대비하고 있음을 의미합니다. 이 리스크오프 행동은 역사적으로 시장 약세의 전조이며 **하락** 방향을 시사합니다." },
    { id: "fb52", source: "sector_rotation", level: "advanced", symbol: "QQQ", companyName: "인베스코 QQQ", category: "movement", correctAnswerIndex: 0, headline: "펀드 플로우 데이터에 따르면 2주간 **채권과 현금**에서 **경기순환 섹터**로 **$250억**이 유입되었습니다: **산업재** (+$80억), **금융** (+$70억), **소재** (+$50억). **ISM 제조업 PMI**가 **48.7**에서 **52.5**로 반등했습니다. 방향은?", explanation: "안전자산에서 **경기순환 섹터**로의 대규모 로테이션과 **PMI** 50 돌파는 경기 회복 내러티브를 의미합니다. 제조업 개선과 함께한 리스크온 로테이션은 **상승** 모멘텀을 가리킵니다." },

    { id: "fb53", source: "insider_trading", level: "beginner", symbol: "GOOGL", companyName: "알파벳", category: "impact", correctAnswerIndex: 0, headline: "**알파벳** 임원 3명이 1주일 내에 공개 시장에서 총 **$1,200만** 규모의 자사주를 매수했습니다. **CEO**만 **$500만** 어치를 매수하며 **3년 만에** 최대 개인 매수를 기록했습니다. 이는 긍정적일까요, 부정적일까요?", explanation: "다수 임원의 **대규모 내부자 매수**와 특히 **CEO의 $500만 매수**는 경영진의 강한 자신감을 의미합니다. 내부자들은 주가가 저평가되었다고 확신할 때만 개인 자본을 투입하며 이는 명확한 **호재**입니다." },
    { id: "fb54", source: "insider_trading", level: "advanced", symbol: "TSLA", companyName: "테슬라", category: "impact", correctAnswerIndex: 1, headline: "한 CEO가 연간 실적 전망 상향 후 **45일** 만에 **10b5-1 플랜**을 통해 10일간 **$45억** 규모의 자사주를 매도했습니다. 다른 C레벨 임원 2명도 **$8억**을 매도했습니다. 내부자 **매도/매수 비율**이 **50:1**에 달합니다. 영향은?", explanation: "가이던스 상향 직후 **$53억** 규모의 내부자 매도와 **50:1 매도/매수 비율**은 심각한 우려를 제기합니다. 긍정적 전망에도 불구한 집중 매도는 내부자의 확신 부족을 시사하며 **악재**입니다." },

    { id: "fb55", source: "short_interest", level: "beginner", symbol: "AMD", companyName: "AMD", category: "technical", correctAnswerIndex: 0, headline: "**AMD**의 공매도 비율이 3개월 전 **5%**에서 유통주식의 **12%**로 급등했습니다. **숏커버 소요일수**가 **8일**에 달하고 **대차 수수료**가 연 **15%**로 급등했습니다. 이 종목은 과매수일까요, 과매도일까요?", explanation: "**공매도 비율 12%**는 약세 베팅을 반영하지만, **숏커버 소요일수 8일**과 급등하는 **대차 수수료**는 숏스퀴즈 가능성을 만듭니다. 스퀴즈 역학이 가격을 밀어올려 기술적으로 **과매수** 영역입니다." },
    { id: "fb56", source: "short_interest", level: "advanced", symbol: "NVDA", companyName: "엔비디아", category: "technical", correctAnswerIndex: 1, headline: "한 반도체 종목의 **공매도 비율**이 **40% 주가 하락** 후 6주간 **9%**에서 **2.5%**로 급감했습니다. **풋 미결제약정**도 감소하고 **콜 스큐**가 정상화되었습니다. **숏커버 소요일수**는 **1.2일**입니다. 평가는?", explanation: "대규모 하락 후 **공매도 비율**이 9%에서 2.5%로 급감한 것은 약세 세력이 포지션을 청산하고 있음을 의미합니다. **옵션 스큐** 정상화와 낮은 **숏커버 소요일수**는 추가 하락 여력이 제한적임을 시사하며 **과매도** 상태입니다." },

    { id: "fb57", source: "options_flow", level: "beginner", symbol: "AAPL", companyName: "애플", category: "movement", correctAnswerIndex: 0, headline: "**애플**에서 이례적 **옵션 활동**이 감지되었습니다: 2주 만기 **$200 행사가** **콜옵션 스윕** **$5,000만** 규모. **풋/콜 비율**이 6개월 평균 **0.85**에서 **0.5**로 하락했습니다. 예상되는 방향은?", explanation: "**$5,000만** 규모의 대형 **콜 스윕**은 기관 투자자의 공격적 강세 베팅을 의미합니다. **풋/콜 비율 0.5**(평균 대비 매우 낮음)는 압도적 콜 매수를 보여주며 **상승** 움직임을 시사합니다." },
    { id: "fb58", source: "options_flow", level: "advanced", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 1, headline: "**SPY 옵션**에서 단일 기관 블록이 **$420 행사가** 방어적 **풋 매수** **$20억** 규모를 집행했습니다. 30일 풋 **내재변동성**이 **40%** 급등하고 **VIX 기간구조**가 역전되었습니다. **콜/풋 미결제약정 비율**은 **0.7**입니다. 방향은?", explanation: "**$20억 풋 블록**은 대형 기관의 헤지를 의미합니다. **VIX 기간구조 역전**은 단기 공포가 장기를 초과하는 하락 전 전형적 신호입니다. 낮은 **콜/풋 비율**과 함께 스마트 머니는 **하락**에 대비하고 있습니다." },

    { id: "fb59", source: "global_markets", level: "beginner", symbol: "SPY", companyName: "S&P 500 ETF", category: "movement", correctAnswerIndex: 0, headline: "야간 시간대에 **유럽 시장**이 **ECB**의 깜짝 경기부양책 발표로 **2.5%** 상승했습니다. **아시아 시장**도 **1.8%** 상승 마감하며 **일본 닛케이**가 사상 최고치를 경신했습니다. 미국 시장은 어떤 방향으로 개장할까요?", explanation: "**유럽**과 **아시아** 시장의 강한 랠리는 미국 거래에 긍정적 모멘텀을 만듭니다. **ECB 부양책**은 글로벌 유동성을 높이고 국제적 강세는 리스크온 심리를 나타내며 **상승** 개장을 가리킵니다." },
    { id: "fb60", source: "global_markets", level: "advanced", symbol: "QQQ", companyName: "인베스코 QQQ", category: "movement", correctAnswerIndex: 1, headline: "**중국** 주식시장이 부동산 개발사 디폴트로 촉발된 **$3,000억** 전염 우려 속에 하루 만에 **6%** 급락했습니다. 중국 익스포저가 있는 **유럽 은행**들이 **4%** 하락했고 **MSCI 이머징마켓 지수**가 **22%** 하락하며 베어마켓에 진입했습니다. 미국 주식 방향은?", explanation: "**중국 6% 급락**에 **유럽 은행** 전염과 이머징마켓 **베어마켓** 진입은 시스템적 리스크오프 압력을 만듭니다. 위기 시 시장 간 상관관계가 높아지며 미국 주식에도 **하락** 압력이 높습니다." },

    { id: "fb61", source: "commodity_impact", level: "beginner", symbol: "AAPL", companyName: "애플", category: "impact", correctAnswerIndex: 1, headline: "중동 공급 차질로 **유가**가 **배럴당 $110**으로 **25%** 급등했습니다. **운송비**가 치솟고 **소비 지출** 전망이 하향 조정되었습니다. 대부분의 소비재 기업에 미치는 영향은?", explanation: "**유가 25% 급등**은 소비재 기업의 운송 및 생산 비용을 높이는 동시에 **소비자 구매력**을 감소시킵니다. 에너지 비용 상승은 소비자와 기업 모두에게 세금과 같은 효과를 주며 소비재 기업에 **악재**입니다." },
    { id: "fb62", source: "commodity_impact", level: "advanced", symbol: "GOOGL", companyName: "알파벳", category: "impact", correctAnswerIndex: 0, headline: "**구리 가격**이 3개월간 **파운드당 $5.20**으로 **18%** 상승했으며, 글로벌 **데이터센터 건설**과 **EV 인프라** 확대가 주요 원인입니다. **광산주**는 구리 상승에 뒤처지고 **구리/금 비율**은 **2년 최고**입니다. 산업 수요 관련 섹터 영향은?", explanation: "**데이터센터**와 **EV** 수요에 의한 **구리 18% 상승**은 강건한 산업 확장을 의미합니다. 높은 **구리/금 비율**은 리스크온 환경을 확인하며 구조적 성장 트렌드에 의한 원자재 강세는 산업 섹터에 **호재**입니다." },

    { id: "fb63", source: "currency_fx", level: "beginner", symbol: "MSFT", companyName: "마이크로소프트", category: "movement", correctAnswerIndex: 1, headline: "**미국 달러**가 지난 분기 주요 통화 바스켓 대비 **8%** 강세를 보였습니다. 해외 매출 비중 **50%** 이상인 **다국적 기업**들이 상당한 **환율 역풍**에 직면합니다. 수출 중심 주가는 어느 방향으로 움직일까요?", explanation: "달러 강세는 해외 수익을 달러로 환산할 때 가치를 줄입니다. **50% 이상 해외 매출** 기업에게 **8% 달러 강세**는 상당한 역풍을 만들어 주가를 **하락** 방향으로 압박합니다." },
    { id: "fb64", source: "currency_fx", level: "advanced", symbol: "AAPL", companyName: "애플", category: "movement", correctAnswerIndex: 0, headline: "**달러 인덱스(DXY)**가 **연준** 금리인하 시사 이후 6주간 **5%** 하락했습니다. **ECB**와 **일본은행**은 금리를 동결했습니다. **USD/JPY**가 **155에서 142**로, **EUR/USD**가 **1.15**로 상승했습니다. 미국 다국적 기업 실적 방향은?", explanation: "**DXY 5% 하락**은 해외 수익이 더 많은 달러로 환산되어 다국적 기업 실적에 **순풍**이 됩니다. 유리한 **USD/JPY**와 **EUR/USD** 움직임은 주요 시장 수익을 높이며 **상승** 실적 수정을 가리킵니다." },
  ];

  app.get("/api/news/quiz", async (req, res) => {
    const lang = (req.query.lang as string) || "en";
    const isKorean = lang === "ko";
    const level = (req.query.level as string) || "beginner";
    const sessionKey = `${req.ip || 'default'}-${lang}`;
    const dataSource = getNextDataSource(sessionKey);
    const category = dataSourceToCategory[dataSource];
    const templateVariant = Math.floor(Math.random() * 3);
    const templateKey = `${dataSource}-${templateVariant}`;

    try {
      const usSymbols = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'AMD', 'CRM'];
      const krSymbols = ['005930.KS', '000660.KS', '005380.KS', '035420.KS', '035720.KS', '373220.KS', '051910.KS', '006400.KS', '068270.KS', '259960.KS'];
      const symbols = dataSource === 'kospi_news' ? krSymbols : usSymbols;
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
      const fundamentals = await getStockFundamentals(randomSymbol);

      let fgData: { score: number; rating: string } | null = null;
      if (dataSource === 'fear_greed' || dataSource === 'macro_events') {
        fgData = await fetchFearGreedScore();
      }

      if (fundamentals && fundamentals.price > 0) {
        const isKrStock = randomSymbol.endsWith('.KS') || randomSymbol.endsWith('.KQ');
        const curr = isKrStock ? '₩' : '$';
        const capUnit = isKrStock ? `₩${(fundamentals.marketCap / 1e12).toFixed(1)}T` : `$${(fundamentals.marketCap / 1e9).toFixed(0)}B`;
        const peStr = fundamentals.peRatio ? `P/E Ratio: ${fundamentals.peRatio.toFixed(1)}` : '';
        const rawDiv = fundamentals.dividendYield;
        const divStr = rawDiv ? `Dividend Yield: ${(rawDiv * 100).toFixed(2)}%` : '';
        const capStr = fundamentals.marketCap ? `Market Cap: ${capUnit}` : '';
        const betaStr = fundamentals.beta ? `Beta: ${fundamentals.beta.toFixed(2)}` : '';
        const epsStr = fundamentals.eps ? `EPS: ${curr}${fundamentals.eps.toFixed(2)}` : '';
        const highStr = fundamentals.fiftyTwoWeekHigh ? `52W High: ${curr}${isKrStock ? fundamentals.fiftyTwoWeekHigh.toLocaleString() : fundamentals.fiftyTwoWeekHigh.toFixed(2)}` : '';
        const lowStr = fundamentals.fiftyTwoWeekLow ? `52W Low: ${curr}${isKrStock ? fundamentals.fiftyTwoWeekLow.toLocaleString() : fundamentals.fiftyTwoWeekLow.toFixed(2)}` : '';
        const sectorStr = fundamentals.sector || '';
        const fgStr = fgData ? `Fear & Greed Index: ${fgData.score}/100 (${fgData.rating})` : '';
        const fundamentalsContext = [peStr, divStr, capStr, betaStr, epsStr, highStr, lowStr, sectorStr, fgStr].filter(Boolean).join(', ');

        const prompt = buildAIPrompt(dataSource, fundamentals, fundamentalsContext, isKorean, level, templateVariant, fgData, curr);

        const aiResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.95,
          max_tokens: 600,
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

            addToHistory(sessionKey, quizId, templateKey);

            const safeHeadline = ensureBoldKeywords(parsed.headline, fundamentals.symbol, fundamentals.name);
            const safeExplanation = ensureBoldKeywords(parsed.explanation, fundamentals.symbol, fundamentals.name);

            return res.json({
              id: quizId,
              headline: safeHeadline,
              symbol: fundamentals.symbol,
              companyName: fundamentals.name,
              category: aiCategory,
              options: isKorean ? opts.ko : opts.en,
              correctAnswerIndex: correctIdx,
              explanation: safeExplanation,
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
    if (candidates.length === 0) candidates = fallbacks.filter(q => !isInHistory(sessionKey, q.id));
    if (candidates.length === 0) candidates = fallbacks;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const opts = categoryOptions[chosen.category];

    addToHistory(sessionKey, chosen.id, `fb-${chosen.source}`);

    res.json({
      ...chosen,
      options: isKorean ? opts.ko : opts.en,
      isRealTime: false,
      source: chosen.source,
    });
  });

  // === Economic Calendar ===
  app.get("/api/economic-calendar", isAuthenticated, (req, res) => {
    try {
      const yearParam = parseInt(req.query.year as string);
      const monthParam = parseInt(req.query.month as string);
      const now = new Date();
      const year = isNaN(yearParam) ? now.getUTCFullYear() : yearParam;
      const month = isNaN(monthParam) ? now.getUTCMonth() + 1 : monthParam;
      const events = getEventsByMonth(year, month);
      res.json({ events, year, month });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch economic calendar" });
    }
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
