import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CandlestickChart,
  LineChart,
  ExternalLink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getLocalizedCompanyName } from "@/lib/stockNames";
import { cleanCompanyName } from "@/lib/stockUtils";
import {
  calculateSMA,
  calculateRSI,
  calculateBollingerBands,
  calculateMACD,
  calculateSupportResistance,
  detectMACrossover,
} from "@/lib/technicalAnalysis";
import { useLocation } from "wouter";

const PERIOD_OPTIONS = [
  { key: "1d",  label: "1D",  period: "1d",  interval: "5m",  returnLabelKo: "오늘",  returnLabelEn: "Today"   },
  { key: "1w",  label: "1W",  period: "5d",  interval: "15m", returnLabelKo: "1주",   returnLabelEn: "1 Week"  },
  { key: "1m",  label: "1M",  period: "1mo", interval: "1d",  returnLabelKo: "1개월", returnLabelEn: "1 Month" },
  { key: "1y",  label: "1Y",  period: "1y",  interval: "1wk", returnLabelKo: "1년",   returnLabelEn: "1 Year"  },
  { key: "5y",  label: "5Y",  period: "5y",  interval: "1wk", returnLabelKo: "5년",   returnLabelEn: "5 Years" },
  { key: "all", label: "MAX", period: "max", interval: "1mo", returnLabelKo: "전체",  returnLabelEn: "All Time"},
];

const SECTOR_RRG_DATA = [
  { name: "Technology",      nameKo: "기술",     x: 102, y: 104, quad: "leading"  },
  { name: "Healthcare",      nameKo: "헬스케어", x: 98,  y: 101, quad: "weakening"},
  { name: "Financials",      nameKo: "금융",     x: 101, y: 99,  quad: "improving"},
  { name: "Consumer Disc.",  nameKo: "소비재",   x: 97,  y: 96,  quad: "lagging"  },
  { name: "Industrials",     nameKo: "산업재",   x: 100, y: 102, quad: "leading"  },
  { name: "Energy",          nameKo: "에너지",   x: 96,  y: 97,  quad: "lagging"  },
  { name: "Utilities",       nameKo: "유틸리티", x: 99,  y: 100, quad: "improving"},
  { name: "Communication",   nameKo: "통신",     x: 103, y: 98,  quad: "weakening"},
  { name: "Materials",       nameKo: "소재",     x: 98,  y: 103, quad: "leading"  },
  { name: "Real Estate",     nameKo: "부동산",   x: 95,  y: 95,  quad: "lagging"  },
];

const QUAD_COLOR: Record<string, string> = {
  leading: "#22c55e",
  weakening: "#f59e0b",
  improving: "#3b82f6",
  lagging: "#ef4444",
};

