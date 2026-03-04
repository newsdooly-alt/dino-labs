import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    TradingView: any;
  }
}

// ── Symbol mapper ─────────────────────────────────────────────────────────────
export function toTVSymbol(symbol: string): string {
  if (symbol.endsWith(".KS") || symbol.endsWith(".KQ")) {
    return `KRX:${symbol.split(".")[0]}`;
  }
  if (symbol.endsWith(".T")) {
    return `TSE:${symbol.split(".")[0]}`;
  }
  const etfExchanges: Record<string, string> = {
    SPY: "AMEX", QQQ: "NASDAQ", IWM: "AMEX", GLD: "AMEX",
    SLV: "AMEX", TLT: "NASDAQ", VIX: "TVC",
  };
  if (etfExchanges[symbol]) return `${etfExchanges[symbol]}:${symbol}`;
  return symbol;
}

// ── Period → TradingView interval/range ───────────────────────────────────────
export function toTVConfig(periodKey: string): { interval: string; range: string } {
  switch (periodKey) {
    case "1d":  return { interval: "5",  range: "1D"  };
    case "1w":  return { interval: "15", range: "5D"  };
    case "1m":  return { interval: "D",  range: "1M"  };
    case "3m":  return { interval: "D",  range: "3M"  };
    case "1y":  return { interval: "W",  range: "12M" };
    case "5y":  return { interval: "W",  range: "60M" };
    case "all": return { interval: "M",  range: "ALL" };
    default:    return { interval: "D",  range: "1M"  };
  }
}

// ── Chart style mapper ────────────────────────────────────────────────────────
export function toTVStyle(chartType: "candle" | "area" | "line"): string {
  if (chartType === "area")  return "3";
  if (chartType === "line")  return "2";
  return "1"; // candles
}

// ── Script loader (singleton) ─────────────────────────────────────────────────
let tvLoaded = false;
let tvCallbacks: (() => void)[] = [];

function ensureTVScript(cb: () => void) {
  if (typeof window === "undefined") return;
  if (window.TradingView) { cb(); return; }
  tvCallbacks.push(cb);
  if (!tvLoaded) {
    tvLoaded = true;
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    s.onload = () => {
      tvCallbacks.forEach(fn => fn());
      tvCallbacks = [];
    };
    document.head.appendChild(s);
  }
}

let _counter = 0;

// ── Component ─────────────────────────────────────────────────────────────────
export interface TradingViewChartProps {
  symbol: string;
  periodKey?: string;
  chartType?: "candle" | "area" | "line";
  isDark?: boolean;
  height?: number | string;
  lang?: string;
  className?: string;
  fillContainer?: boolean;
}

export function TradingViewChart({
  symbol,
  periodKey = "1m",
  chartType = "candle",
  isDark = false,
  height = 500,
  lang = "en",
  className,
  fillContainer = false,
}: TradingViewChartProps) {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const idRef    = useRef(`tv_${++_counter}`);
  const cleanRef = useRef(false);

  useEffect(() => {
    cleanRef.current = false;
    const wrap = wrapRef.current;
    if (!wrap) return;

    const id = idRef.current;
    wrap.innerHTML = "";

    const inner = document.createElement("div");
    inner.id = id;
    inner.style.width = "100%";
    inner.style.height = "100%";
    wrap.appendChild(inner);

    const tvSym = toTVSymbol(symbol);
    const { interval, range } = toTVConfig(periodKey);
    const style = toTVStyle(chartType);

    const create = () => {
      if (cleanRef.current || !inner.isConnected) return;
      new window.TradingView.widget({
        container_id: id,
        autosize: true,
        symbol: tvSym,
        interval,
        range,
        timezone: "America/New_York",
        theme: isDark ? "dark" : "light",
        style,
        locale: lang === "ko" ? "ko" : "en",
        toolbar_bg: isDark ? "#0f172a" : "#f9fafb",

        withdateranges:     true,
        hide_top_toolbar:   false,
        hide_side_toolbar:  false,
        hide_legend:        false,
        allow_symbol_change: true,
        save_image:         false,
        enable_publishing:  false,

        studies: ["Volume@tv-basicstudies"],

        studies_overrides: {
          "volume.volume.color.0":      "#ef4444",
          "volume.volume.color.1":      "#22c55e",
          "volume.volume ma.visible":   false,
          "volume.show ma":             false,
        },

        overrides: {
          "mainSeriesProperties.showCountdown": true,
          "paneProperties.backgroundType":       isDark ? "solid" : "solid",
          "paneProperties.background":           isDark ? "#0f172a" : "#ffffff",
          "paneProperties.gridLinesMode":        1,
          "paneProperties.horzGridProperties.color": isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
          "paneProperties.vertGridProperties.color": isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
          "scalesProperties.showStudyLastValue":  true,
        },
      });
    };

    ensureTVScript(create);

    return () => {
      cleanRef.current = true;
      if (wrap) wrap.innerHTML = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, periodKey, chartType, isDark, lang]);

  const heightStyle = fillContainer
    ? { height: "100%", minHeight: 0 }
    : typeof height === "string"
      ? { height, minHeight: 240 }
      : { height, minHeight: height };

  return (
    <div
      ref={wrapRef}
      className={cn("w-full overflow-hidden", className)}
      style={heightStyle}
    />
  );
}
