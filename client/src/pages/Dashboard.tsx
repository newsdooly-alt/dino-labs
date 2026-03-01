import { useUser } from "@/hooks/use-user";
import { useQuests } from "@/hooks/use-quests";
import { BreakingNewsQuiz } from "@/components/BreakingNewsQuiz";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { ArrowRight, Trophy, ChevronRight, Flame, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { translations } from "@/lib/translations";
import { useQuery } from "@tanstack/react-query";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useTimezone } from "@/contexts/TimezoneContext";
import { cleanCompanyName } from "@/lib/stockUtils";
import { calculateLevel, xpProgressInLevel } from "@shared/leveling";

interface MarketMoodData {
  index: number;
  label: string;
  dinoAdvice: string;
}

interface LiveStockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  isMarketOpen: boolean;
  lastUpdated: string;
  isStale: boolean;
}

interface LiveStockResponse {
  quotes: LiveStockQuote[];
  dinoMessage: string | null;
  isMarketOpen: boolean;
  fetchedAtFormatted?: string;
  fetchedAtUTC?: number;
  source?: string;
}

function getNickname(fallback: string): string {
  try {
    const saved = localStorage.getItem("dinolingo_settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.nickname && parsed.nickname.trim()) return parsed.nickname;
    }
  } catch {}
  return fallback;
}

