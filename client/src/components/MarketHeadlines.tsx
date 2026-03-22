import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Newspaper, RefreshCw, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { NewsDetailModal, NewsItem as ModalNewsItem } from "@/components/NewsDetailModal";

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: number;
  relatedSymbol: string;
  thumbnail: string | null;
  koreanSummary?: string;
}

export function MarketHeadlines() {
  const { data: user } = useUser();
  const lang = (user?.language || "ko") as keyof typeof translations;
  const t = translations[lang];
  const [selectedItem, setSelectedItem] = useState<ModalNewsItem | null>(null);

  // Client-side fallback news for when API completely fails
  const clientFallbackNews: NewsItem[] = [
    {
      title: "Understanding Market Indices: SPY, QQQ, and DIA",
      publisher: "Dino Education",
      link: "https://www.investopedia.com/terms/m/marketindex.asp",
      publishedAt: Math.floor(Date.now() / 1000) - 3600,
      relatedSymbol: "SPY",
      thumbnail: null,
      koreanSummary: "시장 지수 이해하기: SPY, QQQ, DIA에 대해 알아보세요."
    },
    {
      title: "What is P/E Ratio and Why Does It Matter?",
      publisher: "Dino Education",
      link: "https://www.investopedia.com/terms/p/price-earningsratio.asp",
      publishedAt: Math.floor(Date.now() / 1000) - 7200,
      relatedSymbol: "AAPL",
      thumbnail: null,
      koreanSummary: "P/E 비율이란 무엇이며 왜 중요한가요?"
    },
    {
      title: "How to Read Stock Charts: A Beginner's Guide",
      publisher: "Dino Education",
      link: "https://www.investopedia.com/articles/technical/112401.asp",
      publishedAt: Math.floor(Date.now() / 1000) - 10800,
      relatedSymbol: "MSFT",
      thumbnail: null,
      koreanSummary: "주식 차트 읽는 법: 초보자 가이드"
    }
  ];

  const { data, isLoading, error, refetch, isRefetching } = useQuery<{ news: NewsItem[]; count: number; source?: string }>({
    queryKey: ["/api/news", lang],
    queryFn: async () => {
      console.log("[News] Fetching news from API...");
      try {
        const res = await fetch(`/api/news?lang=${lang}`);
        if (!res.ok) {
          console.error(`[News] API returned status ${res.status}`);
          throw new Error(`API Error: ${res.status}`);
        }
        const result = await res.json();
        console.log(`[News] Received ${result.news?.length || 0} items (source: ${result.source || 'unknown'})`);
        return result;
      } catch (err) {
        console.error("[News] Fetch failed:", err);
        throw err;
      }
    },
    staleTime: 300000,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const { data: readCount, refetch: refetchReadCount } = useQuery<{ count: number }>({
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
      refetchReadCount();
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
    }
  });

  const handleReadArticle = (item: NewsItem) => {
    markAsReadMutation.mutate();
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

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - (timestamp * 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return t.just_now;
    if (minutes < 60) return `${minutes} ${t.minutes_ago}`;
    if (hours < 24) return `${hours} ${t.hours_ago}`;
    
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric"
    });
  };

  const newsReadProgress = readCount?.count || 0;
  const questComplete = newsReadProgress >= 3;

  return (
    <>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Newspaper className="w-6 h-6 text-blue-500" />
          {t.todays_market_headlines}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {newsReadProgress}/3
          </span>
          {questComplete && (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          )}
        </div>
      </div>

      <div className="relative">
        <div className="flex items-start gap-3 mb-4 md:mb-0 md:absolute md:-left-2 md:-top-2 md:z-10">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Newspaper className="w-6 h-6 text-white" />
          </div>
          <div className="bg-primary/10 dark:bg-primary/20 border border-primary/30 rounded-xl px-3 py-2 max-w-[220px] shadow-sm">
            <p className="text-xs font-medium text-primary dark:text-primary">
              {t.dino_news_bubble}
            </p>
          </div>
        </div>

        <Card className="overflow-hidden md:ml-16">
          <CardContent className="p-4 min-h-[200px]">
            {isLoading || isRefetching ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t.loading_news}</span>
              </div>
            ) : (() => {
              // Always show news - use API data if available, otherwise fallback
              // This ensures news section is NEVER blank
              const hasLiveNews = data?.news && data.news.length > 0;
              const newsToShow = hasLiveNews ? data.news : clientFallbackNews;
              const showFallbackBanner = error || !hasLiveNews;
              
              return (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {showFallbackBanner && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 pb-2 border-b border-border">
                      <span>{t.dino_learning_resources || (lang === "ko" ? "디노의 학습 자료" : "Dino's Learning Resources")}</span>
                      {error && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => refetch()}
                          className="h-6 px-2 gap-1"
                          data-testid="button-retry-news"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {t.retry}
                        </Button>
                      )}
                    </div>
                  )}
                  {newsToShow.slice(0, 7).map((item, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <button
                        onClick={() => handleReadArticle(item)}
                        className="w-full text-left p-3 rounded-xl bg-background/50 hover:bg-muted/50 border border-border hover:border-primary/30 transition-all group"
                        data-testid={`news-item-${idx}`}
                      >
                        <div className="flex items-start gap-3">
                          {item.thumbnail && (
                            <img 
                              src={item.thumbnail} 
                              alt="" 
                              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {item.relatedSymbol}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {item.publisher} • {formatTimeAgo(item.publishedAt)}
                              </span>
                            </div>
                            
                            <h3 className="font-medium text-sm mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                              {item.title}
                            </h3>
                            
                            {item.koreanSummary && lang === "ko" && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {item.koreanSummary}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>

    {selectedItem && (
      <NewsDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    )}
    </>
  );
}
