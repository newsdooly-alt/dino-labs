import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useLocation } from "wouter";
import { TrendingUp, BarChart3, ChevronRight, RefreshCw, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { translations } from "@/lib/translations";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cleanCompanyName } from "@/lib/stockUtils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RecommendedStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
  marketCap: number | null;
  isKorean: boolean;
  currency: string;
}

interface RecommendedResponse {
  recommended: RecommendedStock[];
  count: number;
}

function getRecommendationReason(stock: RecommendedStock, lang: string): string {
  const vr = stock.volumeRatio;
  const cp = stock.changePercent;

  if (lang === "ko") {
    if (vr >= 2.0 && cp > 2) return "평소보다 높은 거래량을 동반한 상승세로 매수세가 강력합니다.";
    if (vr >= 2.0 && cp > 0) return "거래대금이 집중되며 시장의 주도주로 부각되고 있습니다.";
    if (vr >= 2.0 && cp <= 0) return "거래량이 급증하며 큰 변동이 예상되는 종목입니다.";
    if (vr >= 1.5 && cp > 1) return "주요 이평선 돌파와 함께 거래량이 실려 추가 상승이 기대됩니다.";
    if (vr >= 1.5 && cp > 0) return "거래량 증가와 함께 안정적인 상승 흐름을 보이고 있습니다.";
    if (vr >= 1.5 && cp <= 0) return "높은 거래량 속 조정 중으로 반등 가능성에 주목하세요.";
    if (cp > 3) return "강한 가격 상승 모멘텀으로 시장의 관심이 집중되고 있습니다.";
    if (cp > 0) return "꾸준한 상승세와 안정적인 거래량을 보여주고 있습니다.";
    return "높은 유동성으로 투자자들의 관심이 집중되는 종목입니다.";
  }

  if (vr >= 2.0 && cp > 2) return "Strong buying pressure with volume significantly above average.";
  if (vr >= 2.0 && cp > 0) return "Heavy trading volume signals growing market interest and momentum.";
  if (vr >= 2.0 && cp <= 0) return "Unusual volume surge suggests significant movement ahead.";
  if (vr >= 1.5 && cp > 1) return "Breaking key levels with rising volume, further upside expected.";
  if (vr >= 1.5 && cp > 0) return "Stable uptrend supported by above-average trading activity.";
  if (vr >= 1.5 && cp <= 0) return "High volume during pullback may signal a potential bounce.";
  if (cp > 3) return "Strong price momentum drawing significant market attention.";
  if (cp > 0) return "Steady gains with consistent trading volume and liquidity.";
  return "High liquidity stock attracting strong investor attention.";
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K`;
  return vol.toString();
}

export default function Recommended() {
  const { data: user } = useUser();
  const [, navigate] = useLocation();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];
  const isKo = lang === "ko";
  const { formatPrice, isKoreanStock } = useCurrency();

  const { data, isLoading, refetch, isRefetching } = useQuery<RecommendedResponse>({
    queryKey: ["/api/stocks/recommended"],
    queryFn: async () => {
      const res = await fetch("/api/stocks/recommended");
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: 2,
  });

  const stocks = data?.recommended || [];

  return (
    <div className="p-4 md:p-10 max-w-4xl mx-auto min-h-screen w-full">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-5xl font-display font-bold mb-3" data-testid="heading-recommended">
          {isKo ? "추천 종목" : "Recommended Stocks"}
        </h1>
        <p className="text-muted-foreground text-base max-w-lg mx-auto">
          {isKo
            ? "거래량과 가격 모멘텀을 기반으로 선별된 주목할 종목입니다."
            : "Curated picks based on trading volume and price momentum."}
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
            {isKo ? "오늘의 추천" : "Today's Picks"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          data-testid="button-refresh-recommended"
        >
          <RefreshCw className={cn("w-4 h-4 mr-1", isRefetching && "animate-spin")} />
          {isKo ? "새로고침" : "Refresh"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-28 bg-card/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : stocks.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {isKo ? "추천 종목을 불러올 수 없습니다." : "Unable to load recommendations."}
          </p>
          <Button onClick={() => refetch()} className="mt-4" data-testid="button-retry-recommended">
            {isKo ? "다시 시도" : "Try Again"}
          </Button>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="list-recommended">
          {stocks.map((stock, idx) => (
            <motion.div
              key={stock.symbol}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card
                className="p-4 md:p-5 cursor-pointer hover-elevate"
                onClick={() => navigate(`/stock/${stock.symbol}`)}
                data-testid={`card-recommended-${stock.symbol}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base md:text-lg truncate" data-testid={`text-name-rec-${stock.symbol}`}>
                        {cleanCompanyName(stock.name)}
                      </h3>
                      {stock.isKorean && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {stock.symbol.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-symbol-rec-${stock.symbol}`}>
                      {stock.symbol}
                    </p>

                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed" data-testid={`text-reason-${stock.symbol}`}>
                      {getRecommendationReason(stock, lang)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-1">
                    <p className="font-mono font-bold text-base tabular-nums" data-testid={`text-price-rec-${stock.symbol}`}>
                      {formatPrice(stock.price, { nativeCurrency: stock.isKorean ? 'KRW' : 'USD' })}
                    </p>
                    <p className={cn(
                      "text-xs font-bold tabular-nums",
                      stock.changePercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <BarChart3 className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {formatVolume(stock.volume)}
                      </span>
                      {stock.volumeRatio >= 1.5 && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0">
                          <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                          {stock.volumeRatio.toFixed(1)}x
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
