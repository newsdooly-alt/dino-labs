import { useState, useEffect, useRef, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  AreaSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
  type CandlestickData,
  type LineData,
  type AreaData,
} from "lightweight-charts";
import { TradingViewChart } from "./TradingViewChart";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";

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
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Range config ──────────────────────────────────────────────────────────────
// daysBack: how many calendar days to show in the viewport when clicked
// fetchPeriod/Interval: what to ask the API for
// isIntraday: whether to use intraday (5m) data
const RANGES = [
  { key: "1d",  label: "1D",  daysBack: 1,    fetchPeriod: "5d",  fetchInterval: "5m",  isIntraday: true  },
  { key: "1w",  label: "1W",  daysBack: 7,    fetchPeriod: "2y",  fetchInterval: "1d",  isIntraday: false },
  { key: "1m",  label: "1M",  daysBack: 30,   fetchPeriod: "2y",  fetchInterval: "1d",  isIntraday: false },
  { key: "3m",  label: "3M",  daysBack: 90,   fetchPeriod: "2y",  fetchInterval: "1d",  isIntraday: false },
  { key: "1y",  label: "1Y",  daysBack: 365,  fetchPeriod: "5y",  fetchInterval: "1d",  isIntraday: false },
  { key: "5y",  label: "5Y",  daysBack: 1825, fetchPeriod: "max", fetchInterval: "1wk", isIntraday: false },
  { key: "all", label: "ALL", daysBack: 99999,fetchPeriod: "max", fetchInterval: "1wk", isIntraday: false },
] as const;

// How many days to fetch per "load more" chunk, keyed by interval
const FETCH_CHUNK_DAYS: Record<string, number> = {
  "5m":  7,     // 1 week of intraday
  "1d":  3650,  // ~10 years of daily
  "1wk": 18250, // ~50 years of weekly
  "1mo": 18250,
};

type RangeKey = typeof RANGES[number]["key"];

function isGlobalExchange(symbol: string) {
  return symbol.endsWith(".KS") || symbol.endsWith(".KQ") || symbol.endsWith(".T");
}

function toUTC(dateStr: string): UTCTimestamp {
  return Math.floor(new Date(dateStr).getTime() / 1000) as UTCTimestamp;
}

function cloneRange(r: { from: number | string; to: number | string } | null) {
  return r ? { from: r.from, to: r.to } : null;
}

// ── Fetch helper ──────────────────────────────────────────────────────────────
async function fetchCandles(
  symbol: string,
  opts: { period?: string; interval: string; start?: string; end?: string }
): Promise<CandlePoint[]> {
  let url = `/api/stocks/history/${symbol}?interval=${opts.interval}`;
  if (opts.start) {
    url += `&start=${opts.start}`;
    if (opts.end) url += `&end=${opts.end}`;
  } else {
    url += `&period=${opts.period ?? "1y"}`;
  }
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const json = await resp.json();
  const raw: CandlePoint[] = (json.data ?? []).map((d: any) => ({
    date:   d.date,
    open:   d.open   ?? d.close,
    high:   d.high   ?? d.close,
    low:    d.low    ?? d.close,
    close:  d.close,
    volume: d.volume ?? 0,
  }));
  raw.sort((a, b) => a.date.localeCompare(b.date));
  return raw;
}

// ── LoadMoreBar ───────────────────────────────────────────────────────────────
function LoadMoreBar({ lang }: { lang: string }) {
  return (
    <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
      <div className="flex items-center gap-1.5 bg-background/90 border border-border rounded-full px-3 py-1 text-[11px] shadow">
        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-muted-foreground font-medium">
          {lang === "ko" ? "이전 데이터 로드 중…" : "Loading earlier data…"}
        </span>
      </div>
    </div>
  );
}

