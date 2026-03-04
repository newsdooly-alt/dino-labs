import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TradingViewChart } from "./TradingViewChart";
import { LWChart, type LWCandlePoint } from "./LWChart";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";

// ── Time-range config ────────────────────────────────────────────────────────
interface RangeConfig {
  key: string;
  label: string;
  period: string;
  interval: string;
  extendBy: string; // when user hits start edge, extend by this period
}

const RANGES: RangeConfig[] = [
  { key: "1d",  label: "1D",  period: "5d",   interval: "5m",  extendBy: "5d"  },
  { key: "1w",  label: "1W",  period: "1mo",  interval: "1h",  extendBy: "1mo" },
  { key: "1m",  label: "1M",  period: "1mo",  interval: "1d",  extendBy: "1mo" },
  { key: "3m",  label: "3M",  period: "3mo",  interval: "1d",  extendBy: "3mo" },
  { key: "1y",  label: "1Y",  period: "1y",   interval: "1wk", extendBy: "1y"  },
  { key: "5y",  label: "5Y",  period: "5y",   interval: "1wk", extendBy: "5y"  },
  { key: "all", label: "ALL", period: "max",  interval: "1mo", extendBy: ""    },
];

function isGlobalExchange(symbol: string): boolean {
  return symbol.endsWith(".KS") || symbol.endsWith(".KQ") || symbol.endsWith(".T");
}

// ── Prop types ───────────────────────────────────────────────────────────────
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

// ── Return rate badge ─────────────────────────────────────────────────────────
function ReturnBadge({ data, lang }: { data: LWCandlePoint[]; lang: string }) {
  if (data.length < 2) return null;
  const first = data[0].close;
  const last  = data[data.length - 1].close;
  const pct   = ((last - first) / first) * 100;
  const isPos = pct >= 0;
  return (
    <span
      className={cn(
        "text-xs font-bold px-2 py-0.5 rounded-full",
        isPos
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/15 text-red-600 dark:text-red-400"
      )}
      data-testid="badge-return-rate"
    >
      {isPos ? "+" : ""}{pct.toFixed(2)}%
      <span className="font-normal opacity-70 ml-1">
        {lang === "ko" ? "기간수익" : "period"}
      </span>
    </span>
  );
}

