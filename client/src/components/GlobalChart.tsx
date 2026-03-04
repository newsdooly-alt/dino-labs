import { useQuery } from "@tanstack/react-query";
import { TradingViewChart } from "./TradingViewChart";
import { LWChart, type LWCandlePoint } from "./LWChart";
import { useCurrency } from "@/contexts/CurrencyContext";

interface GlobalChartProps {
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

const PERIOD_MAP: Record<string, { period: string; interval: string }> = {
  "1d": { period: "5d",   interval: "5m"  },
  "1w": { period: "1mo",  interval: "1h"  },
  "1m": { period: "1mo",  interval: "1d"  },
  "3m": { period: "3mo",  interval: "1d"  },
  "1y": { period: "1y",   interval: "1wk" },
  "5y": { period: "5y",   interval: "1wk" },
  "all":{ period: "max",  interval: "1mo" },
};

function isGlobalExchange(symbol: string): boolean {
  return (
    symbol.endsWith(".KS") ||
    symbol.endsWith(".KQ") ||
    symbol.endsWith(".T")
  );
}

function LWChartFetcher({
  symbol,
  periodKey = "1m",
  chartType = "candle",
  isDark = false,
  height,
  lang = "en",
  className,
  fillContainer,
}: GlobalChartProps) {
  const { formatPrice, isKoreanStock, isJapaneseStock } = useCurrency();
  const isKr = isKoreanStock(symbol);
  const isJp = isJapaneseStock(symbol);
  const nativeCurrency = isKr ? "KRW" : isJp ? "JPY" : "USD";

  const { period, interval } = PERIOD_MAP[periodKey] ?? PERIOD_MAP["1m"];

  const { data: histData, isLoading } = useQuery<{ data: any[] }>({
    queryKey: [`/api/stocks/history/${symbol}`, period, interval],
    queryFn: async () => {
      const r = await fetch(`/api/stocks/history/${symbol}?period=${period}&interval=${interval}`);
      if (!r.ok) throw new Error("history fetch failed");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const chartData: LWCandlePoint[] = (histData?.data ?? []).map((d: any) => ({
    date: d.date,
    open:   d.open   ?? d.close,
    high:   d.high   ?? d.close,
    low:    d.low    ?? d.close,
    close:  d.close,
    volume: d.volume ?? 0,
  }));

  const containerStyle = fillContainer
    ? { height: "100%", width: "100%", minHeight: 0 }
    : typeof height === "string"
      ? { height, width: "100%" }
      : { height: height ?? 400, width: "100%" };

  if (isLoading) {
    return (
      <div
        className={className}
        style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">{lang === "ko" ? "차트 로딩 중..." : "Loading chart..."}</span>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div
        className={className}
        style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span className="text-xs text-muted-foreground">
          {lang === "ko" ? "차트 데이터 없음" : "No chart data available"}
        </span>
      </div>
    );
  }

  const chartHeight = fillContainer
    ? undefined
    : typeof height === "number"
      ? height
      : 400;

  return (
    <div className={className} style={containerStyle}>
      <LWChart
        data={chartData}
        height={chartHeight}
        isDark={isDark}
        nativeCurrency={nativeCurrency}
        formatPrice={(v) => formatPrice(v, { nativeCurrency })}
        chartType={chartType}
        showVolume
        showMA
        maPeriods={[20, 60]}
        lang={lang}
        isIntraday={periodKey === "1d"}
      />
    </div>
  );
}

export function GlobalChart(props: GlobalChartProps) {
  if (isGlobalExchange(props.symbol)) {
    return <LWChartFetcher {...props} />;
  }
  return <TradingViewChart {...props} />;
}
