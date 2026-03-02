import { useState, useMemo } from "react";
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
  const { formatPrice, isKoreanStock, isJapaneseStock } = useCurrency();
  const isDark = theme === "dark";
  const isKo = lang === "ko";

  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const tooltipBg = isDark ? "#111827" : "#ffffff";
  const tooltipBorder = isDark ? "#374151" : "#e5e7eb";

  const isKr = isKoreanStock(symbol);
  const isJp = isJapaneseStock(symbol);
  const nativeCurrency = isKr ? "KRW" : isJp ? "JPY" : "USD";

  const [activeTab, setActiveTab] = useState<TabKey>("chart");
  const [period, setPeriod] = useState("1m");
  const [chartType, setChartType] = useState<"candle" | "area">("candle");
  const [showMA, setShowMA] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [showSR, setShowSR] = useState(true);

  const periodOpt = PERIOD_OPTIONS.find(p => p.key === period) || PERIOD_OPTIONS[2];
  const isIntraday = period === "1d" || period === "1w";

  const { data: historyRaw, isLoading: histLoading } = useQuery<{ history: HistoryData[] }>({
    queryKey: ["/api/stocks/history", symbol, periodOpt.period, periodOpt.interval],
    enabled: isOpen,
    queryFn: async () => {
      const res = await fetch(`/api/stocks/history?symbol=${symbol}&period=${periodOpt.period}&interval=${periodOpt.interval}`);
      return res.json();
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
    return history.map((d, i) => ({
      date: d.t,
      open: d.o, high: d.h, low: d.l, close: d.c, volume: d.v,
      sma20: sma20[i], sma60: sma60[i], sma120: sma120[i],
      upperBB: upperBB[i], lowerBB: lowerBB[i], middleBB: middleBB[i],
      rsi: rsiValues[i],
      macd: macdResult?.macd?.[i],
      signal: macdResult?.signal?.[i],
      histogram: macdResult?.histogram?.[i],
    }));
  }, [history, sma20, sma60, sma120, upperBB, lowerBB, middleBB, rsiValues, macdResult]);

  const ret = periodReturn(history);
  const retPositive = ret !== null && ret >= 0;

  const volumeProfile = useMemo(() => buildVolumeProfile(history, 24), [history]);

  const peers = getPeers(symbol);
  const { data: peerData } = useQuery<{ quotes: Array<{ symbol: string; price: number; changePercent: number; name: string }> }>({
    queryKey: ["/api/stocks/live", [...peers, symbol].join(",")],
    enabled: isOpen && activeTab === "compare",
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live?symbols=${[...peers, symbol].join(",")}`);
      return res.json();
    },
  });

  const allSymbols = [symbol, ...peers];
  const peerRows = useMemo(() => {
    const quotes = peerData?.quotes || [];
    return allSymbols.map(s => {
      const q = quotes.find(q => q.symbol === s);
      const localName = q ? getLocalizedCompanyName(cleanCompanyName(q.name || s), lang) : s;
      return {
        symbol: s,
        name: localName,
        price: q?.price ?? null,
        changePercent: q?.changePercent ?? null,
        isSelf: s === symbol,
      };
    });
  }, [peerData, allSymbols, symbol, lang]);

  const lastPrice = history.length ? history[history.length - 1].c : null;
  const displayName = getLocalizedCompanyName(cleanCompanyName(name), lang);

  const renderTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="rounded-lg border p-2.5 shadow-xl text-xs" style={{ background: tooltipBg, borderColor: tooltipBorder }}>
        <p className="font-bold mb-1 text-foreground">{d.date}</p>
        {d.close != null && <p className="text-foreground">종가: {formatPrice(d.close, { nativeCurrency })}</p>}
        {d.open  != null && <p className="text-muted-foreground">시가: {formatPrice(d.open, { nativeCurrency })}</p>}
        {d.high  != null && <p className="text-emerald-500">고가: {formatPrice(d.high, { nativeCurrency })}</p>}
        {d.low   != null && <p className="text-rose-500">저가: {formatPrice(d.low, { nativeCurrency })}</p>}
        {d.volume != null && <p className="text-muted-foreground">거래량: {formatNumber(d.volume)}</p>}
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
        <DialogHeader className="flex flex-row items-center justify-between px-4 pt-4 pb-2 border-b shrink-0">
          <DialogDescription className="sr-only">{isKo ? `${displayName} 프로 분석` : `${displayName} Pro Analysis`}</DialogDescription>
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="w-4 h-4 text-violet-500 shrink-0" />
            <div className="min-w-0">
              <DialogTitle className="text-sm font-bold truncate">{displayName}</DialogTitle>
              <p className="text-xs text-muted-foreground font-mono">{symbol}</p>
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
                  onClick={() => setPeriod(opt.key)}
                  data-testid={`button-period-modal-${opt.key}`}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-full border transition-all touch-manipulation",
                    period === opt.key
                      ? "bg-violet-500 text-white border-violet-500"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-violet-400/50"
                  )}
                >{opt.label}</button>
              ))}
              {ret !== null && (
                <span className={cn("ml-auto text-sm font-bold tabular-nums", retPositive ? "text-green-500" : "text-red-500")}>
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
              </div>

              {histLoading ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">{isKo ? "데이터 로딩 중..." : "Loading..."}</div>
              ) : chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">{isKo ? "데이터 없음" : "No data"}</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={v => formatPrice(v, { nativeCurrency, compact: true })} width={52} />
                    <Tooltip content={renderTooltip} />
                    {showSR && srLevels.support.map((s, i) => (
                      <ReferenceLine key={`s-${i}`} y={s} stroke="#22c55e" strokeWidth={1} strokeDasharray="4 3" />
                    ))}
                    {showSR && srLevels.resistance.map((r, i) => (
                      <ReferenceLine key={`r-${i}`} y={r} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" />
                    ))}
                    {showBB && !isIntraday && (
                      <>
                        <Area type="monotone" dataKey="upperBB" stroke="#6b7280" fill="none" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                        <Area type="monotone" dataKey="lowerBB" stroke="#6b7280" fill="#6b728020" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                        <Line type="monotone" dataKey="middleBB" stroke="#9ca3af" strokeWidth={1} dot={false} />
                      </>
                    )}
                    {chartType === "area" ? (
                      <Area type="monotone" dataKey="close" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={2} dot={false} />
                    ) : (
                      <Bar dataKey="close" fill="#8b5cf6" opacity={0.9} radius={[1, 1, 0, 0]} />
                    )}
                    {showMA && !isIntraday && (
                      <>
                        <Line type="monotone" dataKey="sma20" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="sma60" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="sma120" stroke="#a855f7" strokeWidth={1.5} dot={false} />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}

              {/* Volume sub-chart */}
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={55}>
                  <ComposedChart data={chartData} margin={{ top: 0, right: 4, left: -10, bottom: 0 }}>
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
                          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={v => formatPrice(v, { nativeCurrency, compact: true })} width={52} />
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
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">{isKo ? "데이터 로딩 중..." : "Loading..."}</div>
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
                          {formatPrice(p.price, { nativeCurrency, compact: true })}
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
                    { label: isKo ? "52주 최고" : "52W High", value: Math.max(...history.map(d => d.h)) },
                    { label: isKo ? "현재 가격" : "Current",  value: history[history.length - 1].c },
                    { label: isKo ? "52주 최저" : "52W Low",  value: Math.min(...history.map(d => d.l)) },
                  ].map(item => (
                    <div key={item.label} className="text-center">
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                      <p className="text-xs font-mono font-bold">{formatPrice(item.value, { nativeCurrency, compact: true })}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ TAB: 비교 (Peer Comparison) ═══════════════ */}
          {activeTab === "compare" && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold mb-0.5">{isKo ? "섹터 동종 기업 비교" : "Sector Peer Comparison"}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {isKo ? "같은 섹터 내 상위 3개 기업과의 당일 수익률 비교" : "Today's performance vs top 3 sector peers"}
                </p>
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