// ── ReturnBadge ───────────────────────────────────────────────────────────────
function ReturnBadge({ pct, lang }: { pct: number | null; lang: string }) {
  if (pct === null) return null;
  const isPos = pct >= 0;
  return (
    <span
      className={cn(
        "text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap",
        isPos
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/15 text-red-600 dark:text-red-400"
      )}
      data-testid="badge-return-rate"
    >
      {isPos ? "+" : ""}{pct.toFixed(2)}%
      <span className="font-normal opacity-70 ml-1">
        {lang === "ko" ? "기간" : "visible"}
      </span>
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// InfiniteScrollChart — Persistent LightweightCharts instance
// The chart is NEVER re-mounted when data changes or range buttons are clicked.
// All interactions are imperative via refs.
// ══════════════════════════════════════════════════════════════════════════════
interface InfiniteScrollChartProps {
  symbol: string;
  chartType: "candle" | "area" | "line";
  isDark: boolean;
  height: number;
  lang: string;
  rangeKey: RangeKey;
  onReturnRateChange: (pct: number | null) => void;
  onLoadingChange: (loading: boolean) => void;
}

function InfiniteScrollChart({
  symbol, chartType, isDark, height, lang, rangeKey,
  onReturnRateChange, onLoadingChange,
}: InfiniteScrollChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Chart instances — created once, updated imperatively
  const chartRef       = useRef<IChartApi | null>(null);
  const mainSeriesRef  = useRef<ISeriesApi<SeriesType> | null>(null);
  const volSeriesRef   = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Data buffer
  const allDataRef        = useRef<CandlePoint[]>([]);
  const intradayRef       = useRef(false);       // true while intraday (5m) data is loaded
  const loadedRangeRef    = useRef<string>("");  // tracks which range data is buffered
  const currentIntervalRef= useRef<string>("1d");// interval of the currently buffered data
  const oldestDateRef     = useRef<string>("");  // oldest date fetched (for "no more data" guard)

  // Guards
  const fetchingMoreRef   = useRef(false);
  const noMoreOldDataRef  = useRef(false);       // true when we hit IPO / start of history
  const initialLoadingRef = useRef(false);

  // Keep latest callbacks in refs (avoid stale closures inside chart event handlers)
  const onReturnRateRef = useRef(onReturnRateChange);
  onReturnRateRef.current = onReturnRateChange;
  const onLoadingRef = useRef(onLoadingChange);
  onLoadingRef.current = onLoadingChange;
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  const { formatPrice, isKoreanStock, isJapaneseStock } = useCurrency();
  const isKr = isKoreanStock(symbol);
  const isJp = isJapaneseStock(symbol);
  const nativeCurrency = isKr ? "KRW" : isJp ? "JPY" : "USD";
  const formatPriceRef = useRef(formatPrice);
  formatPriceRef.current = formatPrice;

  // ── Imperative: write data to chart series while preserving the viewport ──
  const applyData = useCallback((
    data: CandlePoint[],
    preserveViewport: boolean,
    afterApply?: () => void,
  ) => {
    const chart = chartRef.current;
    const main  = mainSeriesRef.current;
    const vol   = volSeriesRef.current;
    if (!chart || !main) return;

    // Save current visible time range
    const saved = preserveViewport ? cloneRange(chart.timeScale().getVisibleRange()) : null;

    // Update main series
    if (chartType === "candle") {
      main.setData(data.map(d => ({
        time:  toUTC(d.date),
        open:  d.open,
        high:  d.high,
        low:   d.low,
        close: d.close,
      } as CandlestickData)));
    } else {
      main.setData(data.map(d => ({
        time:  toUTC(d.date),
        value: d.close,
      } as LineData)));
    }

    // Update volume series
    vol?.setData(data.map(d => ({
      time:  toUTC(d.date),
      value: d.volume,
      color: d.close >= d.open ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)",
    })));

    // Restore / apply viewport
    requestAnimationFrame(() => {
      try {
        if (saved) {
          chart.timeScale().setVisibleRange(saved as any);
        }
        afterApply?.();
      } catch { /* range might be outside new data – ignore */ }
    });
  }, [chartType]);

  // ── Imperative: zoom visible range to N days back from now ────────────────
  const zoomToDays = useCallback((daysBack: number) => {
    const chart = chartRef.current;
    if (!chart) return;
    if (daysBack >= 99000) {
      chart.timeScale().fitContent();
      return;
    }
    const now  = Math.floor(Date.now() / 1000) as UTCTimestamp;
    const from = (now - daysBack * 86400) as UTCTimestamp;
    try { chart.timeScale().setVisibleRange({ from, to: now }); } catch {}
  }, []);

  // ── Load initial data for a given range ──────────────────────────────────
  const loadForRange = useCallback(async (key: RangeKey) => {
    const range = RANGES.find(r => r.key === key)!;
    if (initialLoadingRef.current) return;
    initialLoadingRef.current = true;
    onLoadingRef.current(true);

    try {
      const data = await fetchCandles(symbolRef.current, {
        period: range.fetchPeriod,
        interval: range.fetchInterval,
      });
      if (data.length === 0) return;
      allDataRef.current = data;
      intradayRef.current = range.isIntraday;
      loadedRangeRef.current = key;
      currentIntervalRef.current = range.fetchInterval;
      noMoreOldDataRef.current = false;
      oldestDateRef.current = data[0]?.date?.slice(0, 10) ?? "";

      // Update time scale visibility for intraday mode
      chartRef.current?.applyOptions({
        timeScale: { timeVisible: range.isIntraday, secondsVisible: false },
      });

      applyData(data, false, () => zoomToDays(range.daysBack));
    } finally {
      initialLoadingRef.current = false;
      onLoadingRef.current(false);
    }
  }, [applyData, zoomToDays]);

  // ── Handle range button click ────────────────────────────────────────────
  const rangeKeyRef = useRef(rangeKey);
  useEffect(() => {
    const prevKey = rangeKeyRef.current;
    rangeKeyRef.current = rangeKey;

    const range     = RANGES.find(r => r.key === rangeKey)!;
    const prevRange = RANGES.find(r => r.key === prevKey)!;

    // Reload if: no data, intraday changed, or interval changed (mixing bars is forbidden)
    const intervalChanged = range.fetchInterval !== currentIntervalRef.current;
    const needsNewData =
      allDataRef.current.length === 0 ||
      range.isIntraday !== prevRange.isIntraday ||
      intervalChanged ||
      (range.key === "all" && loadedRangeRef.current !== "all" && loadedRangeRef.current !== "5y");

    if (needsNewData) {
      loadForRange(rangeKey);
    } else {
      // Just zoom — data already in buffer
      zoomToDays(range.daysBack);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  // ── When symbol changes: reset buffer and reload ─────────────────────────
  useEffect(() => {
    allDataRef.current = [];
    loadedRangeRef.current = "";
    currentIntervalRef.current = "1d";
    noMoreOldDataRef.current = false;
    oldestDateRef.current = "";
    loadForRange(rangeKeyRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // ── Fetch older data (infinite scroll handler) ─────────────────────────
  const fetchOlderData = useCallback(async () => {
    if (fetchingMoreRef.current || noMoreOldDataRef.current) return;
    const data = allDataRef.current;
    if (data.length === 0) return;

    fetchingMoreRef.current = true;
    onLoadingRef.current(true);

    try {
      // Use the SAME interval as the currently buffered data to avoid bar-width mixing
      const interval   = intradayRef.current ? "5m" : currentIntervalRef.current;
      const chunkDays  = FETCH_CHUNK_DAYS[interval] ?? 3650;

      const oldestDate = data[0].date.slice(0, 10);
      const endMs      = new Date(oldestDate).getTime();
      const startMs    = endMs - chunkDays * 86400000;
      const startDate  = new Date(startMs).toISOString().slice(0, 10);

      const older = await fetchCandles(symbolRef.current, {
        interval,
        start: startDate,
        end:   oldestDate,
      });

      if (older.length === 0) {
        // No data before this date — assume we've reached the IPO
        noMoreOldDataRef.current = true;
        return;
      }

      // Deduplicate by first 10 chars of date (handles timezone offsets in date strings)
      const existingDates = new Set(data.map(d => d.date.slice(0, 10)));
      const fresh = older.filter(d => !existingDates.has(d.date.slice(0, 10)));
      if (fresh.length === 0) {
        noMoreOldDataRef.current = true;
        return;
      }

      const combined = [...fresh, ...data];
      combined.sort((a, b) => a.date.localeCompare(b.date));
      allDataRef.current = combined;

      // Update chart data while preserving the current viewport
      applyData(combined, true);
    } finally {
      fetchingMoreRef.current = false;
      onLoadingRef.current(false);
    }
  }, [applyData]);

  // ── Create the chart (only when isDark / chartType / height changes) ──────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const textC   = isDark ? "#9ca3af" : "#6b7280";
    const gridC   = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
    const borderC = isDark ? "#1e293b" : "#e5e7eb";
    const bgC     = isDark ? "#0f172a" : "#ffffff";

    const chart = createChart(container, {
      width:  container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: textC,
      },
      grid: {
        vertLines: { color: gridC },
        horzLines: { color: gridC },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: borderC },
      timeScale: {
        borderColor: borderC,
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
        minBarSpacing: 2,        // prevent bars from collapsing on long histories
      },
      // Zoom via mouse wheel, pan via drag — same on mobile (pinch / touch-drag)
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale:  { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });
    chartRef.current = chart;

    // ── Main series ──────────────────────────────────────────────────────
    let main: ISeriesApi<SeriesType>;
    if (chartType === "candle") {
      main = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",   downColor: "#ef4444",
        borderUpColor: "#22c55e", borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",   wickDownColor: "#ef4444",
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

    // Scale margins so volume bars don't overlap candles; autoScale: re-fits Y as user pans
    chart.priceScale("right").applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.18 },
      autoScale: true,
    });

    // ── Volume series ─────────────────────────────────────────────────────
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.84, bottom: 0 },
      drawTicks: false,
      borderVisible: false,
    });
    volSeriesRef.current = vol;

    // ── Tooltip overlay ───────────────────────────────────────────────────
    const tooltip = document.createElement("div");
    tooltip.style.cssText = `
      position:absolute;display:none;pointer-events:none;
      background:${isDark ? "rgba(15,23,42,0.96)" : "rgba(255,255,255,0.97)"};
      border:1px solid ${isDark ? "#334155" : "#e5e7eb"};
      border-radius:8px;padding:8px 12px;z-index:50;
      box-shadow:0 4px 16px rgba(0,0,0,0.15);min-width:140px;max-width:210px;
      color:${isDark ? "#e5e7eb" : "#111827"};font-family:inherit;
    `;
    container.style.position = "relative";
    container.appendChild(tooltip);

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        tooltip.style.display = "none";
        return;
      }
      const data = allDataRef.current;
      const ts   = Number(param.time);
      const idx  = data.findIndex(d => Math.abs(toUTC(d.date) - ts) <= 60);
      if (idx < 0) { tooltip.style.display = "none"; return; }

      const d     = data[idx];
      const isUp  = d.close >= d.open;
      const prev  = idx > 0 ? data[idx - 1].close : d.close;
      const pct   = prev > 0 ? ((d.close - prev) / prev) * 100 : 0;
      const fp    = (v: number) => formatPriceRef.current(v, { nativeCurrency });
      const tc    = isDark ? "#9ca3af" : "#6b7280";
      const fc    = isDark ? "#e5e7eb" : "#111827";
      const pc    = isUp ? "#22c55e" : "#ef4444";
      const ko    = lang === "ko";

      const dateStr = intradayRef.current
        ? new Date(d.date).toLocaleTimeString(ko ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
        : new Date(d.date).toLocaleDateString(ko ? "ko-KR" : "en-US", { month: "short", day: "numeric", year: "numeric" });

      let html = `<div style="font-size:10px;color:${tc};margin-bottom:4px;font-weight:600">${dateStr}</div>`;
      html += `<div style="display:grid;grid-template-columns:auto 1fr;gap:1px 10px;font-size:11px">`;
      html += `<span style="color:${tc}">${ko ? "시가" : "O"}</span><span style="color:${fc};font-weight:600;text-align:right">${fp(d.open)}</span>`;
      html += `<span style="color:${tc}">${ko ? "고가" : "H"}</span><span style="color:#22c55e;font-weight:600;text-align:right">${fp(d.high)}</span>`;
      html += `<span style="color:${tc}">${ko ? "저가" : "L"}</span><span style="color:#ef4444;font-weight:600;text-align:right">${fp(d.low)}</span>`;
      html += `<span style="color:${tc}">${ko ? "종가" : "C"}</span><span style="color:${pc};font-weight:700;text-align:right">${fp(d.close)}<span style="font-size:9.5px;opacity:.8"> (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)</span></span>`;
      html += `</div>`;
      if (d.volume > 0) {
        const v = d.volume >= 1e9 ? `${(d.volume/1e9).toFixed(1)}B` : d.volume >= 1e6 ? `${(d.volume/1e6).toFixed(1)}M` : `${(d.volume/1e3).toFixed(0)}K`;
        html += `<div style="font-size:10px;color:${tc};margin-top:3px">${ko ? "거래량" : "Vol"}: <span style="color:${fc}">${v}</span></div>`;
      }
      tooltip.innerHTML = html;
      tooltip.style.display = "block";

      const rect = container.getBoundingClientRect();
      const ttW  = 160;
      let left   = param.point.x + 14;
      if (left + ttW > rect.width) left = param.point.x - ttW - 8;
      tooltip.style.left = `${Math.max(0, left)}px`;
      tooltip.style.top  = `${Math.max(4, param.point.y - 44)}px`;
    });

    // ── Left-edge detection → infinite scroll ────────────────────────────
    // Trigger at <= 20 bars from the left edge (fires well before user hits empty space on mobile)
    let edgeFired = false;
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range && range.from <= 20 && !edgeFired && !fetchingMoreRef.current && !noMoreOldDataRef.current) {
        edgeFired = true;
        fetchOlderData().finally(() => { edgeFired = false; });
      }
    });

    // ── Dynamic return rate based on VISIBLE range ───────────────────────
    chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
      if (!range || allDataRef.current.length === 0) {
        onReturnRateRef.current(null);
        return;
      }
      const fromMs = Number(range.from) * 1000;
      const toMs   = Number(range.to)   * 1000;
      const visible = allDataRef.current.filter(d => {
        const ts = new Date(d.date).getTime();
        return ts >= fromMs && ts <= toMs;
      });
      if (visible.length >= 2) {
        const first = visible[0].close;
        const last  = visible[visible.length - 1].close;
        onReturnRateRef.current(((last - first) / first) * 100);
      } else {
        onReturnRateRef.current(null);
      }
    });

    // ── ResizeObserver ────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      if (w > 0) chart.applyOptions({ width: w });
    });
    ro.observe(container);

    // Reload data into the new chart instance
    if (allDataRef.current.length > 0) {
      applyData(allDataRef.current, false, () => {
        const range = RANGES.find(r => r.key === rangeKeyRef.current)!;
        zoomToDays(range.daysBack);
      });
    } else {
      loadForRange(rangeKeyRef.current);
    }

    return () => {
      tooltip.remove();
      ro.disconnect();
      chart.remove();
      chartRef.current      = null;
      mainSeriesRef.current = null;
      volSeriesRef.current  = null;
    };
  // Only recreate on theme / chart type / size changes — NOT on data or range
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark, chartType, height]);

  return (
    <div
      ref={containerRef}
      className="w-full select-none"
      style={{ height, maxWidth: "100vw", touchAction: "none" }}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TradingView wrapper — no auto-timeout, explicit stable height
// ══════════════════════════════════════════════════════════════════════════════
function TVWithFallback({
  symbol, periodKey, chartType, isDark, chartH, lang, fillContainer, onSymbolChange, onFallback,
}: {
  symbol: string; periodKey: string; chartType: "candle" | "area" | "line";
  isDark: boolean; chartH: number; lang: string; fillContainer?: boolean;
  onSymbolChange?: (s: string) => void; onFallback: () => void;
}) {
  return (
    <div className="w-full flex flex-col" style={{ maxWidth: "100vw" }}>
      {/* Explicit stable container — autosize: true reads this size */}
      <div style={{ width: "100%", height: chartH, minHeight: 350, flexShrink: 0 }}>
        <TradingViewChart
          symbol={symbol} periodKey={periodKey} chartType={chartType}
          isDark={isDark} height={chartH} lang={lang}
          fillContainer={true}
          onSymbolChange={onSymbolChange}
        />
      </div>
      <div className="flex justify-end px-3 py-1 border-t border-border/30 shrink-0">
        <button
          onClick={onFallback}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          data-testid="button-use-internal-chart"
        >
          {lang === "ko" ? "내부 차트로 전환" : "Switch to internal chart"}
        </button>
      </div>
    </div>
  );
}

// ── Responsive chart height hook ──────────────────────────────────────────────
// 500px on desktop (≥ 640px), 400px on mobile — with 350px hard floor
function useChartHeight(heightProp?: number | string): number {
  const getH = () => {
    if (typeof window === "undefined") return 500;
    return window.innerWidth >= 640 ? 500 : 400;
  };
  const [h, setH] = useState<number>(
    typeof heightProp === "number" ? heightProp : getH()
  );
  useEffect(() => {
    if (typeof heightProp === "number") return; // parent override wins
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
  symbol,
  periodKey: initialPeriod = "1m",
  chartType  = "candle",
  isDark     = false,
  height,                    // optional override; defaults to responsive 400/500px
  lang       = "en",
  className,
  fillContainer = false,
  onSymbolChange,
}: GlobalChartProps) {
  const [rangeKey, setRangeKey]     = useState<RangeKey>(initialPeriod as RangeKey);
  const [useFallback, setFallback]  = useState(false);
  const [returnRate, setReturnRate] = useState<number | null>(null);
  const [isLoading, setIsLoading]   = useState(false);

  // Sync external periodKey prop
  useEffect(() => { setRangeKey(initialPeriod as RangeKey); }, [initialPeriod]);
  // Reset fallback when symbol changes
  useEffect(() => { setFallback(false); }, [symbol]);

  // Smart routing: KS/KQ/T → always internal (TradingView restricts them)
  // All others → TradingView first; manual "Switch" button available
  const useInternal = isGlobalExchange(symbol) || useFallback;

  // Responsive height: 500px desktop / 400px mobile, 350px minimum
  const chartH = useChartHeight(height);

  return (
    <div className={cn("flex flex-col w-full overflow-hidden", className)} style={{ maxWidth: "100vw" }}>
      {/* ── Range buttons + return rate ── */}
      <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-b border-border/40 bg-muted/20 flex-wrap shrink-0">
        <div className="flex items-center gap-0.5 flex-wrap">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRangeKey(r.key as RangeKey)}
              className={cn(
                "min-w-[40px] min-h-[36px] px-2.5 py-1 rounded-md text-xs font-bold transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                rangeKey === r.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              data-testid={`button-range-${r.key}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
          <ReturnBadge pct={returnRate} lang={lang} />
        </div>
      </div>

      {/* ── Chart area — explicit stable dimensions, no flex shrink ── */}
      <div
        className="relative w-full shrink-0"
        style={{ width: "100%", maxWidth: "100vw", minHeight: 350 }}
      >
        {/* Infinite scroll loading bar (internal chart only) */}
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
            symbol={symbol}
            chartType={chartType}
            isDark={isDark}
            height={chartH}
            lang={lang}
            rangeKey={rangeKey}
            onReturnRateChange={setReturnRate}
            onLoadingChange={setIsLoading}
          />
        ) : (
          <TVWithFallback
            symbol={symbol}
            periodKey={rangeKey}
            chartType={chartType}
            isDark={isDark}
            chartH={chartH}
            lang={lang}
            fillContainer={fillContainer}
            onSymbolChange={onSymbolChange}
            onFallback={() => setFallback(true)}
          />
        )}
      </div>
    </div>
  );
}
