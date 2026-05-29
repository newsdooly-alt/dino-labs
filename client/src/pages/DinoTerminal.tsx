import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart,
  ReferenceLine
} from "recharts";
import {
  Search, RefreshCw, TrendingUp, TrendingDown, ChevronRight,
  Newspaper, Bot, Star, BarChart2, Zap, Flame, Activity,
  Globe, DollarSign, Calendar, ExternalLink, ArrowUpRight,
  ArrowDownRight, MonitorPlay, Shield, Cpu, Radio, Briefcase
} from "lucide-react";

// ══════════════════════════════════════════════════════════════════════════════
// TERMINAL THEME CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════
const T = {
  bg: "#0a0e14",
  panel: "#0f1620",
  panel2: "#111a26",
  border: "#1e2d40",
  borderHover: "#2a3f58",
  text: "#c8d3e0",
  muted: "#566880",
  up: "#00c896",
  down: "#ff4757",
  info: "#3d9bff",
  yellow: "#ffc107",
  header: "#080c12",
};

const UP = "text-[#00c896]";
const DOWN = "text-[#ff4757]";
const INFO = "text-[#3d9bff]";
const MUTED = "text-[#566880]";

// ══════════════════════════════════════════════════════════════════════════════
// DATA CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════
const WATCH_SYMS = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "005930.KS", "^KS11", "^IXIC", "BTC-USD", "GC=F", "JPY=X"];
const WATCH_NAMES: Record<string, string> = {
  "AAPL": "Apple", "NVDA": "NVIDIA", "TSLA": "Tesla", "MSFT": "Microsoft",
  "AMZN": "Amazon", "META": "Meta", "005930.KS": "삼성전자",
  "^KS11": "KOSPI", "^IXIC": "NASDAQ", "BTC-USD": "Bitcoin",
  "GC=F": "Gold", "JPY=X": "USD/JPY",
};
const INDEX_SYMS = ["SPY", "QQQ", "^KS11", "^IXIC", "GC=F", "CL=F", "BTC-USD", "JPY=X"];
const INDEX_LBL: Record<string, string> = {
  "SPY": "SPY", "QQQ": "QQQ", "^KS11": "KOSPI", "^IXIC": "NDX",
  "GC=F": "GOLD", "CL=F": "OIL", "BTC-USD": "BTC", "JPY=X": "¥",
};

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════
function fmtPrice(v: number | undefined, sym?: string): string {
  if (v == null) return "—";
  if (sym === "BTC-USD") return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (sym?.includes(".KS") || sym === "^KS11") return Math.round(v).toLocaleString();
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtChange(v: number | undefined): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtVol(v: number | undefined): string {
  if (!v) return "—";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}
function fmtMktCap(v: number | undefined): string {
  if (!v) return "—";
  if (v >= 1_000_000_000_000) return `$${(v / 1_000_000_000_000).toFixed(2)}T`;
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
  return `$${v}`;
}
function isUp(pct?: number) { return (pct || 0) >= 0; }

// ══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ══════════════════════════════════════════════════════════════════════════════
function useLivePrices(symbols: string[]) {
  return useQuery<any>({
    queryKey: ["/api/stocks/live", symbols.join(",")],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live?symbols=${symbols.join(",")}`);
      return res.json();
    },
    refetchInterval: 12000,
    staleTime: 8000,
  });
}

function useHistory(symbol: string, period = "1mo") {
  return useQuery<any[]>({
    queryKey: ["/api/stocks/history", symbol, period],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/history/${encodeURIComponent(symbol)}?period=${period}&interval=1d`);
      const data = await res.json();
      if (Array.isArray(data)) return data;
      return data?.history || data?.data || [];
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });
}

