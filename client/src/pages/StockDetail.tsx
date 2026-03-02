import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Check, 
  Building2, 
  DollarSign, 
  BarChart3, 
  Calendar,
  AlertCircle,
  RefreshCw,
  Lightbulb,
  Newspaper,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { translations } from "@/lib/translations";
import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cleanCompanyName } from "@/lib/stockUtils";
import { getLocalizedCompanyName } from "@/lib/stockNames";

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  isMarketOpen: boolean;
  lastUpdated: string;
  isStale: boolean;
}

interface StockInfo {
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  description: string | null;
  descriptionKo?: string | null;
  website: string | null;
  marketCap: number | null;
  peRatio: number | null;
  forwardPE: number | null;
  eps: number | null;
  dividendYield: number | null;
  "52WeekHigh": number | null;
  "52WeekLow": number | null;
  avgVolume: number | null;
  beta: number | null;
}

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: number;
  relatedSymbol: string;
  thumbnail: string | null;
  koreanSummary?: string | null;
}

interface StockNewsResponse {
  news: NewsItem[];
  symbol: string;
}

interface HistoryData {
  symbol: string;
  period: string;
  interval: string;
  data: { date: string; close: number; open: number; high: number; low: number; volume: number }[];
  count: number;
}

interface WatchlistItem {
  id: number;
  userId: number;
  symbol: string;
  stockId: number;
  addedAt: string;
}

const periodOptions = [
  { key: "1d", label: "1D", period: "1d", interval: "5m" },
  { key: "1w", label: "1W", period: "5d", interval: "15m" },
  { key: "1m", label: "1M", period: "1mo", interval: "1d" },
  { key: "1y", label: "1Y", period: "1y", interval: "1wk" },
];

