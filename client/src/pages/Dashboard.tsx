import { useUser } from "@/hooks/use-user";
import { useQuests } from "@/hooks/use-quests";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { QuestCard } from "@/components/quests/QuestCard";
import { DinoEgg } from "@/components/DinoEgg";
import { Link } from "wouter";
import { ArrowRight, Trophy, TrendingUp, Target as TargetIcon, Star } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { translations } from "@/lib/translations";

export default function Dashboard() {
  const { data: user, isLoading: isUserLoading } = useUser();
  const { data: quests, isLoading: isQuestsLoading } = useQuests();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];

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
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
                {t.welcome_back}, {user?.username}!
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
          <h3 className="font-display font-bold text-lg mb-2">Your Dino Egg</h3>
          <DinoEgg level={currentLevel} />
          <p className="text-xs text-muted-foreground mt-2">Hatching at Level 10</p>
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
            {quests?.map((quest, i) => (
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
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Star className="w-6 h-6 text-yellow-500" />
              My Top Picks
            </h2>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-lg">
             {/* Mock Portfolio Picks */}
             <MarketIndex symbol="NVDA" name="NVIDIA Corp" price={822.79} change={4.5} isPos={true} />
             <MarketIndex symbol="TSLA" name="Tesla, Inc." price={202.64} change={-1.2} isPos={false} />
             <MarketIndex symbol="AAPL" name="Apple Inc." price={188.85} change={0.3} isPos={true} />

             <div className="pt-4 border-t border-border mt-4">
               <Link href="/watchlist" className="flex items-center justify-center gap-2 w-full py-3 bg-muted hover:bg-muted/80 rounded-xl font-bold text-sm transition-colors">
                  Modify Portfolio <ArrowRight className="w-4 h-4" />
               </Link>
             </div>
          </div>
          
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-accent" />
              {t.market_pulse}
            </h2>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-lg">
             <MarketIndex symbol="SPY" name="S&P 500" price={502.45} change={1.2} isPos={true} />
             <MarketIndex symbol="QQQ" name="Nasdaq" price={428.30} change={-0.5} isPos={false} />
             <MarketIndex symbol="DIA" name="Dow Jones" price={391.20} change={0.8} isPos={true} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketIndex({ symbol, name, price, change, isPos }: { symbol: string, name: string, price: number, change: number, isPos: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h4 className="font-bold">{symbol}</h4>
        <p className="text-xs text-muted-foreground">{name}</p>
      </div>
      <div className="text-right">
        <div className="font-mono font-medium">${price.toFixed(2)}</div>
        <div className={cn("text-xs font-bold", isPos ? "text-primary" : "text-destructive")}>
           {isPos ? "+" : ""}{change}%
        </div>
      </div>
    </div>
  );
}
