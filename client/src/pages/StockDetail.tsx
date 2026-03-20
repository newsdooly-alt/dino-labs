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
  BarChart3, 
  RefreshCw,
  Lightbulb,
  Newspaper,
  ExternalLink,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { translations } from "@/lib/translations";
import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { GlobalChart } from "@/components/GlobalChart";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cleanCompanyName } from "@/lib/stockUtils";
import { getLocalizedCompanyName } from "@/lib/stockNames";
import { StockAnalysisModal } from "@/components/StockAnalysisModal";
import { PeerComparison } from "@/components/PeerComparison";

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

interface WatchlistItem {
  id: number;
  userId: number;
  symbol: string;
  stockId: number;
  addedAt: string;
}


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
      message: lang === "en" ? "Loading company information..." : "회사 정보를 불러오는 중..."
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
    if (lang === "en") {
      return { title: "Dino's Insight", message: `This stock pays a ${yieldPct}% dividend! That means for every $100 invested, you'd get about $${yieldPct} per year in passive income.` };
    } else {
      return { title: "디노의 인사이트", message: `이 주식은 ${yieldPct}% 배당을 지급해요! 100달러 투자 시 연간 약 ${yieldPct}달러의 수동 소득을 얻을 수 있어요.` };
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
  const [showProModal, setShowProModal] = useState(false);
  const { toast } = useToast();
  const { theme } = useTheme();
  const { formatPrice, formatMarketCap: formatMarketCapCurrency, isKoreanStock, isJapaneseStock } = useCurrency();
  const isKr = isKoreanStock(symbol);
  const isJp = isJapaneseStock(symbol);
  const nativeCurrency = isKr ? 'KRW' : isJp ? 'JPY' : 'USD';

  const isDark = theme === "dark";

  const { data: user } = useQuery<{ language: string }>({
    queryKey: ["/api/profiles/me"],
    queryFn: async () => {
      const res = await fetch("/api/profiles/me", { credentials: "include" });
      if (!res.ok) return { language: "en" };
      return res.json();
    },
  });
  const lang = (user?.language || "ko") as keyof typeof translations;
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

  const { data: info } = useQuery<StockInfo>({
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

  const { data: watchlist } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist"],
  });

  const isInWatchlist = watchlist?.some(item => item.symbol === symbol);

  const addToWatchlistMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/watchlist", { symbol }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({
        title: lang === "en" ? "Added to Watchlist" : "관심종목에 추가됨",
        description: t.stock_added || (lang === "en" ? "Great choice!" : "좋은 선택이에요!"),
      });
    },
  });

  const isPeriodPositive = (quote?.changePercent ?? 0) >= 0;
  const dinoInsight = getDinoInsight(info || null, lang);


  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5 w-full">
      <Button
        variant="ghost"
        onClick={() => { if (window.history.length > 1) window.history.back(); else navigate("/"); }}
        className="mb-1"
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        {lang === "en" ? "Back" : "뒤로"}
      </Button>

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold">
              {getLocalizedCompanyName(cleanCompanyName(quote?.name || info?.name || symbol), lang)}
            </h1>
            {info?.sector && <Badge variant="secondary">{info.sector}</Badge>}
            {isKr && <Badge variant="outline" className="text-xs">{symbol.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI'}</Badge>}
            {isJp && <Badge variant="outline" className="text-xs border-red-400/40 text-red-600 dark:text-red-400">TSE</Badge>}
          </div>
          <p className="text-muted-foreground mt-1">{symbol}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn("w-2 h-2 rounded-full shrink-0", quote?.isMarketOpen ? "bg-green-500 animate-pulse" : "bg-gray-400")} />
            <span className="text-xs text-muted-foreground">
              {quote?.isMarketOpen ? (lang === "ko" ? "장 개장" : "Market Open") : (lang === "ko" ? "장 마감" : "Market Closed")}
              {isKr ? " (KST)" : " (ET)"}
            </span>
            {isKr && <span className="text-xs font-medium text-blue-600 dark:text-blue-400">KRW</span>}
            {isJp && <span className="text-xs font-medium text-red-600 dark:text-red-400">JPY</span>}
          </div>
        </div>

        <div className="flex flex-col items-end">
          {isQuoteLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded w-28 mb-1" />
              <div className="h-4 bg-muted rounded w-20" />
            </div>
          ) : (
            <>
              <div className="text-3xl font-bold font-mono">{formatPrice(quote?.price, { nativeCurrency })}</div>
              <div className={cn("flex items-center gap-1 text-base font-semibold flex-wrap justify-end", isPeriodPositive ? "text-emerald-500" : "text-rose-500")}>
                {isPeriodPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <>{(quote?.change ?? 0) >= 0 ? "+" : ""}{formatPrice(quote?.change, { nativeCurrency })} ({(quote?.changePercent ?? 0) >= 0 ? "+" : ""}{quote?.changePercent?.toFixed(2) || "0.00"}%)</>
                <span className="text-xs text-muted-foreground font-normal">{lang === "ko" ? "오늘" : "today"}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {!isInWatchlist && (
        <Button onClick={() => addToWatchlistMutation.mutate()} disabled={addToWatchlistMutation.isPending} className="w-full md:w-auto" data-testid="button-add-watchlist">
          {addToWatchlistMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          {t.add_to_watchlist}
        </Button>
      )}
      {isInWatchlist && (
        <Badge variant="outline" className="py-2 px-4">
          <Check className="w-4 h-4 mr-2" />{lang === "en" ? "In Your Watchlist" : "관심종목에 있음"}
        </Badge>
      )}

      {/* ── Chart Card ── */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{lang === "ko" ? "TradingView 내장 툴바에서 기간·차트 유형을 변경하세요" : "Use the TradingView toolbar to change period & chart type"}</p>
            <button
              onClick={() => navigate(`/pro?symbol=${encodeURIComponent(symbol)}`)}
              className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full border transition-all bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 hover:from-violet-500/20 hover:to-fuchsia-500/20 text-violet-600 dark:text-violet-400 border-violet-400/30 hover:border-violet-400/60 touch-manipulation whitespace-nowrap"
              data-testid="button-pro-analysis"
            >
              <Zap className="w-3 h-3 shrink-0" />
              {lang === "ko" ? "Pro 대시보드" : "Pro Dashboard"}
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <GlobalChart
            symbol={symbol}
            periodKey="1m"
            chartType="candle"
            isDark={isDark}
            lang={lang === "ko" ? "ko" : "en"}
          />
        </CardContent>
      </Card>

      {/* ── Key Stats ── */}
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
              <p className="text-xs text-muted-foreground">{lang === "en" ? "Market Cap" : "시가총액"}</p>
              <p className="font-semibold">{formatMarketCapCurrency(info?.marketCap ?? null, { nativeCurrency })}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{lang === "en" ? "P/E Ratio" : "PER"}</p>
              <p className="font-semibold">{formatNumber(info?.peRatio ?? null)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{lang === "en" ? "Dividend Yield" : "배당수익률"}</p>
              <p className="font-semibold">{formatPercent(info?.dividendYield ?? null)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{lang === "en" ? "EPS" : "주당순이익"}</p>
              <p className="font-semibold">{formatPrice(info?.eps, { nativeCurrency })}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{lang === "en" ? "52-Week High" : "52주 최고"}</p>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatPrice(info?.["52WeekHigh"], { nativeCurrency })}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{lang === "en" ? "52-Week Low" : "52주 최저"}</p>
              <p className="font-semibold text-rose-600 dark:text-rose-400">{formatPrice(info?.["52WeekLow"], { nativeCurrency })}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{lang === "en" ? "Beta" : "베타"}</p>
              <p className="font-semibold">{formatNumber(info?.beta ?? null)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{lang === "en" ? "Avg Volume" : "평균 거래량"}</p>
              <p className="font-semibold">{info?.avgVolume ? (info.avgVolume / 1e6).toFixed(2) + "M" : "--"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Peer Comparison ── */}
      <PeerComparison symbol={symbol} lang={lang} />

      {/* ── Dino Insight ── */}
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

      {/* ── News ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            {lang === "en" ? `${symbol} News` : `${symbol} 뉴스`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isNewsLoading ? (
            <div className="animate-pulse space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg" />)}</div>
          ) : stockNews && stockNews.news.length > 0 ? (
            stockNews.news.slice(0, 5).map((item, idx) => (
              <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors" data-testid={`news-item-${idx}`}>
                <div className="flex items-start gap-3">
                  {item.thumbnail && <img src={item.thumbnail} alt="" className="w-16 h-12 object-cover rounded flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2 mb-1">{lang === "ko" && item.koreanSummary ? item.koreanSummary : item.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{item.publisher}</span>
                      <span>•</span>
                      <span>{new Date(item.publishedAt * 1000).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" })}</span>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </a>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{lang === "en" ? "No recent news available" : "최근 뉴스가 없습니다"}</p>
          )}
        </CardContent>
      </Card>

      {/* ── Korean Domestic News Links ── */}
      {lang === "ko" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-primary" />
              국내 증권 뉴스 보기
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              {info?.name || quote?.name || symbol} 관련 국내 뉴스를 확인하세요.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://search.naver.com/search.naver?where=news&query=${encodeURIComponent((info?.name || quote?.name || symbol) + ' 주가')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#03C75A]/10 border border-[#03C75A]/30 text-[#03C75A] text-xs font-medium hover:bg-[#03C75A]/20 transition-colors"
                data-testid="link-naver-news"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"/>
                </svg>
                네이버 뉴스
              </a>
              <a
                href={`https://finance.naver.com/search/searchNews.naver?query=${encodeURIComponent(info?.name || quote?.name || symbol)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#03C75A]/10 border border-[#03C75A]/30 text-[#03C75A] text-xs font-medium hover:bg-[#03C75A]/20 transition-colors"
                data-testid="link-naver-finance"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"/>
                </svg>
                네이버 금융 뉴스
              </a>
              <a
                href={`https://search.daum.net/search?w=news&q=${encodeURIComponent((info?.name || quote?.name || symbol) + ' 주가 뉴스')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAE100]/10 border border-[#FAE100]/40 text-yellow-600 dark:text-yellow-400 text-xs font-medium hover:bg-[#FAE100]/20 transition-colors"
                data-testid="link-daum-news"
              >
                <span className="font-bold text-[10px]">D</span>
                카카오 다음 뉴스
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── About ── */}
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
              <a href={info.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                {lang === "en" ? "Visit Website" : "웹사이트 방문"}
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {showProModal && (
        <StockAnalysisModal
          symbol={symbol}
          name={quote?.name || symbol}
          isOpen={showProModal}
          onClose={() => setShowProModal(false)}
          lang={lang === "ko" ? "ko" : "en"}
        />
      )}
    </div>
  );
}
