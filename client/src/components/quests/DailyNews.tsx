import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Newspaper, RefreshCw, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
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

export function DailyNews() {
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
    staleTime: 300000, // 5 minutes
  });

  const { data: readCount } = useQuery<{ count: number }>({
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
    }
  });

  const handleReadArticle = (link: string) => {
    markAsReadMutation.mutate();
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

  const newsReadProgress = readCount?.count || 0;
  const questComplete = newsReadProgress >= 3;

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
                <div 
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (newsReadProgress / 3) * 100)}%` }}
                />
              </div>
              <span className="text-sm font-mono">
                {newsReadProgress}/3
              </span>
              {questComplete && (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
      ) : data?.news && data.news.length > 0 ? (
        <div className="space-y-4">
          {data.news.map((item, idx) => (
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
