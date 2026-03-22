import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useEggs } from "@/hooks/use-eggs";
import { translations } from "@/lib/translations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Newspaper, RefreshCw, CheckCircle2, Trophy, ArrowLeft, BookOpen, ChevronDown, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import confetti from "canvas-confetti";
import { NewsDetailModal, NewsItem as ModalNewsItem } from "@/components/NewsDetailModal";

const DAILY_NEWS_GOAL = 3;
const NEWS_COMPLETE_KEY = "dinolingo_news_complete_shown";

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

function hasShownNewsCompleteToday(): boolean {
  return localStorage.getItem(NEWS_COMPLETE_KEY) === getTodayDateString();
}

function markNewsCompleteShownToday(): void {
  localStorage.setItem(NEWS_COMPLETE_KEY, getTodayDateString());
}

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: number;
  relatedSymbol: string;
  thumbnail: string | null;
  koreanSummary?: string;
  isMarketOverview?: boolean;
}

interface NewsResponse {
  news: NewsItem[];
  count: number;
  total: number;
  page: number;
  hasMore: boolean;
  source: string;
}

export function DailyNews() {
  const { data: user } = useUser();
  const { addXpToEggs } = useEggs();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const lang = (user?.language || "ko") as keyof typeof translations;
  const t = translations[lang] as Record<string, string>;

  const [showCelebration, setShowCelebration] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ModalNewsItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [allNews, setAllNews] = useState<NewsItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data, isLoading } = useQuery<NewsResponse>({
    queryKey: ["/api/news", lang, 1],
    queryFn: async () => {
      const res = await fetch(`/api/news?lang=${lang}&page=1&limit=5`);
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
    staleTime: 300000,
  });

  useEffect(() => {
    if (data?.news) {
      setAllNews(data.news);
      setHasMore(data.hasMore || false);
      setCurrentPage(1);
    }
  }, [data]);

  const { data: readCount } = useQuery<{ count: number }>({
    queryKey: ["/api/news/read-count"],
    queryFn: async () => {
      const res = await fetch("/api/news/read-count", { credentials: "include" });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/news/read", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news/read-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quests"] });
    },
  });

  const newsReadProgress = readCount?.count || 0;
  const questComplete = newsReadProgress >= DAILY_NEWS_GOAL;

  useEffect(() => {
    if (questComplete && !hasShownNewsCompleteToday()) {
      markNewsCompleteShownToday();
      setShowCelebration(true);
      addXpToEggs(15);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
        colors: ["#3b82f6", "#22c55e", "#fbbf24"],
      });
    }
  }, [questComplete, addXpToEggs]);

  const handleReadArticle = (item: NewsItem) => {
    if (newsReadProgress < DAILY_NEWS_GOAL) {
      markAsReadMutation.mutate();
      addXpToEggs(5);
    }
    setSelectedItem({
      title: item.title,
      summary: item.koreanSummary || item.title,
      link: item.link,
      publisher: item.publisher,
      publishedAt: item.publishedAt,
      symbol: item.relatedSymbol,
      isHot: false,
    });
  };

  const handleLoadMore = async () => {
    const nextPage = currentPage + 1;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/news?lang=${lang}&page=${nextPage}&limit=5`);
      if (res.ok) {
        const result: NewsResponse = await res.json();
        setAllNews(prev => [...prev, ...result.news]);
        setHasMore(result.hasMore || false);
        setCurrentPage(nextPage);
      }
    } catch (err) {
      console.error("Failed to load more news:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <>
    <div className="space-y-6">
      <Card className="border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Newspaper className="w-5 h-5 text-blue-500" />
              <span className="font-medium">{t.news_read_progress}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (newsReadProgress / DAILY_NEWS_GOAL) * 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-sm font-mono" data-testid="text-news-progress">
                {Math.min(newsReadProgress, DAILY_NEWS_GOAL)}/{DAILY_NEWS_GOAL}
              </span>
              {questComplete && (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <Card className="border-green-500/30 bg-gradient-to-r from-green-500/10 via-blue-500/10 to-purple-500/10">
              <CardContent className="pt-6 pb-5">
                <div className="flex flex-col items-center text-center gap-4">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-green-500 flex items-center justify-center"
                  >
                    <Trophy className="w-8 h-8 text-white" />
                  </motion.div>

                  <div>
                    <h3 className="font-bold text-xl mb-1" data-testid="text-news-complete-title">
                      {t.daily_news_complete}
                    </h3>
                    <p className="text-foreground/80 text-sm" data-testid="text-news-complete-msg">
                      {t.daily_news_complete_msg}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3 justify-center">
                    <Button
                      onClick={() => {
                        setShowCelebration(false);
                      }}
                      className="gap-2"
                      data-testid="button-read-more-news"
                    >
                      <BookOpen className="w-4 h-4" />
                      {t.read_more_news}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/")}
                      className="gap-2"
                      data-testid="button-back-to-dashboard"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      {t.back_to_dashboard}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowCelebration(false)}
                      data-testid="button-dismiss-news-complete"
                    >
                      {lang === "ko" ? "닫기" : "Dismiss"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {questComplete && !showCelebration && (
        <Card className="border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="font-medium text-green-600 dark:text-green-400">{t.daily_news_complete}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate("/")}
                data-testid="button-go-dashboard-from-news"
              >
                {t.back_to_dashboard}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">{t.daily_news}</h2>
        <p className="text-muted-foreground">{t.news_description}</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="py-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : allNews.length > 0 ? (
        <div className="space-y-4">
          {allNews.map((item, idx) => (
            <motion.div
              key={`${item.title}-${idx}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx, 5) * 0.1 }}
            >
              <Card className={`overflow-hidden transition-colors ${item.isMarketOverview ? 'border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10' : ''}`}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    {item.thumbnail && (
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {item.relatedSymbol}
                        </Badge>
                        {item.isMarketOverview && (
                          <Badge variant="outline" className="text-xs text-blue-500 border-blue-500/30">
                            {lang === "ko" ? "시장 전체" : "Market Overview"}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {item.publisher}
                        </span>
                      </div>

                      <h3 className="font-semibold text-sm mb-1 line-clamp-2">
                        {item.title}
                      </h3>

                      {lang === "ko" && item.koreanSummary && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {item.koreanSummary}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-muted-foreground">
                          {formatTime(item.publishedAt)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReadArticle(item)}
                          className="text-primary gap-1"
                          data-testid={`button-read-${idx}`}
                        >
                          {t.read_article}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="gap-2"
                data-testid="button-load-more-news"
              >
                {loadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {lang === "ko" ? "더보기" : "Read More"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {lang === "ko" ? "뉴스를 불러올 수 없습니다." : "Unable to load news."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>

    {selectedItem && (
      <NewsDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    )}
    </>
  );
}
