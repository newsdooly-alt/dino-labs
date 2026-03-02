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
  AlertCircle,
  RefreshCw,
  Lightbulb,
  Newspaper,
  ExternalLink,
  CandlestickChart,
  LineChart,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { translations } from "@/lib/translations";
import { useState, useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  ComposedChart,
  Line,
  Bar,
  BarChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  ReferenceArea,
  Brush,
} from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cleanCompanyName } from "@/lib/stockUtils";
import { getLocalizedCompanyName } from "@/lib/stockNames";
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateBollingerBands,
  detectMACrossover,
  calculateSupportResistance,
} from "@/lib/technicalAnalysis";
import { StockAnalysisModal } from "@/components/StockAnalysisModal";

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
  { key: "1d",  label: "1D",  period: "1d",  interval: "5m",   returnLabel: { en: "Today",    ko: "오늘"   } },
  { key: "1w",  label: "1W",  period: "5d",  interval: "15m",  returnLabel: { en: "1 Week",   ko: "1주"    } },
  { key: "1m",  label: "1M",  period: "1mo", interval: "1d",   returnLabel: { en: "1 Month",  ko: "1개월"  } },
  { key: "1y",  label: "1Y",  period: "1y",  interval: "1wk",  returnLabel: { en: "1 Year",   ko: "1년"    } },
  { key: "5y",  label: "5Y",  period: "5y",  interval: "1wk",  returnLabel: { en: "5 Years",  ko: "5년"    } },
  { key: "all", label: "ALL", period: "max", interval: "1mo",  returnLabel: { en: "All Time", ko: "전체"   } },
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
  const [selectedPeriod, setSelectedPeriod] = useState("1m");
  const [showVolume, setShowVolume] = useState(true);
  const [showSignals, setShowSignals] = useState(false);
  const [showSR, setShowSR] = useState(true);
  const [showMA, setShowMA] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showBB, setShowBB] = useState(false);
  const [chartType, setChartType] = useState<"candle" | "area">("candle");
  const [showProModal, setShowProModal] = useState(false);
  const [brushDomain, setBrushDomain] = useState<{ startIndex?: number; endIndex?: number }>({});
  const { toast } = useToast();
  const { theme } = useTheme();
  const { formatPrice, formatMarketCap: formatMarketCapCurrency, isKoreanStock, isJapaneseStock } = useCurrency();
  const isKr = isKoreanStock(symbol);
  const isJp = isJapaneseStock(symbol);
  const nativeCurrency = isKr ? 'KRW' : isJp ? 'JPY' : 'USD';

  const isDark = theme === "dark";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
  const tooltipBg = isDark ? "#111827" : "#ffffff";
  const tooltipBorder = isDark ? "#374151" : "#e5e7eb";

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
    mutationFn: async () => apiRequest("POST", "/api/watchlist", { symbol }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({
        title: lang === "en" ? "Added to Watchlist" : "관심종목에 추가됨",
        description: t.stock_added || (lang === "en" ? "Great choice!" : "좋은 선택이에요!"),
      });
    },
  });

  const isIntraday = selectedPeriod === "1d";
  const rawHistoryData = history?.data || [];
  const closePrices = rawHistoryData.map(d => d.close);

  const ma20Values  = calculateSMA(closePrices, 20);
  const ma60Values  = calculateSMA(closePrices, 60);
  const ma120Values = calculateSMA(closePrices, 120);
  const rsiValues   = calculateRSI(closePrices, 14);
  const bbValues    = calculateBollingerBands(closePrices, 20);

  const crossoverSignals = (!isIntraday && closePrices.length >= 62)
    ? detectMACrossover(closePrices, 20, 60)
    : [];
  const signalMap = new Map(crossoverSignals.map(s => [s.index, s.signal]));

  const srLevels = useMemo(() => {
    if (isIntraday || closePrices.length < 20) {
      return {
        supports: info?.["52WeekLow"] != null ? [info["52WeekLow"] as number] : [],
        resistances: info?.["52WeekHigh"] != null ? [info["52WeekHigh"] as number] : [],
      };
    }
    return calculateSupportResistance(closePrices, 3);
  }, [closePrices, isIntraday, info]);

  const chartData = useMemo(() => {
    return rawHistoryData.map((d, i) => {
      const dt = new Date(d.date);
      const label = isIntraday
        ? dt.toLocaleTimeString(lang === "ko" ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
        : dt.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
      const prevClose = i > 0 ? rawHistoryData[i - 1].close : (d.open || d.close);
      const changePct = prevClose > 0 ? ((d.close - prevClose) / prevClose) * 100 : 0;
      return {
        date: label,
        rawDate: d.date,
        price: d.close,
        open: d.open,
        high: d.high || d.close,
        low: d.low || d.close,
        close: d.close,
        volume: d.volume ?? 0,
        ma20: ma20Values[i] ?? null,
        ma60: ma60Values[i] ?? null,
        ma120: ma120Values[i] ?? null,
        rsi: rsiValues[i] ?? null,
        bbUpper: bbValues[i]?.upper ?? null,
        bbMiddle: bbValues[i]?.middle ?? null,
        bbLower: bbValues[i]?.lower ?? null,
        signal: signalMap.get(i) ?? null,
        isUp: d.close >= d.open,
        changePct,
      };
    });
  }, [rawHistoryData, ma20Values, ma60Values, ma120Values, rsiValues, bbValues, signalMap, isIntraday, lang]);

  const { yDomainMin, yDomainMax } = useMemo(() => {
    if (!chartData.length) return { yDomainMin: 0, yDomainMax: 100 };
    const allLows  = chartData.map(d => d.low  > 0 ? d.low  : d.price).filter(v => v > 0);
    const allHighs = chartData.map(d => d.high > 0 ? d.high : d.price).filter(v => v > 0);
    const maVals = chartData.flatMap(d => [d.ma20, d.ma60, d.ma120, d.bbUpper, d.bbLower]).filter((v): v is number => v !== null && v > 0);
    const allMin = Math.min(...allLows, ...maVals);
    const allMax = Math.max(...allHighs, ...maVals);
    const pad = (allMax - allMin) * 0.06;
    return { yDomainMin: allMin - pad, yDomainMax: allMax + pad };
  }, [chartData]);

  const candlestickShape = useMemo(() => {
    const dMin = yDomainMin;
    const dMax = yDomainMax;
    return (props: any) => {
      const { x, width, background, payload } = props;
      if (!payload || !background || !background.height || background.height <= 0) return <g />;

      const { open, high, low, close } = payload;
      if (open == null || high == null || low == null || close == null) return <g />;

      const toY = (val: number) =>
        background.y + ((dMax - val) / (dMax - dMin)) * background.height;

      const isUp = close >= open;
      const bullColor = "#22c55e";
      const bearColor = "#ef4444";
      const color = isUp ? bullColor : bearColor;

      const highY  = toY(high);
      const lowY   = toY(low);
      const openY  = toY(open);
      const closeY = toY(close);

      const bodyTop = Math.min(openY, closeY);
      const bodyBot = Math.max(openY, closeY);
      const bodyH   = Math.max(bodyBot - bodyTop, 1);
      const bodyW   = Math.max((width || 6) - 2, 2);
      const wickX   = x + (width || 6) / 2;

      return (
        <g>
          <line x1={wickX} y1={highY} x2={wickX} y2={lowY} stroke={color} strokeWidth={1} opacity={0.9} />
          <rect x={x + 1} y={bodyTop} width={bodyW} height={bodyH} fill={isUp ? color : color} stroke={color} strokeWidth={0.5} opacity={isUp ? 0.85 : 0.9} />
        </g>
      );
    };
  }, [yDomainMin, yDomainMax]);

  const periodReturnPct = selectedPeriod === "1d"
    ? (quote?.changePercent ?? 0)
    : chartData.length > 1
      ? ((chartData[chartData.length - 1].price - chartData[0].price) / chartData[0].price) * 100
      : (quote?.changePercent ?? 0);

  const periodReturnAbs = selectedPeriod === "1d"
    ? (quote?.change ?? 0)
    : chartData.length > 1
      ? chartData[chartData.length - 1].price - chartData[0].price
      : (quote?.change ?? 0);

  const isPeriodPositive = periodReturnPct >= 0;
  const periodLabelStr = periodOptions.find(p => p.key === selectedPeriod)?.returnLabel[lang === "ko" ? "ko" : "en"] ?? "";
  const dinoInsight = getDinoInsight(info || null, lang);

  const candleTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const dt = new Date(d.rawDate);
    const dateStr = isIntraday
      ? dt.toLocaleTimeString(lang === "ko" ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
      : dt.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" });
    const isUp = d.close >= d.open;
    return (
      <div style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <p style={{ color: tickColor, marginBottom: 6, fontWeight: 600 }}>{dateStr}</p>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "2px 14px" }}>
          {chartType === "candle" && (
            <>
              <span style={{ color: tickColor }}>{lang === "ko" ? "시가" : "Open"}</span>
              <span style={{ fontWeight: 700, color: isDark ? "#e5e7eb" : "#111827", textAlign: "right" }}>{formatPrice(d.open, { nativeCurrency })}</span>
              <span style={{ color: tickColor }}>{lang === "ko" ? "고가" : "High"}</span>
              <span style={{ fontWeight: 700, color: "#22c55e", textAlign: "right" }}>{formatPrice(d.high, { nativeCurrency })}</span>
              <span style={{ color: tickColor }}>{lang === "ko" ? "저가" : "Low"}</span>
              <span style={{ fontWeight: 700, color: "#ef4444", textAlign: "right" }}>{formatPrice(d.low, { nativeCurrency })}</span>
              <span style={{ color: tickColor }}>{lang === "ko" ? "종가" : "Close"}</span>
              <span style={{ fontWeight: 700, color: isUp ? "#22c55e" : "#ef4444", textAlign: "right" }}>
                {formatPrice(d.close, { nativeCurrency })} <span style={{ fontSize: 10, opacity: 0.85 }}>({d.changePct >= 0 ? "+" : ""}{d.changePct?.toFixed(2)}%)</span>
              </span>
            </>
          )}
          {chartType === "area" && (
            <>
              <span style={{ color: tickColor }}>{lang === "ko" ? "가격" : "Price"}</span>
              <span style={{ fontWeight: 700, color: isUp ? "#22c55e" : "#ef4444", textAlign: "right" }}>
                {formatPrice(d.price, { nativeCurrency })} <span style={{ fontSize: 10, opacity: 0.85 }}>({d.changePct >= 0 ? "+" : ""}{d.changePct?.toFixed(2)}%)</span>
              </span>
            </>
          )}
          {showMA && d.ma20 && (
            <>
              <span style={{ color: "#f59e0b" }}>MA 20</span>
              <span style={{ fontWeight: 600, color: "#f59e0b", textAlign: "right" }}>{formatPrice(d.ma20, { nativeCurrency, compact: true })}</span>
            </>
          )}
          {showMA && d.ma60 && (
            <>
              <span style={{ color: "#3b82f6" }}>MA 60</span>
              <span style={{ fontWeight: 600, color: "#3b82f6", textAlign: "right" }}>{formatPrice(d.ma60, { nativeCurrency, compact: true })}</span>
            </>
          )}
          {showMA && d.ma120 && (
            <>
              <span style={{ color: "#a855f7" }}>MA 120</span>
              <span style={{ fontWeight: 600, color: "#a855f7", textAlign: "right" }}>{formatPrice(d.ma120, { nativeCurrency, compact: true })}</span>
            </>
          )}
          {showBB && d.bbUpper && (
            <>
              <span style={{ color: "#6b7280" }}>BB Upper</span>
              <span style={{ fontWeight: 600, color: "#6b7280", textAlign: "right" }}>{formatPrice(d.bbUpper, { nativeCurrency, compact: true })}</span>
            </>
          )}
          {d.volume > 0 && (
            <>
              <span style={{ color: tickColor }}>{lang === "ko" ? "거래량" : "Vol"}</span>
              <span style={{ fontWeight: 600, color: isDark ? "#e5e7eb" : "#111827", textAlign: "right" }}>
                {d.volume >= 1e9 ? `${(d.volume / 1e9).toFixed(1)}B` : d.volume >= 1e6 ? `${(d.volume / 1e6).toFixed(1)}M` : `${(d.volume / 1e3).toFixed(0)}K`}
              </span>
            </>
          )}
          {showRSI && d.rsi != null && (
            <>
              <span style={{ color: d.rsi > 70 ? "#ef4444" : d.rsi < 30 ? "#22c55e" : tickColor }}>RSI 14</span>
              <span style={{ fontWeight: 700, color: d.rsi > 70 ? "#ef4444" : d.rsi < 30 ? "#22c55e" : isDark ? "#e5e7eb" : "#111827", textAlign: "right" }}>{d.rsi.toFixed(1)}</span>
            </>
          )}
        </div>
      </div>
    );
  };

  const toggleBtn = (active: boolean, onClick: () => void, children: React.ReactNode, activeClass: string, testId?: string) => (
    <button
      onClick={onClick}
      className={cn(
        "text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all",
        active ? activeClass : "bg-muted/50 text-muted-foreground border-border hover:border-muted-foreground/40"
      )}
      data-testid={testId}
    >
      {children}
    </button>
  );

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
                {selectedPeriod === "1d" ? (
                  <>{(quote?.change ?? 0) >= 0 ? "+" : ""}{formatPrice(quote?.change, { nativeCurrency })} ({(quote?.changePercent ?? 0) >= 0 ? "+" : ""}{quote?.changePercent?.toFixed(2) || "0.00"}%)</>
                ) : (
                  <>{isPeriodPositive ? "+" : ""}{formatPrice(periodReturnAbs, { nativeCurrency })} ({isPeriodPositive ? "+" : ""}{periodReturnPct.toFixed(2)}%)</>
                )}
                {selectedPeriod !== "1d" && chartData.length > 1 && (
                  <span className="text-xs text-muted-foreground font-normal ml-0.5">({periodLabelStr})</span>
                )}
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
        <CardHeader className="pb-2">
          {/* Top row: period tabs + chart type toggle + zoom + Pro button */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1 flex-wrap">
              {periodOptions.map((opt) => (
                <Button
                  key={opt.key}
                  variant={selectedPeriod === opt.key ? "default" : "ghost"}
                  size="sm"
                  className="px-2.5 h-7 text-xs"
                  onClick={() => { setSelectedPeriod(opt.key); setBrushDomain({}); }}
                  data-testid={`button-period-${opt.key}`}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {/* Zoom controls */}
              <div className="flex gap-0 items-center">
                <button
                  onClick={() => {
                    const n = chartData.length;
                    if (n < 4) return;
                    const s = brushDomain.startIndex ?? 0;
                    const e = brushDomain.endIndex ?? n - 1;
                    const range = e - s;
                    const quarter = Math.max(Math.round(range * 0.25), 1);
                    setBrushDomain({ startIndex: Math.min(s + quarter, e - 2), endIndex: Math.max(e - quarter, s + 2) });
                  }}
                  className="flex items-center justify-center w-6 h-6 rounded-l border border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all touch-manipulation"
                  title="Zoom in"
                  data-testid="button-zoom-in"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
                <button
                  onClick={() => {
                    const n = chartData.length;
                    if (n < 2) return;
                    const s = brushDomain.startIndex ?? 0;
                    const e = brushDomain.endIndex ?? n - 1;
                    const range = e - s;
                    const quarter = Math.max(Math.round(range * 0.33), 1);
                    setBrushDomain({ startIndex: Math.max(s - quarter, 0), endIndex: Math.min(e + quarter, n - 1) });
                  }}
                  className="flex items-center justify-center w-6 h-6 border-y border-r border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all touch-manipulation"
                  title="Zoom out"
                  data-testid="button-zoom-out"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setBrushDomain({})}
                  className="flex items-center justify-center px-1.5 h-6 rounded-r border-y border-r border-border bg-muted/50 hover:bg-muted text-[9px] font-bold text-muted-foreground hover:text-foreground transition-all touch-manipulation"
                  title="Reset zoom"
                  data-testid="button-zoom-reset"
                >
                  1:1
                </button>
              </div>
              {/* Chart type toggle */}
              <div className="flex gap-0 items-center">
                <button
                  onClick={() => setChartType("candle")}
                  className={cn("flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-l-full border transition-all", chartType === "candle" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border")}
                  data-testid="button-chart-candle"
                >
                  <CandlestickChart className="w-3 h-3" />{lang === "ko" ? "캔들" : "Candle"}
                </button>
                <button
                  onClick={() => setChartType("area")}
                  className={cn("flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-r-full border-y border-r transition-all", chartType === "area" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border")}
                  data-testid="button-chart-area"
                >
                  <LineChart className="w-3 h-3" />{lang === "ko" ? "라인" : "Line"}
                </button>
              </div>
              {/* Pro Dashboard overlay button */}
              <button
                onClick={() => setShowProModal(true)}
                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 hover:from-violet-500/20 hover:to-fuchsia-500/20 text-violet-600 dark:text-violet-400 border-violet-400/30 hover:border-violet-400/60 touch-manipulation"
                data-testid="button-pro-analysis"
              >
                <Zap className="w-3 h-3" />
                <span className="hidden sm:inline">{lang === "ko" ? "자세히 보기" : "Pro View"}</span>
              </button>
            </div>
          </div>

          {/* Indicator toggles row */}
          <div className="flex gap-1.5 flex-wrap mt-2 items-center">
            {toggleBtn(showSR, () => setShowSR(v => !v), lang === "ko" ? "지지/저항선" : "S/R Lines", "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/40", "button-toggle-sr")}
            {toggleBtn(showVolume, () => setShowVolume(v => !v), lang === "ko" ? "거래량" : "Volume", "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-400/40", "button-toggle-volume")}
            {!isIntraday && toggleBtn(showMA, () => setShowMA(v => !v), lang === "ko" ? "이동평균" : "MA Lines", "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-400/40", "button-toggle-ma")}
            {!isIntraday && toggleBtn(showBB, () => setShowBB(v => !v), lang === "ko" ? "볼린저밴드" : "Bollinger", "bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-400/40", "button-toggle-bb")}
            {!isIntraday && toggleBtn(showRSI, () => setShowRSI(v => !v), "RSI", "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-400/40", "button-toggle-rsi")}
            {!isIntraday && toggleBtn(showSignals, () => setShowSignals(v => !v), lang === "ko" ? "매매 시그널" : "Signals", "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-400/40", "button-toggle-signals")}
          </div>

          {/* MA legend */}
          {showMA && !isIntraday && (
            <div className="flex items-center gap-4 ml-1 mt-1.5 flex-wrap">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500"><span className="w-5 h-0.5 bg-amber-500 inline-block" />MA 20</span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-500"><span className="w-5 h-0.5 bg-blue-500 inline-block" />MA 60</span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-purple-500"><span className="w-5 h-0.5 bg-purple-500 inline-block" />MA 120</span>
            </div>
          )}
          {showSignals && !isIntraday && (
            <div className="flex items-center gap-4 ml-1 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">▲ {lang === "ko" ? "골든크로스 (매수)" : "Golden Cross (Buy)"}</span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500">▼ {lang === "ko" ? "데드크로스 (매도)" : "Dead Cross (Sell)"}</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="px-1 pb-3 sm:px-4">
          {isHistoryLoading ? (
            <div className="h-72 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length > 0 ? (
            <>
              {/* ── Main chart ── */}
              <ResponsiveContainer width="100%" height={300} style={{ touchAction: "pan-y" }}>
                <ComposedChart data={chartData} margin={{ top: 6, right: isKr || isJp ? 12 : 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="bbFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor="#6b7280" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#6b7280" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: tickColor }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[yDomainMin, yDomainMax]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: tickColor }}
                    tickFormatter={(v) => formatPrice(v, { nativeCurrency, compact: true })}
                    width={isKr || isJp ? 76 : 58}
                  />

                  <Tooltip content={candleTooltip} />

                  {/* S/R reference lines */}
                  {showSR && srLevels.resistances.map((level, i) => (
                    <ReferenceLine key={`res-${i}`} y={level} stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.5} strokeOpacity={0.7}
                      label={{ value: lang === "ko" ? `저항 ${formatPrice(level, { nativeCurrency, compact: true })}` : `R ${formatPrice(level, { nativeCurrency, compact: true })}`, position: i === 0 ? "insideTopRight" : "insideBottomRight", fontSize: 9, fill: "#ef4444", dx: -4 }}
                    />
                  ))}
                  {showSR && srLevels.supports.map((level, i) => (
                    <ReferenceLine key={`sup-${i}`} y={level} stroke="#22c55e" strokeDasharray="5 3" strokeWidth={1.5} strokeOpacity={0.7}
                      label={{ value: lang === "ko" ? `지지 ${formatPrice(level, { nativeCurrency, compact: true })}` : `S ${formatPrice(level, { nativeCurrency, compact: true })}`, position: i === 0 ? "insideBottomRight" : "insideTopRight", fontSize: 9, fill: "#22c55e", dx: -4 }}
                    />
                  ))}

                  {/* Bollinger Band fill area */}
                  {showBB && !isIntraday && (
                    <>
                      <Area type="monotone" dataKey="bbUpper" stroke="none" fill="url(#bbFill)" isAnimationActive={false} connectNulls />
                      <Line type="monotone" dataKey="bbUpper"  stroke="#6b7280" strokeWidth={1} strokeDasharray="4 2" dot={false} isAnimationActive={false} connectNulls name="bbUpper" />
                      <Line type="monotone" dataKey="bbMiddle" stroke="#6b7280" strokeWidth={1} strokeDasharray="2 2" dot={false} isAnimationActive={false} connectNulls name="bbMiddle" opacity={0.5} />
                      <Line type="monotone" dataKey="bbLower"  stroke="#6b7280" strokeWidth={1} strokeDasharray="4 2" dot={false} isAnimationActive={false} connectNulls name="bbLower" />
                    </>
                  )}

                  {/* MA lines */}
                  {showMA && !isIntraday && (
                    <>
                      <Line type="monotone" dataKey="ma20"  stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls name="ma20" />
                      <Line type="monotone" dataKey="ma60"  stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls name="ma60" />
                      <Line type="monotone" dataKey="ma120" stroke="#a855f7" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls name="ma120" />
                    </>
                  )}

                  {/* Candlestick bars */}
                  {chartType === "candle" && (
                    <Bar dataKey="close" shape={candlestickShape} isAnimationActive={false} />
                  )}

                  {/* Area line (line mode) */}
                  {chartType === "area" && (
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#areaFill)"
                      isAnimationActive={false}
                      name="price"
                      dot={(dotProps: any) => {
                        const { cx, cy, payload } = dotProps;
                        if (!showSignals || isIntraday || !payload?.signal) return <circle key={`d-${cx}`} cx={cx} cy={cy} r={0} fill="none" />;
                        const isBuy = payload.signal === "buy";
                        const dotY = isBuy ? cy + 18 : cy - 18;
                        return (
                          <g key={`sig-${cx}-${cy}`}>
                            <polygon points={isBuy ? `${cx},${cy + 6} ${cx - 7},${dotY + 8} ${cx + 7},${dotY + 8}` : `${cx},${cy - 6} ${cx - 7},${dotY - 8} ${cx + 7},${dotY - 8}`} fill={isBuy ? "#22c55e" : "#ef4444"} />
                            <text x={cx} y={isBuy ? dotY + 20 : dotY - 12} textAnchor="middle" fontSize={8} fill={isBuy ? "#22c55e" : "#ef4444"} fontWeight="bold">
                              {isBuy ? (lang === "ko" ? "골든크로스" : "Buy") : (lang === "ko" ? "데드크로스" : "Sell")}
                            </text>
                          </g>
                        );
                      }}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--primary))", fill: "white" }}
                    />
                  )}

                  {/* Candlestick signal overlays */}
                  {showSignals && chartType === "candle" && !isIntraday && chartData.map((d, i) => {
                    if (!d.signal) return null;
                    const isBuy = d.signal === "buy";
                    return <ReferenceLine key={`sigline-${i}`} x={d.date} stroke={isBuy ? "#22c55e" : "#ef4444"} strokeDasharray="3 3" strokeWidth={1.5} strokeOpacity={0.6} />;
                  })}

                  {/* Brush navigator for zoom/pan */}
                  <Brush
                    dataKey="date"
                    height={18}
                    travellerWidth={8}
                    startIndex={brushDomain.startIndex}
                    endIndex={brushDomain.endIndex}
                    onChange={(e: any) => setBrushDomain({ startIndex: e.startIndex, endIndex: e.endIndex })}
                    fill={isDark ? "#1f2937" : "#f3f4f6"}
                    stroke={isDark ? "#374151" : "#e5e7eb"}
                    traveller={{ fill: isDark ? "#6b7280" : "#9ca3af" }}
                    gap={1}
                  />
                </ComposedChart>
              </ResponsiveContainer>

              {/* ── Volume sub-chart ── */}
              {showVolume && (
                <div className="border-t border-border/30 pt-0.5">
                  <p className="text-[9px] text-muted-foreground text-center mb-0.5">{lang === "ko" ? "거래량" : "Volume"}</p>
                  <ResponsiveContainer width="100%" height={60}>
                    <BarChart data={chartData} margin={{ top: 0, right: isKr || isJp ? 12 : 8, bottom: 0, left: 0 }}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Bar dataKey="volume" radius={[1, 1, 0, 0]} maxBarSize={16} isAnimationActive={false}>
                        {chartData.map((entry, idx) => (
                          <Cell key={`vol-${idx}`} fill={entry.isUp ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── RSI sub-chart ── */}
              {showRSI && !isIntraday && (
                <div className="border-t border-border/30 pt-0.5">
                  <p className="text-[9px] text-muted-foreground text-center mb-0.5">RSI (14)</p>
                  <ResponsiveContainer width="100%" height={80}>
                    <ComposedChart data={chartData} margin={{ top: 2, right: isKr || isJp ? 12 : 8, bottom: 0, left: 0 }}>
                      <XAxis dataKey="date" hide />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: tickColor }} ticks={[30, 50, 70]} width={24} />
                      {/* Overbought zone */}
                      <ReferenceArea y1={70} y2={100} fill="rgba(239,68,68,0.08)" />
                      {/* Oversold zone */}
                      <ReferenceArea y1={0} y2={30} fill="rgba(34,197,94,0.08)" />
                      <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.6}
                        label={{ value: "70", position: "insideTopRight", fontSize: 9, fill: "#ef4444" }}
                      />
                      <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.6}
                        label={{ value: "30", position: "insideBottomRight", fontSize: 9, fill: "#22c55e" }}
                      />
                      <ReferenceLine y={50} stroke={tickColor} strokeDasharray="2 4" strokeWidth={0.5} strokeOpacity={0.4} />
                      <Line
                        type="monotone"
                        dataKey="rsi"
                        stroke="#06b6d4"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls
                      />
                      <Tooltip
                        formatter={(v: number) => [v?.toFixed(1), "RSI"]}
                        contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 6, fontSize: 11 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── Signal panel ── */}
              {showSignals && !isIntraday && crossoverSignals.length > 0 && (() => {
                const lastSig = crossoverSignals[crossoverSignals.length - 1];
                const pt = chartData[lastSig.index];
                const isBuy = lastSig.signal === "buy";
                return (
                  <div className={cn("mt-3 mx-1 p-3.5 rounded-xl border text-sm", isBuy ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 border-rose-400/30 text-rose-700 dark:text-rose-400")}>
                    <p className="font-bold mb-1">
                      {isBuy ? "📈 " : "📉 "}
                      {lang === "ko"
                        ? isBuy ? "골든크로스 발생 — MA20이 MA60을 상향 돌파. 매수 고려" : "데드크로스 발생 — MA20이 MA60을 하향 돌파. 매도 고려"
                        : isBuy ? "Golden Cross — MA20 crossed above MA60. Consider buying" : "Dead Cross — MA20 crossed below MA60. Consider selling"}
                    </p>
                    <p className="text-xs opacity-75">
                      {lang === "ko"
                        ? `시그널 발생일: ${pt?.date ?? ""} · 이동평균선 교차 기반 추세 전환 시그널`
                        : `Signal date: ${pt?.date ?? ""} · MA crossover trend-reversal signal`}
                    </p>
                  </div>
                );
              })()}

              {/* ── Period return pill ── */}
              {chartData.length > 1 && selectedPeriod !== "1d" && (
                <div className="mt-3 flex flex-wrap gap-2.5 px-1">
                  <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-3 py-1.5">
                    <span className="text-muted-foreground">{lang === "ko" ? `${periodLabelStr} 수익률` : `${periodLabelStr} Return`}</span>
                    <span className={cn("font-bold", isPeriodPositive ? "text-emerald-500" : "text-rose-500")}>
                      {isPeriodPositive ? "+" : ""}{periodReturnPct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-3 py-1.5">
                    <span className="text-muted-foreground">{lang === "ko" ? "시작가" : "Start"}</span>
                    <span className="font-mono font-semibold">{formatPrice(chartData[0].price, { nativeCurrency })}</span>
                  </div>
                  {chartData[0].ma20 != null && showMA && (
                    <div className="flex items-center gap-2 text-xs bg-amber-500/10 rounded-lg px-3 py-1.5">
                      <span className="text-amber-600 dark:text-amber-400">MA20</span>
                      <span className="font-mono font-semibold">{formatPrice(chartData[chartData.length - 1].ma20, { nativeCurrency, compact: true })}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="h-72 flex items-center justify-center text-muted-foreground">
              <AlertCircle className="w-5 h-5 mr-2" />
              {lang === "en" ? "No chart data available" : "차트 데이터가 없습니다"}
            </div>
          )}
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