function formatMarketCap(v: number | null): string {
  if (!v) return "--";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
}
function fmtVol(v: number | null): string {
  if (!v) return "--";
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${v}`;
}

interface Props {
  symbol: string;
  name: string;
  isOpen: boolean;
  onClose: () => void;
  lang: "en" | "ko";
}

type TabKey = "chart" | "indicators" | "sector" | "fundamentals";

export function StockAnalysisModal({ symbol, name, isOpen, onClose, lang }: Props) {
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const { formatPrice, isKoreanStock, isJapaneseStock } = useCurrency();
  const isKr = isKoreanStock(symbol);
  const isJp = isJapaneseStock(symbol);
  const nativeCurrency: "KRW" | "JPY" | "USD" = isKr ? "KRW" : isJp ? "JPY" : "USD";

  const isDark = theme === "dark";
  const tickColor   = isDark ? "#9ca3af" : "#6b7280";
  const tooltipBg   = isDark ? "#111827" : "#ffffff";
  const tooltipBdr  = isDark ? "#374151" : "#e5e7eb";

  const [tab, setTab]                   = useState<TabKey>("chart");
  const [period, setPeriod]             = useState("1m");
  const [chartType, setChartType]       = useState<"candle" | "area">("candle");
  const [showVolume, setShowVolume]     = useState(true);
  const [showSR, setShowSR]             = useState(true);
  const [showMA, setShowMA]             = useState(false);
  const [showBB, setShowBB]             = useState(false);
  const [showSignals, setShowSignals]   = useState(false);

  const isKo = lang === "ko";
  const periodCfg = PERIOD_OPTIONS.find(p => p.key === period) || PERIOD_OPTIONS[2];
  const isIntraday = period === "1d";

  const { data: quote } = useQuery<any>({
    queryKey: ["/api/stocks/live", symbol],
    queryFn: async () => {
      const r = await fetch(`/api/stocks/live/${symbol}`);
      if (!r.ok) throw new Error("quota");
      return r.json();
    },
    enabled: isOpen && !!symbol,
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const { data: info } = useQuery<any>({
    queryKey: ["/api/stocks/info", symbol, lang],
    queryFn: async () => {
      const r = await fetch(`/api/stocks/info/${symbol}?lang=${lang}`);
      if (!r.ok) throw new Error("info");
      return r.json();
    },
    enabled: isOpen && !!symbol,
    staleTime: 300000,
  });

  const { data: history, isLoading: isHistLoading } = useQuery<any>({
    queryKey: ["/api/stocks/history", symbol, periodCfg.period, periodCfg.interval],
    queryFn: async () => {
      const r = await fetch(`/api/stocks/history/${symbol}?period=${periodCfg.period}&interval=${periodCfg.interval}`);
      if (!r.ok) throw new Error("history");
      return r.json();
    },
    enabled: isOpen && !!symbol,
    staleTime: 60000,
  });

  const rawData = history?.data || [];
  const closes  = rawData.map((d: any) => d.close as number);

  const ma20   = calculateSMA(closes, 20);
  const ma60   = calculateSMA(closes, 60);
  const ma120  = calculateSMA(closes, 120);
  const rsi    = calculateRSI(closes, 14);
  const bb     = calculateBollingerBands(closes, 20);
  const macd   = calculateMACD(closes);
  const crossoverSignals = (!isIntraday && closes.length >= 62)
    ? detectMACrossover(closes, 20, 60) : [];
  const signalMap = new Map(crossoverSignals.map(s => [s.index, s.signal]));

  const srLevels = useMemo(() => {
    if (isIntraday || closes.length < 20) {
      return {
        supports:    info?.["52WeekLow"]  != null ? [info["52WeekLow"]]  : [],
        resistances: info?.["52WeekHigh"] != null ? [info["52WeekHigh"]] : [],
      };
    }
    return calculateSupportResistance(closes, 3);
  }, [closes, isIntraday, info]);

  const chartData = useMemo(() => rawData.map((d: any, i: number) => {
    const dt = new Date(d.date);
    const label = isIntraday
      ? dt.toLocaleTimeString(isKo ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
      : dt.toLocaleDateString(isKo ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
    return {
      date: label, rawDate: d.date,
      price: d.close, open: d.open, high: d.high || d.close, low: d.low || d.close, close: d.close,
      volume: d.volume ?? 0,
      ma20: ma20[i] ?? null, ma60: ma60[i] ?? null, ma120: ma120[i] ?? null,
      rsi: rsi[i] ?? null,
      bbUpper: bb[i]?.upper ?? null, bbMiddle: bb[i]?.middle ?? null, bbLower: bb[i]?.lower ?? null,
      macd: macd.macd[i] ?? null, macdSignal: macd.signal[i] ?? null, macdHist: macd.histogram[i] ?? null,
      signal: signalMap.get(i) ?? null,
      isUp: d.close >= d.open,
    };
  }), [rawData, ma20, ma60, ma120, rsi, bb, macd, signalMap, isIntraday, isKo]);

  const { yDomainMin, yDomainMax } = useMemo(() => {
    if (!chartData.length) return { yDomainMin: 0, yDomainMax: 100 };
    const lows  = chartData.map((d: any) => d.low  > 0 ? d.low  : d.price).filter((v: number) => v > 0);
    const highs = chartData.map((d: any) => d.high > 0 ? d.high : d.price).filter((v: number) => v > 0);
    const maVals = chartData.flatMap((d: any) => [d.ma20, d.ma60, d.ma120, d.bbUpper, d.bbLower]).filter((v: any): v is number => v !== null && v > 0);
    const allMin = Math.min(...lows, ...maVals);
    const allMax = Math.max(...highs, ...maVals);
    const pad = (allMax - allMin) * 0.06;
    return { yDomainMin: allMin - pad, yDomainMax: allMax + pad };
  }, [chartData]);

  const candlestickShape = useMemo(() => {
    const dMin = yDomainMin, dMax = yDomainMax;
    return (props: any) => {
      const { x, width, background, payload } = props;
      if (!payload || !background || !background.height || background.height <= 0) return <g />;
      const { open, high, low, close } = payload;
      if (open == null || high == null || low == null || close == null) return <g />;
      const toY = (val: number) => background.y + ((dMax - val) / (dMax - dMin)) * background.height;
      const isUp = close >= open;
      const color = isUp ? "#22c55e" : "#ef4444";
      const highY  = toY(high), lowY  = toY(low);
      const openY  = toY(open), closeY = toY(close);
      const bodyTop = Math.min(openY, closeY);
      const bodyH   = Math.max(Math.max(openY, closeY) - bodyTop, 1);
      const bodyW   = Math.max((width || 6) - 2, 2);
      const wickX   = x + (width || 6) / 2;
      return (
        <g>
          <line x1={wickX} y1={highY} x2={wickX} y2={lowY} stroke={color} strokeWidth={1} opacity={0.9} />
          <rect x={x + 1} y={bodyTop} width={bodyW} height={bodyH} fill={color} stroke={color} strokeWidth={0.5} opacity={isUp ? 0.85 : 0.9} />
        </g>
      );
    };
  }, [yDomainMin, yDomainMax]);

  const periodReturnPct = period === "1d"
    ? (quote?.changePercent ?? 0)
    : chartData.length > 1
      ? ((chartData[chartData.length - 1].price - chartData[0].price) / chartData[0].price) * 100
      : (quote?.changePercent ?? 0);
  const periodReturnAbs = period === "1d"
    ? (quote?.change ?? 0)
    : chartData.length > 1
      ? chartData[chartData.length - 1].price - chartData[0].price
      : (quote?.change ?? 0);
  const isPositive = periodReturnPct >= 0;
  const periodLabel = periodCfg ? (isKo ? periodCfg.returnLabelKo : periodCfg.returnLabelEn) : "";

  const candleTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const dt = new Date(d.rawDate);
    const dateStr = isIntraday
      ? dt.toLocaleTimeString(isKo ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
      : dt.toLocaleDateString(isKo ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" });
    const isUp = d.close >= d.open;
    return (
      <div style={{ background: tooltipBg, border: `1px solid ${tooltipBdr}`, borderRadius: 8, padding: "8px 12px", fontSize: 11 }}>
        <p style={{ color: tickColor, marginBottom: 4, fontWeight: 600 }}>{dateStr}</p>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "2px 12px" }}>
          {chartType === "candle" && (
            <>
              <span style={{ color: tickColor }}>{isKo ? "시가" : "O"}</span>
              <span style={{ fontWeight: 700, color: isDark ? "#e5e7eb" : "#111827", textAlign: "right" }}>{formatPrice(d.open, { nativeCurrency })}</span>
              <span style={{ color: "#22c55e" }}>{isKo ? "고가" : "H"}</span>
              <span style={{ fontWeight: 700, color: "#22c55e", textAlign: "right" }}>{formatPrice(d.high, { nativeCurrency })}</span>
              <span style={{ color: "#ef4444" }}>{isKo ? "저가" : "L"}</span>
              <span style={{ fontWeight: 700, color: "#ef4444", textAlign: "right" }}>{formatPrice(d.low, { nativeCurrency })}</span>
              <span style={{ color: isUp ? "#22c55e" : "#ef4444" }}>{isKo ? "종가" : "C"}</span>
              <span style={{ fontWeight: 700, color: isUp ? "#22c55e" : "#ef4444", textAlign: "right" }}>{formatPrice(d.close, { nativeCurrency })}</span>
            </>
          )}
          {chartType === "area" && (
            <>
              <span style={{ color: tickColor }}>{isKo ? "가격" : "Price"}</span>
              <span style={{ fontWeight: 700, color: isDark ? "#e5e7eb" : "#111827", textAlign: "right" }}>{formatPrice(d.price, { nativeCurrency })}</span>
            </>
          )}
          {d.volume > 0 && (
            <>
              <span style={{ color: tickColor }}>{isKo ? "거래량" : "Vol"}</span>
              <span style={{ fontWeight: 600, color: isDark ? "#d1d5db" : "#374151", textAlign: "right" }}>{fmtVol(d.volume)}</span>
            </>
          )}
        </div>
      </div>
    );
  };

  const rsiTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d?.rsi) return null;
    return (
      <div style={{ background: tooltipBg, border: `1px solid ${tooltipBdr}`, borderRadius: 6, padding: "6px 10px", fontSize: 11 }}>
        <span style={{ color: d.rsi > 70 ? "#ef4444" : d.rsi < 30 ? "#22c55e" : tickColor, fontWeight: 700 }}>RSI: {d.rsi.toFixed(1)}</span>
      </div>
    );
  };

  const macdTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (d?.macd == null) return null;
    return (
      <div style={{ background: tooltipBg, border: `1px solid ${tooltipBdr}`, borderRadius: 6, padding: "6px 10px", fontSize: 11 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "2px 10px" }}>
          <span style={{ color: "#3b82f6" }}>MACD</span><span style={{ fontWeight: 700, color: "#3b82f6", textAlign: "right" }}>{d.macd?.toFixed(2) ?? "--"}</span>
          <span style={{ color: "#f59e0b" }}>{isKo ? "시그널" : "Signal"}</span><span style={{ fontWeight: 700, color: "#f59e0b", textAlign: "right" }}>{d.macdSignal?.toFixed(2) ?? "--"}</span>
          <span style={{ color: (d.macdHist ?? 0) >= 0 ? "#22c55e" : "#ef4444" }}>{isKo ? "히스토그램" : "Hist"}</span><span style={{ fontWeight: 700, color: (d.macdHist ?? 0) >= 0 ? "#22c55e" : "#ef4444", textAlign: "right" }}>{d.macdHist?.toFixed(2) ?? "--"}</span>
        </div>
      </div>
    );
  };

  const toggleBtn = (active: boolean, onClick: () => void, label: string, activeClass: string, testId?: string) => (
    <button
      onClick={onClick}
      className={cn(
        "text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all shrink-0",
        active ? activeClass : "bg-muted/50 text-muted-foreground border-border hover:border-muted-foreground/40"
      )}
      data-testid={testId}
    >
      {label}
    </button>
  );

  const displayName = getLocalizedCompanyName(cleanCompanyName(name || symbol), lang);
  const sector = info?.sector || null;

  const stockRRGPoint = useMemo(() => {
    const sectorMatch = SECTOR_RRG_DATA.find(s =>
      sector && (s.name.toLowerCase().includes(sector.toLowerCase()) || sector.toLowerCase().includes(s.name.toLowerCase().split(" ")[0]))
    );
    if (sectorMatch) {
      return { name: symbol, nameKo: symbol, x: sectorMatch.x + (Math.random() * 2 - 1), y: sectorMatch.y + (Math.random() * 2 - 1), quad: sectorMatch.quad, isStock: true };
    }
    return { name: symbol, nameKo: symbol, x: 100, y: 100, quad: "leading", isStock: true };
  }, [symbol, sector]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "chart",        label: isKo ? "차트"    : "Chart"        },
    { key: "indicators",  label: isKo ? "기술지표" : "Indicators"   },
    { key: "sector",      label: isKo ? "섹터분석" : "Sector"       },
    { key: "fundamentals", label: isKo ? "기업실적" : "Fundamentals" },
  ];

  const weekHigh  = info?.["52WeekHigh"];
  const weekLow   = info?.["52WeekLow"];
  const weekRange = weekHigh && weekLow ? weekHigh - weekLow : 0;
  const currentPrice = quote?.price ?? 0;
  const weekRangePct = weekRange > 0 ? ((currentPrice - weekLow) / weekRange) * 100 : 50;

  const rsiLast = chartData.length > 0 ? chartData[chartData.length - 1].rsi : null;
  const macdLast = chartData.length > 0 ? chartData[chartData.length - 1].macd : null;
  const macdSigLast = chartData.length > 0 ? chartData[chartData.length - 1].macdSignal : null;

  const getRSILabel = (v: number | null) => {
    if (v == null) return { text: "--", color: tickColor };
    if (v > 70) return { text: isKo ? "과매수 구간" : "Overbought", color: "#ef4444" };
    if (v < 30) return { text: isKo ? "과매도 구간" : "Oversold",   color: "#22c55e" };
    return { text: isKo ? "중립"       : "Neutral",    color: tickColor };
  };
  const getMACDLabel = (m: number | null, s: number | null) => {
    if (m == null || s == null) return { text: "--", color: tickColor };
    if (m > s) return { text: isKo ? "상승 모멘텀" : "Bullish momentum", color: "#22c55e" };
    return { text: isKo ? "하락 모멘텀" : "Bearish momentum", color: "#ef4444" };
  };

  return (
    <Dialog open={isOpen} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-none w-screen h-screen md:h-[92vh] md:w-[96vw] md:max-w-5xl p-0 gap-0 flex flex-col overflow-hidden rounded-none md:rounded-2xl"
        data-testid="modal-stock-analysis"
      >
        {/* ── Header ── */}
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold leading-tight truncate">{displayName}</DialogTitle>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono">{symbol}</span>
                {sector && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{sector}</Badge>}
                {isKr && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-400/40 text-blue-600 dark:text-blue-400">KOSPI</Badge>}
                {isJp && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-400/40 text-red-600 dark:text-red-400">TSE</Badge>}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Price block */}
              <div className="text-right hidden sm:block">
                <div className="text-xl font-bold font-mono">{formatPrice(quote?.price, { nativeCurrency })}</div>
                <div className={cn("flex items-center justify-end gap-1 text-sm font-semibold", isPositive ? "text-emerald-500" : "text-rose-500")}>
                  {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {isPositive ? "+" : ""}{periodReturnPct.toFixed(2)}%
                </div>
              </div>
              <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted transition-colors" data-testid="button-close-modal">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile price */}
          <div className="sm:hidden flex items-center gap-2 mt-1">
            <span className="text-lg font-bold font-mono">{formatPrice(quote?.price, { nativeCurrency })}</span>
            <span className={cn("text-sm font-bold", isPositive ? "text-emerald-500" : "text-rose-500")}>
              {isPositive ? "+" : ""}{periodReturnPct.toFixed(2)}%
              <span className="text-xs font-normal text-muted-foreground ml-1">({periodLabel})</span>
            </span>
          </div>
        </DialogHeader>

        {/* ── Tab Nav ── */}
        <div className="flex border-b border-border shrink-0 overflow-x-auto no-scrollbar" data-testid="modal-tabs">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 shrink-0",
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              data-testid={`tab-${t.key}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden" data-testid="modal-content">

          {/* ════════ TAB: 차트 ════════ */}
          {tab === "chart" && (
            <div className="p-3 space-y-3">
              {/* Period + Chart type controls */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-1 flex-wrap">
                  {PERIOD_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setPeriod(opt.key)}
                      className={cn(
                        "px-2.5 h-7 text-xs font-semibold rounded-md transition-colors",
                        period === opt.key ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      )}
                      data-testid={`button-modal-period-${opt.key}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-0">
                  <button
                    onClick={() => setChartType("candle")}
                    className={cn("flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-l-full border transition-all", chartType === "candle" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border")}
                    data-testid="button-modal-candle"
                  >
                    <CandlestickChart className="w-3 h-3" />{isKo ? "캔들" : "Candle"}
                  </button>
                  <button
                    onClick={() => setChartType("area")}
                    className={cn("flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-r-full border-y border-r transition-all", chartType === "area" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border")}
                    data-testid="button-modal-area"
                  >
                    <LineChart className="w-3 h-3" />{isKo ? "라인" : "Line"}
                  </button>
                </div>
              </div>

              {/* Period return */}
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-bold", isPositive ? "text-emerald-500" : "text-rose-500")}>
                  {isPositive ? "+" : ""}{formatPrice(periodReturnAbs, { nativeCurrency })} ({isPositive ? "+" : ""}{periodReturnPct.toFixed(2)}%)
                </span>
                <span className="text-xs text-muted-foreground">{periodLabel}</span>
              </div>

              {/* Toggle buttons */}
              <div className="flex gap-1.5 flex-wrap items-center">
                {toggleBtn(showSR, () => setShowSR(v => !v), isKo ? "지지/저항선" : "S/R Lines", "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/40", "button-modal-sr")}
                {toggleBtn(showVolume, () => setShowVolume(v => !v), isKo ? "거래량" : "Volume", "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-400/40", "button-modal-volume")}
                {!isIntraday && toggleBtn(showMA, () => setShowMA(v => !v), isKo ? "이동평균" : "MA Lines", "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-400/40", "button-modal-ma")}
                {!isIntraday && toggleBtn(showBB, () => setShowBB(v => !v), isKo ? "볼린저밴드" : "Bollinger", "bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-400/40", "button-modal-bb")}
                {!isIntraday && toggleBtn(showSignals, () => setShowSignals(v => !v), isKo ? "매매 시그널" : "Signals", "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-400/40", "button-modal-signals")}
              </div>
              {showMA && !isIntraday && (
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500"><span className="w-5 h-0.5 bg-amber-500 inline-block" />MA 20</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-500"><span className="w-5 h-0.5 bg-blue-500 inline-block" />MA 60</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-purple-500"><span className="w-5 h-0.5 bg-purple-500 inline-block" />MA 120</span>
                </div>
              )}

              {/* Main price chart */}
              {isHistLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : chartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={chartData} margin={{ top: 4, right: isKr || isJp ? 10 : 6, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="modalAreaFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tickColor }} interval="preserveStartEnd" />
                      <YAxis domain={[yDomainMin, yDomainMax]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tickColor }} tickFormatter={v => formatPrice(v, { nativeCurrency, compact: true })} width={isKr || isJp ? 72 : 54} />
                      <Tooltip content={candleTooltip} />

                      {showSR && srLevels.resistances.map((level: number, i: number) => (
                        <ReferenceLine key={`r${i}`} y={level} stroke="#ef4444" strokeDasharray="5 3" strokeWidth={1.5} strokeOpacity={0.7}
                          label={{ value: isKo ? `저항 ${formatPrice(level, { nativeCurrency, compact: true })}` : `R ${formatPrice(level, { nativeCurrency, compact: true })}`, position: "insideTopRight", fontSize: 9, fill: "#ef4444", dx: -4 }}
                        />
                      ))}
                      {showSR && srLevels.supports.map((level: number, i: number) => (
                        <ReferenceLine key={`s${i}`} y={level} stroke="#22c55e" strokeDasharray="5 3" strokeWidth={1.5} strokeOpacity={0.7}
                          label={{ value: isKo ? `지지 ${formatPrice(level, { nativeCurrency, compact: true })}` : `S ${formatPrice(level, { nativeCurrency, compact: true })}`, position: "insideBottomRight", fontSize: 9, fill: "#22c55e", dx: -4 }}
                        />
                      ))}

                      {showBB && !isIntraday && (
                        <>
                          <Line type="monotone" dataKey="bbUpper"  stroke="#6b7280" strokeWidth={1} strokeDasharray="4 2" dot={false} isAnimationActive={false} connectNulls />
                          <Line type="monotone" dataKey="bbMiddle" stroke="#6b7280" strokeWidth={1} strokeDasharray="2 2" dot={false} isAnimationActive={false} connectNulls opacity={0.5} />
                          <Line type="monotone" dataKey="bbLower"  stroke="#6b7280" strokeWidth={1} strokeDasharray="4 2" dot={false} isAnimationActive={false} connectNulls />
                        </>
                      )}
                      {showMA && !isIntraday && (
                        <>
                          <Line type="monotone" dataKey="ma20"  stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                          <Line type="monotone" dataKey="ma60"  stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                          <Line type="monotone" dataKey="ma120" stroke="#a855f7" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                        </>
                      )}

                      {chartType === "candle" && <Bar dataKey="close" shape={candlestickShape} isAnimationActive={false} />}
                      {chartType === "area" && (
                        <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#modalAreaFill)" isAnimationActive={false}
                          dot={(dp: any) => {
                            const { cx, cy, payload } = dp;
                            if (!showSignals || isIntraday || !payload?.signal) return <circle key={`d-${cx}`} cx={cx} cy={cy} r={0} fill="none" />;
                            const isBuy = payload.signal === "buy";
                            const dotY = isBuy ? cy + 18 : cy - 18;
                            return (
                              <g key={`sig-${cx}-${cy}`}>
                                <polygon points={isBuy ? `${cx},${cy + 6} ${cx - 7},${dotY + 8} ${cx + 7},${dotY + 8}` : `${cx},${cy - 6} ${cx - 7},${dotY - 8} ${cx + 7},${dotY - 8}`} fill={isBuy ? "#22c55e" : "#ef4444"} />
                              </g>
                            );
                          }}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>

                  {/* Volume chart */}
                  {showVolume && (
                    <ResponsiveContainer width="100%" height={70}>
                      <ComposedChart data={chartData} margin={{ top: 0, right: isKr || isJp ? 10 : 6, bottom: 0, left: 0 }}>
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={false} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: tickColor }} tickFormatter={v => fmtVol(v)} width={isKr || isJp ? 72 : 54} />
                        <Tooltip content={() => null} />
                        <Bar dataKey="volume" isAnimationActive={false}>
                          {chartData.map((d: any, i: number) => (
                            <Cell key={`v-${i}`} fill={d.isUp ? "#22c55e" : "#ef4444"} opacity={0.5} />
                          ))}
                        </Bar>
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  {isKo ? "차트 데이터 없음" : "No chart data"}
                </div>
              )}

              <button
                onClick={() => { onClose(); navigate(`/stock/${symbol}`); }}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:underline py-1"
                data-testid="button-modal-goto-detail"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {isKo ? `${displayName} 전체 분석 보기` : `View full analysis for ${symbol}`}
              </button>
            </div>
          )}

          {/* ════════ TAB: 기술지표 ════════ */}
          {tab === "indicators" && (
            <div className="p-3 space-y-5">
              {/* Period selector (compact) */}
              <div className="flex gap-1 flex-wrap">
                {PERIOD_OPTIONS.map(opt => (
                  <button key={opt.key} onClick={() => setPeriod(opt.key)}
                    className={cn("px-2.5 h-7 text-xs font-semibold rounded-md transition-colors", period === opt.key ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted")}
                    data-testid={`button-modal-ind-period-${opt.key}`}
                  >{opt.label}</button>
                ))}
              </div>

              {/* RSI Summary Card */}
              <div className="bg-muted/40 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">RSI (14)</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-background border" style={{ color: getRSILabel(rsiLast).color }}>
                    {getRSILabel(rsiLast).text} {rsiLast != null ? `(${rsiLast.toFixed(1)})` : ""}
                  </span>
                </div>
                {isHistLoading ? (
                  <div className="h-32 flex items-center justify-center"><RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height={130}>
                    <ComposedChart data={chartData} margin={{ top: 2, right: 6, bottom: 0, left: 0 }}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: tickColor }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: tickColor }} width={28} ticks={[30, 50, 70]} />
                      <Tooltip content={rsiTooltip} />
                      <ReferenceArea y1={70} y2={100} fill="#ef4444" fillOpacity={0.08} />
                      <ReferenceArea y1={0}  y2={30}  fill="#22c55e" fillOpacity={0.08} />
                      <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} strokeOpacity={0.5} />
                      <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="4 2" strokeWidth={1} strokeOpacity={0.5} />
                      <ReferenceLine y={50} stroke={tickColor} strokeDasharray="2 2" strokeWidth={1} strokeOpacity={0.3} />
                      <Line type="monotone" dataKey="rsi" stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
                <p className="text-xs text-muted-foreground">
                  {isKo
                    ? "RSI 70 이상: 과매수 (과열 가능성) · RSI 30 이하: 과매도 (반등 가능성)"
                    : "RSI > 70: Overbought (potential reversal) · RSI < 30: Oversold (potential bounce)"}
                </p>
              </div>

              {/* MACD Summary Card */}
              <div className="bg-muted/40 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">MACD (12, 26, 9)</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-background border" style={{ color: getMACDLabel(macdLast, macdSigLast).color }}>
                    {getMACDLabel(macdLast, macdSigLast).text}
                  </span>
                </div>
                {isHistLoading ? (
                  <div className="h-32 flex items-center justify-center"><RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height={130}>
                    <ComposedChart data={chartData} margin={{ top: 2, right: 6, bottom: 0, left: 0 }}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: tickColor }} interval="preserveStartEnd" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: tickColor }} width={36} tickFormatter={v => v.toFixed(1)} />
                      <Tooltip content={macdTooltip} />
                      <ReferenceLine y={0} stroke={tickColor} strokeOpacity={0.3} />
                      <Bar dataKey="macdHist" isAnimationActive={false}>
                        {chartData.map((d: any, i: number) => (
                          <Cell key={`mh-${i}`} fill={(d.macdHist ?? 0) >= 0 ? "#22c55e" : "#ef4444"} opacity={0.7} />
                        ))}
                      </Bar>
                      <Line type="monotone" dataKey="macd"       stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                      <Line type="monotone" dataKey="macdSignal" stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
                <div className="flex items-center gap-4 text-[10px] font-semibold flex-wrap">
                  <span className="flex items-center gap-1 text-blue-500"><span className="w-4 h-0.5 bg-blue-500 inline-block" />MACD</span>
                  <span className="flex items-center gap-1 text-amber-500"><span className="w-4 h-0.5 bg-amber-500 inline-block" />{isKo ? "시그널" : "Signal"}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">{isKo ? "히스토그램 (MACD - Signal)" : "Histogram (MACD − Signal)"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isKo
                    ? "MACD가 시그널선 위: 상승 신호 · MACD가 시그널선 아래: 하락 신호"
                    : "MACD above signal: bullish signal · MACD below signal: bearish signal"}
                </p>
              </div>

              {/* Bollinger Band summary */}
              <div className="bg-muted/40 rounded-xl p-3 space-y-2">
                <h3 className="text-sm font-bold">{isKo ? "볼린저 밴드 (20, 2)" : "Bollinger Bands (20, 2)"}</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: isKo ? "상단" : "Upper", val: chartData.length > 0 ? chartData[chartData.length - 1].bbUpper : null, color: "#6b7280" },
                    { label: isKo ? "중간" : "Middle", val: chartData.length > 0 ? chartData[chartData.length - 1].bbMiddle : null, color: "#6b7280" },
                    { label: isKo ? "하단" : "Lower", val: chartData.length > 0 ? chartData[chartData.length - 1].bbLower : null, color: "#6b7280" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="bg-background rounded-lg p-2 border border-border">
                      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                      <p className="text-xs font-bold" style={{ color }}>{val != null ? formatPrice(val, { nativeCurrency, compact: true }) : "--"}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isKo
                    ? "가격이 상단 밴드에 닿으면 과매수, 하단에 닿으면 과매도 가능성이 있어요."
                    : "Price touching upper band may indicate overbought; lower band may indicate oversold."}
                </p>
              </div>
            </div>
          )}

          {/* ════════ TAB: 섹터분석 ════════ */}
          {tab === "sector" && (
            <div className="p-3 space-y-4">
              <div className="bg-muted/40 rounded-xl p-3">
                <h3 className="text-sm font-bold mb-1">{isKo ? "섹터 위치 (RRG 기반)" : "Sector Position (RRG-based)"}</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {isKo
                    ? "상대 강도(RS-Ratio)와 모멘텀(RS-Momentum)을 기반으로 한 섹터 상대 성과를 보여줍니다."
                    : "Shows relative sector performance based on RS-Ratio (strength) vs. RS-Momentum."}
                </p>

                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <XAxis type="number" dataKey="x" domain={[93, 107]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: tickColor }} label={{ value: isKo ? "상대 강도 →" : "RS-Ratio →", position: "insideBottom", fontSize: 9, fill: tickColor, offset: -8 }} />
                    <YAxis type="number" dataKey="y" domain={[93, 107]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: tickColor }} label={{ value: isKo ? "↑ 모멘텀" : "↑ Momentum", angle: -90, position: "insideLeft", fontSize: 9, fill: tickColor, offset: 16 }} />
                    <Tooltip cursor={false} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div style={{ background: tooltipBg, border: `1px solid ${tooltipBdr}`, borderRadius: 6, padding: "6px 10px", fontSize: 11 }}>
                          <p style={{ fontWeight: 700, color: QUAD_COLOR[d.quad] }}>{isKo ? d.nameKo || d.name : d.name}</p>
                          <p style={{ color: tickColor, fontSize: 10 }}>{isKo ? "RS: " : "RS-Ratio: "}{d.x?.toFixed(1)} · {isKo ? "모멘텀: " : "Momentum: "}{d.y?.toFixed(1)}</p>
                        </div>
                      );
                    }} />
                    <ReferenceArea x1={100} x2={107} y1={100} y2={107} fill="#22c55e" fillOpacity={0.08} />
                    <ReferenceArea x1={93}  x2={100} y1={100} y2={107} fill="#f59e0b" fillOpacity={0.08} />
                    <ReferenceArea x1={93}  x2={100} y1={93}  y2={100} fill="#ef4444" fillOpacity={0.08} />
                    <ReferenceArea x1={100} x2={107} y1={93}  y2={100} fill="#3b82f6" fillOpacity={0.08} />
                    <ReferenceLine x={100} stroke={tickColor} strokeOpacity={0.3} strokeDasharray="4 2" />
                    <ReferenceLine y={100} stroke={tickColor} strokeOpacity={0.3} strokeDasharray="4 2" />
                    <Scatter data={SECTOR_RRG_DATA} name="sectors">
                      {SECTOR_RRG_DATA.map((entry, i) => (
                        <Cell key={`sec-${i}`} fill={QUAD_COLOR[entry.quad]} opacity={0.8} />
                      ))}
                    </Scatter>
                    <Scatter data={[stockRRGPoint]} name="stock" shape={(props: any) => {
                      const { cx, cy } = props;
                      return (
                        <g>
                          <circle cx={cx} cy={cy} r={10} fill="hsl(var(--primary))" opacity={0.9} />
                          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={7} fill="white" fontWeight="bold">{symbol.slice(0, 4)}</text>
                        </g>
                      );
                    }} />
                  </ScatterChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    { color: "#22c55e", label: isKo ? "선도 (강세)" : "Leading (Strong)" },
                    { color: "#f59e0b", label: isKo ? "약화 (모멘텀 하락)" : "Weakening (Fading)" },
                    { color: "#3b82f6", label: isKo ? "개선 (회복 중)" : "Improving (Recovery)" },
                    { color: "#ef4444", label: isKo ? "지연 (약세)" : "Lagging (Weak)" },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {sector && (
                <div className="bg-muted/40 rounded-xl p-3">
                  <h3 className="text-sm font-bold mb-2">{isKo ? "소속 섹터" : "Sector"}: <span className="text-primary">{sector}</span></h3>
                  {info?.industry && (
                    <p className="text-xs text-muted-foreground mb-1">{isKo ? "업종" : "Industry"}: {info.industry}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {isKo
                      ? `${symbol}은(는) ${sector} 섹터에 속해 있습니다. RRG 차트의 파란 원은 해당 종목의 대략적인 위치를 나타냅니다.`
                      : `${symbol} belongs to the ${sector} sector. The blue dot shows the stock's approximate position on the RRG chart.`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ════════ TAB: 기업실적 ════════ */}
          {tab === "fundamentals" && (
            <div className="p-3 space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: isKo ? "시가총액" : "Market Cap",    value: formatMarketCap(info?.marketCap) },
                  { label: isKo ? "PER (주가수익비율)" : "P/E Ratio", value: info?.peRatio != null ? info.peRatio.toFixed(1) : "--" },
                  { label: isKo ? "선행 PER" : "Forward P/E",   value: info?.forwardPE != null ? info.forwardPE.toFixed(1) : "--" },
                  { label: isKo ? "EPS (주당순이익)" : "EPS",    value: info?.eps != null ? formatPrice(info.eps, { nativeCurrency }) : "--" },
                  { label: isKo ? "배당 수익률" : "Dividend Yield", value: info?.dividendYield != null ? `${(info.dividendYield * 100).toFixed(2)}%` : "--" },
                  { label: isKo ? "베타 (변동성)" : "Beta",       value: info?.beta != null ? info.beta.toFixed(2) : "--" },
                  { label: isKo ? "평균 거래량" : "Avg Volume",   value: fmtVol(info?.avgVolume) },
                  { label: isKo ? "52주 최고가" : "52W High",     value: info?.["52WeekHigh"] != null ? formatPrice(info["52WeekHigh"], { nativeCurrency, compact: true }) : "--" },
                  { label: isKo ? "52주 최저가" : "52W Low",      value: info?.["52WeekLow"] != null ? formatPrice(info["52WeekLow"], { nativeCurrency, compact: true }) : "--" },
                  { label: isKo ? "현재가" : "Current Price",    value: formatPrice(quote?.price, { nativeCurrency }) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/40 rounded-xl p-3 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                    <p className="text-sm font-bold">{value}</p>
                  </div>
                ))}
              </div>

              {/* 52W range slider */}
              {weekHigh && weekLow && currentPrice > 0 && (
                <div className="bg-muted/40 rounded-xl p-3 space-y-2">
                  <h3 className="text-sm font-bold">{isKo ? "52주 가격 범위" : "52-Week Price Range"}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono text-red-500">{formatPrice(weekLow, { nativeCurrency, compact: true })}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full relative"
                        style={{ width: `${Math.min(Math.max(weekRangePct, 2), 98)}%` }}
                      />
                    </div>
                    <span className="font-mono text-green-500">{formatPrice(weekHigh, { nativeCurrency, compact: true })}</span>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    {isKo ? `현재 52주 범위의 ${weekRangePct.toFixed(0)}% 위치` : `Currently at ${weekRangePct.toFixed(0)}% of 52-week range`}
                  </p>
                </div>
              )}

              {/* Description */}
              {(info?.descriptionKo || info?.description) && (
                <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                  <h3 className="text-sm font-bold">{isKo ? "기업 소개" : "About"}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6">
                    {isKo && info?.descriptionKo ? info.descriptionKo : info?.description}
                  </p>
                </div>
              )}

              {/* EPS interpretation */}
              {info?.eps != null && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1">
                  <h3 className="text-sm font-bold text-primary">{isKo ? "디노의 인사이트" : "Dino's Insight"} 🦕</h3>
                  <p className="text-xs text-muted-foreground">
                    {isKo
                      ? info.eps > 0
                        ? `EPS ${formatPrice(info.eps, { nativeCurrency })}은 주당 이익을 의미해요.${info.peRatio ? ` PER ${info.peRatio.toFixed(1)}는 투자자들이 이익 1달러당 ${info.peRatio.toFixed(0)}달러를 지불한다는 뜻이에요.` : ""}`
                        : "현재 적자 상태예요. 향후 실적 개선 여부를 주목해보세요."
                      : info.eps > 0
                        ? `EPS of ${formatPrice(info.eps, { nativeCurrency })} means the company earns this per share.${info.peRatio ? ` P/E of ${info.peRatio.toFixed(1)} means investors pay $${info.peRatio.toFixed(0)} for every $1 of earnings.` : ""}`
                        : "The company is currently unprofitable. Watch for future earnings improvement."}
                  </p>
                </div>
              )}

              <button
                onClick={() => { onClose(); navigate(`/stock/${symbol}`); }}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:underline py-1"
                data-testid="button-modal-fundamentals-detail"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {isKo ? `${displayName} 전체 분석 보기` : `Full analysis for ${symbol}`}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
