import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  X,
  Zap,
  BarChart2,
  Activity,
  Layers,
  GitCompare,
  Search,
  Settings2,
  SortAsc,
  SortDesc,
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
} from "@/lib/technicalAnalysis";
import { useLocation } from "wouter";

const PERIOD_OPTIONS = [
  { key: "1d",  label: "1D",  period: "1d",  interval: "5m"  },
  { key: "1w",  label: "1W",  period: "5d",  interval: "15m" },
  { key: "1m",  label: "1M",  period: "1mo", interval: "1d"  },
  { key: "1y",  label: "1Y",  period: "1y",  interval: "1wk" },
  { key: "5y",  label: "5Y",  period: "5y",  interval: "1wk" },
  { key: "all", label: "MAX", period: "max", interval: "1mo" },
];

const TABS = [
  { key: "chart",      ko: "차트",     en: "Chart",      icon: BarChart2  },
  { key: "indicators", ko: "보조지표", en: "Indicators",  icon: Activity   },
  { key: "volume",     ko: "매물대",   en: "Vol Profile", icon: Layers     },
  { key: "compare",    ko: "비교",     en: "Compare",     icon: GitCompare },
] as const;

type TabKey = typeof TABS[number]["key"];

const PEER_MAP: Record<string, string[]> = {
  AAPL: ["MSFT", "GOOGL", "META"],
  MSFT: ["AAPL", "GOOGL", "AMZN"],
  GOOGL: ["META", "MSFT", "AMZN"],
  META: ["GOOGL", "SNAP", "AMZN"],
  AMZN: ["GOOGL", "MSFT", "WMT"],
  NVDA: ["AMD", "INTC", "QCOM"],
  AMD: ["NVDA", "INTC", "QCOM"],
  TSLA: ["RIVN", "NIO", "F"],
  BRK: ["JPM", "BAC", "GS"],
  JPM: ["BAC", "GS", "WFC"],
  BAC: ["JPM", "GS", "WFC"],
  XOM: ["CVX", "COP", "BP"],
  CVX: ["XOM", "COP", "BP"],
  JNJ: ["PFE", "UNH", "ABBV"],
  PFE: ["JNJ", "UNH", "ABBV"],
  "005930.KS": ["000660.KS", "005380.KS", "051910.KS"],
  "000660.KS": ["005930.KS", "005380.KS", "051910.KS"],
};

function getPeers(symbol: string): string[] {
  return PEER_MAP[symbol] || ["AAPL", "MSFT", "GOOGL"];
}

interface HistoryData {
  t: string; o: number; h: number; l: number; c: number; v: number;
}

interface Props {
  symbol: string;
  name: string;
  isOpen: boolean;
  onClose: () => void;
  lang: "ko" | "en";
}

function periodReturn(data: HistoryData[]): number | null {
  if (!data || data.length < 2) return null;
  const start = data[0].c;
  const end   = data[data.length - 1].c;
  return ((end - start) / start) * 100;
}

function buildVolumeProfile(data: HistoryData[], buckets = 20) {
  if (!data.length) return [];
  const prices = data.map(d => [d.l, d.h]).flat();
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const step = range / buckets;

  const profile: { price: number; volume: number; pct: number }[] = [];
  for (let i = 0; i < buckets; i++) {
    const lo = min + i * step;
    const hi = lo + step;
    const mid = (lo + hi) / 2;
    let vol = 0;
    for (const d of data) {
      if (d.h >= lo && d.l <= hi) {
        const overlap = Math.min(d.h, hi) - Math.max(d.l, lo);
        const priceRange = d.h - d.l || 1;
        vol += d.v * (overlap / priceRange);
      }
    }
    profile.push({ price: mid, volume: vol, pct: 0 });
  }
  const maxVol = Math.max(...profile.map(p => p.volume), 1);
  for (const p of profile) p.pct = (p.volume / maxVol) * 100;
  return profile.sort((a, b) => b.price - a.price);
}

function formatNumber(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toFixed(0);
}