// ── Time-range button strip ───────────────────────────────────────────────────
function RangeBar({
  active,
  onChange,
  data,
  lang,
}: {
  active: string;
  onChange: (key: string) => void;
  data: LWCandlePoint[];
  lang: string;
}) {
  return (
    <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-b border-border/40 bg-muted/20 flex-wrap">
      <div className="flex items-center gap-0.5 flex-wrap">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => onChange(r.key)}
            className={cn(
              "min-w-[44px] min-h-[36px] px-2.5 py-1 rounded-md text-xs font-bold transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              active === r.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            data-testid={`button-range-${r.key}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <ReturnBadge data={data} lang={lang} />
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function ChartSkeleton({ height, lang }: { height: number | string; lang: string }) {
  return (
    <div
      className="flex items-center justify-center bg-muted/10"
      style={typeof height === "number" ? { height } : { height, minHeight: 200 }}
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">{lang === "ko" ? "차트 로딩 중…" : "Loading chart…"}</span>
      </div>
    </div>
  );
}

// ── "Load more" indicator ─────────────────────────────────────────────────────
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

// ── Internal LW chart with infinite scroll ────────────────────────────────────
function LWChartFetcher(props: GlobalChartProps & { periodKey: string }) {
  const { symbol, periodKey, chartType = "candle", isDark = false,
          height = 400, lang = "en", className, fillContainer } = props;

  const { formatPrice, isKoreanStock, isJapaneseStock } = useCurrency();
  const isKr = isKoreanStock(symbol);
  const isJp = isJapaneseStock(symbol);
  const nativeCurrency = isKr ? "KRW" : isJp ? "JPY" : "USD";

  const range = RANGES.find(r => r.key === periodKey) ?? RANGES[2];

  // allData: accumulated candles (oldest → newest)
  const [allData, setAllData] = useState<LWCandlePoint[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const oldestDateRef = useRef<string | null>(null);
  const isLoadingMoreRef = useRef(false);
  const activePeriodRef = useRef(periodKey);

  // Fetch initial data when period changes
  const { data: freshData, isLoading } = useQuery<{ data: any[] }>({
    queryKey: [`/api/stocks/history/${symbol}`, range.period, range.interval],
    queryFn: async () => {
      const r = await fetch(
        `/api/stocks/history/${symbol}?period=${range.period}&interval=${range.interval}`
      );
      if (!r.ok) throw new Error("history fetch failed");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // When fresh data arrives or period changes, reset allData
  useEffect(() => {
    activePeriodRef.current = periodKey;
    if (!freshData?.data) return;
    const pts: LWCandlePoint[] = freshData.data.map((d: any) => ({
      date:   d.date,
      open:   d.open   ?? d.close,
      high:   d.high   ?? d.close,
      low:    d.low    ?? d.close,
      close:  d.close,
      volume: d.volume ?? 0,
    }));
    pts.sort((a, b) => a.date.localeCompare(b.date));
    setAllData(pts);
    oldestDateRef.current = pts[0]?.date ?? null;
  }, [freshData, periodKey]);

  // Infinite scroll: fetch older candles when user pans to the left edge
  const handleScrollToStart = useCallback(async () => {
    if (isLoadingMoreRef.current) return;
    if (range.extendBy === "") return;            // disabled for "all"
    if (!oldestDateRef.current) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const endDate = oldestDateRef.current.slice(0, 10);   // YYYY-MM-DD
      const endMs   = new Date(endDate).getTime();

      // Calculate start date = end - extendBy
      let startMs = endMs;
      const eb = range.extendBy;
      if      (eb === "5d")  startMs -= 5   * 86400000;
      else if (eb === "1mo") startMs -= 31  * 86400000;
      else if (eb === "3mo") startMs -= 92  * 86400000;
      else if (eb === "1y")  startMs -= 365 * 86400000;
      else if (eb === "5y")  startMs -= 5 * 365 * 86400000;
      else return;

      const startDate = new Date(startMs).toISOString().slice(0, 10);

      const resp = await fetch(
        `/api/stocks/history/${symbol}?start=${startDate}&end=${endDate}&interval=${range.interval}`
      );
      if (!resp.ok) return;
      const json = await resp.json();
      if (!json.data || json.data.length === 0) return;

      const older: LWCandlePoint[] = json.data.map((d: any) => ({
        date:   d.date,
        open:   d.open   ?? d.close,
        high:   d.high   ?? d.close,
        low:    d.low    ?? d.close,
        close:  d.close,
        volume: d.volume ?? 0,
      }));
      older.sort((a, b) => a.date.localeCompare(b.date));

      setAllData(prev => {
        const existingDates = new Set(prev.map(p => p.date));
        const newPts = older.filter(p => !existingDates.has(p.date));
        if (newPts.length === 0) return prev;
        const combined = [...newPts, ...prev];
        combined.sort((a, b) => a.date.localeCompare(b.date));
        oldestDateRef.current = combined[0]?.date ?? oldestDateRef.current;
        return combined;
      });
    } catch { /* silent */ } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [symbol, range.interval, range.extendBy]);

  const containerH = fillContainer
    ? "100%"
    : typeof height === "number"
      ? height
      : height;

  const chartH = typeof height === "number" ? height : 400;

  if (isLoading && allData.length === 0) {
    return <ChartSkeleton height={containerH} lang={lang} />;
  }

  if (allData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-xs"
        style={{ height: containerH }}
      >
        {lang === "ko" ? "차트 데이터 없음" : "No chart data available"}
      </div>
    );
  }

  return (
    <div
      className={cn("relative w-full overflow-hidden", className)}
      style={{ height: containerH, maxWidth: "100vw" }}
    >
      {isLoadingMore && <LoadMoreBar lang={lang} />}
      <LWChart
        data={allData}
        height={fillContainer ? undefined : chartH}
        isDark={isDark}
        nativeCurrency={nativeCurrency}
        formatPrice={(v) => formatPrice(v, { nativeCurrency })}
        chartType={chartType}
        showVolume
        showMA
        maPeriods={[20, 60]}
        lang={lang}
        isIntraday={periodKey === "1d"}
        onScrollToStart={handleScrollToStart}
      />
    </div>
  );
}

// ── TradingView wrapper with auto-fallback ────────────────────────────────────
function TVWithFallback(props: GlobalChartProps & { periodKey: string; onFallback: () => void }) {
  const { periodKey, chartType, isDark, height, lang, className,
          fillContainer, symbol, onSymbolChange, onFallback } = props;

  // Auto-fallback: if TV widget container remains empty after 12 s, switch
  const tvRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      const el = tvRef.current;
      if (!el) return;
      const iframe = el.querySelector("iframe");
      if (!iframe) onFallback();
    }, 12000);
    return () => clearTimeout(timer);
  }, [symbol, periodKey, onFallback]);

  const h = typeof height === "number" ? height : 500;

  return (
    <div ref={tvRef} className="w-full" style={{ maxWidth: "100vw" }}>
      <TradingViewChart
        symbol={symbol}
        periodKey={periodKey}
        chartType={chartType}
        isDark={isDark}
        height={h}
        lang={lang}
        className={className}
        fillContainer={fillContainer}
        onSymbolChange={onSymbolChange}
      />
      <div className="flex justify-end px-3 py-1.5 border-t border-border/30">
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

// ── Main exported component ───────────────────────────────────────────────────
export function GlobalChart(props: GlobalChartProps) {
  const {
    symbol,
    periodKey: initialPeriod = "1m",
    chartType = "candle",
    isDark = false,
    height = 400,
    lang = "en",
    className,
    fillContainer = false,
    onSymbolChange,
  } = props;

  const [activePeriod, setActivePeriod] = useState(initialPeriod);
  const [useFallback, setUseFallback]   = useState(false);

  // Sync external periodKey prop
  useEffect(() => { setActivePeriod(initialPeriod); }, [initialPeriod]);

  // When symbol changes, reset fallback flag
  useEffect(() => {
    setUseFallback(false);
    setActivePeriod(initialPeriod);
  }, [symbol]);

  // Decide chart engine: global exchanges (KS/KQ/T) always use LW
  const useInternalChart = isGlobalExchange(symbol) || useFallback;

  // For return rate we need actual data even for TV chart
  const range = RANGES.find(r => r.key === activePeriod) ?? RANGES[2];
  const { data: priceData } = useQuery<{ data: any[] }>({
    queryKey: [`/api/stocks/history/${symbol}`, range.period, range.interval],
    queryFn: async () => {
      const r = await fetch(
        `/api/stocks/history/${symbol}?period=${range.period}&interval=${range.interval}`
      );
      if (!r.ok) throw new Error("history fetch failed");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: true,
  });

  const pricePoints: LWCandlePoint[] = (priceData?.data ?? []).map((d: any) => ({
    date:   d.date,
    open:   d.open   ?? d.close,
    high:   d.high   ?? d.close,
    low:    d.low    ?? d.close,
    close:  d.close,
    volume: d.volume ?? 0,
  })).sort((a: LWCandlePoint, b: LWCandlePoint) => a.date.localeCompare(b.date));

  return (
    <div
      className={cn("flex flex-col w-full overflow-hidden", className)}
      style={{ maxWidth: "100vw" }}
    >
      <RangeBar
        active={activePeriod}
        onChange={setActivePeriod}
        data={pricePoints}
        lang={lang}
      />

      {useInternalChart ? (
        <LWChartFetcher
          {...props}
          periodKey={activePeriod}
          chartType={chartType}
          isDark={isDark}
          height={height}
          lang={lang}
          fillContainer={fillContainer}
          className={undefined}
        />
      ) : (
        <TVWithFallback
          {...props}
          periodKey={activePeriod}
          onFallback={() => setUseFallback(true)}
        />
      )}
    </div>
  );
}