function formatMarketCap(value: number | null): string {
  if (!value) return "--";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

function formatNumber(value: number | null, decimals: number = 2): string {
  if (value === null || value === undefined) return "--";
  return value.toFixed(decimals);
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "--";
  return `${(value * 100).toFixed(2)}%`;
}

function getDinoInsight(info: StockInfo | null, lang: "en" | "ko"): { title: string; message: string } {
  if (!info) {
    return {
      title: lang === "en" ? "Dino's Insight" : "디노의 인사이트",
      message: lang === "en" 
        ? "Loading company information..." 
        : "회사 정보를 불러오는 중..."
    };
  }

  const pe = info.peRatio;
  const divYield = info.dividendYield;
  const marketCap = info.marketCap;

  if (pe && pe > 0) {
    if (lang === "en") {
      return {
        title: "Dino's Insight",
        message: pe > 50 
          ? `A P/E ratio of ${pe.toFixed(1)} means investors are paying $${pe.toFixed(0)} for every $1 of profit! That's pretty high - the company might be growing fast, or it could be overvalued.`
          : pe > 20 
          ? `A P/E ratio of ${pe.toFixed(1)} is fairly normal. Investors are paying $${pe.toFixed(0)} for every $1 of profit the company makes.`
          : `A P/E ratio of ${pe.toFixed(1)} is quite low! Investors are only paying $${pe.toFixed(0)} for every $1 of profit. This could be a value opportunity!`
      };
    } else {
      return {
        title: "디노의 인사이트",
        message: pe > 50 
          ? `PER ${pe.toFixed(1)}은 투자자들이 이익 1달러당 ${pe.toFixed(0)}달러를 지불한다는 뜻이에요! 꽤 높은 편이네요 - 회사가 빠르게 성장 중이거나 고평가일 수 있어요.`
          : pe > 20 
          ? `PER ${pe.toFixed(1)}은 꽤 정상적인 수준이에요. 투자자들이 회사 이익 1달러당 ${pe.toFixed(0)}달러를 지불하고 있어요.`
          : `PER ${pe.toFixed(1)}은 꽤 낮은 편이에요! 투자자들이 이익 1달러당 ${pe.toFixed(0)}달러만 지불하고 있어요. 가치 투자 기회일 수 있어요!`
      };
    }
  }

  if (divYield && divYield > 0) {
    const yieldPct = (divYield * 100).toFixed(2);
    const incomePerHundred = yieldPct;
    if (lang === "en") {
      return {
        title: "Dino's Insight",
        message: `This stock pays a ${yieldPct}% dividend! That means for every $100 invested, you'd get about $${incomePerHundred} per year in passive income.`
      };
    } else {
      return {
        title: "디노의 인사이트",
        message: `이 주식은 ${yieldPct}% 배당을 지급해요! 100달러 투자 시 연간 약 ${incomePerHundred}달러의 수동 소득을 얻을 수 있어요.`
      };
    }
  }

  if (marketCap) {
    const capStr = formatMarketCap(marketCap);
    if (lang === "en") {
      return {
        title: "Dino's Insight",
        message: marketCap >= 200e9 
          ? `With a market cap of ${capStr}, this is a mega-cap company! These are usually stable, well-established businesses.`
          : marketCap >= 10e9 
          ? `A market cap of ${capStr} makes this a large-cap stock. Generally more stable than smaller companies!`
          : `With a market cap of ${capStr}, this is a smaller company. More growth potential, but also more risk!`
      };
    } else {
      return {
        title: "디노의 인사이트",
        message: marketCap >= 200e9 
          ? `시가총액 ${capStr}의 초대형주예요! 보통 안정적이고 잘 확립된 기업들이에요.`
          : marketCap >= 10e9 
          ? `시가총액 ${capStr}의 대형주예요. 일반적으로 소형주보다 안정적이에요!`
          : `시가총액 ${capStr}의 소형주예요. 성장 잠재력은 크지만 위험도 높아요!`
      };
    }
  }

  return {
    title: lang === "en" ? "Dino's Insight" : "디노의 인사이트",
    message: lang === "en" 
      ? "Research is key! Always look at a company's fundamentals before investing."
      : "조사가 중요해요! 투자하기 전에 항상 회사의 펀더멘털을 살펴보세요."
  };
}

export default function StockDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/stock/:symbol");
  const symbol = params?.symbol?.toUpperCase() || "";
  const [selectedPeriod, setSelectedPeriod] = useState("1m");
  const { toast } = useToast();
  const { theme } = useTheme();
  const { formatPrice, formatMarketCap: formatMarketCapCurrency, currencySymbol, isKoreanStock, isJapaneseStock } = useCurrency();
  const isKr = isKoreanStock(symbol);
  const isJp = isJapaneseStock(symbol);
  const nativeCurrency = isKr ? 'KRW' : isJp ? 'JPY' : 'USD';

  const { data: user } = useQuery<{ language: string }>({
    queryKey: ["/api/profiles/me"],
    queryFn: async () => {
      const res = await fetch("/api/profiles/me", { credentials: "include" });
      if (!res.ok) return { language: "en" };
      return res.json();
    },
  });
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];

  const { data: quote, isLoading: isQuoteLoading, refetch: refetchQuote } = useQuery<StockQuote>({
    queryKey: ["/api/stocks/live", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live/${symbol}`);
      if (!res.ok) throw new Error("Failed to fetch quote");
      return res.json();
    },
    enabled: !!symbol,
    staleTime: 15000,
    refetchInterval: 30000,
    retry: 2,
  });

  const { data: info, isLoading: isInfoLoading } = useQuery<StockInfo>({
    queryKey: ["/api/stocks/info", symbol, lang],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/info/${symbol}?lang=${lang}`);
      if (!res.ok) throw new Error("Failed to fetch info");
      return res.json();
    },
    enabled: !!symbol,
    staleTime: 300000,
  });

  const { data: stockNews, isLoading: isNewsLoading } = useQuery<StockNewsResponse>({
    queryKey: [`/api/stocks/news/${symbol}`, lang],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/news/${symbol}?lang=${lang}`);
      if (!res.ok) return { news: [], symbol };
      return res.json();
    },
    enabled: !!symbol,
    staleTime: 120000,
  });

  const periodConfig = periodOptions.find(p => p.key === selectedPeriod) || periodOptions[2];
  
  const { data: history, isLoading: isHistoryLoading } = useQuery<HistoryData>({
    queryKey: ["/api/stocks/history", symbol, periodConfig.period, periodConfig.interval],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/history/${symbol}?period=${periodConfig.period}&interval=${periodConfig.interval}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: !!symbol,
    staleTime: 60000,
  });

  const { data: watchlist } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist"],
  });

  const isInWatchlist = watchlist?.some(item => item.symbol === symbol);

  const addToWatchlistMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/watchlist", { symbol });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({
        title: lang === "en" ? "Added to Watchlist" : "관심종목에 추가됨",
        description: t.stock_added || (lang === "en" ? "Great choice!" : "좋은 선택이에요!"),
      });
    },
  });

  const isIntraday = selectedPeriod === "1d";
  const chartData = history?.data?.map(d => {
    const dt = new Date(d.date);
    const label = isIntraday
      ? dt.toLocaleTimeString(lang === "ko" ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
      : dt.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
    return { date: label, rawDate: d.date, price: d.close };
  }) || [];

  const priceChange = chartData.length > 1 
    ? chartData[chartData.length - 1].price - chartData[0].price 
    : 0;
  const isPositive = (quote?.changePercent ?? 0) >= 0;

  const dinoInsight = getDinoInsight(info || null, lang);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 w-full">
      <Button 
        variant="ghost" 
        onClick={() => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            navigate("/");
          }
        }}
        className="mb-2"
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {lang === "en" ? "Back" : "뒤로"}
      </Button>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold">
              {getLocalizedCompanyName(cleanCompanyName(quote?.name || info?.name || symbol), lang)}
            </h1>
            {info?.sector && (
              <Badge variant="secondary">{info.sector}</Badge>
            )}
            {isKr && (
              <Badge variant="outline" className="text-xs">
                {symbol.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI'}
              </Badge>
            )}
            {isJp && (
              <Badge variant="outline" className="text-xs border-red-400/40 text-red-600 dark:text-red-400">
                TSE
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {symbol}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn("w-2 h-2 rounded-full shrink-0", quote?.isMarketOpen ? "bg-green-500 animate-pulse" : "bg-gray-400")} />
            <span className="text-xs text-muted-foreground">
              {quote?.isMarketOpen 
                ? (lang === "ko" ? "장 개장" : "Market Open") 
                : (lang === "ko" ? "장 마감" : "Market Closed")}
              {isKr ? " (KST)" : " (ET)"}
            </span>
            {isKr && (
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">KRW</span>
            )}
            {isJp && (
              <span className="text-xs font-medium text-red-600 dark:text-red-400">JPY</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end">
          {isQuoteLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded w-24 mb-1" />
              <div className="h-4 bg-muted rounded w-16" />
            </div>
          ) : (
            <>
              <div className="text-3xl font-bold font-mono">
                {formatPrice(quote?.price, { nativeCurrency })}
              </div>
              <div className={cn(
                "flex items-center gap-1 text-lg font-semibold",
                isPositive ? "text-primary" : "text-destructive"
              )}>
                {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                {isPositive ? "+" : ""}{quote?.change?.toFixed(2) || "0.00"} ({isPositive ? "+" : ""}{quote?.changePercent?.toFixed(2) || "0.00"}%)
              </div>
            </>
          )}
        </div>
      </div>

      {!isInWatchlist && (
        <Button 
          onClick={() => addToWatchlistMutation.mutate()}
          disabled={addToWatchlistMutation.isPending}
          className="w-full md:w-auto"
          data-testid="button-add-watchlist"
        >
          {addToWatchlistMutation.isPending ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          {t.add_to_watchlist}
        </Button>
      )}
      {isInWatchlist && (
        <Badge variant="outline" className="py-2 px-4">
          <Check className="w-4 h-4 mr-2" />
          {lang === "en" ? "In Your Watchlist" : "관심종목에 있음"}
        </Badge>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg">
              {lang === "en" ? "Price Chart" : "가격 차트"}
            </CardTitle>
            <div className="flex gap-1">
              {periodOptions.map((opt) => (
                <Button
                  key={opt.key}
                  variant={selectedPeriod === opt.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedPeriod(opt.key)}
                  data-testid={`button-period-${opt.key}`}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isHistoryLoading ? (
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fill: theme === "dark" ? "hsl(140, 10%, 60%)" : "hsl(140, 10%, 45%)" }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fill: theme === "dark" ? "hsl(140, 10%, 60%)" : "hsl(140, 10%, 45%)" }}
                  tickFormatter={(v) => formatPrice(v, { nativeCurrency, compact: true })}
                  width={isKr || isJp ? 80 : 60}
                />
                <Tooltip 
                  formatter={(value: number) => [formatPrice(value, { nativeCurrency }), lang === "ko" ? "가격" : "Price"]}
                  labelFormatter={(label, payload) => {
                    if (payload?.[0]?.payload?.rawDate) {
                      const dt = new Date(payload[0].payload.rawDate);
                      if (isIntraday) {
                        return dt.toLocaleTimeString(lang === "ko" ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
                      }
                      return dt.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" });
                    }
                    return label;
                  }}
                  contentStyle={{ 
                    backgroundColor: theme === "dark" ? "hsl(140, 25%, 10%)" : "hsl(0, 0%, 100%)", 
                    border: theme === "dark" ? "1px solid hsl(140, 20%, 18%)" : "1px solid hsl(140, 15%, 85%)",
                    borderRadius: '8px',
                    color: theme === "dark" ? "hsl(140, 15%, 95%)" : "hsl(140, 30%, 10%)"
                  }}
                  labelStyle={{
                    color: theme === "dark" ? "hsl(140, 10%, 60%)" : "hsl(140, 10%, 45%)"
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="price" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fill="url(#colorPrice)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <AlertCircle className="w-5 h-5 mr-2" />
              {lang === "en" ? "No chart data available" : "차트 데이터가 없습니다"}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            {lang === "en" ? "Key Stats" : "주요 지표"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {lang === "en" ? "Market Cap" : "시가총액"}
              </p>
              <p className="font-semibold">{formatMarketCapCurrency(info?.marketCap ?? null, { nativeCurrency })}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {lang === "en" ? "P/E Ratio" : "PER"}
              </p>
              <p className="font-semibold">{formatNumber(info?.peRatio ?? null)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {lang === "en" ? "Dividend Yield" : "배당수익률"}
              </p>
              <p className="font-semibold">{formatPercent(info?.dividendYield ?? null)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {lang === "en" ? "EPS" : "주당순이익"}
              </p>
              <p className="font-semibold">{formatPrice(info?.eps, { nativeCurrency })}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {lang === "en" ? "52-Week High" : "52주 최고"}
              </p>
              <p className="font-semibold text-primary">
                {formatPrice(info?.["52WeekHigh"], { nativeCurrency })}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {lang === "en" ? "52-Week Low" : "52주 최저"}
              </p>
              <p className="font-semibold text-destructive">
                {formatPrice(info?.["52WeekLow"], { nativeCurrency })}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {lang === "en" ? "Beta" : "베타"}
              </p>
              <p className="font-semibold">{formatNumber(info?.beta ?? null)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {lang === "en" ? "Avg Volume" : "평균 거래량"}
              </p>
              <p className="font-semibold">
                {info?.avgVolume ? (info.avgVolume / 1e6).toFixed(2) + "M" : "--"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Lightbulb className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-primary mb-1">{dinoInsight.title}</h3>
              <p className="text-sm text-foreground/80">{dinoInsight.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            {lang === "en" ? `${symbol} News` : `${symbol} 뉴스`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isNewsLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded-lg" />
              ))}
            </div>
          ) : stockNews && stockNews.news.length > 0 ? (
            stockNews.news.slice(0, 5).map((item, idx) => (
              <a 
                key={idx}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                data-testid={`news-item-${idx}`}
              >
                <div className="flex items-start gap-3">
                  {item.thumbnail && (
                    <img 
                      src={item.thumbnail} 
                      alt="" 
                      className="w-16 h-12 object-cover rounded flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2 mb-1">
                      {lang === "ko" && item.koreanSummary ? item.koreanSummary : item.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{item.publisher}</span>
                      <span>•</span>
                      <span>
                        {new Date(item.publishedAt * 1000).toLocaleDateString(
                          lang === "ko" ? "ko-KR" : "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </a>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {lang === "en" ? "No recent news available" : "최근 뉴스가 없습니다"}
            </p>
          )}
        </CardContent>
      </Card>

      {info?.description && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {lang === "en" ? "About the Company" : "회사 소개"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {info.industry && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{info.sector}</Badge>
                <span>/</span>
                <span>{info.industry}</span>
              </div>
            )}
            <p className="text-sm leading-relaxed">
              {lang === "ko" && info.descriptionKo
                ? (info.descriptionKo.length > 500 ? info.descriptionKo.substring(0, 500) + "..." : info.descriptionKo)
                : (info.description.length > 500 ? info.description.substring(0, 500) + "..." : info.description)}
            </p>
            {info.website && (
              <a 
                href={info.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                {lang === "en" ? "Visit Website" : "웹사이트 방문"}
              </a>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
