import { useUser } from "@/hooks/use-user";
import { useQuests } from "@/hooks/use-quests";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { QuestCard } from "@/components/quests/QuestCard";
import { DinoEgg } from "@/components/DinoEgg";
import { MarketMood } from "@/components/MarketMood";
import { BreakingNewsQuiz } from "@/components/BreakingNewsQuiz";
import { LiveStockCard } from "@/components/LiveStockCard";
import { MarketHeadlines } from "@/components/MarketHeadlines";
import { Link } from "wouter";
import { ArrowRight, Trophy, TrendingUp, Target as TargetIcon, Star, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { translations } from "@/lib/translations";
import { queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

function getNickname(fallback: string): string {
  try {
    const saved = localStorage.getItem("dinolingo_settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.nickname && parsed.nickname.trim()) {
        return parsed.nickname;
      }
    }
  } catch (e) {
    console.error("Failed to parse settings:", e);
  }
  return fallback;
}

export default function Dashboard() {
  const { data: user, isLoading: isUserLoading } = useUser();
  const { data: quests, isLoading: isQuestsLoading } = useQuests();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  
  useEffect(() => {
    const updateDisplayName = () => {
      setDisplayName(getNickname(user?.nickname || "Guest"));
    };
    updateDisplayName();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "dinolingo_settings") {
        updateDisplayName();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    
    const interval = setInterval(updateDisplayName, 1000);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [user?.nickname]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Invalidate all stock-related queries to force fresh data (use predicate to match all symbol variations)
    await queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey[0];
        return key === "/api/stocks/live" || key === "/api/market/mood";
      }
    });
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  if (isUserLoading || isQuestsLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
         <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Calculate Level progress
  const currentLevel = user?.level || 1;
  const currentXP = user?.xp || 0;
  const xpForNextLevel = currentLevel * 100;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10">
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Welcome Banner */}
        <section className="lg:col-span-3 relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900 to-green-900 border border-white/10 shadow-2xl p-8 md:p-12 text-white">
          <div className="relative z-10 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-4" data-testid="text-welcome-name">
                {t.welcome_back}, {displayName}!
              </h1>
              <p className="text-lg md:text-xl text-emerald-100 mb-8 max-w-lg leading-relaxed">
                {t.market_moving}
              </p>
              
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 max-w-md">
                 <div className="flex justify-between items-center mb-2">
                   <div className="flex items-center gap-2">
                     <Trophy className="w-5 h-5 text-yellow-400 fill-current" />
                     <span className="font-bold">{t.level} {currentLevel}</span>
                   </div>
                   <span className="text-sm font-medium opacity-80">{currentXP} / {xpForNextLevel} {t.xp}</span>
                 </div>
                 <ProgressBar current={currentXP} max={xpForNextLevel} color="primary" showText={false} className="h-3" />
              </div>
            </motion.div>
          </div>
          
          <div className="absolute right-0 top-0 w-1/2 h-full opacity-10 pointer-events-none">
             <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
               <path fill="#10B981" d="M44.7,-76.4C58.9,-69.2,71.8,-59.1,79.6,-46.3C87.4,-33.5,90.1,-18,88.8,-2.2C87.5,13.6,82.2,29.7,73.1,43.2C64,56.7,51.1,67.6,37.1,73.6C23.1,79.6,8,80.7,-6.2,78.8C-20.4,76.9,-33.7,72,-45.5,64.2C-57.3,56.4,-67.6,45.7,-74.6,33.1C-81.6,20.5,-85.3,6,-82.7,-7.4C-80.1,-20.8,-71.2,-33.1,-61.1,-43.3C-51,-53.5,-39.7,-61.6,-27.6,-69.8C-15.5,-78,-2.6,-86.3,10.1,-84.9C22.8,-83.5,44.7,-76.4,44.7,-76.4Z" transform="translate(100 100)" />
             </svg>
          </div>
        </section>

        {/* Dino Egg Growth */}
        <section className="bg-card border border-border rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-lg">
          <h3 className="font-display font-bold text-lg mb-2">{t.your_dino_egg}</h3>
          <DinoEgg level={currentLevel} />
          <p className="text-xs text-muted-foreground mt-2">{t.hatching_at_level}</p>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <TargetIcon className="w-6 h-6 text-primary" />
              {t.daily_quests}
            </h2>
            <Link href="/quests" className="text-primary font-bold text-sm hover:underline">{t.view_all}</Link>
          </div>
          
          <div className="grid gap-6">
            {quests?.slice(0, 3).map((quest, i) => (
              <motion.div
                key={quest.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <QuestCard quest={quest} />
              </motion.div>
            ))}
          </div>

          <MarketHeadlines />
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Star className="w-6 h-6 text-yellow-500" />
              {t.my_top_picks}
            </h2>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh-data"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
              {lang === "ko" ? "새로고침" : "Refresh"}
            </Button>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6 shadow-lg">
             <LiveStockCard symbols={["NVDA", "TSLA", "AAPL"]} />

             <div className="pt-4 border-t border-border mt-4">
               <Link href="/watchlist" className="flex items-center justify-center gap-2 w-full py-3 bg-muted hover:bg-muted/80 rounded-xl font-bold text-sm transition-colors" data-testid="link-modify-portfolio">
                  {t.modify_portfolio} <ArrowRight className="w-4 h-4" />
               </Link>
             </div>
          </div>
          
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-accent" />
              {t.market_pulse}
            </h2>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6 shadow-lg">
             <LiveStockCard symbols={["SPY", "QQQ", "DIA"]} />
          </div>

          {/* Dino's Market Mood */}
          <MarketMood />

          {/* Breaking News Quiz */}
          <BreakingNewsQuiz />
        </div>
      </div>
    </div>
  );
}