export function StockAnalysisModal({ symbol, name, isOpen, onClose, lang }: Props) {
  const [, navigate] = useLocation();
  const { theme } = useTheme();
  const { formatPrice, isKoreanStock, isJapaneseStock, currency, exchangeRate, exchangeRateJPY } = useCurrency();
  const isDark = theme === "dark";
  const isKo = lang === "ko";

  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const tooltipBg = isDark ? "#111827" : "#ffffff";
  const tooltipBorder = isDark ? "#374151" : "#e5e7eb";

  const isKr = isKoreanStock(symbol);
  const isJp = isJapaneseStock(symbol);
  const nativeCurrency = isKr ? "KRW" : isJp ? "JPY" : "USD";
  const priceMultiplier = (!isKr && !isJp) ? (currency === 'krw' ? exchangeRate : currency === 'jpy' ? exchangeRateJPY : 1) : 1;
  const displayNative = isKr ? 'KRW' : isJp ? 'JPY' : currency === 'krw' ? 'KRW' : currency === 'jpy' ? 'JPY' : 'USD';

  const [activeTab, setActiveTab] = useState<TabKey>("chart");
  const [period, setPeriod] = useState("1m");
  const [chartType, setChartType] = useState<"candle" | "area">("candle");
  const [showMA, setShowMA] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [showSR, setShowSR] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [sortMode, setSortMode] = useState<"change_desc" | "change_asc" | "volume" | "alpha">("change_desc");
  const [searchInput, setSearchInput] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState(symbol);
  const [logScale, setLogScale] = useState(false);
  const [hoveredCandle, setHoveredCandle] = useState<any>(null);
  const [brushDomain, setBrushDomain] = useState<{ startIndex?: number; endIndex?: number }>({});
  const brushDomainRef = useRef(brushDomain);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { brushDomainRef.current = brushDomain; }, [brushDomain]);
  useEffect(() => { setActiveSymbol(symbol); setSearchInput(""); setSearchActive(false); }, [symbol]);

  const periodOpt = PERIOD_OPTIONS.find(p => p.key === period) || PERIOD_OPTIONS[2];
  const isIntraday = period === "1d" || period === "1w";

  const { data: historyRaw, isLoading: histLoading } = useQuery<{ history: HistoryData[] }>({
    queryKey: ["/api/stocks/history", activeSymbol, periodOpt.period, periodOpt.interval],
    enabled: isOpen,
    queryFn: async () => {
      const res = await fetch(`/api/stocks/history/${activeSymbol}?period=${periodOpt.period}&interval=${periodOpt.interval}`);
      if (!res.ok) return { history: [] };
      const raw = await res.json();
      const data: HistoryData[] = (raw.data || []).map((d: any) => ({
        t: d.date,
        o: d.open ?? d.close,
        h: d.high ?? d.close,
        l: d.low ?? d.close,
        c: d.close,
        v: d.volume ?? 0,
      }));
      return { history: data };
    },
  });

  const history = historyRaw?.history || [];

  const { sma20, sma60, sma120, upperBB, lowerBB, middleBB, rsiValues, macdResult, srLevels } = useMemo(() => {
    const closes = history.map(d => d.c);
    const sma20 = calculateSMA(closes, 20);
    const sma60 = calculateSMA(closes, 60);
    const sma120 = calculateSMA(closes, 120);
    const { upper: upperBB, lower: lowerBB, middle: middleBB } = calculateBollingerBands(closes, 20, 2);
    const rsiValues = calculateRSI(closes, 14);
    const macdResult = calculateMACD(closes, 12, 26, 9);
    const srLevels = calculateSupportResistance(history.map(d => ({ high: d.h, low: d.l, close: d.c })), 5);
    return { sma20, sma60, sma120, upperBB, lowerBB, middleBB, rsiValues, macdResult, srLevels };
  }, [history]);

  const chartData = useMemo(() => {
    const m = priceMultiplier;
    return history.map((d, i) => {
      const prevClose = i > 0 ? history[i - 1].c : (d.o || d.c);
      const changePct = prevClose > 0 ? ((d.c - prevClose) / prevClose) * 100 : 0;
      return {
        date: d.t,
        open: d.o * m, high: d.h * m, low: d.l * m, close: d.c * m, volume: d.v,
        sma20: sma20[i] != null ? sma20[i]! * m : undefined,
        sma60: sma60[i] != null ? sma60[i]! * m : undefined,
        sma120: sma120[i] != null ? sma120[i]! * m : undefined,
        upperBB: upperBB[i] != null ? upperBB[i]! * m : undefined,
        lowerBB: lowerBB[i] != null ? lowerBB[i]! * m : undefined,
        middleBB: middleBB[i] != null ? middleBB[i]! * m : undefined,
        rsi: rsiValues[i],
        macd: macdResult?.macd?.[i] != null ? macdResult.macd[i]! * m : undefined,
        signal: macdResult?.signal?.[i] != null ? macdResult.signal[i]! * m : undefined,
        histogram: macdResult?.histogram?.[i] != null ? macdResult.histogram[i]! * m : undefined,
        changePct,
      };
    });
  }, [history, sma20, sma60, sma120, upperBB, lowerBB, middleBB, rsiValues, macdResult, priceMultiplier]);

  const visibleData = useMemo(() => {
    const n = chartData.length;
    if (n === 0) return chartData;
    const s = brushDomain.startIndex ?? 0;
    const e = brushDomain.endIndex ?? n - 1;
    return chartData.slice(Math.max(0, s), Math.min(n - 1, e) + 1);
  }, [chartData, brushDomain]);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    let raf: number | null = null;

    // ── Pinch-to-zoom state ──
    let pinchStartDist = 0; let pinchStartS = 0; let pinchStartE = 0; let isPinching = false;
    // ── Touch-pan state ──
    let panStartX = 0; let panStartY = 0; let panStartS = 0; let panStartE = 0;
    let isPanning = false; let dirLocked = false;
    // ── Mouse drag-to-pan state ──
    let isDragging = false; let dragStartX = 0; let dragStartS = 0; let dragStartE = 0;

    const dist = (t1: Touch, t2: Touch) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinching = true; isPanning = false; dirLocked = false;
        pinchStartDist = dist(e.touches[0], e.touches[1]);
        const bd = brushDomainRef.current; const n = chartData.length;
        pinchStartS = bd.startIndex ?? 0; pinchStartE = bd.endIndex ?? n - 1;
      } else if (e.touches.length === 1) {
        isPinching = false; isPanning = false; dirLocked = false;
        panStartX = e.touches[0].clientX; panStartY = e.touches[0].clientY;
        const bd = brushDomainRef.current; const n = chartData.length;
        panStartS = bd.startIndex ?? 0; panStartE = bd.endIndex ?? n - 1;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        const currentDist = dist(e.touches[0], e.touches[1]);
        const scale = pinchStartDist / Math.max(currentDist, 1);
        const n = chartData.length; const origRange = pinchStartE - pinchStartS;
        const newRange = Math.min(n - 1, Math.max(3, Math.round(origRange * scale)));
        const center = Math.round((pinchStartS + pinchStartE) / 2);
        const newS = Math.max(0, Math.min(center - Math.floor(newRange / 2), n - 1 - newRange));
        const newE = Math.min(n - 1, newS + newRange);
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => setBrushDomain({ startIndex: newS, endIndex: newE }));
      } else if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - panStartX;
        const dy = e.touches[0].clientY - panStartY;
        if (!dirLocked && Math.max(Math.abs(dx), Math.abs(dy)) > 6) {
          dirLocked = true;
          isPanning = Math.abs(dx) >= Math.abs(dy) * 0.9;
        }
        if (isPanning) {
          e.preventDefault();
          const w = el.getBoundingClientRect().width || 1;
          const range = panStartE - panStartS; const n = chartData.length;
          const delta = -Math.round((dx / w) * range);
          const newS = Math.max(0, Math.min(panStartS + delta, n - 1 - range));
          if (raf) cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => setBrushDomain({ startIndex: newS, endIndex: newS + range }));
        }
      }
    };
    const onTouchEnd = () => { isPinching = false; isPanning = false; dirLocked = false; };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDragging = true; dragStartX = e.clientX;
      const bd = brushDomainRef.current; const n = chartData.length;
      dragStartS = bd.startIndex ?? 0; dragStartE = bd.endIndex ?? n - 1;
      el.style.cursor = "grabbing";
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const w = el.getBoundingClientRect().width || 1;
      const range = dragStartE - dragStartS; const n = chartData.length;
      const delta = -Math.round(((e.clientX - dragStartX) / w) * range);
      const newS = Math.max(0, Math.min(dragStartS + delta, n - 1 - range));
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setBrushDomain({ startIndex: newS, endIndex: newS + range }));
    };
    const onMouseUp = () => { isDragging = false; el.style.cursor = "crosshair"; };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const n = chartData.length; const bd = brushDomainRef.current;
      const s = bd.startIndex ?? 0; const end = bd.endIndex ?? n - 1; const range = end - s;
      const dir = e.deltaY > 0 ? 1 : -1;
      const step = Math.max(Math.round(range * 0.1), 1);
      const center = Math.round((s + end) / 2);
      if (dir < 0) {
        const newRange = Math.max(3, range - step * 2);
        const newS = Math.max(0, Math.min(center - Math.floor(newRange / 2), n - 1 - newRange));
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => setBrushDomain({ startIndex: newS, endIndex: newS + newRange }));
      } else {
        const newS = Math.max(0, s - step);
        const newE = Math.min(n - 1, end + step);
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => setBrushDomain({ startIndex: newS, endIndex: newE }));
      }
    };

    el.style.cursor = "crosshair";
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [chartData.length]);

  // Auto-upgrade period when panning/zooming to the left edge
  useEffect(() => {
    if ((brushDomain.startIndex ?? 0) > 0) return;
    const periodOrder = ["1d", "1w", "1m", "1y", "5y", "all"];
    const curIdx = periodOrder.indexOf(period);
    if (curIdx < 0 || curIdx >= periodOrder.length - 1) return;
    const timer = setTimeout(() => {
      const bd = brushDomainRef.current;
      if ((bd.startIndex ?? 0) === 0) {
        setPeriod(periodOrder[curIdx + 1]);
        setBrushDomain({});
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [brushDomain.startIndex, period]);

  const ret = periodReturn(history);
  const retPositive = ret !== null && ret >= 0;

  const volumeProfile = useMemo(() => buildVolumeProfile(history, 24), [history]);

  const peers = getPeers(activeSymbol);
  const { data: peerData } = useQuery<{ quotes: Array<{ symbol: string; price: number; changePercent: number; volume?: number; name: string }> }>({
    queryKey: ["/api/stocks/live", [...peers, activeSymbol].join(",")],
    enabled: isOpen && activeTab === "compare",
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live?symbols=${[...peers, activeSymbol].join(",")}`);
      return res.json();
    },
  });

  const allSymbols = [activeSymbol, ...peers];
  const peerRows = useMemo(() => {
    const quotes = peerData?.quotes || [];
    const rows = allSymbols.map(s => {
      const q = quotes.find(q => q.symbol === s);
      const localName = q ? getLocalizedCompanyName(cleanCompanyName(q.name || s), lang) : s;
      return {
        symbol: s,
        name: localName,
        price: q?.price ?? null,
        changePercent: q?.changePercent ?? null,
        volume: (q as any)?.volume ?? null,
        isSelf: s === activeSymbol,
      };
    });
    if (sortMode === "change_desc") return [...rows].sort((a, b) => (b.changePercent ?? -Infinity) - (a.changePercent ?? -Infinity));
    if (sortMode === "change_asc")  return [...rows].sort((a, b) => (a.changePercent ?? Infinity) - (b.changePercent ?? Infinity));
    if (sortMode === "volume")      return [...rows].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
    if (sortMode === "alpha")       return [...rows].sort((a, b) => a.symbol.localeCompare(b.symbol));
    return rows;
  }, [peerData, allSymbols, activeSymbol, lang, sortMode]);

  const lastPrice = history.length ? history[history.length - 1].c : null;
  const displayName = getLocalizedCompanyName(cleanCompanyName(name), lang);

  const renderTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    const isUp = d.close >= d.open;
    const changePctStr = d.changePct != null ? ` (${d.changePct >= 0 ? "+" : ""}${d.changePct.toFixed(2)}%)` : "";
    return (
      <div className="rounded-lg border p-2.5 shadow-xl text-xs max-w-[180px]" style={{ background: tooltipBg, borderColor: tooltipBorder }}>
        <p className="font-bold mb-1 text-foreground truncate">{d.date}</p>
        {d.close != null && (
          <p style={{ color: isUp ? "#22c55e" : "#ef4444" }} className="font-bold">
            {isKo ? "종가" : "Close"}: {formatPrice(d.close, { nativeCurrency: displayNative })}<span className="opacity-75 text-[10px]">{changePctStr}</span>
          </p>
        )}
        {d.open  != null && <p className="text-muted-foreground">{isKo ? "시가" : "Open"}: {formatPrice(d.open, { nativeCurrency: displayNative })}</p>}
        {d.high  != null && <p className="text-emerald-500">{isKo ? "고가" : "High"}: {formatPrice(d.high, { nativeCurrency: displayNative })}</p>}
        {d.low   != null && <p className="text-rose-500">{isKo ? "저가" : "Low"}: {formatPrice(d.low, { nativeCurrency: displayNative })}</p>}
        {d.volume != null && d.volume > 0 && <p className="text-muted-foreground">{isKo ? "거래량" : "Vol"}: {formatNumber(d.volume)}</p>}
      </div>
    );
  };

  const toggleCls = (active: boolean, base: string) =>
    cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-all", base,
      active ? "opacity-100" : "opacity-40");

  return (
    <Dialog open={isOpen} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-[100vw] w-full h-[100dvh] sm:h-auto sm:max-h-[95dvh] rounded-none sm:rounded-2xl p-0 flex flex-col overflow-hidden"
        style={{ touchAction: "manipulation" }}
      >
        {/* Header */}
        <DialogHeader className="flex flex-col px-4 pt-4 pb-2 border-b shrink-0 gap-2">
          <DialogDescription className="sr-only">{isKo ? `${displayName} 프로 분석` : `${displayName} Pro Analysis`}</DialogDescription>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="w-4 h-4 text-violet-500 shrink-0" />
              <div className="min-w-0">
                <DialogTitle className="text-sm font-bold truncate">{searchActive && activeSymbol !== symbol ? activeSymbol : displayName}</DialogTitle>
                <p className="text-xs text-muted-foreground font-mono">{activeSymbol}</p>
              </div>
              {lastPrice !== null && (
                <div className="ml-2 flex flex-col items-start shrink-0">
                  <span className="text-base font-mono font-bold">{formatPrice(lastPrice, { nativeCurrency })}</span>
                  {ret !== null && (
                    <span className={cn("text-xs font-bold", retPositive ? "text-green-500" : "text-red-500")}>
                      {retPositive ? "+" : ""}{ret.toFixed(2)}% ({periodOpt.label})
                    </span>
                  )}
                </div>
              )}
            </div>
            <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors shrink-0" data-testid="button-close-modal">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Search bar */}
          <form
            onSubmit={e => {
              e.preventDefault();
              const val = searchInput.trim().toUpperCase();
              if (val) { setActiveSymbol(val); setSearchActive(true); setBrushDomain({}); }
            }}
            className="flex items-center gap-1.5"
          >
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder={isKo ? "종목 검색 (예: TSLA)" : "Search symbol (e.g. TSLA)"}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-border bg-muted/40 focus:outline-none focus:border-violet-400 focus:bg-background transition-colors"
                data-testid="input-modal-search"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-bold bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors shrink-0"
              data-testid="button-modal-search-submit"
            >
              {isKo ? "검색" : "Go"}
            </button>
            {searchActive && (
              <button
                type="button"
                onClick={() => { setActiveSymbol(symbol); setSearchInput(""); setSearchActive(false); setBrushDomain({}); }}
                className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                data-testid="button-modal-search-reset"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b shrink-0 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                data-testid={`tab-${tab.key}`}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors touch-manipulation",
                  activeTab === tab.key
                    ? "border-violet-500 text-violet-600 dark:text-violet-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {isKo ? tab.ko : tab.en}
              </button>
            );
          })}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">

          {/* ─── PERIOD SELECTOR (shown on chart + volume tabs) ─── */}
          {(activeTab === "chart" || activeTab === "volume" || activeTab === "indicators") && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => { setPeriod(opt.key); setBrushDomain({}); }}
                  data-testid={`button-period-modal-${opt.key}`}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-full border transition-all touch-manipulation",
                    period === opt.key
                      ? "bg-violet-500 text-white border-violet-500"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-violet-400/50"
                  )}
                >{opt.label}</button>
              ))}
              {/* Zoom controls */}
              <div className="flex gap-0 items-center ml-auto">
                <button
                  onClick={() => {
                    const n = chartData.length;
                    if (n < 4) return;
                    const s = brushDomain.startIndex ?? 0;
                    const e = brushDomain.endIndex ?? n - 1;
                    const range = e - s;
                    const q = Math.max(Math.round(range * 0.25), 1);
                    setBrushDomain({ startIndex: Math.min(s + q, e - 2), endIndex: Math.max(e - q, s + 2) });
                  }}
                  className="flex items-center justify-center w-6 h-6 rounded-l border border-border bg-muted/50 hover:bg-muted text-muted-foreground transition-all touch-manipulation"
                  data-testid="button-modal-zoom-in"
                  title="Zoom in"
                >
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>
                </button>
                <button
                  onClick={() => {
                    const n = chartData.length;
                    if (n < 2) return;
                    const s = brushDomain.startIndex ?? 0;
                    const e = brushDomain.endIndex ?? n - 1;
                    const range = e - s;
                    const q = Math.max(Math.round(range * 0.33), 1);
                    setBrushDomain({ startIndex: Math.max(s - q, 0), endIndex: Math.min(e + q, n - 1) });
                  }}
                  className="flex items-center justify-center w-6 h-6 border-y border-r border-border bg-muted/50 hover:bg-muted text-muted-foreground transition-all touch-manipulation"
                  data-testid="button-modal-zoom-out"
                  title="Zoom out"
                >
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6"/></svg>
                </button>
                <button
                  onClick={() => setBrushDomain({})}
                  className="flex items-center justify-center px-1.5 h-6 rounded-r border-y border-r border-border bg-muted/50 hover:bg-muted text-[9px] font-bold text-muted-foreground transition-all touch-manipulation"
                  data-testid="button-modal-zoom-reset"
                >1:1</button>
              </div>
              {ret !== null && (
                <span className={cn("text-sm font-bold tabular-nums", retPositive ? "text-green-500" : "text-red-500")}>
                  {retPositive ? "▲ +" : "▼ "}{ret.toFixed(2)}%
                </span>
              )}
            </div>
          )}

          {/* ═══════════════ TAB: 차트 ═══════════════ */}
          {activeTab === "chart" && (
            <div className="space-y-3">
              {/* Toggles row */}
              <div className="flex gap-1.5 flex-wrap items-center">
                <button
                  onClick={() => setChartType(v => v === "candle" ? "area" : "candle")}
                  className={toggleCls(true, "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-400/40")}
                  data-testid="toggle-chart-type"
                >
                  {chartType === "candle" ? (isKo ? "캔들" : "Candle") : (isKo ? "라인" : "Line")}
                </button>
                {!isIntraday && (
                  <>
                    <button onClick={() => setShowMA(v => !v)} className={toggleCls(showMA, "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/40")} data-testid="toggle-ma">
                      {isKo ? "이동평균" : "MA Lines"}
                    </button>
                    <button onClick={() => setShowBB(v => !v)} className={toggleCls(showBB, "bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-400/40")} data-testid="toggle-bb">
                      {isKo ? "볼린저밴드" : "Bollinger"}
                    </button>
                  </>
                )}
                <button onClick={() => setShowSR(v => !v)} className={toggleCls(showSR, "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-400/40")} data-testid="toggle-sr">
                  {isKo ? "지지/저항선" : "S/R Lines"}
                </button>
                {/* Settings toggle for advanced features */}
                <button
                  onClick={() => setShowSettings(v => !v)}
                  className={cn("ml-auto p-1.5 rounded-lg border transition-all", showSettings ? "bg-violet-500/15 border-violet-400/50 text-violet-600 dark:text-violet-400" : "border-border bg-muted/40 text-muted-foreground hover:text-foreground")}
                  data-testid="toggle-settings"
                  title={isKo ? "고급 설정" : "Advanced Settings"}
                >
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Settings Panel */}
              {showSettings && (
                <div className="flex flex-wrap gap-2 p-2 rounded-lg bg-muted/30 border border-border text-[11px]">
                  <span className="text-muted-foreground font-medium self-center">{isKo ? "차트 오버레이:" : "Overlays:"}</span>
                  <button onClick={() => setShowBB(v => !v)} className={cn("px-2 py-0.5 rounded-full border font-semibold transition-all", showBB ? "bg-indigo-500/20 border-indigo-400/60 text-indigo-600 dark:text-indigo-400" : "border-border text-muted-foreground")} data-testid="settings-toggle-bb">
                    {isKo ? "볼린저밴드" : "Bollinger Bands"}
                  </button>
                  <button onClick={() => setLogScale(v => !v)} className={cn("px-2 py-0.5 rounded-full border font-semibold transition-all", logScale ? "bg-cyan-500/20 border-cyan-400/60 text-cyan-600 dark:text-cyan-400" : "border-border text-muted-foreground")} data-testid="settings-toggle-logscale">
                    {isKo ? "로그 스케일" : "Log Scale"}
                  </button>
                  <button onClick={() => setActiveTab("indicators")} className="px-2 py-0.5 rounded-full border font-semibold border-violet-400/40 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-all" data-testid="settings-goto-macd">
                    {isKo ? "MACD 보기 →" : "View MACD →"}
                  </button>
                  <button onClick={() => setActiveTab("volume")} className="px-2 py-0.5 rounded-full border font-semibold border-amber-400/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-all" data-testid="settings-goto-volume">
                    {isKo ? "매물대 보기 →" : "Volume Profile →"}
                  </button>
                </div>
              )}

              {histLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-[260px] rounded-xl bg-muted/60 relative overflow-hidden">
                    <div className="absolute bottom-0 inset-x-0 flex items-end gap-0.5 px-4 pb-4">
                      {[35,50,30,70,45,60,40,80,55,65,48,72,38,90,62,75,44,58,68,85].map((h, i) => (
                        <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i % 3 === 0 ? "#8b5cf640" : "#6b728030" }} />
                      ))}
                    </div>
                  </div>
                  <div className="h-16 rounded-xl bg-muted/40" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">{isKo ? "데이터 없음" : "No data"}</div>
              ) : (
                <>
                {/* OHLC info strip */}
                <div className="flex items-center gap-2 px-1 py-0.5 text-[10px] font-mono min-h-[18px]">
                  {hoveredCandle ? (
                    <>
                      <span className="text-muted-foreground text-[9px]">{hoveredCandle.date}</span>
                      <span>O <span className="text-foreground font-semibold">{formatPrice(hoveredCandle.open ?? hoveredCandle.close, { nativeCurrency: displayNative, compact: false })}</span></span>
                      <span>H <span className="text-emerald-500 font-semibold">{formatPrice(hoveredCandle.high ?? hoveredCandle.close, { nativeCurrency: displayNative, compact: false })}</span></span>
                      <span>L <span className="text-rose-500 font-semibold">{formatPrice(hoveredCandle.low ?? hoveredCandle.close, { nativeCurrency: displayNative, compact: false })}</span></span>
                      <span>C <span className="font-semibold">{formatPrice(hoveredCandle.close, { nativeCurrency: displayNative, compact: false })}</span></span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/40 text-[9px]">{isKo ? "차트에 마우스를 올리세요" : "Hover for OHLC"}</span>
                  )}
                </div>
                <div ref={chartContainerRef} style={{ touchAction: "pan-y", maxWidth: "100vw" }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart
                      data={visibleData}
                      margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
                      onMouseMove={(d: any) => { if (d?.activePayload?.[0]) setHoveredCandle(d.activePayload[0].payload); }}
                      onMouseLeave={() => setHoveredCandle(null)}
                    >
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis domain={logScale ? [Math.max(0.01, visibleData.reduce((m, d) => Math.min(m, d.low || d.close), Infinity) * 0.99), visibleData.reduce((m, d) => Math.max(m, d.high || d.close), 0) * 1.01] : ["auto", "auto"]} scale={logScale ? "log" : "linear"} tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={v => formatPrice(v, { nativeCurrency: displayNative, compact: true })} width={displayNative !== 'USD' ? 64 : 52} allowDataOverflow />
                      <Tooltip content={renderTooltip} />
                      {showSR && srLevels.support.map((s, i) => (
                        <ReferenceLine key={`s-${i}`} y={s * priceMultiplier} stroke="#22c55e" strokeWidth={1} strokeDasharray="4 3" />
                      ))}
                      {showSR && srLevels.resistance.map((r, i) => (
                        <ReferenceLine key={`r-${i}`} y={r * priceMultiplier} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" />
                      ))}
                      {showBB && !isIntraday && (
                        <>
                          <Area type="monotone" dataKey="upperBB" stroke="#6b7280" fill="none" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                          <Area type="monotone" dataKey="lowerBB" stroke="#6b7280" fill="#6b728020" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                          <Line type="monotone" dataKey="middleBB" stroke="#9ca3af" strokeWidth={1} dot={false} />
                        </>
                      )}
                      {chartType === "area" ? (
                        <Area type="monotone" dataKey="close" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={2} dot={false} isAnimationActive={false} />
                      ) : (
                        <Bar dataKey="close" fill="#8b5cf6" opacity={0.9} radius={[1, 1, 0, 0]} isAnimationActive={false} />
                      )}
                      {showMA && !isIntraday && (
                        <>
                          <Line type="monotone" dataKey="sma20" stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                          <Line type="monotone" dataKey="sma60" stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                          <Line type="monotone" dataKey="sma120" stroke="#a855f7" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        </>
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                </>
              )}

              {/* Volume sub-chart */}
              {visibleData.length > 0 && (
                <ResponsiveContainer width="100%" height={55}>
                  <ComposedChart data={visibleData} margin={{ top: 0, right: 4, left: -10, bottom: 0 }}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={[0, "auto"]} />
                    <Bar dataKey="volume" fill="#8b5cf660" radius={[1, 1, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {/* MA Legend */}
              {showMA && !isIntraday && (
                <div className="flex items-center gap-4 flex-wrap text-[10px] font-bold">
                  <span className="flex items-center gap-1.5 text-amber-500"><span className="w-4 h-0.5 bg-amber-500 inline-block" />MA 20</span>
                  <span className="flex items-center gap-1.5 text-blue-500"><span className="w-4 h-0.5 bg-blue-500 inline-block" />MA 60</span>
                  <span className="flex items-center gap-1.5 text-purple-500"><span className="w-4 h-0.5 bg-purple-500 inline-block" />MA 120</span>
                  {showSR && <span className="flex items-center gap-1.5 text-green-500">── {isKo ? "지지선" : "Support"}</span>}
                  {showSR && <span className="flex items-center gap-1.5 text-red-500">── {isKo ? "저항선" : "Resistance"}</span>}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ TAB: 보조지표 ═══════════════ */}
          {activeTab === "indicators" && (
            <div className="space-y-6">
              {histLoading ? (
                <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">{isKo ? "데이터 로딩 중..." : "Loading..."}</div>
              ) : (
                <>
                  {/* RSI 상대강도지수 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold">{isKo ? "상대강도지수 (RSI)" : "Relative Strength Index (RSI)"}</h3>
                      {chartData.length > 0 && chartData[chartData.length - 1].rsi != null && (
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                          chartData[chartData.length - 1].rsi! > 70 ? "bg-red-500/15 text-red-500" :
                          chartData[chartData.length - 1].rsi! < 30 ? "bg-green-500/15 text-green-500" :
                          "bg-muted text-muted-foreground"
                        )}>
                          RSI {chartData[chartData.length - 1].rsi?.toFixed(1)}
                          {chartData[chartData.length - 1].rsi! > 70 ? (isKo ? " 과매수" : " Overbought") :
                           chartData[chartData.length - 1].rsi! < 30 ? (isKo ? " 과매도" : " Oversold") : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {isKo ? "RSI 70 이상 = 과매수 (매도 신호), RSI 30 이하 = 과매도 (매수 신호)" : "RSI > 70 = Overbought (sell signal), RSI < 30 = Oversold (buy signal)"}
                    </p>
                    <ResponsiveContainer width="100%" height={100}>
                      <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} width={28} ticks={[30, 50, 70]} />
                        <Tooltip formatter={(v: any) => [Number(v).toFixed(1), "RSI"]} contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8 }} />
                        <ReferenceLine y={70} stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" />
                        <ReferenceLine y={30} stroke="#22c55e" strokeWidth={1} strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="rsi" stroke="#06b6d4" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  {/* MACD 이동평균 수렴확산 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold">{isKo ? "이동평균 수렴확산 (MACD)" : "Moving Average Convergence Divergence (MACD)"}</h3>
                      {chartData.length > 0 && chartData[chartData.length - 1].histogram != null && (
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
                          chartData[chartData.length - 1].histogram! > 0 ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
                        )}>
                          {chartData[chartData.length - 1].histogram! > 0 ? (isKo ? "강세" : "Bullish") : (isKo ? "약세" : "Bearish")}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {isKo ? "MACD선이 시그널선 위로 돌파 = 매수, 아래로 돌파 = 매도" : "MACD crossing above signal = buy, crossing below = sell"}
                    </p>
                    <ResponsiveContainer width="100%" height={110}>
                      <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} width={28} />
                        <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8 }} />
                        <ReferenceLine y={0} stroke={tickColor} strokeWidth={0.5} />
                        <Bar dataKey="histogram" fill="#8b5cf6" opacity={0.7} radius={[1, 1, 0, 0]}
                          label={false}
                        />
                        <Line type="monotone" dataKey="macd" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="signal" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div className="flex items-center gap-4 text-[10px] font-bold">
                      <span className="flex items-center gap-1 text-amber-500"><span className="w-4 h-0.5 bg-amber-500 inline-block" />MACD</span>
                      <span className="flex items-center gap-1 text-red-500"><span className="w-4 h-0.5 bg-red-500 inline-block" />{isKo ? "시그널" : "Signal"}</span>
                      <span className="flex items-center gap-1 text-violet-500"><span className="w-3 h-3 bg-violet-500/70 inline-block rounded-sm" />{isKo ? "히스토그램" : "Histogram"}</span>
                    </div>
                  </div>

                  {/* Bollinger Bands */}
                  {!isIntraday && (
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold">{isKo ? "볼린저 밴드" : "Bollinger Bands"}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {isKo ? "가격이 상단 밴드 근처 = 과매수, 하단 밴드 근처 = 과매도" : "Price near upper band = overbought, near lower band = oversold"}
                      </p>
                      <ResponsiveContainer width="100%" height={110}>
                        <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={v => formatPrice(v, { nativeCurrency: displayNative, compact: true })} width={displayNative !== 'USD' ? 64 : 52} />
                          <Tooltip content={renderTooltip} />
                          <Area type="monotone" dataKey="upperBB" stroke="#6b7280" fill="none" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                          <Area type="monotone" dataKey="lowerBB" stroke="#6b7280" fill="#6b728015" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                          <Line type="monotone" dataKey="middleBB" stroke="#9ca3af" strokeWidth={1} dot={false} />
                          <Line type="monotone" dataKey="close" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══════════════ TAB: 매물대 (Volume Profile) ═══════════════ */}
          {activeTab === "volume" && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold mb-0.5">{isKo ? "매물대 분석" : "Volume Profile"}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {isKo ? "각 가격대에서 거래된 누적 거래량을 나타냅니다. 긴 막대일수록 강한 지지/저항 구간입니다." : "Shows cumulative volume at each price level. Longer bars indicate stronger support/resistance zones."}
                </p>
              </div>

              {histLoading ? (
                <div className="space-y-1.5 animate-pulse">
                  {Array.from({ length: 12 }, (_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-3 bg-muted/60 rounded w-16 shrink-0" />
                      <div className="flex-1 h-4 bg-muted/40 rounded-sm" style={{ width: `${30 + (i % 7) * 10}%` }} />
                    </div>
                  ))}
                </div>
              ) : volumeProfile.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">{isKo ? "데이터 없음" : "No data"}</div>
              ) : (
                <div className="space-y-1">
                  {volumeProfile.map((p, i) => {
                    const isHighVol = p.pct > 70;
                    const isMedVol = p.pct > 40;
                    const barColor = isHighVol ? "#8b5cf6" : isMedVol ? "#a78bfa" : "#c4b5fd";
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground w-20 shrink-0 text-right">
                          {formatPrice(p.price * priceMultiplier, { nativeCurrency: displayNative, compact: true })}
                        </span>
                        <div className="flex-1 h-4 bg-muted/30 rounded-r-sm overflow-hidden">
                          <div
                            className="h-full rounded-r-sm transition-all"
                            style={{ width: `${p.pct}%`, background: barColor }}
                          />
                        </div>
                        {isHighVol && (
                          <span className="text-[10px] text-violet-500 font-bold w-12 shrink-0">
                            {isKo ? "고점" : "High"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Price range summary */}
              {history.length > 0 && (
                <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                  {[
                    { label: isKo ? "52주 최고" : "52W High", value: Math.max(...history.map(d => d.h)) * priceMultiplier },
                    { label: isKo ? "현재 가격" : "Current",  value: history[history.length - 1].c * priceMultiplier },
                    { label: isKo ? "52주 최저" : "52W Low",  value: Math.min(...history.map(d => d.l)) * priceMultiplier },
                  ].map(item => (
                    <div key={item.label} className="text-center">
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                      <p className="text-xs font-mono font-bold">{formatPrice(item.value, { nativeCurrency: displayNative, compact: true })}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ TAB: 비교 (Peer Comparison) ═══════════════ */}
          {activeTab === "compare" && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold mb-0.5">{isKo ? "섹터 동종 기업 비교" : "Sector Peer Comparison"}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {isKo ? "같은 섹터 내 상위 3개 기업과의 당일 수익률 비교" : "Today's performance vs top 3 sector peers"}
                  </p>
                </div>
                {/* Sort controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setSortMode(m => m === "change_desc" ? "change_asc" : "change_desc")}
                    className={cn("flex items-center gap-0.5 px-2 py-1 text-[10px] font-bold rounded-lg border transition-all", (sortMode === "change_desc" || sortMode === "change_asc") ? "bg-violet-500/15 border-violet-400/50 text-violet-600 dark:text-violet-400" : "border-border text-muted-foreground")}
                    data-testid="sort-change"
                    title={isKo ? "등락률 정렬" : "Sort by Change %"}
                  >
                    {sortMode === "change_asc" ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />}
                    %
                  </button>
                  <button
                    onClick={() => setSortMode("volume")}
                    className={cn("px-2 py-1 text-[10px] font-bold rounded-lg border transition-all", sortMode === "volume" ? "bg-blue-500/15 border-blue-400/50 text-blue-600 dark:text-blue-400" : "border-border text-muted-foreground")}
                    data-testid="sort-volume"
                    title={isKo ? "거래량 정렬" : "Sort by Volume"}
                  >
                    {isKo ? "거래량" : "Vol"}
                  </button>
                  <button
                    onClick={() => setSortMode("alpha")}
                    className={cn("px-2 py-1 text-[10px] font-bold rounded-lg border transition-all", sortMode === "alpha" ? "bg-green-500/15 border-green-400/50 text-green-600 dark:text-green-400" : "border-border text-muted-foreground")}
                    data-testid="sort-alpha"
                    title="A-Z"
                  >
                    A-Z
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {peerRows.map(row => {
                  const pct = row.changePercent;
                  const barPct = pct !== null ? Math.min(Math.abs(pct) * 10, 100) : 0;
                  return (
                    <div
                      key={row.symbol}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover-elevate",
                        row.isSelf ? "border-violet-400/50 bg-violet-500/5" : "border-border"
                      )}
                      onClick={() => { onClose(); navigate(`/stock/${row.symbol}`); }}
                      data-testid={`peer-row-${row.symbol}`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-muted-foreground">{row.symbol.replace(".KS", "").replace(".KQ", "").slice(0, 4)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold truncate">{row.name}</p>
                          {row.isSelf && <span className="text-[10px] bg-violet-500/15 text-violet-500 px-1.5 py-0.5 rounded-full font-bold shrink-0">{isKo ? "현재" : "This"}</span>}
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono">{row.symbol}</p>
                        {pct !== null && (
                          <div className="mt-1.5 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", pct >= 0 ? "bg-green-500" : "bg-red-500")}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {row.price !== null && (
                          <p className="text-sm font-mono font-bold">{formatPrice(row.price, { nativeCurrency: isKoreanStock(row.symbol) ? "KRW" : isJapaneseStock(row.symbol) ? "JPY" : "USD" })}</p>
                        )}
                        {pct !== null && (
                          <p className={cn("text-xs font-bold", pct >= 0 ? "text-green-500" : "text-red-500")}>
                            {pct >= 0 ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : <TrendingDown className="w-3 h-3 inline mr-0.5" />}
                            {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Relative Bar Comparison */}
              {peerRows.some(r => r.changePercent !== null) && (
                <div className="pt-3 border-t space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground">{isKo ? "당일 수익률 비교" : "Today's Return Comparison"}</h4>
                  {peerRows.map(row => {
                    if (row.changePercent === null) return null;
                    const pct = row.changePercent;
                    const maxAbs = Math.max(...peerRows.filter(r => r.changePercent !== null).map(r => Math.abs(r.changePercent!)), 0.01);
                    const barW = Math.abs(pct) / maxAbs * 50;
                    return (
                      <div key={row.symbol} className="flex items-center gap-2">
                        <span className={cn("text-[10px] font-bold w-16 shrink-0 text-right", row.isSelf ? "text-violet-500" : "text-muted-foreground")}>
                          {row.symbol.slice(0, 6)}
                        </span>
                        <div className="flex-1 flex items-center justify-center gap-0">
                          {pct < 0 && (
                            <div className="flex justify-end" style={{ width: "50%" }}>
                              <div className="h-4 bg-red-500 rounded-l-sm" style={{ width: `${barW * 2}%` }} />
                            </div>
                          )}
                          <div className="w-px h-5 bg-border mx-0.5" />
                          {pct >= 0 && (
                            <div className="flex" style={{ width: "50%" }}>
                              <div className="h-4 bg-green-500 rounded-r-sm" style={{ width: `${barW * 2}%` }} />
                            </div>
                          )}
                        </div>
                        <span className={cn("text-[10px] font-mono font-bold w-14 shrink-0", pct >= 0 ? "text-green-500" : "text-red-500")}>
                          {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2.5 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
          <span>{isKo ? "DinoInvest Pro 분석" : "DinoInvest Pro Analysis"}</span>
          <button
            onClick={() => { onClose(); navigate(`/stock/${symbol}`); }}
            className="font-semibold text-violet-500 hover:text-violet-600 transition-colors"
            data-testid="button-goto-stockdetail"
          >
            {isKo ? "상세 페이지로 →" : "Full Page →"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
