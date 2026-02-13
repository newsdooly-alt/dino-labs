import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useEggs } from "@/hooks/use-eggs";
import { translations } from "@/lib/translations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Newspaper, RefreshCw, CheckCircle2, Trophy, ArrowLeft, BookOpen } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import confetti from "canvas-confetti";

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
}

export function DailyNews() {
  const { data: user } = useUser();
  const { addXpToEggs } = useEggs();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang] as Record<string, string>;

  const [showCelebration, setShowCelebration] = useState(false);
  const [showExtraNews, setShowExtraNews] = useState(false);

  const { data, isLoading } = useQuery<{ news: NewsItem[]; count: number }>({
    queryKey: ["/api/news", lang],
    queryFn: async () => {
      const res = await fetch(`/api/news?lang=${lang}`);
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
    staleTime: 300000,
  });

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

  const handleReadArticle = (link: string) => {
    if (newsReadProgress < DAILY_NEWS_GOAL) {
      markAsReadMutation.mutate();
      addXpToEggs(5);
    }
    window.open(link, "_blank", "noopener,noreferrer");
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

  const newsItems = data?.news || [];
  const visibleNews = questComplete && !showExtraNews ? newsItems.slice(0, DAILY_NEWS_GOAL) : newsItems;

  return (
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
                        setShowExtraNews(true);
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

      {questComplete && !showCelebration && !showExtraNews && (
        <Card className="border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="font-medium text-green-600 dark:text-green-400">{t.daily_news_complete}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowExtraNews(true)}
                  data-testid="button-read-more-after-complete"
                >
                  {t.read_more_news}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate("/")}
                  data-testid="button-go-dashboard-from-news"
                >
                  {t.back_to_dashboard}
                </Button>
              </div>
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
      ) : visibleNews.length > 0 ? (
        <div className="space-y-4">
          {visibleNews.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="overflow-hidden hover:border-primary/50 transition-colors">
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
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {item.relatedSymbol}
                        </Badge>
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
                          onClick={() => handleReadArticle(item.link)}
                          className="text-primary gap-1"
                          data-testid={`button-read-${idx}`}
                        >
                          {t.read_article}
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
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
  );
}
