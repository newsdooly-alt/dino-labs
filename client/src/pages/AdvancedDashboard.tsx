import { useQuery } from "@tanstack/react-query";
import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useUser } from "@/hooks/use-user";
import { getLocalizedCompanyName } from "@/lib/stockNames";
import { cleanCompanyName } from "@/lib/stockUtils";
import { calculateSMA, calculateRSI, calculateBollingerBands, calculateSupportResistance } from "@/lib/technicalAnalysis";
import { cn } from "@/lib/utils";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceArea, CartesianGrid,
} from "recharts";
import { LWChart, type LWCandlePoint } from "@/components/LWChart";
import { Input } from "@/components/ui/input";
import {
  TrendingUp, TrendingDown, BarChart3, Activity,
  CandlestickChart, LineChart as LineChartIcon,
  RefreshCw, AlertCircle, ChevronRight, Zap,
  Globe, Star, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { translations } from "@/lib/translations";

// ── Screener stocks ──────────────────────────────────────────────────
const SCREENER_STOCKS = [
  { symbol: "NVDA",      flag: "🇺🇸", sectorEn: "Semiconductors",  sectorKo: "반도체" },
  { symbol: "TSLA",      flag: "🇺🇸", sectorEn: "EV / Automotive",  sectorKo: "전기차" },
  { symbol: "AAPL",      flag: "🇺🇸", sectorEn: "Technology",       sectorKo: "기술" },
  { symbol: "MSFT",      flag: "🇺🇸", sectorEn: "Technology",       sectorKo: "기술" },
  { symbol: "AMZN",      flag: "🇺🇸", sectorEn: "E-Commerce / AI",  sectorKo: "이커머스" },
  { symbol: "META",      flag: "🇺🇸", sectorEn: "Social Media",     sectorKo: "소셜미디어" },
  { symbol: "GOOGL",     flag: "🇺🇸", sectorEn: "Technology",       sectorKo: "기술" },
  { symbol: "AMD",       flag: "🇺🇸", sectorEn: "Semiconductors",   sectorKo: "반도체" },
  { symbol: "NFLX",      flag: "🇺🇸", sectorEn: "Streaming",        sectorKo: "스트리밍" },
  { symbol: "JPM",       flag: "🇺🇸", sectorEn: "Finance",          sectorKo: "금융" },
  { symbol: "XOM",       flag: "🇺🇸", sectorEn: "Energy",           sectorKo: "에너지" },
  { symbol: "005930.KS", flag: "🇰🇷", sectorEn: "Semiconductors",   sectorKo: "반도체" },
  { symbol: "000660.KS", flag: "🇰🇷", sectorEn: "Semiconductors",   sectorKo: "반도체" },
  { symbol: "005380.KS", flag: "🇰🇷", sectorEn: "Automotive",       sectorKo: "자동차" },
  { symbol: "035420.KS", flag: "🇰🇷", sectorEn: "Internet",         sectorKo: "인터넷" },
];

const SCREENER_SYMS = SCREENER_STOCKS.map(s => s.symbol);
const ALL_SYMS_WITH_SPY = ["SPY", ...SCREENER_SYMS].join(",");

const PERIOD_OPTIONS = [
  { key: "1d",  label: "1D",  period: "1d",  interval: "5m"  },
  { key: "1w",  label: "1W",  period: "5d",  interval: "15m" },
  { key: "1m",  label: "1M",  period: "1mo", interval: "1d"  },
  { key: "1y",  label: "1Y",  period: "1y",  interval: "1wk" },
  { key: "5y",  label: "5Y",  period: "5y",  interval: "1wk" },
  { key: "all", label: "ALL", period: "max", interval: "1mo" },
];

type MobileTab = "chart" | "screener" | "fundamentals" | "analysis";

// ── Sector RRG mini quadrant data ─────────────────────────────────────
const SECTOR_QUADRANTS = [
  { label: "XLK", labelKo: "기술",    q: "leading",   color: "#6366f1" },
  { label: "XLC", labelKo: "통신",    q: "leading",   color: "#a855f7" },
  { label: "XLF", labelKo: "금융",    q: "improving", color: "#f59e0b" },
  { label: "XLI", labelKo: "산업재",  q: "improving", color: "#f97316" },
  { label: "XLV", labelKo: "헬스케어",q: "weakening", color: "#10b981" },
  { label: "XLY", labelKo: "임의소비",q: "weakening", color: "#8b5cf6" },
  { label: "XLE", labelKo: "에너지",  q: "lagging",   color: "#ef4444" },
  { label: "XLRE",labelKo: "리츠",    q: "lagging",   color: "#ec4899" },
  { label: "XLU", labelKo: "유틸리티",q: "lagging",   color: "#14b8a6" },
  { label: "XLB", labelKo: "소재",    q: "lagging",   color: "#84cc16" },
  { label: "XLP", labelKo: "필수소비",q: "improving", color: "#06b6d4" },
];

const QUADRANT_POS: Record<string, { x: number; y: number }> = {
  XLK:  { x: 105, y: 103 }, XLC:  { x: 103, y: 101 },
  XLF:  { x: 97,  y: 102 }, XLI:  { x: 98,  y: 101 },
  XLV:  { x: 104, y: 98  }, XLY:  { x: 101, y: 97  },
  XLE:  { x: 96,  y: 97  }, XLRE: { x: 95,  y: 96  },
  XLU:  { x: 97,  y: 95  }, XLB:  { x: 99,  y: 98  },
  XLP:  { x: 96,  y: 101 },
};

function getPatternTag(rs: number, lang: string): { label: string; color: string } {
  if (rs > 4)   return { label: lang === "ko" ? "급등 🚀" : "Breakout 🚀",   color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" };
  if (rs > 1.5) return { label: lang === "ko" ? "강세 ▲" : "Strong ▲",      color: "text-green-400 bg-green-500/10 border-green-500/25" };
  if (rs > -1)  return { label: lang === "ko" ? "중립 ─" : "Neutral ─",      color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25" };
  if (rs > -3)  return { label: lang === "ko" ? "약세 ▼" : "Weak ▼",         color: "text-orange-400 bg-orange-500/10 border-orange-500/25" };
  return           { label: lang === "ko" ? "급락 ⚠" : "Breakdown ⚠",         color: "text-rose-400 bg-rose-500/15 border-rose-500/30" };
}

function getStageAnalysis(price: number, sma50: number | null, sma200: number | null, lang: string) {
  if (!sma50 && !sma200) return { stage: "N/A", desc: lang === "ko" ? "데이터 부족" : "Insufficient data", color: "#6b7280" };
  if (sma50 && sma200) {
    if (price > sma50 && sma50 > sma200) return { stage: lang === "ko" ? "스테이지 2" : "Stage 2", desc: lang === "ko" ? "상승 추세 ↑" : "Uptrend ↑", color: "#22c55e" };
    if (price < sma50 && sma50 > sma200) return { stage: lang === "ko" ? "스테이지 3" : "Stage 3", desc: lang === "ko" ? "정점 분배 ⚠" : "Top / Distribution", color: "#f59e0b" };
    if (price < sma50 && sma50 < sma200) return { stage: lang === "ko" ? "스테이지 4" : "Stage 4", desc: lang === "ko" ? "하락 추세 ↓" : "Downtrend ↓", color: "#ef4444" };
    return { stage: lang === "ko" ? "스테이지 1" : "Stage 1", desc: lang === "ko" ? "바닥 다지기" : "Basing / Recovery", color: "#6366f1" };
  }
  if (sma50) {
    if (price > sma50) return { stage: lang === "ko" ? "강세 구간" : "Above MA50", desc: lang === "ko" ? "긍정적" : "Positive bias", color: "#22c55e" };
    return { stage: lang === "ko" ? "약세 구간" : "Below MA50", desc: lang === "ko" ? "부정적" : "Negative bias", color: "#ef4444" };
  }
  return { stage: "N/A", desc: "-", color: "#6b7280" };
}

function formatMarketCap(v: number | null): string {
  if (!v) return "--";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
}

// ── Main Component ────────────────────────────────────────────────────
export default function AdvancedDashboard() {
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const { formatPrice, isKoreanStock, isJapaneseStock } = useCurrency();
  const { data: user } = useUser();
  const lang = (user?.language || "en") as string;
  const t = translations[lang as keyof typeof translations];

  const isDark = theme === "dark";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const tooltipBg = isDark ? "#111827" : "#ffffff";
  const tooltipBorder = isDark ? "#374151" : "#e5e7eb";

  // UI state
  const [selectedSymbol, setSelectedSymbol] = useState("NVDA");
  const [mobileTab, setMobileTab] = useState<MobileTab>("chart");
  const [selectedPeriod, setSelectedPeriod] = useState("1m");
  const [showSR, setShowSR] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [showMA, setShowMA] = useState(true);
  const [chartType, setChartType] = useState<"candle" | "area">("candle");
  const [showMACD, setShowMACD] = useState(false);
  const [screenerSort, setScreenerSort] = useState<"rs" | "name" | "change" | "vol">("rs");
  const [screenerSearch, setScreenerSearch] = useState("");

  const isKr = isKoreanStock(selectedSymbol);
  const isJp = isJapaneseStock(selectedSymbol);
  const nativeCurrency = isKr ? "KRW" : isJp ? "JPY" : "USD";

  // ── Batch screener quotes (includes SPY for RS calc) ──────────────
  const { data: screenerData, isLoading: isScreenerLoading } = useQuery<{ quotes: any[] }>({
    queryKey: ["/api/stocks/live", "advanced-screener"],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live?symbols=${ALL_SYMS_WITH_SPY}`);
      if (!res.ok) return { quotes: [] };
      return res.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const spyChange = screenerData?.quotes?.find(q => q.symbol === "SPY")?.changePercent ?? 0;

  const screenerRows = useMemo(() => {
    if (!screenerData?.quotes) return [];
    const rows = SCREENER_STOCKS.map(s => {
      const q = screenerData.quotes.find(q => q.symbol === s.symbol);
      const cp = q?.changePercent ?? 0;
      const rs = cp - spyChange;
      return {
        ...s,
        price: q?.price ?? null,
        changePercent: cp,
        volume: (q?.volume ?? 0) as number,
        rs,
        name: q?.name ?? s.symbol,
        pattern: getPatternTag(rs, lang),
      };
    });
    const filtered = screenerSearch.trim()
      ? rows.filter(r => r.symbol.toLowerCase().includes(screenerSearch.toLowerCase()) || r.name.toLowerCase().includes(screenerSearch.toLowerCase()))
      : rows;
    return filtered.sort((a, b) => {
      if (screenerSort === "rs")     return b.rs - a.rs;
      if (screenerSort === "name")   return a.symbol.localeCompare(b.symbol);
      if (screenerSort === "change") return (b.changePercent ?? 0) - (a.changePercent ?? 0);
      if (screenerSort === "vol")    return b.volume - a.volume;
      return 0;
    });
  }, [screenerData, spyChange, screenerSort, screenerSearch, lang]);

  const selectedScreenerInfo = SCREENER_STOCKS.find(s => s.symbol === selectedSymbol);

  // ── Live quote for selected stock ──────────────────────────────────
  const { data: quote, isLoading: isQuoteLoading } = useQuery<any>({
    queryKey: ["/api/stocks/live", selectedSymbol],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live/${selectedSymbol}`);
      if (!res.ok) throw new Error("Quote failed");
      return res.json();
    },
    enabled: !!selectedSymbol,
    staleTime: 15000,
    refetchInterval: 30000,
  });

  // ── Stock info (fundamentals) ──────────────────────────────────────
  const { data: info } = useQuery<any>({
    queryKey: ["/api/stocks/info", selectedSymbol, lang],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/info/${selectedSymbol}?lang=${lang}`);
      if (!res.ok) throw new Error("Info failed");
      return res.json();
    },
    enabled: !!selectedSymbol,
    staleTime: 300000,
  });

  // ── History for chart ──────────────────────────────────────────────
  const periodConfig = PERIOD_OPTIONS.find(p => p.key === selectedPeriod) ?? PERIOD_OPTIONS[2];
  const isIntraday = selectedPeriod === "1d";

  const { data: history, isLoading: isHistoryLoading } = useQuery<any>({
    queryKey: ["/api/stocks/history", selectedSymbol, periodConfig.period, periodConfig.interval],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/history/${selectedSymbol}?period=${periodConfig.period}&interval=${periodConfig.interval}`);
      if (!res.ok) throw new Error("History failed");
      return res.json();
    },
    enabled: !!selectedSymbol,
    staleTime: 60000,
  });

  const rawHistory = history?.data ?? [];
  const closes = rawHistory.map((d: any) => d.close as number);

  const sma50  = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const srLevels = useMemo(() => {
    if (isIntraday || closes.length < 20) return { supports: [], resistances: [] };
    return calculateSupportResistance(closes, 2);
  }, [closes, isIntraday]);

  const chartData = useMemo(() => {
    return rawHistory.map((d: any, i: number) => {
      const dt = new Date(d.date);
      const label = isIntraday
        ? dt.toLocaleTimeString(lang === "ko" ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
        : dt.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
      return {
        date: label, rawDate: d.date,
        price: d.close, open: d.open,
        high: d.high || d.close, low: d.low || d.close, close: d.close,
        volume: d.volume ?? 0,
        sma50: sma50[i] ?? null,
        sma200: sma200[i] ?? null,
        isUp: d.close >= d.open,
      };
    });
  }, [rawHistory, sma50, sma200, isIntraday, lang]);

  const lwChartData = useMemo((): LWCandlePoint[] => {
    return rawHistory.map((d: any, i: number) => ({
      date: d.date,
      open: d.open || d.close,
      high: d.high || d.close,
      low: d.low || d.close,
      close: d.close,
      volume: d.volume ?? 0,
      changePct: i > 0 && rawHistory[i - 1].close > 0
        ? ((d.close - rawHistory[i - 1].close) / rawHistory[i - 1].close) * 100
        : 0,
    }));
  }, [rawHistory]);


  const periodReturnPct = selectedPeriod === "1d"
    ? (quote?.changePercent ?? 0)
    : chartData.length > 1
      ? ((chartData[chartData.length - 1].price - chartData[0].price) / chartData[0].price) * 100
      : (quote?.changePercent ?? 0);
  const isPositive = periodReturnPct >= 0;

  // Stage analysis from last data point
  const lastIdx = chartData.length - 1;
  const lastSMA50  = lastIdx >= 0 ? (chartData[lastIdx].sma50  as number | null) : null;
  const lastSMA200 = lastIdx >= 0 ? (chartData[lastIdx].sma200 as number | null) : null;
  const lastPrice  = lastIdx >= 0 ? chartData[lastIdx].price : (quote?.price ?? 0);
  const stageInfo = getStageAnalysis(lastPrice, lastSMA50, lastSMA200, lang);

  // Breadth: computed from screener (RS-based)
  const positiveRS = screenerRows.filter(s => s.rs > 0).length;
  const breadthPct = screenerRows.length > 0 ? Math.round((positiveRS / screenerRows.length) * 100) : 0;

  // SMA breadth from backend
  const { data: breadthData } = useQuery<{ pctAboveSMA50: number; pctAboveSMA200: number; above50: number; above200: number; total: number }>({
    queryKey: ["/api/market/breadth"],
    queryFn: async () => {
      const res = await fetch("/api/market/breadth");
      if (!res.ok) return { pctAboveSMA50: 0, pctAboveSMA200: 0, above50: 0, above200: 0, total: 0 };
      return res.json();
    },
    staleTime: 15 * 60 * 1000,
  });


  // ── Sub-panel renderers ──────────────────────────────────────────────
  const displayName = getLocalizedCompanyName(cleanCompanyName(quote?.name || selectedSymbol), lang);

  const ScreenerPanel = () => (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-2 pt-2 pb-1 flex-shrink-0">
        <Input
          placeholder={lang === "ko" ? "종목 검색..." : "Search..."}
          value={screenerSearch}
          onChange={e => setScreenerSearch(e.target.value)}
          className="h-7 text-xs"
          data-testid="input-screener-search"
        />
      </div>
      <div className="flex items-center justify-between px-2 pb-1 flex-shrink-0">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{lang === "ko" ? "정렬" : "Sort"}</span>
        <div className="flex gap-0.5">
          {([["rs", "RS"], ["change", "%"], ["vol", "Vol"], ["name", "A-Z"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setScreenerSort(key)} className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold", screenerSort === key ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")} data-testid={`sort-screener-${key}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto border-t border-border/30">
        {isScreenerLoading ? (
          <div className="p-3 space-y-1.5">
            {Array(8).fill(0).map((_, i) => <div key={i} className="h-10 bg-muted/50 rounded-lg animate-pulse" />)}
          </div>
        ) : screenerRows.map(row => {
          const isSelected = row.symbol === selectedSymbol;
          const price = row.price;
          const isKrStock = row.symbol.endsWith(".KS") || row.symbol.endsWith(".KQ");
          const priceFmt = price == null ? "--"
            : isKrStock ? `₩${Math.round(price).toLocaleString()}`
            : `$${price.toFixed(2)}`;
          const displayN = getLocalizedCompanyName(cleanCompanyName(row.name), lang);
          return (
            <button
              key={row.symbol}
              onClick={() => { setSelectedSymbol(row.symbol); setMobileTab("chart"); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-b border-border/30",
                isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/50"
              )}
              data-testid={`screener-stock-${row.symbol}`}
            >
              <span className="text-sm shrink-0">{row.flag}</span>
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-bold truncate", isSelected ? "text-primary" : "")}>{displayN}</p>
                <p className="text-[10px] text-muted-foreground">{row.symbol}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-mono font-semibold">{priceFmt}</p>
                {screenerSort === "vol" && row.volume > 0 ? (
                  <p className="text-[10px] text-muted-foreground">
                    {row.volume >= 1e9 ? `${(row.volume / 1e9).toFixed(1)}B` : row.volume >= 1e6 ? `${(row.volume / 1e6).toFixed(1)}M` : `${(row.volume / 1e3).toFixed(0)}K`}
                  </p>
                ) : (
                  <p className={cn("text-[10px] font-bold", row.rs >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {screenerSort === "change" ? `${row.changePercent >= 0 ? "+" : ""}${row.changePercent.toFixed(2)}%` : `RS ${row.rs >= 0 ? "+" : ""}${row.rs.toFixed(1)}%`}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const ChartPanel = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header with price + period tabs */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50 flex-shrink-0 flex-wrap">
        <div>
          <span className="text-xs font-bold text-muted-foreground truncate max-w-[120px] block">{displayName}</span>
          <div className="flex items-center gap-2">
            {isQuoteLoading ? <div className="h-5 w-16 bg-muted rounded animate-pulse" /> : (
              <span className="text-base font-bold font-mono">{formatPrice(quote?.price, { nativeCurrency })}</span>
            )}
            <span className={cn("text-xs font-semibold", isPositive ? "text-emerald-500" : "text-rose-500")}>
              {isPositive ? "+" : ""}{periodReturnPct.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="flex gap-0.5 flex-wrap">
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.key} onClick={() => setSelectedPeriod(opt.key)}
              className={cn("px-2 py-0.5 text-[11px] font-semibold rounded", selectedPeriod === opt.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              data-testid={`adv-period-${opt.key}`}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      {/* Indicator toggles */}
      <div className="flex gap-1.5 px-3 py-1.5 border-b border-border/30 flex-wrap flex-shrink-0">
        {[
          { key: "sr",   label: lang === "ko" ? "S/R선" : "S/R",   state: showSR,     set: () => setShowSR(v => !v),     cls: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
          { key: "vol",  label: lang === "ko" ? "거래량" : "Vol",   state: showVolume, set: () => setShowVolume(v => !v), cls: "text-blue-500 bg-blue-500/10 border-blue-500/30" },
          { key: "ma",   label: "MA 50/200",                         state: showMA,     set: () => setShowMA(v => !v),     cls: "text-orange-500 bg-orange-500/10 border-orange-500/30" },
          { key: "macd", label: "MACD",                              state: showMACD,   set: () => setShowMACD(v => !v),   cls: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30" },
        ].map(btn => (
          <button key={btn.key} onClick={btn.set}
            className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all", btn.state ? btn.cls : "text-muted-foreground bg-muted/30 border-border")}
            data-testid={`adv-toggle-${btn.key}`}
          >{btn.label}</button>
        ))}
        <div className="flex ml-auto gap-0.5">
          <button onClick={() => setChartType("candle")} className={cn("flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border", chartType === "candle" ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground border-border")} data-testid="adv-candle">
            <CandlestickChart className="w-3 h-3" />{lang === "ko" ? "캔들" : "Candle"}
          </button>
          <button onClick={() => setChartType("area")} className={cn("flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border", chartType === "area" ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground border-border")} data-testid="adv-area">
            <LineChartIcon className="w-3 h-3" />{lang === "ko" ? "라인" : "Line"}
          </button>
        </div>
      </div>

      {/* MA legend */}
      {showMA && !isIntraday && (
        <div className="flex items-center gap-3 px-3 py-1 flex-shrink-0">
          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500"><span className="w-4 h-0.5 bg-amber-500 inline-block" />SMA 50</span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500"><span className="w-4 h-0.5 bg-rose-500 inline-block" />SMA 200</span>
        </div>
      )}

      {/* Main chart */}
      <div className="flex-1 overflow-hidden min-h-0 px-1 flex flex-col">
        {isHistoryLoading ? (
          <div className="h-full flex items-center justify-center">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : lwChartData.length > 0 ? (
          <LWChart
            data={lwChartData}
            height={showMACD || showRSI ? 220 : 280}
            isDark={isDark}
            formatPrice={(v, opts) => formatPrice(v, { nativeCurrency, ...(opts || {}) })}
            nativeCurrency={nativeCurrency}
            isIntraday={isIntraday}
            chartType={chartType === "area" ? "area" : "candle"}
            showVolume={showVolume}
            showMA={showMA && !isIntraday}
            maPeriods={[50, 200]}
            maColors={["#f59e0b", "#ef4444"]}
            showRSI={false}
            showMACD={showMACD && !isIntraday}
            showSR={showSR}
            srLevels={srLevels}
            lang={lang}
            className="flex-1"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            <AlertCircle className="w-4 h-4 mr-2" />{lang === "ko" ? "데이터 없음" : "No data"}
          </div>
        )}
      </div>
    </div>
  );

  const FundamentalsPanel = () => (
    <div className="flex flex-col h-full overflow-y-auto space-y-3 p-3">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex-shrink-0">{lang === "ko" ? "기본 분석" : "Fundamentals"}</p>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { lbl: lang === "ko" ? "시가총액" : "Mkt Cap",    val: formatMarketCap(info?.marketCap) },
          { lbl: lang === "ko" ? "PER" : "P/E",             val: info?.peRatio?.toFixed(1) ?? "--" },
          { lbl: lang === "ko" ? "배당수익률" : "Div Yield", val: info?.dividendYield != null ? `${(info.dividendYield * 100).toFixed(2)}%` : "--" },
          { lbl: lang === "ko" ? "주당순이익" : "EPS",       val: info?.eps != null ? formatPrice(info.eps, { nativeCurrency, compact: true }) : "--" },
          { lbl: lang === "ko" ? "52주 고" : "52W High",    val: info?.["52WeekHigh"] != null ? formatPrice(info["52WeekHigh"], { nativeCurrency, compact: true }) : "--" },
          { lbl: lang === "ko" ? "52주 저" : "52W Low",     val: info?.["52WeekLow"]  != null ? formatPrice(info["52WeekLow"],  { nativeCurrency, compact: true }) : "--" },
          { lbl: lang === "ko" ? "베타" : "Beta",            val: info?.beta?.toFixed(2) ?? "--" },
          { lbl: lang === "ko" ? "평균 거래량" : "Avg Vol",  val: info?.avgVolume ? `${(info.avgVolume / 1e6).toFixed(1)}M` : "--" },
        ].map(({ lbl, val }) => (
          <div key={lbl} className="bg-muted/40 rounded-lg p-2">
            <p className="text-[9px] text-muted-foreground mb-0.5">{lbl}</p>
            <p className="text-xs font-bold font-mono">{val}</p>
          </div>
        ))}
      </div>

      {/* 52W price bar */}
      {info?.["52WeekHigh"] && info?.["52WeekLow"] && quote?.price && (
        <div className="bg-muted/40 rounded-lg p-2">
          <p className="text-[9px] text-muted-foreground mb-1.5">{lang === "ko" ? "52주 가격 범위" : "52-Week Range"}</p>
          <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 h-full bg-primary/30 rounded-full" style={{
              width: `${Math.min(100, Math.max(0, ((quote.price - info["52WeekLow"]) / (info["52WeekHigh"] - info["52WeekLow"])) * 100))}%`
            }} />
            <div className="absolute top-0 h-full w-1.5 bg-primary rounded-full" style={{
              left: `${Math.min(97, Math.max(0, ((quote.price - info["52WeekLow"]) / (info["52WeekHigh"] - info["52WeekLow"])) * 100))}%`
            }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-rose-500 font-mono">{formatPrice(info["52WeekLow"], { nativeCurrency, compact: true })}</span>
            <span className="text-[9px] text-emerald-500 font-mono">{formatPrice(info["52WeekHigh"], { nativeCurrency, compact: true })}</span>
          </div>
        </div>
      )}

      {/* Sector */}
      {selectedScreenerInfo && (
        <div className="bg-muted/40 rounded-lg p-2">
          <p className="text-[9px] text-muted-foreground mb-1">{lang === "ko" ? "섹터" : "Sector"}</p>
          <p className="text-xs font-semibold">{lang === "ko" ? selectedScreenerInfo.sectorKo : selectedScreenerInfo.sectorEn}</p>
        </div>
      )}

      {/* About company (truncated) */}
      {info?.description && (
        <div className="bg-muted/40 rounded-lg p-2">
          <p className="text-[9px] text-muted-foreground mb-1">{lang === "ko" ? "회사 소개" : "About"}</p>
          <p className="text-[10px] leading-relaxed text-foreground/70 line-clamp-4">
            {lang === "ko" && info.descriptionKo ? info.descriptionKo : info.description}
          </p>
          <button onClick={() => navigate(`/stock/${selectedSymbol}`)} className="mt-1.5 text-[10px] text-primary hover:underline flex items-center gap-0.5">
            {lang === "ko" ? "전체 보기" : "Full detail"} <ChevronRight className="w-2.5 h-2.5" />
          </button>
        </div>
      )}
    </div>
  );

  const AnalysisPanel = () => {
    const miniRRGData = SECTOR_QUADRANTS.map(s => ({
      ...s,
      x: QUADRANT_POS[s.label]?.x ?? 100,
      y: QUADRANT_POS[s.label]?.y ?? 100,
    }));

    const quadrantLabel = (q: string) => {
      if (q === "leading")   return lang === "ko" ? "선도" : "Leading";
      if (q === "weakening") return lang === "ko" ? "약화" : "Weakening";
      if (q === "lagging")   return lang === "ko" ? "지연" : "Lagging";
      return lang === "ko" ? "회복" : "Improving";
    };

    return (
      <div className="flex flex-col h-full overflow-y-auto space-y-3 p-3">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex-shrink-0">{lang === "ko" ? "시장 분석" : "Market Analysis"}</p>

        {/* Stage Analysis */}
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-[9px] text-muted-foreground mb-1.5">{lang === "ko" ? "📊 스테이지 분석" : "📊 Stage Analysis"}</p>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stageInfo.color }} />
            <span className="text-xs font-bold" style={{ color: stageInfo.color }}>{stageInfo.stage}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{stageInfo.desc}</p>
          <div className="mt-2 space-y-1 text-[10px]">
            {lastSMA50  != null && <p className="text-amber-500">SMA 50: {formatPrice(lastSMA50,  { nativeCurrency, compact: true })}</p>}
            {lastSMA200 != null && <p className="text-rose-500">SMA 200: {formatPrice(lastSMA200, { nativeCurrency, compact: true })}</p>}
          </div>
        </div>

        {/* Market Breadth */}
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-[9px] text-muted-foreground mb-2">{lang === "ko" ? "📈 시장 폭 (SMA 기준)" : "📈 Market Breadth (SMA)"}</p>
          {/* RS-based breadth */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">{lang === "ko" ? "RS 양수 종목" : "Positive RS vs SPY"}</span>
            <span className="text-xs font-bold" style={{ color: breadthPct >= 50 ? "#22c55e" : "#ef4444" }}>{breadthPct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${breadthPct}%`, background: breadthPct >= 50 ? "#22c55e" : "#ef4444" }} />
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">{positiveRS}/{screenerRows.length} {lang === "ko" ? "종목 SPY 대비 강세" : "stocks outperforming SPY"}</p>
          {/* SMA-based breadth */}
          {breadthData && breadthData.total > 0 && (
            <div className="mt-2 space-y-1.5">
              {[
                { lbl: lang === "ko" ? "SMA50 위" : "Above SMA 50",  pct: breadthData.pctAboveSMA50,  count: breadthData.above50,  color: "#f59e0b" },
                { lbl: lang === "ko" ? "SMA200 위" : "Above SMA 200", pct: breadthData.pctAboveSMA200, count: breadthData.above200, color: "#ef4444" },
              ].map(({ lbl, pct, count, color }) => (
                <div key={lbl}>
                  <div className="flex justify-between text-[9px] mb-0.5">
                    <span className="text-muted-foreground">{lbl}</span>
                    <span className="font-semibold" style={{ color }}>{pct}% <span className="text-muted-foreground font-normal">({count}/{breadthData.total})</span></span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color, opacity: 0.75 }} />
                  </div>
                </div>
              ))}
              <p className="text-[9px] text-muted-foreground">{lang === "ko" ? `${breadthData.total}개 주요 종목 기준` : `Based on ${breadthData.total} major stocks`}</p>
            </div>
          )}
        </div>

        {/* Mini RRG Sector Rotation */}
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-[9px] text-muted-foreground mb-2">{lang === "ko" ? "🔄 섹터 순환 (미국 S&P500)" : "🔄 US Sector Rotation (RRG)"}</p>
          <div className="relative">
            <ResponsiveContainer width="100%" height={160}>
              <ScatterChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                {/* Quadrant backgrounds */}
                <ReferenceArea x1={100} x2={112} y1={100} y2={110} fill="rgba(34,197,94,0.08)" />
                <ReferenceArea x1={88}  x2={100} y1={100} y2={110} fill="rgba(99,102,241,0.08)" />
                <ReferenceArea x1={100} x2={112} y1={90}  y2={100} fill="rgba(234,179,8,0.08)" />
                <ReferenceArea x1={88}  x2={100} y1={90}  y2={100} fill="rgba(239,68,68,0.08)" />
                <XAxis type="number" dataKey="x" domain={[88, 112]} tick={false} axisLine={false} tickLine={false} />
                <YAxis type="number" dataKey="y" domain={[90, 110]} tick={false} axisLine={false} tickLine={false} />
                <ReferenceLine x={100} stroke={tickColor} strokeDasharray="3 3" strokeWidth={0.5} strokeOpacity={0.5} />
                <ReferenceLine y={100} stroke={tickColor} strokeDasharray="3 3" strokeWidth={0.5} strokeOpacity={0.5} />
                <Tooltip content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 6, padding: "4px 8px", fontSize: 10 }}>
                      <p style={{ fontWeight: 700, color: d.color }}>{d.label} <span style={{ color: tickColor }}>{lang === "ko" ? d.labelKo : d.label}</span></p>
                      <p style={{ color: tickColor }}>{quadrantLabel(d.q)}</p>
                    </div>
                  );
                }} />
                <Scatter data={miniRRGData} shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (!cx || !cy) return <g />;
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={7} fill={payload.color} opacity={0.85} />
                      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={6} fill="white" fontWeight="bold">{payload.label.replace("XL", "").replace("RE", "RE")}</text>
                    </g>
                  );
                }} />
              </ScatterChart>
            </ResponsiveContainer>
            {/* Quadrant labels */}
            <div className="absolute top-1.5 right-2 text-[8px] text-emerald-500 font-bold">{lang === "ko" ? "선도 ↗" : "Leading ↗"}</div>
            <div className="absolute top-1.5 left-2 text-[8px] text-indigo-500 font-bold">{lang === "ko" ? "회복 ↗" : "Improving ↗"}</div>
            <div className="absolute bottom-1.5 right-2 text-[8px] text-yellow-500 font-bold">{lang === "ko" ? "약화 ↘" : "Weakening ↘"}</div>
            <div className="absolute bottom-1.5 left-2 text-[8px] text-rose-500 font-bold">{lang === "ko" ? "지연 ↙" : "Lagging ↙"}</div>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {SECTOR_QUADRANTS.slice(0, 6).map(s => (
              <span key={s.label} className="flex items-center gap-0.5 text-[8px]">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: s.color }} />
                <span className="text-muted-foreground">{lang === "ko" ? s.labelKo : s.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Quick link to full RRG */}
        <button onClick={() => navigate("/market-trends")} className="text-[10px] text-primary hover:underline flex items-center gap-1 justify-center py-1">
          <Globe className="w-3 h-3" />{lang === "ko" ? "전체 RRG 보기 →" : "Full RRG Chart →"}
        </button>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-[calc(100vh-56px)] md:h-[calc(100vh-0px)] flex flex-col overflow-hidden">
      {/* ── Page title bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 flex-shrink-0 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">DinoInvest <span className="text-primary">Pro</span></span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">{lang === "ko" ? "고급 대시보드" : "Advanced"}</Badge>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {quote?.isMarketOpen != null && (
            <>
              <span className={cn("w-1.5 h-1.5 rounded-full", quote.isMarketOpen ? "bg-green-500 animate-pulse" : "bg-gray-400")} />
              <span>{quote.isMarketOpen ? (lang === "ko" ? "장 개장" : "Market Open") : (lang === "ko" ? "장 마감" : "Closed")}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Mobile tab bar ─────────────────────────────────────────── */}
      <div className="md:hidden flex border-b border-border flex-shrink-0">
        {([
          { key: "screener",     icon: BarChart3,    label: lang === "ko" ? "스크리너" : "Screener" },
          { key: "chart",        icon: Activity,     label: lang === "ko" ? "차트" : "Chart" },
          { key: "fundamentals", icon: Star,         label: lang === "ko" ? "펀더멘털" : "Funds" },
          { key: "analysis",     icon: Globe,        label: lang === "ko" ? "분석" : "Analysis" },
        ] as { key: MobileTab; icon: any; label: string }[]).map(tab => (
          <button key={tab.key} onClick={() => setMobileTab(tab.key)}
            className={cn("flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors",
              mobileTab === tab.key ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            )}
            data-testid={`mobile-tab-${tab.key}`}
          >
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {/* ── Mobile: single active panel ────────────────────────────── */}
      <div className="md:hidden flex-1 overflow-hidden">
        {mobileTab === "screener"     && <div className="h-full overflow-hidden"><ScreenerPanel /></div>}
        {mobileTab === "chart"        && <div className="h-full overflow-hidden"><ChartPanel /></div>}
        {mobileTab === "fundamentals" && <div className="h-full overflow-hidden"><FundamentalsPanel /></div>}
        {mobileTab === "analysis"     && <div className="h-full overflow-hidden"><AnalysisPanel /></div>}
      </div>

      {/* ── Desktop 4-pane grid (md+) ──────────────────────────────── */}
      <div className="hidden md:grid flex-1 overflow-hidden" style={{ gridTemplateColumns: "200px 1fr 185px 185px" }}>
        {/* Left: Screener */}
        <div className="border-r border-border/50 overflow-hidden flex flex-col">
          <ScreenerPanel />
        </div>

        {/* Center: Chart */}
        <div className="border-r border-border/50 overflow-hidden flex flex-col">
          <ChartPanel />
        </div>

        {/* Right 1: Fundamentals */}
        <div className="border-r border-border/50 overflow-hidden flex flex-col">
          <FundamentalsPanel />
        </div>

        {/* Right 2: Analysis */}
        <div className="overflow-hidden flex flex-col">
          <AnalysisPanel />
        </div>
      </div>
    </div>
  );
}