export default function Dashboard() {
  const { data: user, isLoading: isUserLoading } = useUser();
  const { data: quests, isLoading: isQuestsLoading } = useQuests();
  const [, navigate] = useLocation();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];
  const isKo = lang === "ko";
  const { formatPrice, isKoreanStock } = useCurrency();
  const { formatTime, timezoneLabel } = useTimezone();

  const displayName = getNickname(user?.nickname || "Guest");

  const { data: moodData, isLoading: isMoodLoading } = useQuery<MarketMoodData>({
    queryKey: ["/api/market/mood", lang],
    queryFn: async () => {
      const res = await fetch(`/api/market/mood?lang=${lang}`);
      if (!res.ok) throw new Error("Failed to fetch market mood");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const watchlistSymbols = ["NVDA", "TSLA", "AAPL"];
  const { data: stockData, isLoading: isStockLoading } = useQuery<LiveStockResponse>({
    queryKey: ["/api/stocks/live", watchlistSymbols.join(",")],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live?symbols=${watchlistSymbols.join(",")}`);
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    retry: 3,
  });

  if (isUserLoading || isQuestsLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalXp = (user as any)?.totalXp || 0;
  const currentLevel = calculateLevel(totalXp);
  const levelProgress = xpProgressInLevel(totalXp);
  const xpPercent = levelProgress.percent;

  const DAILY_QUEST_COUNT = 6;
  const completedQuests = Math.min(quests?.filter(q => q.isCompleted)?.length || 0, DAILY_QUEST_COUNT);
  const totalQuests = DAILY_QUEST_COUNT;

  const moodIndex = moodData?.index ?? 50;
  const moodLabel = moodData?.label ?? "Neutral";
  const moodAdvice = moodData?.dinoAdvice ?? (isKo ? "침착하게 현명하게 투자하세요!" : "Stay calm and invest wisely!");

  const getMoodColor = (idx: number) => {
    if (idx <= 25) return "text-red-500";
    if (idx <= 45) return "text-orange-500";
    if (idx <= 55) return "text-yellow-500";
    if (idx <= 75) return "text-lime-500";
    return "text-green-500";
  };

  const getMoodBarColor = (idx: number) => {
    if (idx <= 25) return "bg-red-500";
    if (idx <= 45) return "bg-orange-500";
    if (idx <= 55) return "bg-yellow-500";
    if (idx <= 75) return "bg-lime-500";
    return "bg-green-500";
  };

  const quotes = stockData?.quotes?.filter(q => q.price > 0) || [];

  return (
    <div className="w-full max-w-lg mx-auto px-5 py-8 space-y-10">

      {/* ── Section 1: Market Temperature ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        data-testid="section-market-temperature"
      >
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4" data-testid="label-market-temp">
          {t.market_temperature}
        </h2>

        {isMoodLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded-2xl" />
            <div className="h-3 bg-muted rounded-full w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-5">
              <div className="shrink-0">
                <span className={cn("text-6xl font-mono font-black tabular-nums leading-none", getMoodColor(moodIndex))} data-testid="text-mood-index">
                  {moodIndex}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold leading-tight" data-testid="text-mood-label">{moodLabel}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-snug line-clamp-2" data-testid="text-dino-advice">
                  {moodAdvice}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${moodIndex}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={cn("h-full rounded-full", getMoodBarColor(moodIndex))}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t.extreme_fear}</span>
                <span>{t.extreme_greed}</span>
              </div>
            </div>
          </div>
        )}
      </motion.section>

      {/* ── Section 2: Quick Watchlist ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        data-testid="section-watchlist"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground" data-testid="label-watchlist">
            {t.my_top_picks}
          </h2>
          <Link href="/recommended" className="text-xs font-bold text-primary" data-testid="link-view-all-recommended">
            {t.view_all}
          </Link>
        </div>

        {isStockLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex justify-between items-center py-3">
                <div className="space-y-1">
                  <div className="h-5 bg-muted rounded w-14" />
                  <div className="h-3 bg-muted rounded w-28" />
                </div>
                <div className="space-y-1 text-right">
                  <div className="h-5 bg-muted rounded w-20" />
                  <div className="h-3 bg-muted rounded w-12 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {quotes.map((quote) => (
              <div
                key={quote.symbol}
                className="flex items-center justify-between py-4 cursor-pointer hover-elevate rounded-lg px-2 -mx-2"
                onClick={() => navigate(`/stock/${quote.symbol}`)}
                data-testid={`stock-row-${quote.symbol}`}
              >
                <div className="min-w-0">
                  <p className="text-base font-bold truncate max-w-[180px]" data-testid={`text-name-${quote.symbol}`}>{cleanCompanyName(quote.name || quote.symbol)}</p>
                  <p className="text-xs text-muted-foreground" data-testid={`text-symbol-${quote.symbol}`}>{quote.symbol}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-base font-mono font-bold tabular-nums" data-testid={`text-price-${quote.symbol}`}>
                      {formatPrice(quote.price, { nativeCurrency: isKoreanStock(quote.symbol) ? 'KRW' : 'USD' })}
                    </p>
                    <p className={cn(
                      "text-xs font-bold tabular-nums",
                      quote.changePercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )} data-testid={`text-change-${quote.symbol}`}>
                      {quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </div>
            ))}

            {quotes.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground" data-testid="text-loading-stocks">
                {t.loading_stocks}
              </p>
            )}
          </div>
        )}

        {stockData && (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground" data-testid="market-status">
            <span className={cn("w-2 h-2 rounded-full shrink-0", stockData.isMarketOpen ? "bg-green-500 animate-pulse" : "bg-gray-400")} />
            <span>{stockData.isMarketOpen ? t.market_open : t.market_closed}</span>
            {(stockData.fetchedAtUTC || stockData.fetchedAtFormatted) && (
              <>
                <span className="mx-1">·</span>
                <span data-testid="text-market-time">
                  {stockData.fetchedAtUTC ? formatTime(stockData.fetchedAtUTC) : stockData.fetchedAtFormatted}
                </span>
              </>
            )}
          </div>
        )}
      </motion.section>

      {/* ── Section 3: Daily Goal Progress ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        data-testid="section-daily-goal"
      >
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4" data-testid="label-daily-goal">
          {t.daily_progress}
        </h2>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-base" data-testid="text-quest-summary">
                  {completedQuests} {t.of} {totalQuests} {t.quests_completed}
                </p>
                <p className="text-xs text-muted-foreground" data-testid="text-quest-status">
                  {completedQuests === totalQuests
                    ? t.all_done_for_today
                    : `${totalQuests - completedQuests} ${t.remaining}`}
                </p>
              </div>
            </div>
            <Link href="/quests" data-testid="link-go-quests">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center hover-elevate">
                <ArrowRight className="w-4 h-4 text-primary" />
              </div>
            </Link>
          </div>

          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden" data-testid="progress-quests">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${totalQuests > 0 ? (completedQuests / totalQuests) * 100 : 0}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-primary rounded-full"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5 text-yellow-500" />
              <span className="font-medium">{t.level} {currentLevel}</span>
              <span>·</span>
              <span>{levelProgress.currentXpInLevel}/{levelProgress.xpNeededForNext} {t.xp}</span>
            </div>
            {(user as any)?.streak > 0 && (
              <div className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span className="font-medium">{(user as any).streak} {t.day_streak}</span>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* ── Section 4: Today's Insight ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        data-testid="section-todays-insight"
      >
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4" data-testid="label-todays-insight">
          {t.todays_insight}
        </h2>

        <BreakingNewsQuiz />
      </motion.section>

    </div>
  );
}
