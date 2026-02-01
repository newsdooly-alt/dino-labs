import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Newspaper, RefreshCw, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion } from "framer-motion";

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
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];

  const { data, isLoading } = useQuery<{ news: NewsItem[]; count: number }>({
    queryKey: ["/api/news", lang],
    queryFn: async () => {
      const res = await fetch(`/api/news?lang=${lang}`);
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });

  const { data: readCount, refetch: refetchReadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/news/read-count"],
    queryFn: async () => {
      const res = await fetch(`/api/news/read-count?userId=1`);
      if (!res.ok) return { count: 0 };
      return res.json();
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/news/read", { userId: 1 });
    },
    onSuccess: () => {
      refetchReadCount();
      queryClient.invalidateQueries({ queryKey: ["/api/users/1"] });
    }
  });

  const handleReadArticle = (link: string) => {
    markAsReadMutation.mutate();
    window.open(link, "_blank", "noopener,noreferrer");
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
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-2xl shadow-lg flex-shrink-0">
            🦖
          </div>
          <div className="bg-primary/10 dark:bg-primary/20 border border-primary/30 rounded-xl px-3 py-2 max-w-[220px] shadow-sm">
            <p className="text-xs font-medium text-primary dark:text-primary">
              {t.dino_news_bubble}
            </p>
          </div>
        </div>

        <Card className="overflow-hidden md:ml-16">
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t.loading_news}</span>
              </div>
            ) : data?.news && data.news.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {data.news.slice(0, 7).map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <button
                      onClick={() => handleReadArticle(item.link)}
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
                          
                          <h3 className="font-medium text-sm mb-1 line-clamp-2 group-hover:text-primary transition-colors flex items-start gap-1">
                            {item.title}
                            <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                          </h3>
                          
                          {item.koreanSummary && (
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
            ) : (
              <div className="text-center py-8">
                <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">
                  {t.no_news_available}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
