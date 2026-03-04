import { useState, useEffect, useRef, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  AreaSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
  type CandlestickData,
  type LineData,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
} from "lightweight-charts";
import { TradingViewChart } from "./TradingViewChart";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";
import {
  calcSMA, calcEMA, calcBB, calcRSI, calcMACD, calcVolumeMA, toLineData,
} from "@/lib/chartMath";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GlobalChartProps {
  symbol: string;
  periodKey?: string;
  chartType?: "candle" | "area" | "line";
  isDark?: boolean;
  height?: number | string;
  lang?: string;
  className?: string;
  fillContainer?: boolean;
  onSymbolChange?: (symbol: string) => void;
}

interface CandlePoint {
  date: string; open: number; high: number; low: number;
  close: number; volume: number;
}

export type IndicatorKey = "sma5"|"sma20"|"sma60"|"sma120"|"bb"|"rsi"|"macd"|"volumeMA";
export type DrawMode = "trendline"|"hline"|"fibonacci"|"erase"|null;

interface DrawingPoint { time: UTCTimestamp; price: number; }
interface DrawingSpec {
  id: string;
  type: "trendline"|"hline"|"fibonacci";
  points: DrawingPoint[];
}

// ── Range config ──────────────────────────────────────────────────────────────
const RANGES = [
  { key: "1d",  label: "1D",  daysBack: 1,    fetchPeriod: "5d",  fetchInterval: "5m",  isIntraday: true  },
  { key: "1w",  label: "1W",  daysBack: 7,    fetchPeriod: "2y",  fetchInterval: "1d",  isIntraday: false },
  { key: "1m",  label: "1M",  daysBack: 30,   fetchPeriod: "2y",  fetchInterval: "1d",  isIntraday: false },
  { key: "3m",  label: "3M",  daysBack: 90,   fetchPeriod: "2y",  fetchInterval: "1d",  isIntraday: false },
  { key: "1y",  label: "1Y",  daysBack: 365,  fetchPeriod: "5y",  fetchInterval: "1d",  isIntraday: false },
  { key: "5y",  label: "5Y",  daysBack: 1825, fetchPeriod: "max", fetchInterval: "1wk", isIntraday: false },
  { key: "all", label: "ALL", daysBack: 99999,fetchPeriod: "max", fetchInterval: "1wk", isIntraday: false },
] as const;
type RangeKey = typeof RANGES[number]["key"];

const FETCH_CHUNK_DAYS: Record<string, number> = {
  "5m": 7, "1d": 3650, "1wk": 18250, "1mo": 18250,
};

const FIB_LEVELS = [
  { pct: 0,     label: "0%" },
  { pct: 0.236, label: "23.6%" },
  { pct: 0.382, label: "38.2%" },
  { pct: 0.5,   label: "50%" },
  { pct: 0.618, label: "61.8%" },
  { pct: 0.786, label: "78.6%" },
  { pct: 1,     label: "100%" },
];

function isGlobalExchange(s: string) {
  return s.endsWith(".KS") || s.endsWith(".KQ") || s.endsWith(".T");
}
function toUTC(d: string): UTCTimestamp {
  return Math.floor(new Date(d).getTime() / 1000) as UTCTimestamp;
}
function cloneRange(r: { from: number|string; to: number|string }|null) {
  return r ? { from: r.from, to: r.to } : null;
}
function uid() { return Math.random().toString(36).slice(2, 9); }

// ── Fetch helper ──────────────────────────────────────────────────────────────
async function fetchCandles(
  symbol: string,
  opts: { period?: string; interval: string; start?: string; end?: string }
): Promise<CandlePoint[]> {
  let url = `/api/stocks/history/${symbol}?interval=${opts.interval}`;
  if (opts.start) { url += `&start=${opts.start}`; if (opts.end) url += `&end=${opts.end}`; }
  else url += `&period=${opts.period ?? "1y"}`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const json = await resp.json();
  const raw: CandlePoint[] = (json.data ?? []).map((d: any) => ({
    date: d.date, open: d.open ?? d.close, high: d.high ?? d.close,
    low: d.low ?? d.close, close: d.close, volume: d.volume ?? 0,
  }));
  raw.sort((a, b) => a.date.localeCompare(b.date));
  return raw;
}

// ── Small UI helpers ──────────────────────────────────────────────────────────
function ReturnBadge({ pct, lang }: { pct: number|null; lang: string }) {
  if (pct === null) return null;
  const pos = pct >= 0;
  return (
    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap",
      pos ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
           : "bg-red-500/15 text-red-600 dark:text-red-400"
    )} data-testid="badge-return-rate">
      {pos ? "+" : ""}{pct.toFixed(2)}%
      <span className="font-normal opacity-70 ml-1">{lang === "ko" ? "기간" : "visible"}</span>
    </span>
  );
}

// ── Indicator Panel ───────────────────────────────────────────────────────────
function IndicatorPanel({
  active, onToggle, lang,
}: { active: Set<IndicatorKey>; onToggle: (k: IndicatorKey) => void; lang: string }) {
  const overlays: { k: IndicatorKey; label: string }[] = [
    { k: "sma5",     label: "SMA 5"   },
    { k: "sma20",    label: "SMA 20"  },
    { k: "sma60",    label: "SMA 60"  },
    { k: "sma120",   label: "SMA 120" },
    { k: "bb",       label: "Bollinger Bands" },
    { k: "volumeMA", label: lang === "ko" ? "거래량 MA" : "Volume MA" },
  ];
  const oscillators: { k: IndicatorKey; label: string }[] = [
    { k: "rsi",  label: "RSI (14)" },
    { k: "macd", label: "MACD"     },
  ];
  return (
    <div className="absolute top-full right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-3 min-w-[200px]"
         data-testid="panel-indicators">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
        {lang === "ko" ? "오버레이" : "Overlays"}
      </p>
      {overlays.map(({ k, label }) => (
        <label key={k} className="flex items-center gap-2 py-1 cursor-pointer hover:text-foreground text-sm" data-testid={`toggle-ind-${k}`}>
          <input type="checkbox" className="accent-primary" checked={active.has(k)} onChange={() => onToggle(k)} />
          {label}
        </label>
      ))}
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-3 mb-2">
        {lang === "ko" ? "오실레이터" : "Oscillators"}
      </p>
      {oscillators.map(({ k, label }) => (
        <label key={k} className="flex items-center gap-2 py-1 cursor-pointer hover:text-foreground text-sm" data-testid={`toggle-ind-${k}`}>
          <input type="checkbox" className="accent-primary" checked={active.has(k)} onChange={() => onToggle(k)} />
          {label}
        </label>
      ))}
    </div>
  );
}

