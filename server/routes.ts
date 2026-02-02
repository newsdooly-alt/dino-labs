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
import { getStockQuote, getMultipleQuotes, getRealTimeQuizQuestion, searchStocks, getStockHistory, getStockInfo, getMarketNews, getStockNews } from "./stockService";

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
  app.get(api.profiles.get.path, isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    
    let profile = await storage.getUserProfile(userId);
    if (!profile) {
      // Auto-create profile for new users (use upsert to handle race conditions)
      profile = await storage.upsertUserProfile({
        id: userId,
        nickname: req.user?.claims?.first_name || "Player",
        language: "en",
        favoriteStocks: []
      });
    }
    res.json(profile);
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
        const newQuests = await generateDailyQuests(userId, profile.language || 'en');
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
  const MOOD_CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

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
      // Fetch from Alternative.me Fear & Greed Index API
      const response = await fetch("https://api.alternative.me/fng/?limit=1");
      const data = await response.json();
      const fngValue = parseInt(data.data?.[0]?.value || "50");
      const fngClassification = data.data?.[0]?.value_classification || "Neutral";

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
