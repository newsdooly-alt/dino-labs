import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MarketMoodData {
  index: number;
  label: string;
  dinoAdvice: string;
}

export function MarketMood() {
  const { data, isLoading } = useQuery<MarketMoodData>({
    queryKey: ["/api/market/mood"],
    staleTime: 1000 * 60 * 5, // 5 min cache
  });

  const getMoodColor = (index: number) => {
    if (index <= 25) return "text-red-500";
    if (index <= 45) return "text-orange-500";
    if (index <= 55) return "text-yellow-500";
    if (index <= 75) return "text-lime-500";
    return "text-green-500";
  };

  const getMoodBg = (index: number) => {
    if (index <= 25) return "from-red-500/20 to-red-600/10";
    if (index <= 45) return "from-orange-500/20 to-orange-600/10";
    if (index <= 55) return "from-yellow-500/20 to-yellow-600/10";
    if (index <= 75) return "from-lime-500/20 to-lime-600/10";
    return "from-green-500/20 to-green-600/10";
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 animate-pulse" data-testid="market-mood-loading">
        <div className="h-6 bg-muted rounded w-1/2 mb-4" />
        <div className="h-24 bg-muted rounded" />
      </div>
    );
  }

  const index = data?.index ?? 50;
  const label = data?.label ?? "Neutral";
  const advice = data?.dinoAdvice ?? "Stay calm and invest wisely!";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-gradient-to-br border border-border rounded-3xl p-6 shadow-lg overflow-hidden relative",
        getMoodBg(index)
      )}
      data-testid="market-mood-card"
    >
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
            <path d="M16 16c0-4.4-3.6-8-8-8s-8 3.6-8 8" />
            <path d="M2 16h12" />
            <path d="M7 8V5a3 3 0 0 1 6 0v3" />
          </svg>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-lg mb-1">Dino's Market Mood</h3>
          <div className="flex items-center gap-3 mb-3">
            <span className={cn("text-3xl font-mono font-bold", getMoodColor(index))}>
              {index}
            </span>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </span>
          </div>
          
          <div className="w-full h-3 bg-background/50 rounded-full overflow-hidden mb-4">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${index}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                index <= 25 ? "bg-red-500" :
                index <= 45 ? "bg-orange-500" :
                index <= 55 ? "bg-yellow-500" :
                index <= 75 ? "bg-lime-500" : "bg-green-500"
              )}
            />
          </div>

          <p className="text-sm text-foreground/80 italic leading-relaxed">
            "{advice}"
          </p>
        </div>
      </div>

      <div className="flex justify-between text-xs text-muted-foreground mt-4 px-1">
        <span>Extreme Fear</span>
        <span>Extreme Greed</span>
      </div>
    </motion.div>
  );
}