function useFundamentals(symbol: string) {
  return useQuery<any>({
    queryKey: ["/api/stocks/live", symbol, "single"],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live/${encodeURIComponent(symbol)}`);
      return res.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
    enabled: !!symbol,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// CLOCK
// ══════════════════════════════════════════════════════════════════════════════
function TerminalClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const kst = t.toLocaleTimeString("ko-KR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "Asia/Seoul", hour12: false
  });
  const us = t.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "America/New_York"
  });
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
      <span className={MUTED}>KST</span>
      <span style={{ color: T.text }}>{kst}</span>
      <span className="w-px h-3 bg-[#1e2d40]" />
      <span className={MUTED}>NY</span>
      <span style={{ color: T.text }}>{us}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INDEX TICKER STRIP
// ══════════════════════════════════════════════════════════════════════════════
function IndexStrip() {
  const { data } = useLivePrices(INDEX_SYMS);
  const stocks = data?.stocks || {};
  const items = [...INDEX_SYMS, ...INDEX_SYMS];

  return (
    <div
      className="flex items-center overflow-hidden border-b"
      style={{ background: T.header, borderColor: T.border, height: 26 }}
    >
      <div className="flex items-center gap-5 animate-[ticker_25s_linear_infinite] whitespace-nowrap px-3">
        {items.map((sym, i) => {
          const s = stocks[sym];
          const up = isUp(s?.changePercent);
          return (
            <span key={`${sym}-${i}`} className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-mono" style={{ color: T.muted }}>{INDEX_LBL[sym]}</span>
              <span className="text-[10px] font-mono font-bold" style={{ color: T.text }}>
                {s ? fmtPrice(s.price, sym) : "···"}
              </span>
              {s && (
                <span className={cn("text-[10px] font-mono font-semibold", up ? UP : DOWN)}>
                  {fmtChange(s.changePercent)}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MARKET PULSE WIDGET
// ══════════════════════════════════════════════════════════════════════════════
function MarketPulseWidget({ stocks }: { stocks: Record<string, any> }) {
  const { data: mood } = useQuery<any>({
    queryKey: ["/api/market/mood"],
    staleTime: 60000,
    refetchInterval: 120000,
  });
  const fg = mood?.fearGreedIndex;
  const fgColor = fg == null ? T.muted : fg > 65 ? T.up : fg > 45 ? "#ffc107" : fg > 25 ? "#ff8c00" : T.down;
  const fgLabel = fg == null ? "—" : fg > 65 ? "GREED" : fg > 45 ? "NEUTRAL" : fg > 25 ? "FEAR" : "EXT FEAR";

  const spy = stocks["SPY"];
  const adv = mood?.advancing ?? "—";
  const dec = mood?.declining ?? "—";

  return (
    <div className="p-2 border-b" style={{ borderColor: T.border }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono font-bold tracking-widest uppercase" style={{ color: T.muted }}>
          MARKET PULSE
        </span>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: spy ? T.up : T.muted }} />
          <span className="text-[9px] font-mono" style={{ color: T.muted }}>MIXED LIVE</span>
        </div>
      </div>

      {/* Fear & Greed */}
      <div className="flex items-center gap-2 mb-2">
        <div className="shrink-0 text-center">
          <div className="text-[10px] font-mono" style={{ color: T.muted }}>F&G</div>
          <div className="text-2xl font-black font-mono leading-none" style={{ color: fgColor }}>
            {fg ?? "—"}
          </div>
          <div className="text-[9px] font-mono font-bold" style={{ color: fgColor }}>{fgLabel}</div>
        </div>
        <div className="flex-1">
          <div
            className="relative h-2 rounded-full overflow-hidden"
            style={{ background: "linear-gradient(to right, #ff4757, #ffc107, #00c896)" }}
          >
            {fg != null && (
              <div
                className="absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 border-white"
                style={{ left: `${fg}%`, transform: "translate(-50%, -50%)", background: fgColor, boxShadow: `0 0 6px ${fgColor}` }}
              />
            )}
          </div>
          <div className="grid grid-cols-3 gap-1 mt-1.5">
            {[["ADV", adv, T.up], ["DEC", dec, T.down], ["SPY", spy ? fmtChange(spy.changePercent) : "—", isUp(spy?.changePercent) ? T.up : T.down]].map(([l, v, c]) => (
              <div key={l as string} className="text-center">
                <div className="text-[8px] font-mono" style={{ color: T.muted }}>{l}</div>
                <div className="text-[11px] font-bold font-mono" style={{ color: c as string }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WATCH GRID WIDGET
// ══════════════════════════════════════════════════════════════════════════════
function WatchGrid({ stocks, onSelect, selected }: {
  stocks: Record<string, any>;
  onSelect: (sym: string) => void;
  selected: string;
}) {
  return (
    <div className="border-b" style={{ borderColor: T.border }}>
      <div className="flex items-center justify-between px-2 py-1.5 border-b" style={{ borderColor: T.border, background: T.header }}>
        <span className="text-[9px] font-mono font-bold tracking-widest uppercase" style={{ color: T.muted }}>WATCH GRID</span>
        <Link href="/watchlist" className="text-[9px] font-mono" style={{ color: T.info }}>편집</Link>
      </div>
      {/* Column headers */}
      <div className="grid px-2 py-1" style={{ gridTemplateColumns: "1fr 70px 52px 40px" }}>
        {["TICKER", "LAST", "CHG%", "VOL"].map(h => (
          <span key={h} className="text-[8px] font-mono uppercase text-right first:text-left" style={{ color: T.muted }}>{h}</span>
        ))}
      </div>
      {/* Rows */}
      {WATCH_SYMS.map(sym => {
        const s = stocks[sym];
        const up = isUp(s?.changePercent);
        const isSel = sym === selected;
        return (
          <button
            key={sym}
            onClick={() => onSelect(sym)}
            className="w-full grid px-2 py-1 text-right transition-colors"
            style={{
              gridTemplateColumns: "1fr 70px 52px 40px",
              background: isSel ? "#1a2d42" : "transparent",
              borderLeft: isSel ? `2px solid ${T.info}` : "2px solid transparent",
            }}
          >
            <div className="text-left">
              <div className="text-[11px] font-mono font-bold" style={{ color: isSel ? T.info : T.text }}>
                {sym.replace(".KS", "").replace("^", "").replace("=X", "")}
              </div>
            </div>
            <div className="text-[11px] font-mono" style={{ color: T.text }}>
              {s ? fmtPrice(s.price, sym) : <span style={{ color: T.muted }}>···</span>}
            </div>
            <div className={cn("text-[11px] font-mono font-bold", up ? UP : DOWN)}>
              {s ? fmtChange(s.changePercent) : <span style={{ color: T.muted }}>—</span>}
            </div>
            <div className="text-[10px] font-mono" style={{ color: T.muted }}>
              {s ? fmtVol(s.volume) : "—"}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTOR MAP WIDGET
// ══════════════════════════════════════════════════════════════════════════════
function SectorMap() {
  const { data } = useQuery<any>({
    queryKey: ["/api/sector-returns"],
    staleTime: 60000,
    refetchInterval: 300000,
  });
  const sectors: any[] = data?.sectors || [];
  const KO: Record<string, string> = {
    "Technology": "기술", "Healthcare": "헬스케어", "Financials": "금융",
    "Consumer Discretionary": "소비재", "Energy": "에너지", "Utilities": "유틸리티",
    "Materials": "소재", "Industrials": "산업재", "Communication Services": "통신",
    "Real Estate": "부동산", "Consumer Staples": "필수소비",
  };

  return (
    <div className="border-b" style={{ borderColor: T.border }}>
      <div className="px-2 py-1.5 border-b flex items-center justify-between" style={{ borderColor: T.border, background: T.header }}>
        <span className="text-[9px] font-mono font-bold tracking-widest uppercase" style={{ color: T.muted }}>SECTOR MAP</span>
        <Link href="/market-trends" className="text-[9px] font-mono" style={{ color: T.info }}>→</Link>
      </div>
      <div className="grid grid-cols-2 gap-px p-1.5" style={{ background: T.border }}>
        {sectors.slice(0, 10).map((sec: any) => {
          const up = (sec.change || 0) >= 0;
          const abs = Math.abs(sec.change || 0);
          const intensity = Math.min(abs / 3, 1);
          const bg = up
            ? `rgba(0, 200, 150, ${0.08 + intensity * 0.25})`
            : `rgba(255, 71, 87, ${0.08 + intensity * 0.25})`;
          return (
            <div key={sec.sector} className="flex flex-col p-1.5 rounded-sm" style={{ background: bg }}>
              <span className="text-[9px] font-mono truncate" style={{ color: T.muted }}>
                {KO[sec.sector] || sec.sector}
              </span>
              <span className={cn("text-[11px] font-mono font-bold", up ? UP : DOWN)}>
                {up ? "+" : ""}{(sec.change || 0).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FLOW RADAR WIDGET (simplified)
// ══════════════════════════════════════════════════════════════════════════════
function FlowRadar({ stocks }: { stocks: Record<string, any> }) {
  const flows = [
    { label: "Equity", sym: "SPY", factor: 1 },
    { label: "FX", sym: "JPY=X", factor: -1 },
    { label: "Bond", sym: "GC=F", factor: 0.5 },
    { label: "Credit", sym: "QQQ", factor: 1 },
    { label: "Crypto", sym: "BTC-USD", factor: 1 },
  ];
  return (
    <div className="p-2 border-b" style={{ borderColor: T.border }}>
      <div className="text-[9px] font-mono font-bold tracking-widest uppercase mb-1.5" style={{ color: T.muted }}>
        FLOW RADAR
      </div>
      {flows.map(({ label, sym, factor }) => {
        const s = stocks[sym];
        const pct = (s?.changePercent || 0) * factor;
        const up = pct >= 0;
        const barW = Math.min(Math.abs(pct) * 8, 100);
        return (
          <div key={label} className="flex items-center gap-2 mb-1">
            <span className="w-12 text-[9px] font-mono shrink-0" style={{ color: T.muted }}>{label}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#1a2030" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${barW}%`,
                  marginLeft: up ? "50%" : `${50 - barW}%`,
                  background: up ? T.up : T.down,
                }}
              />
            </div>
            <span className={cn("w-10 text-right text-[9px] font-mono font-semibold shrink-0", up ? UP : DOWN)}>
              {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PRICE ACTION CHART (center main)
// ══════════════════════════════════════════════════════════════════════════════
const PERIODS = ["5D", "1M", "3M", "6M", "1Y"];
const PERIOD_MAP: Record<string, { period: string; interval: string }> = {
  "5D": { period: "5d", interval: "1h" },
  "1M": { period: "1mo", interval: "1d" },
  "3M": { period: "3mo", interval: "1d" },
  "6M": { period: "6mo", interval: "1d" },
  "1Y": { period: "1y", interval: "1wk" },
};

function PriceChart({ symbol, period }: { symbol: string; period: string }) {
  const cfg = PERIOD_MAP[period] || PERIOD_MAP["1M"];
  const { data: raw, isLoading } = useQuery<any[]>({
    queryKey: ["/api/stocks/history", symbol, cfg.period],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/history/${encodeURIComponent(symbol)}?period=${cfg.period}&interval=${cfg.interval}`);
      const d = await res.json();
      return Array.isArray(d) ? d : d?.history || d?.data || [];
    },
    staleTime: 60000,
    refetchInterval: 120000,
    enabled: !!symbol,
  });

  const chartData = (raw || []).map((d: any) => ({
    t: d.date || d.timestamp || d.t,
    close: d.close ?? d.c ?? d.price,
    volume: d.volume ?? d.v ?? 0,
    open: d.open ?? d.o,
    high: d.high ?? d.h,
    low: d.low ?? d.l,
  })).filter((d: any) => d.close != null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: T.muted }}>
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        <span className="text-[11px] font-mono">로딩중...</span>
      </div>
    );
  }
  if (!chartData.length) {
    return <div className="flex items-center justify-center h-full text-[11px] font-mono" style={{ color: T.muted }}>데이터 없음</div>;
  }

  const prices = chartData.map((d: any) => d.close);
  const minP = Math.min(...prices) * 0.998;
  const maxP = Math.max(...prices) * 1.002;
  const startP = chartData[0]?.close;
  const endP = chartData[chartData.length - 1]?.close;
  const totalPct = startP ? ((endP - startP) / startP * 100) : 0;
  const chartUp = totalPct >= 0;

  return (
    <div className="h-full flex flex-col">
      {/* Mini return badge */}
      <div className="flex items-center gap-2 px-2 pb-1">
        <span className="text-[9px] font-mono" style={{ color: T.muted }}>기간수익률</span>
        <span className={cn("text-[10px] font-mono font-bold", chartUp ? UP : DOWN)}>
          {totalPct >= 0 ? "+" : ""}{totalPct.toFixed(2)}%
        </span>
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="70%">
          <ComposedChart data={chartData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartUp ? T.up : T.down} stopOpacity={0.2} />
                <stop offset="95%" stopColor={chartUp ? T.up : T.down} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <YAxis domain={[minP, maxP]} hide />
            <Tooltip
              contentStyle={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 10, fontFamily: "monospace" }}
              labelStyle={{ color: T.muted, fontSize: 9 }}
              formatter={(v: any) => [fmtPrice(v, symbol), "종가"]}
              labelFormatter={(t) => String(t).substring(0, 10)}
            />
            <ReferenceLine y={startP} stroke={T.muted} strokeDasharray="3 3" strokeWidth={1} />
            <Area type="monotone" dataKey="close" stroke={chartUp ? T.up : T.down} strokeWidth={1.5}
              fill="url(#chartGrad)" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <ResponsiveContainer width="100%" height="28%">
          <BarChart data={chartData} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="t" hide />
            <YAxis hide />
            <Bar dataKey="volume" fill={chartUp ? T.up : T.down} opacity={0.5} radius={[1, 1, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SYMBOL HEADER (big price display)
// ══════════════════════════════════════════════════════════════════════════════
function SymbolHeader({ symbol, stock }: { symbol: string; stock: any }) {
  const up = isUp(stock?.changePercent);
  const isLive = !!stock;

  return (
    <div className="px-3 py-2 border-b flex items-start justify-between gap-3" style={{ borderColor: T.border, background: T.panel }}>
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-base font-mono font-black" style={{ color: T.info }}>{symbol.replace("^", "")}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold" style={{
            background: isLive ? "rgba(0,200,150,0.15)" : "rgba(86,104,128,0.2)",
            color: isLive ? T.up : T.muted
          }}>
            {isLive ? "● LIVE" : "— OFFLINE"}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black font-mono" style={{ color: T.text }}>
            {stock ? fmtPrice(stock.price, symbol) : "——"}
          </span>
          {stock && (
            <span className={cn("text-sm font-mono font-bold", up ? UP : DOWN)}>
              {up ? "▲" : "▼"} {fmtChange(stock.changePercent)}
            </span>
          )}
        </div>
        {stock && (
          <div className="flex gap-3 mt-1">
            {[
              ["O", stock.open], ["H", stock.dayHigh || stock.high],
              ["L", stock.dayLow || stock.low], ["C", stock.previousClose]
            ].map(([l, v]) => (
              <div key={l as string} className="flex items-center gap-1">
                <span className="text-[8px] font-mono" style={{ color: T.muted }}>{l}</span>
                <span className="text-[10px] font-mono" style={{ color: T.text }}>{fmtPrice(v as number, symbol)}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <span className="text-[8px] font-mono" style={{ color: T.muted }}>VOL</span>
              <span className="text-[10px] font-mono" style={{ color: T.text }}>{fmtVol(stock.volume)}</span>
            </div>
          </div>
        )}
      </div>
      <Link
        href={`/stock/${symbol}`}
        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold shrink-0"
        style={{ background: T.info + "22", color: T.info, border: `1px solid ${T.info}40` }}
      >
        풀차트 <ArrowUpRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TECH / RISK ENGINE
// ══════════════════════════════════════════════════════════════════════════════
function TechEngine({ symbol, stock }: { symbol: string; stock: any }) {
  const { data: hist } = useQuery<any[]>({
    queryKey: ["/api/stocks/history", symbol, "3mo_tech"],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/history/${encodeURIComponent(symbol)}?period=3mo&interval=1d`);
      const d = await res.json();
      return Array.isArray(d) ? d : d?.history || [];
    },
    staleTime: 120000,
    enabled: !!symbol,
  });

  // Compute SMA20, SMA50 from history
  const closes = (hist || []).map((d: any) => d.close ?? d.c).filter(Boolean);
  const sma20 = closes.length >= 20 ? closes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20 : null;
  const sma50 = closes.length >= 50 ? closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50 : null;
  const price = stock?.price;

  // Fake RSI estimate from recent momentum
  const recentPct = stock?.changePercent || 0;
  const rsiEst = Math.max(20, Math.min(80, 50 + recentPct * 3));

  const metrics = [
    ["PRICE", price ? fmtPrice(price, symbol) : "—", T.text],
    ["CHG%", stock ? fmtChange(stock.changePercent) : "—", isUp(stock?.changePercent) ? T.up : T.down],
    ["SMA20", sma20 ? fmtPrice(sma20, symbol) : "—", price && sma20 ? (price > sma20 ? T.up : T.down) : T.muted],
    ["SMA50", sma50 ? fmtPrice(sma50, symbol) : "—", price && sma50 ? (price > sma50 ? T.up : T.down) : T.muted],
    ["RSI~", rsiEst.toFixed(0), rsiEst > 70 ? T.down : rsiEst < 30 ? T.up : T.text],
    ["52W H", stock?.fiftyTwoWeekHigh ? fmtPrice(stock.fiftyTwoWeekHigh, symbol) : "—", T.muted],
    ["52W L", stock?.fiftyTwoWeekLow ? fmtPrice(stock.fiftyTwoWeekLow, symbol) : "—", T.muted],
    ["BETA", stock?.beta ? stock.beta.toFixed(2) : "—", T.muted],
  ];

  return (
    <div className="p-2">
      <div className="text-[9px] font-mono font-bold tracking-widest uppercase mb-2" style={{ color: T.muted }}>
        TECH / RISK ENGINE
      </div>
      <div className="grid grid-cols-4 gap-px" style={{ background: T.border }}>
        {metrics.map(([l, v, c]) => (
          <div key={l as string} className="px-2 py-1.5" style={{ background: T.panel2 }}>
            <div className="text-[8px] font-mono" style={{ color: T.muted }}>{l}</div>
            <div className="text-[11px] font-mono font-bold" style={{ color: c as string }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CROSS ASSET MATRIX (simplified — 5D performance comparison)
// ══════════════════════════════════════════════════════════════════════════════
function CrossAssetMatrix({ stocks }: { stocks: Record<string, any> }) {
  const syms = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META"];
  return (
    <div className="p-2 border-t" style={{ borderColor: T.border }}>
      <div className="text-[9px] font-mono font-bold tracking-widest uppercase mb-2" style={{ color: T.muted }}>
        CROSS ASSET SNAPSHOT
      </div>
      <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <table className="w-full" style={{ minWidth: 320 }}>
          <thead>
            <tr>
              <td className="text-[8px] font-mono pb-1 pr-2" style={{ color: T.muted }}>SYMBOL</td>
              {["LAST", "CHG%", "VOL", "52WH%"].map(h => (
                <td key={h} className="text-[8px] font-mono pb-1 text-right pr-1" style={{ color: T.muted }}>{h}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            {syms.map(sym => {
              const s = stocks[sym];
              const up = isUp(s?.changePercent);
              const from52H = s?.price && s?.fiftyTwoWeekHigh
                ? ((s.price - s.fiftyTwoWeekHigh) / s.fiftyTwoWeekHigh * 100)
                : null;
              return (
                <tr key={sym} className="border-t" style={{ borderColor: T.border + "60" }}>
                  <td className="text-[10px] font-mono font-bold py-1 pr-2" style={{ color: T.info }}>{sym}</td>
                  <td className="text-[10px] font-mono text-right pr-1" style={{ color: T.text }}>{s ? fmtPrice(s.price, sym) : "—"}</td>
                  <td className={cn("text-[10px] font-mono font-bold text-right pr-1", up ? UP : DOWN)}>{s ? fmtChange(s.changePercent) : "—"}</td>
                  <td className="text-[10px] font-mono text-right pr-1" style={{ color: T.muted }}>{s ? fmtVol(s.volume) : "—"}</td>
                  <td className={cn("text-[10px] font-mono text-right pr-1", from52H != null && from52H < -10 ? UP : MUTED)}>
                    {from52H != null ? `${from52H.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FUNDAMENTALS PANEL (right sidebar)
// ══════════════════════════════════════════════════════════════════════════════
function FundamentalsPanel({ symbol, stock }: { symbol: string; stock: any }) {
  const rows = [
    ["시가총액", fmtMktCap(stock?.marketCap)],
    ["P/E", stock?.pe ? stock.pe.toFixed(2) : "—"],
    ["P/B", stock?.pb ? stock.pb.toFixed(2) : stock?.priceToBook ? stock.priceToBook.toFixed(2) : "—"],
    ["EPS", stock?.eps ? `$${stock.eps.toFixed(2)}` : "—"],
    ["배당수익률", stock?.dividendYield ? `${(stock.dividendYield * 100).toFixed(2)}%` : "—"],
    ["베타", stock?.beta ? stock.beta.toFixed(2) : "—"],
    ["52W 고", stock?.fiftyTwoWeekHigh ? fmtPrice(stock.fiftyTwoWeekHigh, symbol) : "—"],
    ["52W 저", stock?.fiftyTwoWeekLow ? fmtPrice(stock.fiftyTwoWeekLow, symbol) : "—"],
    ["평균거래량", fmtVol(stock?.avgVolume || stock?.averageVolume)],
  ];

  // 52-week range slider
  const hi = stock?.fiftyTwoWeekHigh;
  const lo = stock?.fiftyTwoWeekLow;
  const price = stock?.price;
  const rangePos = hi && lo && price ? ((price - lo) / (hi - lo) * 100) : null;

  return (
    <div className="border-b" style={{ borderColor: T.border }}>
      <div className="px-2 py-1.5 border-b flex items-center justify-between" style={{ borderColor: T.border, background: T.header }}>
        <span className="text-[9px] font-mono font-bold tracking-widest uppercase" style={{ color: T.muted }}>FUNDAMENTALS</span>
        <Link href={`/stock/${symbol}`} className="text-[9px] font-mono" style={{ color: T.info }}>→</Link>
      </div>
      {/* 52-week range */}
      {rangePos != null && (
        <div className="px-2 py-2 border-b" style={{ borderColor: T.border }}>
          <div className="flex justify-between text-[8px] font-mono mb-1" style={{ color: T.muted }}>
            <span>{fmtPrice(lo, symbol)}</span>
            <span>52W RANGE</span>
            <span>{fmtPrice(hi, symbol)}</span>
          </div>
          <div className="relative h-1.5 rounded-full" style={{ background: T.border }}>
            <div className="absolute h-full rounded-full" style={{ width: `${rangePos}%`, background: `linear-gradient(to right, ${T.down}, ${T.up})` }} />
            <div className="absolute w-2 h-2 rounded-full -translate-y-1/4 border border-white" style={{ left: `${rangePos}%`, background: T.text }} />
          </div>
        </div>
      )}
      {rows.map(([l, v]) => (
        <div key={l} className="flex items-center justify-between px-2 py-1 border-b" style={{ borderColor: T.border + "50" }}>
          <span className="text-[9px] font-mono" style={{ color: T.muted }}>{l}</span>
          <span className="text-[10px] font-mono font-bold" style={{ color: T.text }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EARNINGS / DIVIDENDS PANEL
// ══════════════════════════════════════════════════════════════════════════════
function EarningsPanel() {
  const { data: calData } = useQuery<any>({
    queryKey: ["/api/economic-calendar"],
    queryFn: async () => {
      const now = new Date();
      const res = await fetch(`/api/economic-calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
      return res.json();
    },
    staleTime: 300000,
  });
  const today = new Date().getDate();
  const events: any[] = (calData?.events || [])
    .filter((e: any) => new Date(e.date || "").getDate() >= today)
    .slice(0, 5);

  return (
    <div className="border-b" style={{ borderColor: T.border }}>
      <div className="px-2 py-1.5 border-b flex items-center justify-between" style={{ borderColor: T.border, background: T.header }}>
        <span className="text-[9px] font-mono font-bold tracking-widest uppercase" style={{ color: T.muted }}>CALENDAR</span>
        <Link href="/calendar" className="text-[9px] font-mono" style={{ color: T.info }}>→</Link>
      </div>
      {events.length === 0 ? (
        <div className="px-2 py-3 text-[10px] font-mono" style={{ color: T.muted }}>이벤트 없음</div>
      ) : events.map((ev: any, i: number) => (
        <div key={i} className="flex items-start gap-2 px-2 py-1.5 border-b" style={{ borderColor: T.border + "40" }}>
          <div className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0" style={{
            background: ev.importance === "high" ? T.down : ev.importance === "medium" ? "#ffc107" : T.info
          }} />
          <div className="min-w-0">
            <div className="text-[10px] font-mono truncate" style={{ color: T.text }}>{ev.name || ev.title}</div>
            <div className="text-[9px] font-mono" style={{ color: T.muted }}>{ev.date}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AI TRADE ASSISTANT (mini)
// ══════════════════════════════════════════════════════════════════════════════
function AIAssistant({ symbol }: { symbol: string }) {
  return (
    <div className="p-2">
      <div className="text-[9px] font-mono font-bold tracking-widest uppercase mb-2" style={{ color: T.muted }}>
        AI TRADE ASSISTANT
      </div>
      <div className="rounded p-2 mb-2 text-[10px] font-mono leading-relaxed" style={{ background: T.panel2, color: T.muted, border: `1px solid ${T.border}` }}>
        <span style={{ color: T.up }}>DINO AI:</span> {symbol.replace("^", "").replace(".KS", "")} 분석을 위해
        명령어를 입력하세요.{" "}
        <span style={{ color: T.info }}>HELP, NEWS, SEC, FUND, RISK, WATCH, REFRESH</span> 등의 명령을 사용할 수 있습니다.
      </div>
      <Link
        href="/ai-portfolio"
        className="flex items-center justify-center gap-2 w-full py-2 rounded text-[11px] font-mono font-bold"
        style={{ background: T.up + "22", color: T.up, border: `1px solid ${T.up}40` }}
      >
        <Bot className="w-3.5 h-3.5" />
        AI 포트폴리오 분석 →
      </Link>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NEWS FEED (right)
// ══════════════════════════════════════════════════════════════════════════════
function NewsFeedPanel() {
  const { data: newsData } = useQuery<any[]>({
    queryKey: ["/api/news"],
    staleTime: 120000,
    refetchInterval: 180000,
  });
  const news = Array.isArray(newsData) ? newsData.slice(0, 8) : [];

  return (
    <div className="border-b" style={{ borderColor: T.border }}>
      <div className="px-2 py-1.5 border-b flex items-center justify-between" style={{ borderColor: T.border, background: T.header }}>
        <span className="text-[9px] font-mono font-bold tracking-widest uppercase" style={{ color: T.muted }}>NEWS FEED</span>
        <Link href="/hot-issues" className="text-[9px] font-mono" style={{ color: T.info }}>→</Link>
      </div>
      {news.map((item: any, i: number) => (
        <a
          key={i}
          href={item.url || item.link || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 px-2 py-2 border-b transition-colors"
          style={{ borderColor: T.border + "40" }}
          onMouseEnter={e => (e.currentTarget.style.background = T.panel2)}
          onMouseLeave={e => (e.currentTarget.style.background = "")}
        >
          <span className="text-[9px] font-mono font-bold shrink-0 mt-0.5" style={{
            color: i === 0 ? T.down : T.muted
          }}>{i === 0 ? "HOT" : `${String(i + 1).padStart(2, "0")}`}</span>
          <span className="text-[10px] font-mono leading-snug line-clamp-2" style={{ color: T.text }}>
            {item.title}
          </span>
        </a>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MOBILE QUEST STATUS
// ══════════════════════════════════════════════════════════════════════════════
function QuestMini() {
  const { data: quests } = useQuery<any[]>({
    queryKey: ["/api/quests/daily"],
    staleTime: 60000,
  });
  const { data: user } = useUser();
  const total = quests?.length || 6;
  const done = quests?.filter((q: any) => q.isCompleted).length || 0;
  const pct = Math.round(done / total * 100);

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b" style={{ borderColor: T.border, background: T.panel }}>
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-[9px] font-mono" style={{ color: T.muted }}>오늘의 퀘스트</span>
          <span className="text-[9px] font-mono font-bold" style={{ color: T.up }}>{done}/{total} 완료</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: T.border }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: T.up }} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3" style={{ color: "#ffc107" }} />
          <span className="text-[10px] font-mono font-bold" style={{ color: "#ffc107" }}>{user?.xp || 0}</span>
        </div>
        <div className="flex items-center gap-1">
          <Flame className="w-3 h-3" style={{ color: "#ff6b35" }} />
          <span className="text-[10px] font-mono font-bold" style={{ color: "#ff6b35" }}>{user?.streak || 0}일</span>
        </div>
      </div>
      <Link href="/quests" className="text-[9px] font-mono px-2 py-1 rounded font-bold" style={{ background: T.up + "22", color: T.up }}>→</Link>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FUNCTION KEY STRIP (bottom)
// ══════════════════════════════════════════════════════════════════════════════
const FKEYS = [
  { key: "F2", label: "CHART", href: "/pro" },
  { key: "F3", label: "QUESTS", href: "/quests" },
  { key: "F4", label: "NEWS", href: "/hot-issues" },
  { key: "F5", label: "INVESTORS", href: "/investors" },
  { key: "F6", label: "CALENDAR", href: "/calendar" },
  { key: "F7", label: "AI", href: "/ai-portfolio" },
  { key: "F8", label: "WATCHLIST", href: "/watchlist" },
  { key: "F9", label: "PRO", href: "/pro" },
];

function FKeyStrip() {
  return (
    <div className="flex items-stretch border-t overflow-x-auto shrink-0" style={{ borderColor: T.border, background: T.header, scrollbarWidth: "none" }}>
      {FKEYS.map(({ key, label, href }) => (
        <Link
          key={key}
          href={href}
          className="flex items-center gap-1 px-3 py-1.5 border-r text-[9px] font-mono shrink-0 transition-colors"
          style={{ borderColor: T.border }}
          onMouseEnter={e => (e.currentTarget.style.background = T.panel2)}
          onMouseLeave={e => (e.currentTarget.style.background = "")}
        >
          <span className="font-bold" style={{ color: T.info }}>{key}</span>
          <span style={{ color: T.muted }}>{label}</span>
        </Link>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SEARCH BAR
// ══════════════════════════════════════════════════════════════════════════════
function SymbolSearch({ onSelect }: { onSelect: (sym: string) => void }) {
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const [focused, setFocused] = useState(false);

  const QUICK = ["AAPL", "NVDA", "TSLA", "MSFT", "005930.KS", "^KS11", "BTC-USD", "AMZN"];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    if (q) {
      onSelect(q);
      setQuery("");
      setFocused(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <form onSubmit={submit} className="flex items-center">
        <div className="flex items-center px-2 gap-1.5" style={{ background: T.panel2, border: `1px solid ${T.border}`, borderRadius: 4, minWidth: 160 }}>
          <Search className="w-3 h-3 shrink-0" style={{ color: T.muted }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            placeholder="종목 검색..."
            className="bg-transparent text-[11px] font-mono py-1 outline-none w-24"
            style={{ color: T.text, caretColor: T.info }}
          />
        </div>
        <button type="submit" className="px-2 py-1 ml-1 text-[10px] font-mono font-bold rounded" style={{ background: T.info, color: "#fff" }}>GO</button>
      </form>
      {focused && (
        <div className="absolute top-full left-0 z-50 rounded shadow-xl mt-1 py-1 min-w-[180px]" style={{ background: T.panel2, border: `1px solid ${T.border}` }}>
          {QUICK.filter(s => !query || s.includes(query.toUpperCase())).map(sym => (
            <button
              key={sym}
              onMouseDown={() => { onSelect(sym); setQuery(""); setFocused(false); }}
              className="block w-full text-left px-3 py-1.5 text-[10px] font-mono transition-colors"
              style={{ color: T.text }}
              onMouseEnter={e => (e.currentTarget.style.color = T.info)}
              onMouseLeave={e => (e.currentTarget.style.color = T.text)}
            >
              {sym}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MOBILE TABS
// ══════════════════════════════════════════════════════════════════════════════
type MobileTab = "market" | "chart" | "news" | "fund" | "ai";
const MOBILE_TABS: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
  { id: "market", label: "시장", icon: <Activity className="w-4 h-4" /> },
  { id: "chart", label: "차트", icon: <BarChart2 className="w-4 h-4" /> },
  { id: "news", label: "뉴스", icon: <Newspaper className="w-4 h-4" /> },
  { id: "fund", label: "정보", icon: <DollarSign className="w-4 h-4" /> },
  { id: "ai", label: "AI", icon: <Bot className="w-4 h-4" /> },
];

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function DinoTerminal() {
  const { data: user } = useUser();
  const [selectedSym, setSelectedSym] = useState("005930.KS");
  const [chartPeriod, setChartPeriod] = useState("1M");
  const [mobileTab, setMobileTab] = useState<MobileTab>(() => {
    return (localStorage.getItem("dino-terminal-tab") as MobileTab) || "market";
  });

  useEffect(() => {
    localStorage.setItem("dino-terminal-tab", mobileTab);
  }, [mobileTab]);

  // All live prices in one big batch
  const allSyms = Array.from(new Set([...WATCH_SYMS, ...INDEX_SYMS, selectedSym]));
  const { data: liveData } = useLivePrices(allSyms);
  const stocks: Record<string, any> = liveData?.stocks || {};
  const selectedStock = stocks[selectedSym];

  const selectSym = useCallback((sym: string) => {
    setSelectedSym(sym);
    setMobileTab("chart");
  }, []);

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  const DesktopLayout = (
    <div className="hidden lg:flex flex-col h-full overflow-hidden" style={{ background: T.bg, color: T.text }}>
      {/* Header bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b shrink-0" style={{ borderColor: T.border, background: T.header }}>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black" style={{ background: T.info, color: "#fff" }}>ST</div>
          <span className="text-[11px] font-mono font-black" style={{ color: T.info }}>SnapTerminal</span>
          <span className="text-[9px] font-mono" style={{ color: T.muted }}>US/KR TRANSLATION</span>
        </div>
        <div className="w-px h-4 shrink-0" style={{ background: T.border }} />
        <SymbolSearch onSelect={selectSym} />
        <div className="flex-1" />
        <QuestMini />
        <div className="w-px h-4 shrink-0" style={{ background: T.border }} />
        <TerminalClock />
        {user && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono" style={{ color: T.muted }}>
            <span style={{ color: T.up }}>Lv.{user.level}</span>
            <span>{user.nickname}</span>
          </div>
        )}
      </div>

      {/* Index strip */}
      <IndexStrip />

      {/* 3-panel main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL */}
        <div className="w-[200px] shrink-0 border-r overflow-y-auto flex flex-col" style={{ borderColor: T.border, scrollbarWidth: "none" }}>
          <MarketPulseWidget stocks={stocks} />
          <WatchGrid stocks={stocks} onSelect={selectSym} selected={selectedSym} />
          <SectorMap />
          <FlowRadar stocks={stocks} />
        </div>

        {/* CENTER PANEL */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <SymbolHeader symbol={selectedSym} stock={selectedStock} />

          {/* Period selector + indicator toggles */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0" style={{ borderColor: T.border, background: T.header }}>
            <span className="text-[9px] font-mono font-bold uppercase" style={{ color: T.muted }}>PRICE ACTION</span>
            <div className="w-px h-3" style={{ background: T.border }} />
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className="px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-colors"
                  style={{
                    background: chartPeriod === p ? T.info + "33" : "transparent",
                    color: chartPeriod === p ? T.info : T.muted,
                    border: `1px solid ${chartPeriod === p ? T.info + "60" : "transparent"}`,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <Link href={`/stock/${selectedSym}`} className="text-[9px] font-mono" style={{ color: T.info }}>
              고급 차트 →
            </Link>
          </div>

          {/* Chart area */}
          <div className="flex-1 p-2 overflow-hidden" style={{ minHeight: 0 }}>
            <PriceChart symbol={selectedSym} period={chartPeriod} />
          </div>

          {/* Bottom metrics */}
          <div className="border-t overflow-y-auto" style={{ borderColor: T.border, maxHeight: 220 }}>
            <TechEngine symbol={selectedSym} stock={selectedStock} />
            <CrossAssetMatrix stocks={stocks} />
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-[200px] shrink-0 border-l overflow-y-auto flex flex-col" style={{ borderColor: T.border, scrollbarWidth: "none" }}>
          <FundamentalsPanel symbol={selectedSym} stock={selectedStock} />
          <EarningsPanel />
          <NewsFeedPanel />
          <AIAssistant symbol={selectedSym} />
        </div>
      </div>

      {/* F-key strip */}
      <FKeyStrip />
    </div>
  );

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  const MobileLayout = (
    <div
      className="flex lg:hidden flex-col"
      style={{ height: "calc(100vh - 57px)", background: T.bg, color: T.text }}
    >
      {/* Mobile header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0" style={{ borderColor: T.border, background: T.header }}>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black" style={{ background: T.info, color: "#fff" }}>ST</div>
          <span className="text-[11px] font-mono font-bold" style={{ color: T.info }}>DinoTerminal</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-[11px] font-mono font-bold" style={{ color: T.info }}>{selectedSym.replace("^", "").replace(".KS", "")}</span>
            {selectedStock && (
              <span className={cn("text-[10px] font-mono font-bold", isUp(selectedStock.changePercent) ? UP : DOWN)}>
                {fmtChange(selectedStock.changePercent)}
              </span>
            )}
          </div>
        </div>
        <SymbolSearch onSelect={selectSym} />
      </div>

      {/* Index strip */}
      <IndexStrip />

      {/* Quest mini bar */}
      <QuestMini />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {/* MARKET TAB */}
        {mobileTab === "market" && (
          <div>
            <MarketPulseWidget stocks={stocks} />
            <WatchGrid stocks={stocks} onSelect={selectSym} selected={selectedSym} />
            <SectorMap />
            <FlowRadar stocks={stocks} />
          </div>
        )}

        {/* CHART TAB */}
        {mobileTab === "chart" && (
          <div className="flex flex-col h-full">
            <SymbolHeader symbol={selectedSym} stock={selectedStock} />
            {/* Period selector */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: T.border, background: T.header }}>
              {PERIODS.map(p => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className="px-2.5 py-1 rounded text-[10px] font-mono font-bold"
                  style={{
                    background: chartPeriod === p ? T.info + "33" : T.panel2,
                    color: chartPeriod === p ? T.info : T.muted,
                    border: `1px solid ${chartPeriod === p ? T.info + "60" : T.border}`,
                  }}
                >
                  {p}
                </button>
              ))}
              <div className="flex-1" />
              <Link href={`/stock/${selectedSym}`} className="text-[9px] font-mono" style={{ color: T.info }}>고급→</Link>
            </div>
            {/* Chart */}
            <div style={{ height: 280, padding: "8px 4px" }}>
              <PriceChart symbol={selectedSym} period={chartPeriod} />
            </div>
            {/* Tech engine */}
            <TechEngine symbol={selectedSym} stock={selectedStock} />
            <CrossAssetMatrix stocks={stocks} />
          </div>
        )}

        {/* NEWS TAB */}
        {mobileTab === "news" && (
          <div>
            <NewsFeedPanel />
            <EarningsPanel />
          </div>
        )}

        {/* FUND TAB */}
        {mobileTab === "fund" && (
          <div>
            <FundamentalsPanel symbol={selectedSym} stock={selectedStock} />
            {/* Quick nav */}
            <div className="p-3 grid grid-cols-3 gap-2">
              {[
                { label: "투자자", href: "/investors", icon: <Briefcase className="w-4 h-4" /> },
                { label: "추천종목", href: "/recommended", icon: <Star className="w-4 h-4" /> },
                { label: "실적Live", href: "/earnings", icon: <BarChart2 className="w-4 h-4" /> },
                { label: "시장동향", href: "/market-trends", icon: <Globe className="w-4 h-4" /> },
                { label: "RRG차트", href: "/rrg", icon: <Radio className="w-4 h-4" /> },
                { label: "프로", href: "/pro", icon: <MonitorPlay className="w-4 h-4" /> },
              ].map(({ label, href, icon }) => (
                <Link key={href} href={href}
                  className="flex flex-col items-center gap-1 py-3 rounded"
                  style={{ background: T.panel2, border: `1px solid ${T.border}`, color: T.text }}
                >
                  <span style={{ color: T.info }}>{icon}</span>
                  <span className="text-[10px] font-mono">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* AI TAB */}
        {mobileTab === "ai" && (
          <div>
            <AIAssistant symbol={selectedSym} />
            {/* Quest links */}
            <div className="p-3 space-y-2">
              {[
                { label: "오늘의 퀘스트", href: "/quests", desc: "XP 획득" },
                { label: "AI 포트폴리오", href: "/ai-portfolio", desc: "맞춤 분석" },
                { label: "뉴스 퀴즈", href: "/quests", desc: "실전 훈련" },
              ].map(({ label, href, desc }) => (
                <Link key={href} href={href}
                  className="flex items-center justify-between px-3 py-3 rounded"
                  style={{ background: T.panel2, border: `1px solid ${T.border}` }}
                >
                  <div>
                    <div className="text-[12px] font-mono font-bold" style={{ color: T.text }}>{label}</div>
                    <div className="text-[10px] font-mono" style={{ color: T.muted }}>{desc}</div>
                  </div>
                  <ChevronRight className="w-4 h-4" style={{ color: T.info }} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="flex items-stretch border-t shrink-0" style={{ borderColor: T.border, background: T.header }}>
        {MOBILE_TABS.map(tab => {
          const active = mobileTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
              style={{ color: active ? T.info : T.muted, borderTop: active ? `2px solid ${T.info}` : "2px solid transparent" }}
            >
              {tab.icon}
              <span className="text-[9px] font-mono font-bold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ background: T.bg }}>
      {DesktopLayout}
      {MobileLayout}
    </div>
  );
}

