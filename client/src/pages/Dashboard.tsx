import { useState, useRef, useCallback } from "react";
import { useUser } from "@/hooks/use-user";
import { useQuests } from "@/hooks/use-quests";
import { BreakingNewsQuiz } from "@/components/BreakingNewsQuiz";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { ArrowRight, Trophy, ChevronRight, Flame, BookOpen, Search, Newspaper, Clock, ExternalLink, ChevronLeft, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { translations } from "@/lib/translations";
import { useQuery } from "@tanstack/react-query";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useTimezone } from "@/contexts/TimezoneContext";
import { cleanCompanyName } from "@/lib/stockUtils";
import { getLocalizedCompanyName } from "@/lib/stockNames";
import { calculateLevel, xpProgressInLevel } from "@shared/leveling";

interface MarketMoodData {
  index: number;
  label: string;
  dinoAdvice: string;
}

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: number;
  thumbnail: string | null;
  koreanSummary?: string | null;
  japaneseSummary?: string | null;
}

interface NewsResponse {
  news: NewsItem[];
  count: number;
  total: number;
  page: number;
  hasMore: boolean;
  source: string;
}

function timeAgo(timestamp: number, lang: string): string {
  const now = Date.now();
  const diff = Math.floor((now - timestamp * 1000) / 1000);
  if (diff < 60) return lang === "ko" ? "방금" : lang === "ja" ? "たった今" : "just now";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return lang === "ko" ? `${m}분 전` : lang === "ja" ? `${m}分前` : `${m}m ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return lang === "ko" ? `${h}시간 전` : lang === "ja" ? `${h}時間前` : `${h}h ago`;
  }
  const d = Math.floor(diff / 86400);
  return lang === "ko" ? `${d}일 전` : lang === "ja" ? `${d}日前` : `${d}d ago`;
}

const NEWS_EMOJI_FALLBACKS = ["📈", "💹", "📊", "🏦", "💰", "🌐", "📉", "🔔", "💡", "🏛️"];

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

interface HotIssueItem {
  title: string;
  summary: string;
  link: string;
  publisher: string;
  publishedAt: number;
  thumbnail: string | null;
  isHot: boolean;
  symbol: string;
}

interface HotIssuesResponse {
  issues: HotIssueItem[];
  count: number;
  fetchedAt: number;
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
  const lang = (user?.language || "ko") as keyof typeof translations;
  const t = translations[lang];
  const isKo = lang === "ko";
  const { formatPrice, isKoreanStock } = useCurrency();
  const { formatTime, timezoneLabel } = useTimezone();

  const displayName = getNickname(user?.nickname || "Guest");

  // News carousel state
  const carouselRef = useRef<HTMLDivElement>(null);
  const [carouselPage, setCarouselPage] = useState(0);
  const CARD_W = 220; // card width + gap (208 + 12)

  const scrollToPage = useCallback((idx: number, total: number) => {
    const el = carouselRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(idx, total - 1));
    el.scrollTo({ left: clamped * CARD_W, behavior: "smooth" });
    setCarouselPage(clamped);
  }, []);

  const handleCarouselScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const page = Math.round(el.scrollLeft / CARD_W);
    setCarouselPage(page);
  }, []);

  const { data: moodData, isLoading: isMoodLoading } = useQuery<MarketMoodData>({
    queryKey: ["/api/market/mood", lang],
    queryFn: async () => {
      const res = await fetch(`/api/market/mood?lang=${lang}`);
      if (!res.ok) throw new Error("Failed to fetch market mood");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: newsData, isLoading: isNewsLoading } = useQuery<NewsResponse>({
    queryKey: ["/api/news", lang, "dashboard"],
    queryFn: async () => {
      const res = await fetch(`/api/news?lang=${lang}&limit=10&page=1`);
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });

  const { data: hotIssuesData, isLoading: isHotLoading } = useQuery<HotIssuesResponse>({
    queryKey: ["/api/news/hot-issues"],
    queryFn: async () => {
      const res = await fetch("/api/news/hot-issues");
      if (!res.ok) throw new Error("Failed to fetch hot issues");
      return res.json();
    },
    staleTime: 1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 20,
    retry: 1,
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

      {/* ── Header + Search ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-2xl font-display font-bold mb-4" data-testid="text-dashboard-title">
          {isKo ? `안녕하세요, ${displayName} 👋` : `Hi, ${displayName} 👋`}
        </h1>
        <button
          type="button"
          onClick={() => navigate("/search")}
          className="w-full flex items-center gap-3 h-12 px-4 rounded-2xl bg-muted/60 border border-border hover:border-foreground/20 hover:bg-muted transition-all text-left group"
          data-testid="button-dashboard-search"
        >
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">
            {isKo ? "주식 검색… 한국어 가능 (도요타, 엔비디아…)" : "Search stocks… US, KR, JP, EU"}
          </span>
        </button>
      </motion.div>

      {/* ── Section: 오늘의 이슈 Preview ── */}
      {(isHotLoading || (hotIssuesData && hotIssuesData.issues.length > 0)) && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-primary fill-primary" />
            <h2 className="text-base font-bold text-foreground">
              {isKo ? "오늘의 이슈" : lang === "ja" ? "今日のニュース" : "Today's Issues"}
            </h2>
            <Link
              href="/hot-issues"
              className="ml-auto flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              data-testid="link-hot-issues-all"
            >
              {isKo ? "전체 보기" : lang === "ja" ? "すべて見る" : "See all"}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isHotLoading ? (
            <div className="space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(hotIssuesData?.issues || []).slice(0, 3).map((issue, idx) => (
                <a
                  key={idx}
                  href={issue.link || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all hover:shadow-sm active:scale-[0.99] cursor-pointer group",
                    issue.isHot
                      ? "border-primary/35 bg-primary/5 hover:border-primary/60 hover:bg-primary/10"
                      : "border-border bg-muted/40 hover:bg-muted/70"
                  )}
                  data-testid={`card-hot-issue-${idx}`}
                >
                  {issue.isHot && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground shrink-0">
                      <Flame className="w-2.5 h-2.5" />
                      HOT
                    </span>
                  )}
                  <p className="text-sm font-semibold text-foreground leading-snug flex-1 line-clamp-1 group-hover:text-primary transition-colors">
                    {issue.title}
                  </p>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          )}
        </motion.section>
      )}

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

      {/* ── Top Headlines Horizontal Carousel ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        data-testid="section-top-headlines"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground" data-testid="label-top-headlines">
              {lang === "ko" ? "주요 헤드라인" : lang === "ja" ? "主要ニュース" : "Top Headlines"}
            </h2>
          </div>
          <a href="https://finance.yahoo.com/news/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-bold text-primary"
            data-testid="link-all-news"
          >
            {lang === "ko" ? "더보기" : lang === "ja" ? "もっと見る" : "More"}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {isNewsLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex-shrink-0 w-52 h-44 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : newsData && newsData.news.length > 0 ? (() => {
          const totalItems = newsData.news.length;
          const visibleCount = 3;
          const maxPage = Math.max(0, totalItems - visibleCount);
          return (
            <div className="relative">
              {/* Prev arrow — visible on md+ screens */}
              <button
                onClick={() => scrollToPage(carouselPage - 1, totalItems)}
                disabled={carouselPage === 0}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-8 h-8 rounded-full bg-card border border-border shadow items-center justify-center text-primary hover:bg-primary/10 transition disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Previous"
                data-testid="btn-news-prev"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Next arrow */}
              <button
                onClick={() => scrollToPage(carouselPage + 1, totalItems)}
                disabled={carouselPage >= maxPage}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-8 h-8 rounded-full bg-card border border-border shadow items-center justify-center text-primary hover:bg-primary/10 transition disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Next"
                data-testid="btn-news-next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Scroll track */}
              <div
                ref={carouselRef}
                onScroll={handleCarouselScroll}
                className="flex gap-3 overflow-x-auto pb-3 -mx-5 px-5 scrollbar-hide snap-x snap-mandatory"
                data-testid="carousel-news"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {newsData.news.map((item, idx) => {
                  const headline = lang === "ko" && item.koreanSummary
                    ? item.koreanSummary
                    : lang === "ja" && item.japaneseSummary
                    ? item.japaneseSummary
                    : item.title;
                  const fallbackEmoji = NEWS_EMOJI_FALLBACKS[idx % NEWS_EMOJI_FALLBACKS.length];

                  return (
                    <a
                      key={idx}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 w-52 snap-start rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all overflow-hidden group"
                      data-testid={`news-card-${idx}`}
                    >
                      {item.thumbnail ? (
                        <div className="w-full h-24 overflow-hidden bg-muted">
                          <img
                            src={item.thumbnail}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-24 bg-primary/5 flex items-center justify-center border-b border-border">
                          <span className="text-4xl">{fallbackEmoji}</span>
                        </div>
                      )}
                      <div className="p-3 space-y-2">
                        <p className="text-xs font-semibold leading-snug line-clamp-3 text-foreground" data-testid={`news-headline-${idx}`}>
                          {headline}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[80px]">
                            {item.publisher}
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                            <Clock className="w-2.5 h-2.5" />
                            {timeAgo(item.publishedAt, lang)}
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>

              {/* Pagination dots */}
              {totalItems > 1 && (
                <div className="flex justify-center gap-1.5 mt-3" data-testid="carousel-dots">
                  {newsData.news.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => scrollToPage(idx, totalItems)}
                      className={cn(
                        "rounded-full transition-all",
                        idx === carouselPage
                          ? "w-4 h-2 bg-primary"
                          : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                      )}
                      aria-label={`Go to news ${idx + 1}`}
                      data-testid={`dot-news-${idx}`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })() : null}
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
            {quotes.map((quote) => {
              const displayStockName = getLocalizedCompanyName(cleanCompanyName(quote.name || quote.symbol), lang);
              return (
              <div
                key={quote.symbol}
                className="flex items-center justify-between py-4 cursor-pointer hover-elevate rounded-lg px-2 -mx-2"
                onClick={() => navigate(`/stock/${quote.symbol}`)}
                data-testid={`stock-row-${quote.symbol}`}
              >
                <div className="min-w-0">
                  <p className="text-base font-bold truncate max-w-[180px]" data-testid={`text-name-${quote.symbol}`}>{displayStockName}</p>
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
              );
            })}

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