// ── Drawing Toolbar ────────────────────────────────────────────────────────────
function DrawingToolbar({
  drawMode, onSelect, onClearAll, lang,
}: {
  drawMode: DrawMode; onSelect: (m: DrawMode) => void; onClearAll: () => void; lang: string;
}) {
  const tools: { mode: DrawMode; icon: string; en: string; ko: string }[] = [
    { mode: "trendline", icon: "📏", en: "Trendline", ko: "추세선" },
    { mode: "hline",     icon: "➖", en: "H-Line", ko: "수평선" },
    { mode: "fibonacci", icon: "🌀", en: "Fibonacci", ko: "피보나치" },
    { mode: "erase",     icon: "🗑", en: "Erase", ko: "지우기" },
  ];
  return (
    <div className="flex items-center gap-1 flex-wrap px-2 py-1 border-t border-border/30 bg-muted/10">
      {tools.map(t => (
        <button key={t.mode}
          onClick={() => onSelect(drawMode === t.mode ? null : t.mode)}
          className={cn(
            "flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium transition-all",
            drawMode === t.mode
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          data-testid={`button-draw-${t.mode}`}
        >
          <span>{t.icon}</span>
          <span className="hidden sm:inline">{lang === "ko" ? t.ko : t.en}</span>
        </button>
      ))}
      <div className="flex-1" />
      <button onClick={onClearAll}
        className="text-[11px] px-2.5 py-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all font-medium"
        data-testid="button-draw-clear">
        {lang === "ko" ? "모두 지우기" : "Clear All"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// InfiniteScrollChart — Persistent LightweightCharts instance
// ══════════════════════════════════════════════════════════════════════════════
interface InfiniteScrollChartProps {
  symbol: string;
  chartType: "candle"|"area"|"line";
  isDark: boolean;
  height: number;
  lang: string;
  rangeKey: RangeKey;
  activeIndicators: Set<IndicatorKey>;
  drawMode: DrawMode;
  onDrawModeChange: (m: DrawMode) => void;
  onReturnRateChange: (pct: number|null) => void;
  onLoadingChange: (loading: boolean) => void;
}

function InfiniteScrollChart({
  symbol, chartType, isDark, height, lang, rangeKey,
  activeIndicators, drawMode, onDrawModeChange,
  onReturnRateChange, onLoadingChange,
}: InfiniteScrollChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Chart core
  const chartRef      = useRef<IChartApi|null>(null);
  const mainSeriesRef = useRef<ISeriesApi<SeriesType>|null>(null);
  const volSeriesRef  = useRef<ISeriesApi<"Histogram">|null>(null);

  // Data buffer
  const allDataRef         = useRef<CandlePoint[]>([]);
  const intradayRef        = useRef(false);
  const loadedRangeRef     = useRef<string>("");
  const currentIntervalRef = useRef<string>("1d");

  // Infinite scroll guards
  const fetchingMoreRef    = useRef(false);
  const noMoreOldDataRef   = useRef(false);
  const initialLoadingRef  = useRef(false);

  // ── Indicator series (overlays — always in pane 0) ────────────────────────
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<SeriesType>>>(new Map());

  // ── Oscillator series (RSI, MACD — in pane 1) ─────────────────────────────
  const oscSeriesRef     = useRef<Map<string, ISeriesApi<SeriesType>>>(new Map());
  const oscPaneActive    = useRef(false);

  // ── Drawing state ─────────────────────────────────────────────────────────
  // Per-symbol drawings (persist across symbol switches)
  const drawingDataRef   = useRef<Map<string, DrawingSpec[]>>(new Map());
  // Live drawing series for current symbol (cleared on symbol switch)
  const drawingSeriesRef = useRef<Map<string, (ISeriesApi<SeriesType>|IPriceLine)[]>>(new Map());
  // "First click" pending point for multi-click tools
  const pendingPointRef  = useRef<DrawingPoint|null>(null);

  // ── Event markers ─────────────────────────────────────────────────────────
  const markerPluginRef  = useRef<ISeriesMarkersPluginApi<UTCTimestamp>|null>(null);

  // ── Callback refs ─────────────────────────────────────────────────────────
  const onReturnRateRef  = useRef(onReturnRateChange); onReturnRateRef.current = onReturnRateChange;
  const onLoadingRef     = useRef(onLoadingChange);    onLoadingRef.current    = onLoadingChange;
  const symbolRef        = useRef(symbol);             symbolRef.current       = symbol;
  const drawModeRef      = useRef(drawMode);           drawModeRef.current     = drawMode;
  const activeIndRef     = useRef(activeIndicators);   activeIndRef.current    = activeIndicators;
  const onDrawModeRef    = useRef(onDrawModeChange);   onDrawModeRef.current   = onDrawModeChange;

  const { formatPrice, isKoreanStock, isJapaneseStock } = useCurrency();
  const isKr = isKoreanStock(symbol);
  const isJp = isJapaneseStock(symbol);
  const nativeCurrency = isKr ? "KRW" : isJp ? "JPY" : "USD";
  const formatPriceRef = useRef(formatPrice); formatPriceRef.current = formatPrice;

  // ── applyData ─────────────────────────────────────────────────────────────
  const applyData = useCallback((
    data: CandlePoint[], preserveViewport: boolean, afterApply?: () => void,
  ) => {
    const chart = chartRef.current; const main = mainSeriesRef.current;
    if (!chart || !main) return;
    const saved = preserveViewport ? cloneRange(chart.timeScale().getVisibleRange()) : null;
    if (chartType === "candle") {
      main.setData(data.map(d => ({
        time: toUTC(d.date), open: d.open, high: d.high, low: d.low, close: d.close,
      } as CandlestickData)));
    } else {
      main.setData(data.map(d => ({ time: toUTC(d.date), value: d.close } as LineData)));
    }
    volSeriesRef.current?.setData(data.map(d => ({
      time: toUTC(d.date), value: d.volume,
      color: d.close >= d.open ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)",
    })));
    requestAnimationFrame(() => {
      try {
        if (saved) chart.timeScale().setVisibleRange(saved as any);
        afterApply?.();
      } catch {}
      renderIndicators(data);
    });
  }, [chartType]);

  // ── zoomToDays ────────────────────────────────────────────────────────────
  const zoomToDays = useCallback((daysBack: number) => {
    const chart = chartRef.current; if (!chart) return;
    if (daysBack >= 99000) { chart.timeScale().fitContent(); return; }
    const now  = Math.floor(Date.now() / 1000) as UTCTimestamp;
    const from = (now - daysBack * 86400) as UTCTimestamp;
    try { chart.timeScale().setVisibleRange({ from, to: now }); } catch {}
  }, []);

  // ── renderIndicators ──────────────────────────────────────────────────────
  const renderIndicators = useCallback((data?: CandlePoint[]) => {
    const chart = chartRef.current; const main = mainSeriesRef.current;
    if (!chart || !main) return;
    const pts = data ?? allDataRef.current;
    if (pts.length === 0) return;
    const closes = pts.map(d => d.close);
    const volumes = pts.map(d => d.volume);
    const times  = pts.map(d => toUTC(d.date));
    const active = activeIndRef.current;
    const isDk   = isDark;

    // Helper: get or create overlay series (pane 0)
    const getOrCreate = (key: string, color: string, lineWidth = 1, dash?: number) => {
      if (indicatorSeriesRef.current.has(key)) return indicatorSeriesRef.current.get(key)!;
      const s = chart.addSeries(LineSeries, {
        color, lineWidth, lineStyle: dash ? 1 : 0,
        lastValueVisible: false, priceLineVisible: false,
        crosshairMarkerVisible: false,
      });
      indicatorSeriesRef.current.set(key, s);
      return s;
    };

    const removeIndicator = (key: string) => {
      const s = indicatorSeriesRef.current.get(key);
      if (s) { try { chart.removeSeries(s); } catch {} indicatorSeriesRef.current.delete(key); }
    };

    // ── SMA overlays ──
    const smaConfig: { key: IndicatorKey; period: number; color: string }[] = [
      { key: "sma5",   period: 5,   color: "#f59e0b" },
      { key: "sma20",  period: 20,  color: "#3b82f6" },
      { key: "sma60",  period: 60,  color: "#8b5cf6" },
      { key: "sma120", period: 120, color: "#ec4899" },
    ];
    for (const { key, period, color } of smaConfig) {
      if (active.has(key)) {
        const s = getOrCreate(key, color, 1);
        s.setData(toLineData(times as number[], calcSMA(closes, period)) as any);
      } else removeIndicator(key);
    }

    // ── Bollinger Bands ──
    if (active.has("bb")) {
      const { upper, middle, lower } = calcBB(closes, 20, 2);
      getOrCreate("bb_mid",   isDk ? "#94a3b8" : "#64748b", 1).setData(toLineData(times as number[], middle) as any);
      getOrCreate("bb_upper", "#06b6d4", 1).setData(toLineData(times as number[], upper) as any);
      getOrCreate("bb_lower", "#06b6d4", 1).setData(toLineData(times as number[], lower) as any);
    } else {
      ["bb_mid","bb_upper","bb_lower"].forEach(removeIndicator);
    }

    // ── Volume MA ──
    if (active.has("volumeMA")) {
      const vma = calcVolumeMA(volumes, 20);
      const vmaS = indicatorSeriesRef.current.get("volumeMA") ?? (() => {
        const s = chart.addSeries(LineSeries, {
          color: "#f97316", lineWidth: 1, lastValueVisible: false,
          priceLineVisible: false, priceScaleId: "vol",
        });
        indicatorSeriesRef.current.set("volumeMA", s);
        return s;
      })();
      vmaS.setData(toLineData(times as number[], vma) as any);
    } else removeIndicator("volumeMA");

    // ── Oscillators: RSI ──
    const needOscPane = active.has("rsi") || active.has("macd");
    if (!needOscPane && oscPaneActive.current) {
      // Remove all oscillator series then remove pane
      oscSeriesRef.current.forEach((s, k) => {
        try { chart.removeSeries(s); } catch {}
        oscSeriesRef.current.delete(k);
      });
      try { chart.removePane(1); } catch {}
      oscPaneActive.current = false;
    }
    if (needOscPane && !oscPaneActive.current) {
      chart.addPane();
      // Resize panes: main 75%, osc 25%
      try {
        const panes = chart.panes();
        if (panes.length >= 2) panes[1].setHeight(Math.round(height * 0.28));
      } catch {}
      oscPaneActive.current = true;
    }

    const getOrCreateOsc = (key: string, color: string, lw = 1, paneIdx = 1) => {
      if (oscSeriesRef.current.has(key)) return oscSeriesRef.current.get(key)!;
      const s = chart.addSeries(LineSeries, {
        color, lineWidth: lw, lastValueVisible: false, priceLineVisible: false,
        priceScaleId: `osc_${key}`,
      }, paneIdx);
      oscSeriesRef.current.set(key, s);
      return s;
    };
    const removeOsc = (key: string) => {
      const s = oscSeriesRef.current.get(key);
      if (s) { try { chart.removeSeries(s); } catch {} oscSeriesRef.current.delete(key); }
    };

    if (active.has("rsi")) {
      const rsiVals = calcRSI(closes, 14);
      getOrCreateOsc("rsi", "#a855f7", 1).setData(toLineData(times as number[], rsiVals) as any);
      // Overbought/oversold reference lines (horizontal price lines on rsi series)
      try {
        const rsiS = oscSeriesRef.current.get("rsi")!;
        if (!oscSeriesRef.current.has("rsi_ob")) {
          rsiS.createPriceLine({ price: 70, color: "#ef4444", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "OB" });
          rsiS.createPriceLine({ price: 30, color: "#22c55e", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "OS" });
          oscSeriesRef.current.set("rsi_ob", rsiS as any); // marker that lines are set
        }
      } catch {}
    } else {
      removeOsc("rsi"); removeOsc("rsi_ob");
    }

    if (active.has("macd")) {
      const { macd, signal, histogram } = calcMACD(closes);
      getOrCreateOsc("macd_line",  "#3b82f6", 1).setData(toLineData(times as number[], macd) as any);
      getOrCreateOsc("macd_sig",   "#f59e0b", 1).setData(toLineData(times as number[], signal) as any);
      // Histogram as histogram series
      if (!oscSeriesRef.current.has("macd_hist")) {
        const hs = chart.addSeries(HistogramSeries, {
          priceScaleId: "osc_macd_line", lastValueVisible: false, priceLineVisible: false,
        }, 1);
        oscSeriesRef.current.set("macd_hist", hs);
      }
      (oscSeriesRef.current.get("macd_hist") as ISeriesApi<"Histogram">).setData(
        toLineData(times as number[], histogram).map(d => ({
          ...d, color: (d as any).value >= 0 ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)",
        })) as any
      );
    } else {
      ["macd_line","macd_sig","macd_hist"].forEach(removeOsc);
    }
  }, [isDark, height]);

  // ── clearAllDrawings: remove all drawing series for current symbol ─────────
  const clearAllDrawings = useCallback((sym: string) => {
    drawingDataRef.current.delete(sym);
    const seriesMap = drawingSeriesRef.current;
    seriesMap.forEach((items, id) => {
      items.forEach(item => {
        try {
          if ("price" in (item as any).options?.()) {
            mainSeriesRef.current?.removePriceLine(item as IPriceLine);
          } else {
            chartRef.current?.removeSeries(item as ISeriesApi<SeriesType>);
          }
        } catch {}
      });
    });
    seriesMap.clear();
  }, []);

  // ── renderDrawings: create chart objects for stored DrawingSpecs ──────────
  const renderDrawings = useCallback((sym: string) => {
    const chart = chartRef.current; const main = mainSeriesRef.current;
    if (!chart || !main) return;
    const drawings = drawingDataRef.current.get(sym) ?? [];
    for (const spec of drawings) {
      const liveItems: (ISeriesApi<SeriesType>|IPriceLine)[] = [];
      if (spec.type === "trendline" && spec.points.length >= 2) {
        const [p1, p2] = spec.points[0].time < spec.points[1].time
          ? [spec.points[0], spec.points[1]] : [spec.points[1], spec.points[0]];
        const s = chart.addSeries(LineSeries, {
          color: "#2196F3", lineWidth: 2, crosshairMarkerVisible: false,
          lastValueVisible: false, priceLineVisible: false,
        });
        s.setData([{ time: p1.time, value: p1.price }, { time: p2.time, value: p2.price }] as any);
        liveItems.push(s);
      } else if (spec.type === "hline" && spec.points.length >= 1) {
        const pl = main.createPriceLine({
          price: spec.points[0].price, color: "#f59e0b",
          lineWidth: 1, lineStyle: 2, axisLabelVisible: true,
          title: `H ${formatPriceRef.current(spec.points[0].price, { nativeCurrency: isKr ? "KRW" : isJp ? "JPY" : "USD" })}`,
        });
        liveItems.push(pl);
      } else if (spec.type === "fibonacci" && spec.points.length >= 2) {
        const hi = Math.max(spec.points[0].price, spec.points[1].price);
        const lo = Math.min(spec.points[0].price, spec.points[1].price);
        const fibColors = ["#ef4444","#f97316","#f59e0b","#22c55e","#3b82f6","#8b5cf6","#ec4899"];
        for (let i = 0; i < FIB_LEVELS.length; i++) {
          const { pct, label } = FIB_LEVELS[i];
          const price = hi - (hi - lo) * pct;
          const pl = main.createPriceLine({
            price, color: fibColors[i] ?? "#6b7280",
            lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `Fib ${label}`,
          });
          liveItems.push(pl);
        }
      }
      drawingSeriesRef.current.set(spec.id, liveItems);
    }
  }, [isKr, isJp]);

  // ── removeDrawing by id ───────────────────────────────────────────────────
  const removeDrawing = useCallback((sym: string, id: string) => {
    const items = drawingSeriesRef.current.get(id) ?? [];
    items.forEach(item => {
      try {
        const opts = (item as any).options?.();
        if (opts && "price" in opts) mainSeriesRef.current?.removePriceLine(item as IPriceLine);
        else chartRef.current?.removeSeries(item as ISeriesApi<SeriesType>);
      } catch {}
    });
    drawingSeriesRef.current.delete(id);
    const data = drawingDataRef.current.get(sym) ?? [];
    drawingDataRef.current.set(sym, data.filter(d => d.id !== id));
  }, []);

  // ── fetchAndRenderMarkers ─────────────────────────────────────────────────
  const fetchAndRenderMarkers = useCallback(async (sym: string) => {
    const main = mainSeriesRef.current; if (!main) return;
    try {
      const [earningsResp, divResp] = await Promise.allSettled([
        fetch(`/api/stocks/earnings/${sym}`).then(r => r.json()),
        fetch(`/api/stocks/dividends/${sym}`).then(r => r.json()),
      ]);
      const allData = allDataRef.current;
      const dateSet = new Set(allData.map(d => d.date.slice(0, 10)));
      const markers: any[] = [];

      if (earningsResp.status === "fulfilled") {
        const e = earningsResp.value;
        const history: { date: string; epsActual?: number }[] = e.history ?? [];
        for (const h of history) {
          const d = h.date?.slice(0, 10);
          if (!d || !dateSet.has(d)) continue;
          markers.push({
            time: toUTC(d), position: "aboveBar", shape: "circle",
            color: "#3b82f6", text: "E",
            tooltip: h.epsActual != null ? `EPS: ${h.epsActual}` : "Earnings",
          });
        }
      }
      if (divResp.status === "fulfilled") {
        const divs: { date: string; amount: number }[] = divResp.value.dividends ?? [];
        for (const div of divs) {
          const d = div.date?.slice(0, 10);
          if (!d || !dateSet.has(d)) continue;
          markers.push({
            time: toUTC(d), position: "belowBar", shape: "circle",
            color: "#22c55e", text: "D",
            tooltip: `Div: ${div.amount}`,
          });
        }
      }
      markers.sort((a, b) => a.time - b.time);

      // Create or update marker plugin
      if (!markerPluginRef.current) {
        markerPluginRef.current = createSeriesMarkers(main as any, markers);
      } else {
        markerPluginRef.current.setMarkers(markers);
      }
    } catch { /* markers are non-critical */ }
  }, []);

  // ── loadForRange ──────────────────────────────────────────────────────────
  const loadForRange = useCallback(async (key: RangeKey) => {
    const range = RANGES.find(r => r.key === key)!;
    if (initialLoadingRef.current) return;
    initialLoadingRef.current = true;
    onLoadingRef.current(true);
    try {
      const data = await fetchCandles(symbolRef.current, {
        period: range.fetchPeriod, interval: range.fetchInterval,
      });
      if (data.length === 0) return;
      allDataRef.current      = data;
      intradayRef.current     = range.isIntraday;
      loadedRangeRef.current  = key;
      currentIntervalRef.current = range.fetchInterval;
      noMoreOldDataRef.current   = false;
      chartRef.current?.applyOptions({
        timeScale: { timeVisible: range.isIntraday, secondsVisible: false },
      });
      applyData(data, false, () => zoomToDays(range.daysBack));
      // Fetch markers after data loads (non-blocking)
      fetchAndRenderMarkers(symbolRef.current);
    } finally {
      initialLoadingRef.current = false;
      onLoadingRef.current(false);
    }
  }, [applyData, zoomToDays, fetchAndRenderMarkers]);

  // ── Handle range button change ────────────────────────────────────────────
  const rangeKeyRef = useRef(rangeKey);
  useEffect(() => {
    const prevKey = rangeKeyRef.current;
    rangeKeyRef.current = rangeKey;
    const range     = RANGES.find(r => r.key === rangeKey)!;
    const prevRange = RANGES.find(r => r.key === prevKey)!;
    const intervalChanged = range.fetchInterval !== currentIntervalRef.current;
    const needsNewData =
      allDataRef.current.length === 0 ||
      range.isIntraday !== prevRange.isIntraday ||
      intervalChanged ||
      (range.key === "all" && loadedRangeRef.current !== "all" && loadedRangeRef.current !== "5y");
    if (needsNewData) loadForRange(rangeKey); else zoomToDays(range.daysBack);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  // ── Symbol change: reset buffer, clear drawings (not data), reload ────────
  useEffect(() => {
    allDataRef.current = []; loadedRangeRef.current = "";
    currentIntervalRef.current = "1d"; noMoreOldDataRef.current = false;
    pendingPointRef.current = null;
    onDrawModeRef.current(null);

    // Remove drawing series for old symbol (keep the data in drawingDataRef for later)
    drawingSeriesRef.current.forEach((items) => {
      items.forEach(item => {
        try {
          const opts = (item as any).options?.();
          if (opts && "price" in opts) mainSeriesRef.current?.removePriceLine(item as IPriceLine);
          else chartRef.current?.removeSeries(item as ISeriesApi<SeriesType>);
        } catch {}
      });
    });
    drawingSeriesRef.current.clear();

    // Remove marker plugin for old symbol
    try { markerPluginRef.current?.setMarkers([]); } catch {}
    markerPluginRef.current = null;

    loadForRange(rangeKeyRef.current).then(() => {
      // Re-render drawings for the new symbol
      renderDrawings(symbol);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // ── Re-render indicators when activeIndicators changes ────────────────────
  useEffect(() => {
    renderIndicators();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndicators]);

  // ── fetchOlderData ────────────────────────────────────────────────────────
  const fetchOlderData = useCallback(async () => {
    if (fetchingMoreRef.current || noMoreOldDataRef.current) return;
    const data = allDataRef.current; if (data.length === 0) return;
    fetchingMoreRef.current = true; onLoadingRef.current(true);
    try {
      const interval  = intradayRef.current ? "5m" : currentIntervalRef.current;
      const chunkDays = FETCH_CHUNK_DAYS[interval] ?? 3650;
      const oldestDate = data[0].date.slice(0, 10);
      const startDate  = new Date(new Date(oldestDate).getTime() - chunkDays * 86400000).toISOString().slice(0, 10);
      const older = await fetchCandles(symbolRef.current, { interval, start: startDate, end: oldestDate });
      if (older.length === 0) { noMoreOldDataRef.current = true; return; }
      const existingDates = new Set(data.map(d => d.date.slice(0, 10)));
      const fresh = older.filter(d => !existingDates.has(d.date.slice(0, 10)));
      if (fresh.length === 0) { noMoreOldDataRef.current = true; return; }
      const combined = [...fresh, ...data].sort((a, b) => a.date.localeCompare(b.date));
      allDataRef.current = combined;
      applyData(combined, true);
    } finally {
      fetchingMoreRef.current = false; onLoadingRef.current(false);
    }
  }, [applyData]);

  // ── Create chart ──────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current; if (!container) return;
    const textC  = isDark ? "#9ca3af" : "#6b7280";
    const gridC  = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
    const borderC= isDark ? "#1e293b" : "#e5e7eb";

    const chart = createChart(container, {
      width: container.clientWidth, height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: textC },
      grid:   { vertLines: { color: gridC }, horzLines: { color: gridC } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: borderC },
      timeScale: {
        borderColor: borderC, timeVisible: false, secondsVisible: false,
        fixLeftEdge: false, fixRightEdge: false, minBarSpacing: 2,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale:  { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });
    chartRef.current = chart;

    // Main price series
    let main: ISeriesApi<SeriesType>;
    if (chartType === "candle") {
      main = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e", downColor: "#ef4444",
        borderUpColor: "#22c55e", borderDownColor: "#ef4444",
        wickUpColor: "#22c55e", wickDownColor: "#ef4444",
      });
    } else if (chartType === "area") {
      main = chart.addSeries(AreaSeries, {
        lineColor: "#6366f1", topColor: "rgba(99,102,241,0.28)",
        bottomColor: "rgba(99,102,241,0)", lineWidth: 2,
      });
    } else {
      main = chart.addSeries(LineSeries, { color: "#6366f1", lineWidth: 2 });
    }
    mainSeriesRef.current = main;
    chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.1, bottom: 0.18 }, autoScale: true });

    // Volume series
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" }, priceScaleId: "vol",
      lastValueVisible: false, priceLineVisible: false,
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 }, drawTicks: false, borderVisible: false });
    volSeriesRef.current = vol;

    // ── Tooltip ──────────────────────────────────────────────────────────
    const tooltip = document.createElement("div");
    tooltip.style.cssText = `
      position:absolute;display:none;pointer-events:none;
      background:${isDark ? "rgba(15,23,42,0.96)" : "rgba(255,255,255,0.97)"};
      border:1px solid ${isDark ? "#334155" : "#e5e7eb"};
      border-radius:8px;padding:8px 12px;z-index:50;
      box-shadow:0 4px 16px rgba(0,0,0,0.15);min-width:140px;max-width:220px;
      color:${isDark ? "#e5e7eb" : "#111827"};font-family:inherit;
    `;
    container.style.position = "relative";
    container.appendChild(tooltip);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        tooltip.style.display = "none"; return;
      }
      const data = allDataRef.current;
      const ts   = Number(param.time);
      const idx  = data.findIndex(d => Math.abs(toUTC(d.date) - ts) <= 60);
      if (idx < 0) { tooltip.style.display = "none"; return; }
      const d    = data[idx];
      const isUp = d.close >= d.open;
      const prev = idx > 0 ? data[idx - 1].close : d.close;
      const pct  = prev > 0 ? ((d.close - prev) / prev) * 100 : 0;
      const fp   = (v: number) => formatPriceRef.current(v, { nativeCurrency });
      const tc   = isDark ? "#9ca3af" : "#6b7280";
      const fc   = isDark ? "#e5e7eb" : "#111827";
      const pc   = isUp ? "#22c55e" : "#ef4444";
      const ko   = lang === "ko";
      const dateStr = intradayRef.current
        ? new Date(d.date).toLocaleTimeString(ko ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
        : new Date(d.date).toLocaleDateString(ko ? "ko-KR" : "en-US", { month: "short", day: "numeric", year: "numeric" });
      let html = `<div style="font-size:10px;color:${tc};margin-bottom:4px;font-weight:600">${dateStr}</div>`;
      html += `<div style="display:grid;grid-template-columns:auto 1fr;gap:1px 10px;font-size:11px">`;
      html += `<span style="color:${tc}">${ko?"시가":"O"}</span><span style="color:${fc};font-weight:600;text-align:right">${fp(d.open)}</span>`;
      html += `<span style="color:${tc}">${ko?"고가":"H"}</span><span style="color:#22c55e;font-weight:600;text-align:right">${fp(d.high)}</span>`;
      html += `<span style="color:${tc}">${ko?"저가":"L"}</span><span style="color:#ef4444;font-weight:600;text-align:right">${fp(d.low)}</span>`;
      html += `<span style="color:${tc}">${ko?"종가":"C"}</span><span style="color:${pc};font-weight:700;text-align:right">${fp(d.close)}<span style="font-size:9.5px;opacity:.8"> (${pct>=0?"+":""}${pct.toFixed(2)}%)</span></span>`;
      html += `</div>`;
      if (d.volume > 0) {
        const v = d.volume >= 1e9 ? `${(d.volume/1e9).toFixed(1)}B` : d.volume >= 1e6 ? `${(d.volume/1e6).toFixed(1)}M` : `${(d.volume/1e3).toFixed(0)}K`;
        html += `<div style="font-size:10px;color:${tc};margin-top:3px">${ko?"거래량":"Vol"}: <span style="color:${fc}">${v}</span></div>`;
      }
      // Active indicator values
      const indLines: string[] = [];
      const actInd = activeIndRef.current;
      if (actInd.has("rsi")) {
        const rsiVal = calcRSI(data.map(x => x.close), 14)[idx];
        if (rsiVal !== null) indLines.push(`RSI: ${rsiVal.toFixed(1)}`);
      }
      if (actInd.has("macd")) {
        const { macd, signal } = calcMACD(data.map(x => x.close));
        if (macd[idx] !== null) indLines.push(`MACD: ${(macd[idx] as number).toFixed(2)}`);
        if (signal[idx] !== null) indLines.push(`Sig: ${(signal[idx] as number).toFixed(2)}`);
      }
      if (indLines.length > 0) {
        html += `<div style="font-size:10px;color:${tc};margin-top:3px;border-top:1px solid ${isDark?"#334155":"#e5e7eb"};padding-top:3px">${indLines.join(" · ")}</div>`;
      }
      tooltip.innerHTML = html;
      tooltip.style.display = "block";
      const rect = container.getBoundingClientRect();
      const ttW  = 165;
      let left   = param.point.x + 14;
      if (left + ttW > rect.width) left = param.point.x - ttW - 8;
      tooltip.style.left = `${Math.max(0, left)}px`;
      tooltip.style.top  = `${Math.max(4, param.point.y - 44)}px`;
    });

    // ── Drawing click handler ──────────────────────────────────────────────
    chart.subscribeClick((param) => {
      const mode = drawModeRef.current;
      if (!mode) return;
      if (!param.time || !param.point) return;
      const price = main.coordinateToPrice(param.point.y);
      if (price === null) return;
      const time = param.time as UTCTimestamp;
      const sym  = symbolRef.current;

      if (mode === "erase") {
        // Find closest trendline drawing and remove it
        const drawings = drawingDataRef.current.get(sym) ?? [];
        if (drawings.length > 0) {
          removeDrawing(sym, drawings[drawings.length - 1].id);
        }
        return;
      }

      if (mode === "hline") {
        const spec: DrawingSpec = { id: uid(), type: "hline", points: [{ time, price }] };
        const existing = drawingDataRef.current.get(sym) ?? [];
        drawingDataRef.current.set(sym, [...existing, spec]);
        renderDrawings(sym); // re-render all (simpler than incremental)
        onDrawModeRef.current(null);
        return;
      }

      // Two-click tools: trendline, fibonacci
      if (!pendingPointRef.current) {
        pendingPointRef.current = { time, price };
      } else {
        const p1 = pendingPointRef.current;
        const p2 = { time, price };
        pendingPointRef.current = null;
        const spec: DrawingSpec = { id: uid(), type: mode as "trendline"|"fibonacci", points: [p1, p2] };
        const existing = drawingDataRef.current.get(sym) ?? [];
        drawingDataRef.current.set(sym, [...existing, spec]);
        // Clear and re-render to include new drawing
        drawingSeriesRef.current.forEach((items) => {
          items.forEach(item => {
            try {
              const opts = (item as any).options?.();
              if (opts && "price" in opts) main.removePriceLine(item as IPriceLine);
              else chart.removeSeries(item as ISeriesApi<SeriesType>);
            } catch {}
          });
        });
        drawingSeriesRef.current.clear();
        renderDrawings(sym);
        onDrawModeRef.current(null);
      }
    });

    // ── Left-edge infinite scroll ──────────────────────────────────────────
    let edgeFired = false;
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range && range.from <= 20 && !edgeFired && !fetchingMoreRef.current && !noMoreOldDataRef.current) {
        edgeFired = true;
        fetchOlderData().finally(() => { edgeFired = false; });
      }
    });

    // ── Return rate from visible range ─────────────────────────────────────
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (!range || allDataRef.current.length === 0) { onReturnRateRef.current(null); return; }
      const fromMs = Number(range.from) * 1000;
      const toMs   = Number(range.to)   * 1000;
      const visible = allDataRef.current.filter(d => {
        const ts = new Date(d.date).getTime(); return ts >= fromMs && ts <= toMs;
      });
      if (visible.length >= 2) {
        onReturnRateRef.current(((visible[visible.length - 1].close - visible[0].close) / visible[0].close) * 100);
      } else onReturnRateRef.current(null);
    });

    // ── Resize observer ────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth; if (w > 0) chart.applyOptions({ width: w });
    });
    ro.observe(container);

    // Re-apply existing data into new chart instance
    if (allDataRef.current.length > 0) {
      applyData(allDataRef.current, false, () => zoomToDays(RANGES.find(r => r.key === rangeKeyRef.current)!.daysBack));
      renderDrawings(symbolRef.current);
      fetchAndRenderMarkers(symbolRef.current);
    } else {
      loadForRange(rangeKeyRef.current);
    }

    return () => {
      tooltip.remove(); ro.disconnect();
      // Clear indicator & oscillator series refs (they'll be re-created)
      indicatorSeriesRef.current.clear();
      oscSeriesRef.current.clear();
      oscPaneActive.current = false;
      markerPluginRef.current = null;
      drawingSeriesRef.current.clear(); // series are destroyed with chart
      chart.remove();
      chartRef.current = null; mainSeriesRef.current = null; volSeriesRef.current = null;
    };
  // Only recreate on theme/type/height changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark, chartType, height]);

  // ── Cursor style for draw mode ─────────────────────────────────────────────
  const cursorStyle = drawMode
    ? (drawMode === "erase" ? "crosshair" : "crosshair")
    : "default";

  return (
    <div ref={containerRef} className="w-full select-none"
      style={{ height, maxWidth: "100vw", touchAction: "none", cursor: cursorStyle }}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TradingView fallback wrapper
// ══════════════════════════════════════════════════════════════════════════════
function TVWithFallback({
  symbol, periodKey, chartType, isDark, chartH, lang, onSymbolChange, onFallback,
}: {
  symbol: string; periodKey: string; chartType: "candle"|"area"|"line";
  isDark: boolean; chartH: number; lang: string;
  onSymbolChange?: (s: string) => void; onFallback: () => void;
}) {
  return (
    <div className="w-full flex flex-col" style={{ maxWidth: "100vw" }}>
      <div style={{ width: "100%", height: chartH, minHeight: 350, flexShrink: 0 }}>
        <TradingViewChart
          symbol={symbol} periodKey={periodKey} chartType={chartType}
          isDark={isDark} height={chartH} lang={lang} fillContainer={true}
          onSymbolChange={onSymbolChange}
        />
      </div>
      <div className="flex justify-end px-3 py-1 border-t border-border/30 shrink-0">
        <button onClick={onFallback}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          data-testid="button-use-internal-chart">
          {lang === "ko" ? "내부 차트로 전환" : "Switch to internal chart"}
        </button>
      </div>
    </div>
  );
}

// ── Responsive chart height ───────────────────────────────────────────────────
function useChartHeight(heightProp?: number|string): number {
  const getH = () => typeof window === "undefined" ? 500 : window.innerWidth >= 640 ? 500 : 400;
  const [h, setH] = useState<number>(typeof heightProp === "number" ? heightProp : getH());
  useEffect(() => {
    if (typeof heightProp === "number") return;
    const update = () => setH(getH());
    window.addEventListener("resize", update, { passive: true });
    update();
    return () => window.removeEventListener("resize", update);
  }, [heightProp]);
  return Math.max(h, 350);
}

// ══════════════════════════════════════════════════════════════════════════════
// GlobalChart — public API
// ══════════════════════════════════════════════════════════════════════════════
export function GlobalChart({
  symbol, periodKey: initialPeriod = "1m",
  chartType = "candle", isDark = false,
  height, lang = "en", className, fillContainer = false, onSymbolChange,
}: GlobalChartProps) {
  const [rangeKey,     setRangeKey]     = useState<RangeKey>(initialPeriod as RangeKey);
  const [useFallback,  setFallback]     = useState(false);
  const [returnRate,   setReturnRate]   = useState<number|null>(null);
  const [isLoading,    setIsLoading]    = useState(false);
  const [activeInds,   setActiveInds]   = useState<Set<IndicatorKey>>(new Set());
  const [drawMode,     setDrawMode]     = useState<DrawMode>(null);
  const [showIndPanel, setShowIndPanel] = useState(false);
  const [showDrawBar,  setShowDrawBar]  = useState(false);

  useEffect(() => { setRangeKey(initialPeriod as RangeKey); }, [initialPeriod]);
  useEffect(() => { setFallback(false); }, [symbol]);

  const useInternal = isGlobalExchange(symbol) || useFallback;
  const chartH = useChartHeight(height);

  const toggleIndicator = (k: IndicatorKey) => {
    setActiveInds(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const handleDrawModeChange = (m: DrawMode) => {
    setDrawMode(m);
    if (m !== null && !showDrawBar) setShowDrawBar(true);
  };

  // Ref to trigger clearAll drawings from parent → child
  const clearAllRef = useRef<((sym: string) => void)|null>(null);

  return (
    <div className={cn("flex flex-col w-full overflow-hidden", className)} style={{ maxWidth: "100vw" }}>
      {/* ── Toolbar row ── */}
      <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-b border-border/40 bg-muted/20 flex-wrap shrink-0">
        {/* Range buttons */}
        <div className="flex items-center gap-0.5 flex-wrap">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRangeKey(r.key as RangeKey)}
              className={cn("min-w-[36px] min-h-[32px] px-2 py-0.5 rounded-md text-xs font-bold transition-all focus:outline-none",
                rangeKey === r.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )} data-testid={`button-range-${r.key}`}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Right side: indicators button + draw toggle + status */}
        <div className="flex items-center gap-1.5">
          {isLoading && <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
          <ReturnBadge pct={returnRate} lang={lang} />

          {useInternal && (
            <>
              {/* ── Drawing toggle ── */}
              <button
                onClick={() => setShowDrawBar(v => !v)}
                className={cn("text-[11px] px-2 py-1 rounded-md font-medium transition-all",
                  showDrawBar ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
                data-testid="button-toggle-draw-bar"
              >
                ✏ {lang === "ko" ? "그리기" : "Draw"}
              </button>

              {/* ── Indicators button ── */}
              <div className="relative">
                <button
                  onClick={() => setShowIndPanel(v => !v)}
                  className={cn("text-[11px] px-2 py-1 rounded-md font-medium transition-all",
                    showIndPanel || activeInds.size > 0
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  data-testid="button-toggle-indicators"
                >
                  📊 {lang === "ko" ? "지표" : "Indicators"}
                  {activeInds.size > 0 && (
                    <span className="ml-1 bg-primary text-primary-foreground text-[9px] rounded-full px-1.5">{activeInds.size}</span>
                  )}
                </button>
                {showIndPanel && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowIndPanel(false)} />
                    <div className="relative z-50">
                      <IndicatorPanel active={activeInds} onToggle={toggleIndicator} lang={lang} />
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Drawing toolbar (shown when toggled) ── */}
      {useInternal && showDrawBar && (
        <DrawingToolbar
          drawMode={drawMode}
          onSelect={handleDrawModeChange}
          onClearAll={() => clearAllRef.current?.(symbol)}
          lang={lang}
        />
      )}

      {/* ── Draw-mode hint ── */}
      {useInternal && drawMode && drawMode !== "erase" && (
        <div className="px-3 py-1 text-[11px] text-primary font-medium bg-primary/5 border-b border-primary/20 animate-pulse">
          {drawMode === "hline"
            ? (lang === "ko" ? "차트를 클릭해 수평선을 그으세요" : "Click on the chart to place a horizontal line")
            : (lang === "ko" ? "두 지점을 클릭하세요 (1/2)" : "Click two points on the chart (1/2)")}
        </div>
      )}
      {useInternal && drawMode === "erase" && (
        <div className="px-3 py-1 text-[11px] text-destructive font-medium bg-destructive/5 border-b border-destructive/20">
          {lang === "ko" ? "클릭하여 마지막 그리기 삭제" : "Click to remove last drawing"}
        </div>
      )}

      {/* ── Chart area ── */}
      <div className="relative w-full shrink-0" style={{ width: "100%", maxWidth: "100vw", minHeight: 350 }}>
        {isLoading && useInternal && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="flex items-center gap-1.5 bg-background/90 border border-border rounded-full px-3 py-1 text-[11px] shadow">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-muted-foreground font-medium">
                {lang === "ko" ? "이전 데이터 로드 중…" : "Loading earlier data…"}
              </span>
            </div>
          </div>
        )}

        {useInternal ? (
          <InfiniteScrollChart
            symbol={symbol} chartType={chartType} isDark={isDark}
            height={chartH} lang={lang} rangeKey={rangeKey}
            activeIndicators={activeInds}
            drawMode={drawMode}
            onDrawModeChange={handleDrawModeChange}
            onReturnRateChange={setReturnRate}
            onLoadingChange={setIsLoading}
          />
        ) : (
          <TVWithFallback
            symbol={symbol} periodKey={rangeKey}
            chartType={chartType} isDark={isDark}
            chartH={chartH} lang={lang}
            onSymbolChange={onSymbolChange}
            onFallback={() => setFallback(false)}
          />
        )}
      </div>

      {/* ── Footer: internal/external switch ── */}
      {!useInternal && (
        <div className="flex justify-end px-3 py-1 border-t border-border/30">
          <button onClick={() => setFallback(true)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            data-testid="button-use-internal-chart">
            {lang === "ko" ? "내부 차트로 전환" : "Switch to internal chart"}
          </button>
        </div>
      )}
    </div>
  );
}
