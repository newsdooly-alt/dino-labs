import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  KOREAN_STOCK_ALIASES,
  containsKorean,
  searchByKoreanAlias,
  getLocalizedCompanyName,
} from "@/lib/stockNames";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ComposedChart, ReferenceLine, CartesianGrid,
} from "recharts";
import {
  Search, RefreshCw, Newspaper, Bot, BarChart2,
  Zap, Flame, Activity, DollarSign, Calendar,
  ArrowUpRight, AlertTriangle, Clock,
  TrendingUp, TrendingDown, Building2, Target,
  ChevronDown, ChevronUp, Languages, Loader2, ShieldAlert, FileText,
} from "lucide-react";

// ══════════════════════════════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════════════════════════════
const C = {
  bg:      "#0a0e14",
  panel:   "#0f1620",
  panel2:  "#111a26",
  border:  "#1e2d40",
  text:    "#c8d3e0",
  muted:   "#566880",
  up:      "#00c896",
  down:    "#ff4757",
  info:    "#3d9bff",
  warn:    "#ffc107",
  header:  "#080c12",
};

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════
const DEFAULT_WATCH_SYMS = [
  "AAPL","NVDA","TSLA","MSFT","AMZN","META",
  "005930.KS","^KS11","^IXIC","BTC-USD","GC=F","CL=F",
];
const DEFAULT_WATCH_NAMES: Record<string,string> = {
  "AAPL":"Apple","NVDA":"NVIDIA","TSLA":"Tesla","MSFT":"Microsoft",
  "AMZN":"Amazon","META":"Meta","005930.KS":"삼성전자",
  "^KS11":"KOSPI","^IXIC":"NASDAQ","BTC-USD":"Bitcoin",
  "GC=F":"Gold","CL=F":"Crude Oil",
};
// Keep legacy alias for components outside the main state
const WATCH_NAMES = DEFAULT_WATCH_NAMES;

const LS_SYMS_KEY  = "dino-watch-syms";
const LS_NAMES_KEY = "dino-watch-names";

function loadWatchSyms(): string[] {
  try {
    const raw = localStorage.getItem(LS_SYMS_KEY);
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) return arr; }
  } catch {}
  return [...DEFAULT_WATCH_SYMS];
}
function loadWatchNames(): Record<string,string> {
  try {
    const raw = localStorage.getItem(LS_NAMES_KEY);
    if (raw) return { ...DEFAULT_WATCH_NAMES, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_WATCH_NAMES };
}
function saveWatchSyms(syms: string[], names: Record<string,string>) {
  localStorage.setItem(LS_SYMS_KEY, JSON.stringify(syms));
  localStorage.setItem(LS_NAMES_KEY, JSON.stringify(names));
}
const INDEX_SYMS = ["SPY","QQQ","^KS11","^IXIC","GC=F","CL=F","BTC-USD","ETH-USD","SOL-USD","XRP-USD","JPY=X","^VIX"];
const CROSS_SYMS = ["AAPL","NVDA","TSLA","MSFT","AMZN","META"];
const MACRO_SYMS = ["^TNX","^VIX","^IRX","^FVX","^TYX","GC=F","SI=F","CL=F","HG=F","NG=F","JPY=X","EURUSD=X","GBPUSD=X","KRW=X","BZ=F","ZW=F","ZC=F","DX-Y.NYB","TLT","IEF","SHY","HYG","LQD","EMB","CNY=X","AUDUSD=X","TIP","^SKEW"];
const GLOBAL_SYMS = ["SPY","QQQ","^KS11","^N225","^GDAXI","^FTSE","^HSI"];
const INDEX_LBL: Record<string,string> = {
  "SPY":"SPY","QQQ":"QQQ","^KS11":"코스피","^IXIC":"NDX",
  "GC=F":"GOLD","CL=F":"OIL","BTC-USD":"BTC","JPY=X":"USD/JPY",
  "^TNX":"10Y","^VIX":"VIX","^IRX":"3M",
  "^FVX":"5Y","^TYX":"30Y","SI=F":"SILVER","HG=F":"COPPER",
  "NG=F":"NATGAS","EURUSD=X":"EUR/USD","GBPUSD=X":"GBP/USD",
  "^GDAXI":"DAX","^FTSE":"FTSE","^HSI":"HSI","^N225":"NKY",
};

// ── Multi-language label system ───────────────────────────────────────────────
type Lang = "ko" | "en" | "ja";
const L: Record<string, Record<Lang, string>> = {
  insiderTrades:   { ko:"내부자 거래",      en:"Insider Trades",     ja:"内部者取引"     },
  buyCount:        { ko:"매수",             en:"Buy",                ja:"買い"           },
  sellCount:       { ko:"매도",             en:"Sell",               ja:"売り"           },
  holdCount:       { ko:"중립",             en:"Hold",               ja:"中立"           },
  institutions:    { ko:"기관 투자자",      en:"Institutions",       ja:"機関投資家"     },
  analystRatings:  { ko:"애널리스트 평가",  en:"Analyst Ratings",    ja:"アナリスト評価" },
  targetPrice:     { ko:"목표주가",         en:"Target Price",       ja:"目標株価"       },
  shortFloat:      { ko:"공매도비율",       en:"Short Float",        ja:"空売り比率"     },
  recentReports:   { ko:"최근 리포트",      en:"Recent Reports",     ja:"最近のレポート" },
  marketNews:      { ko:"시장 뉴스",        en:"Market News",        ja:"市場ニュース"   },
  stockNews:       { ko:"기업 뉴스",        en:"Company News",       ja:"企業ニュース"   },
  aiSummary:       { ko:"AI 요약",          en:"AI Summary",         ja:"AI要約"         },
  readMore:        { ko:"원문 보기",         en:"Read more",          ja:"続きを読む"     },
  noData:          { ko:"데이터 없음",       en:"No data",            ja:"データなし"     },
  loadFail:        { ko:"로드 실패",         en:"Load failed",        ja:"読込失敗"       },
  fearGreed:       { ko:"공포·탐욕",        en:"Fear / Greed",       ja:"恐怖·強欲"      },
  topSectors:      { ko:"섹터 동향",         en:"Sector Trends",      ja:"セクター動向"   },
  genAnalysis:     { ko:"AI 시장 분석 생성", en:"Generate AI Brief",  ja:"AI市場分析生成" },
  aiMarket:        { ko:"AI 시장 분석",      en:"AI Market Brief",    ja:"AI市場分析"     },
  noInsider:       { ko:"내부자 거래 없음",  en:"No insider trades",  ja:"内部者取引なし" },
  noHolders:       { ko:"보유 데이터 없음",  en:"No holder data",     ja:"保有データなし" },
  noAnalyst:       { ko:"애널리스트 데이터 없음",en:"No analyst data",ja:"データなし"    },
  loading:         { ko:"로딩 중...",         en:"Loading...",         ja:"読込中..."      },
  upside:          { ko:"상승여력",           en:"Upside",             ja:"上昇余地"       },
  shortSell:       { ko:"공매도비율",         en:"Short Float",        ja:"空売り"         },
  strongBuy:       { ko:"강매수",             en:"Strong Buy",         ja:"強買い"         },
  todayReports:    { ko:"오늘의 레포트",      en:"Today's Reports",    ja:"本日のレポート"  },
  domesticReport:  { ko:"국내 레포트",        en:"KR Reports",         ja:"国内レポート"   },
  intlReport:      { ko:"해외 레포트",        en:"Global Reports",     ja:"海外レポート"   },
  stockReport:     { ko:"기업 리서치",        en:"Company Research",   ja:"企業リサーチ"   },
  companyDesc:     { ko:"기업 소개",          en:"Company Overview",   ja:"企業概要"        },
  translateDesc:   { ko:"한국어로 번역",      en:"Translate",          ja:"翻訳する"        },
};
function T(key: string, lang: Lang): string { return L[key]?.[lang] ?? L[key]?.en ?? key; }

// Sector ETF → Korean name
const SECTOR_NAMES: Record<string,string> = {
  "XLK":"기술","XLV":"헬스케어","XLF":"금융","XLY":"소비(임의)",
  "XLE":"에너지","XLU":"유틸리티","XLB":"소재","XLI":"산업재",
  "XLC":"통신서비스","XLRE":"부동산","XLP":"필수소비",
};

// ══════════════════════════════════════════════════════════════════════════════
// FORMAT HELPERS
// ══════════════════════════════════════════════════════════════════════════════
function fmtPrice(v: number|undefined, sym?: string): string {
  if (v == null) return "—";
  if (sym === "BTC-USD") return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (sym?.endsWith(".KS") || sym === "^KS11") return Math.round(v).toLocaleString();
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(v: number|undefined): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
function fmtVol(v: number|undefined): string {
  if (!v) return "—";
  if (v >= 1_000_000_000) return `${(v/1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)     return `${(v/1_000_000).toFixed(1)}M`;
  if (v >= 1_000)         return `${(v/1_000).toFixed(0)}K`;
  return String(v);
}
function fmtMktCap(v: number|undefined, currency?: string): string {
  if (!v) return "—";
  if (currency === "KRW") {
    if (v >= 1_000_000_000_000) return `₩${(v/1_000_000_000_000).toFixed(1)}조`;
    return `₩${(v/100_000_000).toFixed(0)}억`;
  }
  if (v >= 1_000_000_000_000) return `$${(v/1_000_000_000_000).toFixed(2)}T`;
  if (v >= 1_000_000_000)     return `$${(v/1_000_000_000).toFixed(1)}B`;
  return `$${(v/1_000_000).toFixed(0)}M`;
}
function isUp(pct?: number) { return (pct ?? 0) >= 0; }

// ══════════════════════════════════════════════════════════════════════════════
// DATA HOOKS  (all with correct API field names)
// ══════════════════════════════════════════════════════════════════════════════

/** Batch live prices → { [symbol]: quoteObj } */
function useLivePrices(symbols: string[]) {
  return useQuery<Record<string,any>>({
    queryKey: ["/api/stocks/live", symbols.sort().join(",")],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live?symbols=${symbols.join(",")}`);
      if (!res.ok) throw new Error("live prices failed");
      const data = await res.json();
      const quotes: any[] = data.quotes || (Array.isArray(data) ? data : []);
      const map: Record<string,any> = {};
      for (const q of quotes) if (q?.symbol) map[q.symbol] = q;
      return map;
    },
    refetchInterval: 15_000,
    staleTime:  10_000,
    retry: 2,
  });
}

/** Single stock detail info (fundamentals) */
function useStockInfo(symbol: string) {
  return useQuery<any>({
    queryKey: ["/api/stocks/info", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/info/${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error("info failed");
      return res.json();
    },
    staleTime:  60_000,
    refetchInterval: 120_000,
    enabled: !!symbol,
    retry: 1,
  });
}

/** Historical OHLCV — returns the .data[] array directly */
function useHistory(symbol: string, period: string, interval: string) {
  return useQuery<any[]>({
    queryKey: ["/api/stocks/history", symbol, period, interval],
    queryFn: async () => {
      const res = await fetch(
        `/api/stocks/history/${encodeURIComponent(symbol)}?period=${period}&interval=${interval}`
      );
      if (!res.ok) throw new Error("history failed");
      const d = await res.json();
      return Array.isArray(d) ? d : (d?.data || []);
    },
    staleTime:  60_000,
    refetchInterval: 120_000,
    enabled: !!symbol,
    retry: 1,
  });
}

/** Fear & Greed — returns { index, label, dinoAdvice } */
function useMood() {
  return useQuery<any>({
    queryKey: ["/api/market/mood"],
    queryFn: async () => {
      const res = await fetch("/api/market/mood");
      if (!res.ok) throw new Error("mood failed");
      return res.json();
    },
    staleTime:  120_000,
    refetchInterval: 180_000,
    retry: 1,
  });
}

/** Sector returns — returns { sectors: [{symbol:"XLK", changePercent:1.3}] } */
function useSectors() {
  return useQuery<any>({
    queryKey: ["/api/sector-returns"],
    queryFn: async () => {
      const res = await fetch("/api/sector-returns");
      if (!res.ok) return { sectors: [] };
      return res.json();
    },
    staleTime:  120_000,
    refetchInterval: 300_000,
    retry: 1,
  });
}

/** Market gainers — returns array of quote objects */
function useGainers() {
  return useQuery<any[]>({
    queryKey: ["/api/market/gainers"],
    queryFn: async () => {
      const res = await fetch("/api/market/gainers");
      if (!res.ok) throw new Error("gainers failed");
      const d = await res.json();
      return Array.isArray(d) ? d : (d?.gainers || []);
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 1,
  });
}

/** News — returns [{ title, link, publisher, publishedAt, thumbnail }] */
function useNews(lang: Lang = "ko") {
  return useQuery<any[]>({
    queryKey: ["/api/news", lang],
    queryFn: async () => {
      const res = await fetch(`/api/news?lang=${lang}&limit=20`);
      if (!res.ok) throw new Error("news failed");
      const d = await res.json();
      return Array.isArray(d) ? d : (d?.news || []);
    },
    staleTime: 180_000,
    refetchInterval: 300_000,
    retry: 1,
  });
}

/** Economic calendar */
function useCalendar() {
  return useQuery<any[]>({
    queryKey: ["/api/economic-calendar", "current"],
    queryFn: async () => {
      const now = new Date();
      const res = await fetch(`/api/economic-calendar?year=${now.getFullYear()}&month=${now.getMonth()+1}`);
      if (!res.ok) throw new Error("calendar failed");
      const d = await res.json();
      return d?.events || [];
    },
    staleTime: 600_000,
    retry: 1,
  });
}

/** Company-specific news */
function useStockNews(symbol: string) {
  return useQuery<any>({
    queryKey: ["/api/stocks/news", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/news/${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error("stock news failed");
      return res.json();
    },
    staleTime: 300_000,
    retry: 1,
    enabled: !!symbol && !symbol.startsWith("^") && !symbol.endsWith("=F") && !symbol.endsWith("=X") && !symbol.startsWith("BTC"),
  });
}

/** Insider trades */
function useInsider(symbol: string) {
  return useQuery<any>({
    queryKey: ["/api/ownership", symbol, "insiders"],
    queryFn: async () => {
      const res = await fetch(`/api/ownership?ticker=${encodeURIComponent(symbol)}&type=insiders`);
      if (!res.ok) throw new Error("insider failed");
      return res.json();
    },
    staleTime: 3_600_000,
    retry: 1,
    enabled: !!symbol,
  });
}

/** Institutional holders */
function useInstitutional(symbol: string) {
  return useQuery<any>({
    queryKey: ["/api/ownership", symbol, "managers"],
    queryFn: async () => {
      const res = await fetch(`/api/ownership?ticker=${encodeURIComponent(symbol)}&type=managers`);
      if (!res.ok) throw new Error("institutional failed");
      return res.json();
    },
    staleTime: 3_600_000,
    retry: 1,
    enabled: !!symbol,
  });
}

/** Analyst ratings */
function useAnalyst(symbol: string) {
  return useQuery<any>({
    queryKey: ["/api/stocks/analyst", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/analyst/${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error("analyst failed");
      return res.json();
    },
    staleTime: 3_600_000,
    retry: 1,
    enabled: !!symbol,
  });
}

/** Live stock search via Yahoo Finance API */
function useStockSearch(query: string) {
  return useQuery<{ticker:string; name:string}[]>({
    queryKey: ["/api/stocks/search", query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const d = await res.json();
      return (d.results || []).map((r: any) => ({ ticker: r.symbol, name: r.name }));
    },
    enabled: query.length >= 2,
    staleTime: 60_000,
    retry: false,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ══════════════════════════════════════════════════════════════════════════════
function StatusBadge({ isLoading, isError, isStale, isLive }: {
  isLoading?: boolean; isError?: boolean; isStale?: boolean; isLive?: boolean;
}) {
  if (isLoading) return (
    <span className="flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded"
      style={{ background: C.muted+"22", color: C.muted }}>
      <RefreshCw className="w-2 h-2 animate-spin" /> LOADING
    </span>
  );
  if (isError) return (
    <span className="flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded"
      style={{ background: C.down+"22", color: C.down }}>
      <AlertTriangle className="w-2 h-2" /> ERROR
    </span>
  );
  if (isStale) return (
    <span className="flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded"
      style={{ background: C.warn+"22", color: C.warn }}>
      <Clock className="w-2 h-2" /> DELAYED
    </span>
  );
  if (isLive) return (
    <span className="flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded"
      style={{ background: C.up+"22", color: C.up }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.up }} />
      LIVE
    </span>
  );
  return null;
}

// Skeleton row for tables
function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex gap-2 px-2 py-1.5 border-b" style={{ borderColor: C.border+"50" }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="h-2.5 rounded animate-pulse" style={{
          background: C.border, flex: i === 0 ? "0 0 60px" : 1
        }} />
      ))}
    </div>
  );
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
  const kst = t.toLocaleTimeString("ko-KR", { hour:"2-digit", minute:"2-digit", second:"2-digit", timeZone:"Asia/Seoul", hour12:false });
  const ny  = t.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", hour12:false, timeZone:"America/New_York" });
  return (
    <div className="flex items-center gap-2 text-[13px] font-mono shrink-0">
      <span style={{ color: C.muted }}>KST</span>
      <span style={{ color: C.text }}>{kst}</span>
      <span className="w-px h-3" style={{ background: C.border }} />
      <span style={{ color: C.muted }}>NY</span>
      <span style={{ color: C.text }}>{ny}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INDEX TICKER STRIP
// ══════════════════════════════════════════════════════════════════════════════
function IndexStrip() {
  const { data: stocks, isLoading } = useLivePrices(INDEX_SYMS);
  const items = [...INDEX_SYMS, ...INDEX_SYMS];

  return (
    <div className="flex items-center overflow-hidden border-b shrink-0"
      style={{ background: C.header, borderColor: C.border, height: 26 }}>
      {isLoading ? (
        <div className="flex items-center gap-4 px-3">
          {INDEX_SYMS.map(s => (
            <span key={s} className="text-[13px] font-mono" style={{ color: C.muted }}>{INDEX_LBL[s]} ···</span>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-5 animate-[ticker_25s_linear_infinite] whitespace-nowrap px-3">
          {items.map((sym, i) => {
            const q = stocks?.[sym];
            const up = isUp(q?.changePercent);
            return (
              <span key={`${sym}-${i}`} className="flex items-center gap-1.5 shrink-0">
                <span className="text-[13px] font-mono" style={{ color: C.muted }}>{INDEX_LBL[sym]}</span>
                <span className="text-[13px] font-mono font-bold" style={{ color: C.text }}>
                  {q ? fmtPrice(q.price, sym) : "—"}
                </span>
                {q && (
                  <span className={cn("text-[13px] font-mono font-semibold", up ? "text-[#00c896]" : "text-[#ff4757]")}>
                    {fmtPct(q.changePercent)}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MARKET PULSE WIDGET  (fear/greed = mood.index, not fearGreedIndex)
// ══════════════════════════════════════════════════════════════════════════════
function MarketPulseWidget({ liveStocks }: { liveStocks: Record<string,any> }) {
  const { data: mood, isLoading, isError } = useMood();

  // mood.index is 0-100, mood.label is Korean string
  const fg    = mood?.index;
  const label = mood?.label ?? (fg == null ? "—" : fg > 65 ? "탐욕" : fg > 45 ? "중립" : fg > 25 ? "공포" : "극공포");
  const fgClr = fg == null ? C.muted : fg > 65 ? C.up : fg > 45 ? C.warn : fg > 25 ? "#ff8c00" : C.down;
  const spy   = liveStocks["SPY"];

  return (
    <div className="p-3 border-b" style={{ borderColor: C.border }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase" style={{ color: C.muted }}>
          MARKET PULSE
        </span>
        <StatusBadge isLoading={isLoading} isError={isError}
          isLive={!isLoading && !isError && fg != null} />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-8 rounded animate-pulse" style={{ background: C.border }} />
          <div className="h-4 rounded animate-pulse" style={{ background: C.border }} />
        </div>
      ) : isError ? (
        <div className="text-[13px] font-mono py-2" style={{ color: C.down }}>
          데이터 로드 실패
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2">
            <div className="shrink-0 text-center w-14">
              <div className="text-[12px] font-mono" style={{ color: C.muted }}>공포&탐욕</div>
              <div className="text-2xl font-black font-mono leading-none" style={{ color: fgClr }}>
                {fg ?? "—"}
              </div>
              <div className="text-[12px] font-mono font-bold" style={{ color: fgClr }}>{label}</div>
            </div>
            <div className="flex-1">
              <div className="relative h-2 rounded-full overflow-hidden mb-1.5"
                style={{ background: "linear-gradient(to right,#ff4757,#ffc107,#00c896)" }}>
                {fg != null && (
                  <div className="absolute w-2.5 h-2.5 rounded-full border-2 border-white"
                    style={{ left:`${fg}%`, top:"50%", transform:"translate(-50%,-50%)",
                      background: fgClr, boxShadow:`0 0 6px ${fgClr}` }} />
                )}
              </div>
              <div className="flex justify-between text-[11px] font-mono" style={{ color: C.muted }}>
                <span>극공포</span><span>극탐욕</span>
              </div>
            </div>
          </div>
          {/* Index snapshot */}
          <div className="grid grid-cols-3 gap-1">
            {(["SPY","QQQ","^KS11"] as const).map(sym => {
              const q = liveStocks[sym];
              const up = isUp(q?.changePercent);
              return (
                <div key={sym} className="rounded px-1.5 py-1 text-center"
                  style={{ background: q ? (up ? C.up+"0d" : C.down+"0d") : C.border+"30",
                    border:`1px solid ${q ? (up ? C.up+"30" : C.down+"30") : C.border}` }}>
                  <div className="text-[11px] font-mono" style={{ color: C.muted }}>{INDEX_LBL[sym] || sym.replace("^","")}</div>
                  <div className={cn("text-[14px] font-bold font-mono", up ? "text-[#00c896]" : "text-[#ff4757]")}>
                    {q ? fmtPct(q.changePercent) : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WATCH EDIT MODAL
// ══════════════════════════════════════════════════════════════════════════════
function WatchEditModal({ watchSyms, watchNames, onUpdate, onClose }: {
  watchSyms: string[];
  watchNames: Record<string,string>;
  onUpdate: (syms: string[], names: Record<string,string>) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/stocks/search?query=${encodeURIComponent(query.trim())}`);
        const d = await r.json();
        setSearchResults((Array.isArray(d) ? d : (d.results || [])).slice(0, 8));
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  function addSym(sym: string, name: string) {
    if (watchSyms.includes(sym) || watchSyms.length >= 20) return;
    const newSyms = [...watchSyms, sym];
    const newNames = { ...watchNames, [sym]: name };
    onUpdate(newSyms, newNames);
  }

  function removeSym(sym: string) {
    if (watchSyms.length <= 1) return;
    const newSyms = watchSyms.filter(s => s !== sym);
    onUpdate(newSyms, watchNames);
  }

  function reset() {
    onUpdate([...DEFAULT_WATCH_SYMS], { ...DEFAULT_WATCH_NAMES });
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[320px] max-h-[80vh] flex flex-col rounded-lg overflow-hidden"
        style={{ background: C.panel, border: `1px solid ${C.border}` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b shrink-0"
          style={{ borderColor: C.border, background: C.header }}>
          <span className="text-[14px] font-mono font-bold tracking-widest uppercase"
            style={{ color: C.text }}>WATCH GRID 편집</span>
          <div className="flex items-center gap-2">
            <button onClick={reset}
              className="text-[12px] font-mono px-2 py-0.5 rounded"
              style={{ background: C.border, color: C.muted }}>
              초기화
            </button>
            <button onClick={onClose}
              className="text-[14px] font-mono font-bold w-5 h-5 flex items-center justify-center rounded"
              style={{ color: C.muted, background: C.border }}>✕</button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b shrink-0" style={{ borderColor: C.border }}>
          <div className="relative">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="종목 검색 (AAPL, 삼성전자...)"
              className="w-full px-2.5 py-1.5 text-[14px] font-mono rounded outline-none"
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text,
                "::placeholder": { color: C.muted } as any }}
            />
            {searching && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] font-mono"
                style={{ color: C.muted }}>검색 중...</span>
            )}
          </div>
          {searchResults.length > 0 && (
            <div className="mt-1.5 rounded overflow-hidden"
              style={{ border: `1px solid ${C.border}` }}>
              {searchResults.map((r: any) => {
                const already = watchSyms.includes(r.symbol);
                const full = watchSyms.length >= 20;
                return (
                  <button key={r.symbol}
                    disabled={already || full}
                    onClick={() => { addSym(r.symbol, r.name || r.symbol); setQuery(""); setSearchResults([]); }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-left border-b last:border-0 transition-colors"
                    style={{ borderColor: C.border, background: "transparent" }}
                    onMouseEnter={e => !already && !full && ((e.currentTarget as HTMLElement).style.background = C.panel2)}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
                    <div className="min-w-0">
                      <span className="text-[14px] font-mono font-bold"
                        style={{ color: already ? C.muted : C.info }}>{r.symbol}</span>
                      <span className="text-[12px] font-mono ml-1.5 truncate"
                        style={{ color: C.muted }}>{r.name}</span>
                    </div>
                    <span className="text-[13px] font-mono shrink-0 ml-2"
                      style={{ color: already ? C.muted : C.up }}>
                      {already ? "✓" : full ? "max" : "+추가"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Current list */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          <div className="px-3 py-1.5 border-b"
            style={{ borderColor: C.border }}>
            <span className="text-[12px] font-mono" style={{ color: C.muted }}>
              현재 {watchSyms.length}/20개 종목
            </span>
          </div>
          {watchSyms.map((sym, idx) => {
            const name = watchNames[sym] || "";
            const ticker = sym.replace(".KS","").replace("^","").replace("=F","").replace("=X","");
            return (
              <div key={sym}
                className="flex items-center justify-between px-3 py-1.5 border-b"
                style={{ borderColor: C.border + "60" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[12px] font-mono w-4 text-center shrink-0"
                    style={{ color: C.muted }}>{idx + 1}</span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-mono font-bold"
                      style={{ color: C.text }}>{ticker}</div>
                    {name && <div className="text-[12px] font-mono truncate"
                      style={{ color: C.muted }}>{name}</div>}
                  </div>
                </div>
                <button
                  onClick={() => removeSym(sym)}
                  disabled={watchSyms.length <= 1}
                  className="text-[14px] font-mono w-5 h-5 flex items-center justify-center rounded shrink-0 transition-colors"
                  style={{ color: C.muted }}
                  onMouseEnter={e => watchSyms.length > 1 && ((e.currentTarget as HTMLElement).style.color = C.down)}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = C.muted)}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="px-3 py-2 border-t shrink-0"
          style={{ borderColor: C.border, background: C.header }}>
          <span className="text-[12px] font-mono" style={{ color: C.muted }}>
            최대 20개 · 변경사항은 자동 저장됩니다
          </span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// WATCH GRID  (real live data, selected symbol highlight)
// ══════════════════════════════════════════════════════════════════════════════
function WatchGrid({ stocks, onSelect, selected, isLoading, watchSyms, watchNames, onEditOpen }: {
  stocks: Record<string,any>;
  onSelect: (s:string)=>void;
  selected: string;
  isLoading: boolean;
  watchSyms: string[];
  watchNames: Record<string,string>;
  onEditOpen: () => void;
}) {
  return (
    <div className="border-b" style={{ borderColor: C.border }}>
      <div className="flex items-center justify-between px-2 py-1.5 border-b"
        style={{ borderColor: C.border, background: C.header }}>
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase" style={{ color: C.muted }}>
          WATCH GRID
        </span>
        <button onClick={onEditOpen}
          className="text-[12px] font-mono transition-colors"
          style={{ color: C.info }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#7ec8ff")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = C.info)}>
          ✏ 편집
        </button>
      </div>
      {/* Header */}
      <div className="grid px-2 py-1" style={{ gridTemplateColumns:"1fr 52px 42px 30px" }}>
        {["TICKER","LAST","CHG%","VOL"].map(h => (
          <span key={h} className="text-[11px] font-mono uppercase text-right first:text-left"
            style={{ color: C.muted }}>{h}</span>
        ))}
      </div>
      {/* Rows */}
      {isLoading
        ? Array.from({length:6}).map((_,i) => <SkeletonRow key={i} />)
        : watchSyms.map(sym => {
            const q = stocks[sym];
            const up = isUp(q?.changePercent);
            const sel = sym === selected;
            return (
              <button key={sym} onClick={() => onSelect(sym)}
                className="w-full grid px-2 py-0.5 text-right transition-all"
                style={{
                  gridTemplateColumns:"1fr 52px 42px 30px",
                  background: sel ? "#1a2d42" : "transparent",
                  borderLeft:`2px solid ${sel ? C.info : "transparent"}`,
                }}>
                <div className="text-left min-w-0">
                  {(() => {
                    const isKR = sym.endsWith(".KS");
                    const koName = watchNames[sym] || "";
                    const ticker = sym.replace(".KS","").replace("^","").replace("=F","").replace("=X","");
                    return isKR && koName ? (
                      <>
                        <div className="text-[13px] font-mono font-bold leading-tight truncate"
                          style={{ color: sel ? C.info : C.text }}>{koName}</div>
                        <div className="text-[11px] font-mono leading-tight"
                          style={{ color: C.muted }}>{ticker}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-[13px] font-mono font-bold leading-tight"
                          style={{ color: sel ? C.info : C.text }}>{ticker}</div>
                        {koName && <div className="text-[11px] font-mono truncate leading-tight"
                          style={{ color: C.muted }}>{koName}</div>}
                      </>
                    );
                  })()}
                </div>
                <div className="text-[14px] font-mono" style={{ color: C.text }}>
                  {q ? fmtPrice(q.price, sym) : <span style={{ color: C.muted }}>—</span>}
                </div>
                <div className={cn("text-[14px] font-mono font-bold",
                  q ? (up ? "text-[#00c896]" : "text-[#ff4757]") : "")}>
                  {q ? fmtPct(q.changePercent) : <span style={{ color: C.muted }}>—</span>}
                </div>
                <div className="text-[13px] font-mono" style={{ color: C.muted }}>
                  {q ? fmtVol(q.volume) : "—"}
                </div>
              </button>
            );
          })
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTOR MAP  (ETF symbols: XLK, XLV, … + changePercent field)
// ══════════════════════════════════════════════════════════════════════════════
function SectorMap() {
  const { data, isLoading, isError } = useSectors();
  const sectors: any[] = data?.sectors || [];

  return (
    <div className="border-b" style={{ borderColor: C.border }}>
      <div className="px-2 py-1.5 border-b flex items-center justify-between"
        style={{ borderColor: C.border, background: C.header }}>
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase" style={{ color: C.muted }}>
          SECTOR MAP
        </span>
        <div className="flex items-center gap-2">
          <StatusBadge isLoading={isLoading} isError={isError}
            isLive={!isLoading && !isError && sectors.length > 0} />
          <Link href="/market-trends" className="text-[12px] font-mono" style={{ color: C.info }}>→</Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-px m-1.5" style={{ background: C.border }}>
          {Array.from({length:8}).map((_,i) => (
            <div key={i} className="h-10 animate-pulse" style={{ background: C.panel2 }} />
          ))}
        </div>
      ) : isError || sectors.length === 0 ? (
        <div className="px-2 py-3 text-[13px] font-mono" style={{ color: C.muted }}>데이터 없음</div>
      ) : (
        <div className="grid grid-cols-2 gap-px p-1.5" style={{ background: C.border }}>
          {sectors.map((sec: any) => {
            const name = SECTOR_NAMES[sec.symbol] || sec.symbol;
            const pct  = sec.changePercent ?? 0;   // ← correct field name
            const up   = pct >= 0;
            const intensity = Math.min(Math.abs(pct) / 3, 1);
            const bg = up
              ? `rgba(0,200,150,${0.08 + intensity*0.25})`
              : `rgba(255,71,87,${0.08 + intensity*0.25})`;
            return (
              <div key={sec.symbol} className="flex flex-col p-1.5 rounded-sm" style={{ background: bg }}>
                <span className="text-[12px] font-mono truncate" style={{ color: C.muted }}>{name}</span>
                <span className={cn("text-[14px] font-mono font-bold", up ? "text-[#00c896]" : "text-[#ff4757]")}>
                  {fmtPct(pct)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MARKET MOVERS PANEL  — 급상승/급하락/거래량/거래대금
// ══════════════════════════════════════════════════════════════════════════════
type MoverTab = "vol"|"value"|"up"|"down";
function MarketMoversPanel({ onSelect }: { onSelect?: (s: string) => void }) {
  const [tab, setTab] = useState<MoverTab>("vol");

  const { data: gainers = [], isLoading: gLd } = useQuery<any[]>({
    queryKey: ["/api/market/gainers"],
    staleTime: 3 * 60 * 1000,
  });
  const { data: losers = [], isLoading: lLd } = useQuery<any[]>({
    queryKey: ["/api/market/losers"],
    staleTime: 3 * 60 * 1000,
  });
  const { data: actives = [], isLoading: aLd } = useQuery<any[]>({
    queryKey: ["/api/market/actives"],
    staleTime: 3 * 60 * 1000,
  });

  const byValue = [...actives]
    .filter(a => a.volume > 0 && a.price > 0)
    .sort((a, b) => (b.price * b.volume) - (a.price * a.volume));

  const rows: any[] = tab === "up"    ? gainers.slice(0, 8)
    : tab === "down"  ? losers.slice(0, 8)
    : tab === "vol"   ? actives.slice(0, 8)
    : byValue.slice(0, 8);

  const isLd = tab === "up" ? gLd : tab === "down" ? lLd : aLd;

  const TABS: { id: MoverTab; ko: string; color: string }[] = [
    { id:"vol",   ko:"거래량",  color: C.info },
    { id:"value", ko:"거래대금", color: C.warn },
    { id:"up",    ko:"급상승",  color: C.up },
    { id:"down",  ko:"급하락",  color: C.down },
  ];

  return (
    <div className="border-b" style={{ borderColor: C.border }}>
      {/* Header */}
      <div className="px-2 py-1 border-b flex items-center gap-1.5"
        style={{ borderColor: C.border, background: C.header }}>
        <span className="text-[12px] font-mono font-bold tracking-widest" style={{ color: C.accent }}>▶</span>
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase" style={{ color: C.text }}>
          MARKET SCAN
        </span>
      </div>
      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: C.border }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-1 text-[12px] font-mono font-bold transition-colors"
            style={{
              color:      tab === t.id ? t.color : C.muted,
              borderBottom: `1.5px solid ${tab === t.id ? t.color : "transparent"}`,
              background: tab === t.id ? t.color + "15" : "transparent",
            }}>
            {t.ko}
          </button>
        ))}
      </div>
      {/* Rows */}
      <div style={{ minHeight: 100 }}>
        {isLd ? (
          <div className="flex items-center justify-center py-5">
            <RefreshCw className="w-3 h-3 animate-spin" style={{ color: C.muted }} />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-2 py-3 text-[12px] font-mono text-center" style={{ color: C.muted }}>
            장 마감 후 갱신
          </div>
        ) : rows.map(item => {
          const up = (item.changePercent ?? 0) >= 0;
          const ticker = (item.symbol || "").replace(".KS","").replace("^","");
          const vol = item.volume || 0;
          const val = (item.price || 0) * vol;
          return (
            <button key={item.symbol} type="button"
              onClick={() => onSelect?.(item.symbol)}
              className="w-full flex items-center justify-between px-2 py-1 border-t text-left transition-colors"
              style={{ borderColor: C.border + "25", cursor: onSelect ? "pointer" : "default" }}
              onMouseEnter={e => (e.currentTarget.style.background = C.accent + "08")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-mono font-bold truncate"
                  style={{ color: C.text }}>{ticker}</div>
                <div className="text-[10px] font-mono truncate"
                  style={{ color: C.muted }}>{(item.name||"").slice(0,15)}</div>
              </div>
              <div className="text-right ml-1 shrink-0">
                <div className="text-[12px] font-mono font-bold"
                  style={{ color: up ? C.up : C.down }}>
                  {up ? "▲" : "▼"}{Math.abs(item.changePercent ?? 0).toFixed(1)}%
                </div>
                <div className="text-[11px] font-mono" style={{ color: C.muted }}>
                  {tab === "vol"
                    ? (item.volumeRatio > 0 ? `×${item.volumeRatio.toFixed(1)}` : fmtVol(vol))
                    : tab === "value"
                    ? `$${val >= 1e9 ? (val/1e9).toFixed(1)+"B" : val >= 1e6 ? (val/1e6).toFixed(0)+"M" : fmtVol(val)}`
                    : `$${(item.price||0).toFixed((item.price||0) < 5 ? 3 : 1)}`
                  }
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VOLUME PULSE PANEL  — 주요 지수 거래량 강도 (compact)
// ══════════════════════════════════════════════════════════════════════════════
function VolumePulsePanel() {
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/market/volume-pulse"],
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="border-b" style={{ borderColor: C.border }}>
      <div className="px-2 py-1 border-b flex items-center justify-between"
        style={{ borderColor: C.border, background: C.header }}>
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase" style={{ color: C.text }}>
          VOL PULSE
        </span>
        <span className="text-[10px] font-mono" style={{ color: C.muted }}>vs 3M avg</span>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <RefreshCw className="w-3 h-3 animate-spin" style={{ color: C.muted }} />
        </div>
      ) : data.length === 0 ? (
        <div className="px-2 py-2 text-[12px] font-mono" style={{ color: C.muted }}>—</div>
      ) : (
        <div className="px-1.5 py-1 space-y-0.5">
          {data.map(item => {
            const ratio = item.volumeRatio || 0;
            const barColor = ratio >= 2 ? C.down : ratio >= 1.3 ? C.warn : ratio >= 0.8 ? C.up : C.muted;
            const label = ratio >= 2 ? "폭증" : ratio >= 1.3 ? "↑" : ratio >= 0.8 ? "─" : "↓";
            const up = (item.changePercent ?? 0) >= 0;
            const barW = Math.min(Math.max(ratio / 2.5 * 100, 4), 100);
            return (
              <div key={item.symbol} className="flex items-center gap-1">
                {/* Label */}
                <span className="text-[11px] font-mono font-bold w-[42px] shrink-0" style={{ color: C.text }}>
                  {item.label || item.symbol}
                </span>
                {/* Bar */}
                <div className="flex-1 relative h-[5px] rounded-full overflow-hidden" style={{ background: C.border }}>
                  <div className="absolute h-full rounded-full"
                    style={{ width: `${barW}%`, background: barColor, opacity: 0.75 }} />
                </div>
                {/* Ratio badge */}
                <span className="text-[11px] font-mono font-bold w-[28px] text-right shrink-0"
                  style={{ color: barColor }}>
                  {ratio > 0 ? `×${ratio.toFixed(1)}` : "—"}
                </span>
                {/* Change */}
                <span className="text-[11px] font-mono w-[28px] text-right shrink-0"
                  style={{ color: up ? C.up : C.down }}>
                  {up ? "▲" : "▼"}{Math.abs(item.changePercent ?? 0).toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CRYPTO MINI PANEL  (in Market tab)
// ══════════════════════════════════════════════════════════════════════════════
const CRYPTO_DEF = [
  { sym:"BTC-USD", label:"BTC", emoji:"₿" },
  { sym:"ETH-USD", label:"ETH", emoji:"Ξ" },
  { sym:"SOL-USD", label:"SOL", emoji:"◎" },
  { sym:"XRP-USD", label:"XRP", emoji:"✕" },
];
function CryptoMiniPanel({ stocks }: { stocks: Record<string,any> }) {
  return (
    <div className="border-b" style={{ borderColor: C.border }}>
      <div className="px-2 py-1.5 border-b flex items-center justify-between"
        style={{ borderColor: C.border, background: C.header }}>
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase" style={{ color: C.muted }}>
          CRYPTO
        </span>
      </div>
      <div className="grid grid-cols-2 gap-px" style={{ background: C.border }}>
        {CRYPTO_DEF.map(({ sym, label, emoji }) => {
          const q  = stocks[sym];
          const up = isUp(q?.changePercent);
          return (
            <div key={sym} className="p-1.5 flex flex-col" style={{ background: C.panel2 }}>
              <span className="text-[11px] font-mono" style={{ color: C.muted }}>{emoji} {label}</span>
              <span className="text-[13px] font-mono font-bold" style={{ color: C.text }}>
                {q ? `$${q.price >= 1000 ? q.price.toLocaleString(undefined,{maximumFractionDigits:0}) : q.price.toFixed(q.price < 1 ? 4 : 2)}` : "—"}
              </span>
              <span className="text-[12px] font-mono font-bold" style={{ color: q ? (up ? C.up : C.down) : C.muted }}>
                {q ? fmtPct(q.changePercent) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RATES MINI PANEL  (in Market tab)
// ══════════════════════════════════════════════════════════════════════════════
const RATES_DEF = [
  { sym:"^TNX",  label:"10Y",  desc:"미국 10년금리" },
  { sym:"^FVX",  label:"5Y",   desc:"미국 5년금리" },
  { sym:"^IRX",  label:"3M",   desc:"단기금리" },
  { sym:"^VIX",  label:"VIX",  desc:"공포지수" },
];
function RatesMiniPanel({ stocks }: { stocks: Record<string,any> }) {
  return (
    <div className="border-b" style={{ borderColor: C.border }}>
      <div className="px-2 py-1.5 border-b flex items-center"
        style={{ borderColor: C.border, background: C.header }}>
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase" style={{ color: C.muted }}>
          RATES &amp; VOLATILITY
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: C.border }}>
        {RATES_DEF.map(({ sym, label, desc }) => {
          const q  = stocks[sym];
          const up = isUp(q?.changePercent);
          return (
            <div key={sym} className="flex items-center justify-between px-2 py-1"
              style={{ borderColor: C.border+"40" }}>
              <div>
                <span className="text-[12px] font-mono font-bold" style={{ color: C.info }}>{label}</span>
                <span className="text-[11px] font-mono ml-1" style={{ color: C.muted }}>{desc}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-mono font-bold" style={{ color: C.text }}>
                  {q ? q.price?.toFixed(2) : "—"}
                </span>
                <span className="text-[11px] font-mono font-bold w-14 text-right"
                  style={{ color: q ? (up ? C.up : C.down) : C.muted }}>
                  {q ? fmtPct(q.changePercent) : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GLOBAL INDICES MINI  (in Market tab — compact 3-col grid)
// ══════════════════════════════════════════════════════════════════════════════
const GLOBAL_MINI = [
  { sym:"SPY",    label:"S&P500", flag:"🇺🇸" },
  { sym:"QQQ",    label:"NASDAQ", flag:"🇺🇸" },
  { sym:"^KS11",  label:"코스피",  flag:"🇰🇷" },
  { sym:"^IXIC",  label:"NDX",    flag:"🇺🇸" },
  { sym:"^N225",  label:"닛케이", flag:"🇯🇵" },
  { sym:"^GDAXI", label:"DAX",    flag:"🇩🇪" },
  { sym:"^FTSE",  label:"FTSE",   flag:"🇬🇧" },
  { sym:"^HSI",   label:"항셍",   flag:"🇭🇰" },
  { sym:"GC=F",   label:"Gold",   flag:"🥇" },
];
function GlobalMiniPanel({ stocks }: { stocks: Record<string,any> }) {
  return (
    <div className="border-b" style={{ borderColor: C.border }}>
      <div className="px-2 py-1.5 border-b flex items-center"
        style={{ borderColor: C.border, background: C.header }}>
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase" style={{ color: C.muted }}>
          GLOBAL INDICES
        </span>
      </div>
      <div className="grid grid-cols-3 gap-px" style={{ background: C.border }}>
        {GLOBAL_MINI.map(({ sym, label, flag }) => {
          const q  = stocks[sym];
          const up = isUp(q?.changePercent);
          return (
            <div key={sym} className="p-1.5" style={{ background: C.panel2 }}>
              <div className="text-[11px] font-mono" style={{ color: C.muted }}>{flag} {label}</div>
              <div className="text-[12px] font-mono font-bold"
                style={{ color: q ? (up ? C.up : C.down) : C.muted }}>
                {q ? fmtPct(q.changePercent) : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FLOW RADAR  (derived from live prices)
// ══════════════════════════════════════════════════════════════════════════════
function FlowRadar({ stocks }: { stocks: Record<string,any> }) {
  const flows = [
    { label:"Equity",  sym:"SPY",    factor: 1   },
    { label:"Tech",    sym:"QQQ",    factor: 1   },
    { label:"KR Mkt",  sym:"^KS11",  factor: 1   },
    { label:"Gold",    sym:"GC=F",   factor: 1   },
    { label:"Crypto",  sym:"BTC-USD",factor: 0.1 },
  ];
  return (
    <div className="p-3 border-b" style={{ borderColor: C.border }}>
      <div className="text-[12px] font-mono font-bold tracking-widest uppercase mb-1.5"
        style={{ color: C.muted }}>FLOW RADAR</div>
      {flows.map(({ label, sym, factor }) => {
        const q   = stocks[sym];
        const pct = (q?.changePercent ?? null);
        const val = pct != null ? pct * factor : null;
        const up  = val == null ? true : val >= 0;
        const barW = val != null ? Math.min(Math.abs(val) * 8, 48) : 0;
        return (
          <div key={label} className="flex items-center gap-2 mb-1">
            <span className="w-14 text-[12px] font-mono shrink-0" style={{ color: C.muted }}>{label}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden flex items-center"
              style={{ background: "#1a2030" }}>
              <div className="h-full rounded-full" style={{
                width:`${barW}%`,
                marginLeft: val != null && val >= 0 ? "50%" : `${50 - barW}%`,
                background: up ? C.up : C.down,
              }} />
            </div>
            <span className={cn("w-12 text-right text-[12px] font-mono font-semibold shrink-0",
              val == null ? "" : up ? "text-[#00c896]" : "text-[#ff4757]")}
              style={val == null ? { color: C.muted } : {}}>
              {val != null ? fmtPct(val) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PRICE CHART  (history.data[] → close/date/volume)
// ══════════════════════════════════════════════════════════════════════════════
const PERIODS: {label:string; period:string; interval:string}[] = [
  { label:"1D",  period:"1d",   interval:"5m"  },
  { label:"5D",  period:"5d",   interval:"1h"  },
  { label:"1M",  period:"1mo",  interval:"1d"  },
  { label:"3M",  period:"3mo",  interval:"1d"  },
  { label:"6M",  period:"6mo",  interval:"1d"  },
  { label:"1Y",  period:"1y",   interval:"1wk" },
];

/** Extract HH:MM from ISO date string for 1D time labels */
function extractHHMM(isoDate: string): string {
  if (!isoDate) return "";
  const m = isoDate.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : isoDate.slice(11, 16);
}

/** Price formatter for Y-axis — compact KRW/USD */
function fmtYTick(v: number, sym: string): string {
  const isKR = sym.endsWith(".KS") || sym.endsWith(".KQ");
  if (isKR) {
    if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `${(v/1_000).toFixed(0)}K`;
    return String(Math.round(v));
  }
  if (v >= 100_000) return `$${(v/1_000).toFixed(0)}K`;
  if (v >= 10_000)  return `$${(v/1_000).toFixed(0)}K`;
  if (v >= 1_000)   return `$${(v/1_000).toFixed(1)}K`;
  if (v >= 100)     return `$${v.toFixed(0)}`;
  return `$${v.toFixed(1)}`;
}

/** Date formatter for X-axis — YYYY-MM-DD → M/D  |  HH:MM passthrough */
function fmtXTick(t: string, is1D: boolean): string {
  if (is1D || !t || t.length < 10) return t;
  const parts = t.split("-");
  if (parts.length >= 3) {
    return `${parseInt(parts[1])}/${parseInt(parts[2].slice(0, 2))}`;
  }
  return t;
}

function PriceChart({ symbol, periodIdx, isMarketOpen = false, prevClose = 0 }: {
  symbol:string; periodIdx:number; isMarketOpen?:boolean; prevClose?:number
}) {
  const { period, interval } = PERIODS[periodIdx];
  const is1D     = periodIdx === 0;
  const liveMode = is1D && isMarketOpen;

  const { data: raw, isLoading, isError } = useQuery<any[]>({
    queryKey: ["/api/stocks/history", symbol, period, interval],
    queryFn: async () => {
      const res = await fetch(
        `/api/stocks/history/${encodeURIComponent(symbol)}?period=${period}&interval=${interval}`
      );
      if (!res.ok) throw new Error("history failed");
      const d = await res.json();
      return Array.isArray(d) ? d : (d?.data || []);
    },
    staleTime:       liveMode ? 0      : 60_000,
    refetchInterval: liveMode ? 30_000 : 120_000,
    enabled:  !!symbol,
    retry:    1,
    placeholderData: keepPreviousData,
  });

  const rows = (raw || []).map((d:any) => ({
    t:     is1D ? extractHHMM(d.date) : (d.date || "").slice(0, 10),
    close: d.close,
    vol:   d.volume ?? 0,
  })).filter((d:any) => d.close != null && d.close > 0);

  if (isLoading && rows.length === 0) return (
    <div className="flex items-center justify-center h-full gap-2" style={{ color: C.muted }}>
      <RefreshCw className="w-4 h-4 animate-spin" />
      <span className="text-[14px] font-mono">차트 로딩중...</span>
    </div>
  );
  if (isError && rows.length === 0) return (
    <div className="flex items-center justify-center h-full gap-2" style={{ color: C.down }}>
      <AlertTriangle className="w-4 h-4" />
      <span className="text-[14px] font-mono">차트 로드 실패</span>
    </div>
  );
  if (!rows.length) return (
    <div className="flex items-center justify-center h-full text-[14px] font-mono"
      style={{ color: C.muted }}>데이터 없음</div>
  );

  const prices   = rows.map(r => r.close);
  const minP     = Math.min(...prices) * 0.997;
  const maxP     = Math.max(...prices) * 1.003;
  const startP   = rows[0].close;
  const endP     = rows[rows.length - 1].close;
  // 1D: color based on prevClose (yesterday's close) so +4% shows green even if intraday dipped
  const baseP    = (is1D && prevClose > 0) ? prevClose : startP;
  const totalPct = baseP ? ((endP - baseP) / baseP * 100) : 0;
  const up       = totalPct >= 0;
  const stroke   = up ? C.up : C.down;

  // Volume: set domain so bars occupy bottom ~22% of chart height
  const maxVol   = Math.max(...rows.map(r => r.vol), 1);
  const volDomainMax = maxVol * 4.5;   // bars fill ~1/4.5 ≈ 22% of chart

  // X-axis: ~5-6 labels regardless of bar count
  const xInterval = is1D
    ? Math.max(6, Math.floor(rows.length / 6))
    : Math.max(1, Math.floor(rows.length / 5));

  const Y_W = 36;
  const tickStyle = { fill: C.muted, fontSize: 7, fontFamily: "monospace" } as const;

  return (
    <div className="h-full flex flex-col">
      {/* ── Header row ── */}
      <div className="flex items-center gap-2 px-2 pb-0.5 shrink-0">
        <span className="text-[12px] font-mono" style={{ color: C.muted }}>기간수익률</span>
        <span className={cn("text-[13px] font-mono font-bold", up ? "text-[#00c896]" : "text-[#ff4757]")}>
          {fmtPct(totalPct)}
        </span>
        {liveMode && (
          <span className="flex items-center gap-0.5 text-[11px] font-mono px-1 py-0.5 rounded"
            style={{ background: C.up+"22", color: C.up }}>
            <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: C.up }} />
            LIVE
          </span>
        )}
        <span className="text-[12px] font-mono ml-auto" style={{ color: C.muted }}>({rows.length}개)</span>
      </div>

      {/* ── Single ComposedChart: price area + volume bars share the same x-axis ── */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: Y_W, left: 2, bottom: 0 }}>
            <defs>
              <linearGradient id={`cg-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={stroke} stopOpacity={0.25} />
                <stop offset="95%" stopColor={stroke} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={C.border} strokeOpacity={0.5} />
            <XAxis
              dataKey="t"
              tick={tickStyle}
              axisLine={{ stroke: C.border, strokeWidth: 0.5 }}
              tickLine={false}
              tickFormatter={(t) => fmtXTick(t, is1D)}
              interval={xInterval}
              height={14}
            />
            {/* Price Y-axis — right */}
            <YAxis
              yAxisId="price"
              orientation="right"
              width={Y_W}
              tickCount={5}
              tick={tickStyle}
              axisLine={false}
              tickLine={{ stroke: C.border, strokeWidth: 0.5 }}
              tickFormatter={(v) => fmtYTick(v, symbol)}
              domain={[minP, maxP]}
            />
            {/* Volume Y-axis — hidden, left; domain scaled so bars sit in bottom ~22% */}
            <YAxis
              yAxisId="vol"
              orientation="left"
              hide
              domain={[0, volDomainMax]}
            />
            <Tooltip
              contentStyle={{ background: C.panel2, border: `1px solid ${C.border}`,
                borderRadius: 4, fontSize: 10, fontFamily: "monospace" }}
              labelStyle={{ color: C.muted, fontSize: 9 }}
              formatter={(v: any, name: string) =>
                name === "vol"
                  ? [fmtVol(v as number), "거래량"]
                  : [fmtPrice(v, symbol), "종가"]
              }
              labelFormatter={(t: any) => String(t)}
            />
            <ReferenceLine yAxisId="price" y={baseP} stroke={stroke}
              strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.6} />
            {/* Volume bars — rendered first so they sit behind the area */}
            <Bar yAxisId="vol" dataKey="vol" fill={stroke} opacity={0.35}
              radius={[1, 1, 0, 0]} isAnimationActive={false} />
            {/* Price area — on top */}
            <Area yAxisId="price" type="monotone" dataKey="close"
              stroke={stroke} strokeWidth={1.5}
              fill={`url(#cg-${symbol})`} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SYMBOL HEADER  (live quote data)
// ══════════════════════════════════════════════════════════════════════════════
function SymbolHeader({ symbol, quote }: { symbol:string; quote:any }) {
  const up = isUp(quote?.changePercent);
  return (
    <div className="px-3 py-2 border-b flex items-start justify-between gap-3"
      style={{ borderColor: C.border, background: C.panel }}>
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-base font-mono font-black" style={{ color: C.info }}>
            {symbol.replace("^","")}
          </span>
          {quote?.name && (
            <span className="text-[13px] font-mono truncate max-w-[120px]"
              style={{ color: C.muted }}>{quote.name}</span>
          )}
          <StatusBadge
            isLive={quote?.isMarketOpen === true && !quote?.isStale}
            isStale={quote?.isStale === true}
          />
        </div>

        {quote ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono" style={{ color: C.text }}>
                {fmtPrice(quote.price, symbol)}
              </span>
              <span className={cn("text-sm font-mono font-bold", up ? "text-[#00c896]" : "text-[#ff4757]")}>
                {up ? "▲" : "▼"} {Math.abs(quote.change ?? 0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
              </span>
              <span className={cn("text-sm font-mono font-bold", up ? "text-[#00c896]" : "text-[#ff4757]")}>
                ({fmtPct(quote.changePercent)})
              </span>
            </div>
            <div className="flex gap-3 mt-1 flex-wrap">
              {quote.volume != null && (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-mono" style={{ color: C.muted }}>VOL</span>
                  <span className="text-[13px] font-mono" style={{ color: C.text }}>{fmtVol(quote.volume)}</span>
                </div>
              )}
              {quote.lastUpdated && (
                <div className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" style={{ color: C.muted }} />
                  <span className="text-[12px] font-mono" style={{ color: C.muted }}>
                    {String(quote.lastUpdated).slice(11,16)} 기준
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-sm font-mono" style={{ color: C.muted }}>데이터 없음</div>
        )}
      </div>

      <Link href={`/stock/${symbol}`}
        className="flex items-center gap-1 px-2 py-1 rounded text-[13px] font-mono font-bold shrink-0"
        style={{ background:C.info+"22", color:C.info, border:`1px solid ${C.info}40` }}>
        풀차트 <ArrowUpRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TECH ENGINE  (from stock info endpoint — correct field names)
// ══════════════════════════════════════════════════════════════════════════════
function TechEngine({ symbol, quote }: { symbol:string; quote:any }) {
  const { data: info, isLoading } = useStockInfo(symbol);

  // Compute approx RSI from recent change (rough heuristic — labeled clearly)
  const rsiApprox = quote
    ? Math.max(20, Math.min(80, 50 + (quote.changePercent ?? 0) * 2.5))
    : null;

  // 52-week range position %
  const hi = info?.["52WeekHigh"];
  const lo = info?.["52WeekLow"];
  const range52 = (hi && lo && quote && hi > lo)
    ? ((quote.price - lo) / (hi - lo) * 100).toFixed(0) + "%"
    : "—";

  const currency = symbol.endsWith(".KS") || symbol === "^KS11" ? "KRW" : "USD";

  const metrics: [string, string, string][] = [
    ["PRICE",    quote ? fmtPrice(quote.price, symbol) : "—",
                 C.text],
    ["CHG%",     quote ? fmtPct(quote.changePercent) : "—",
                 quote ? (isUp(quote.changePercent) ? C.up : C.down) : C.muted],
    ["52W↑",     hi ? fmtPrice(hi, symbol) : "—",    C.muted],
    ["52W↓",     lo ? fmtPrice(lo, symbol) : "—",    C.muted],
    ["P/E",      info?.peRatio  ? info.peRatio.toFixed(1) : "—",  C.text],
    ["P/B",      info?.pbRatio  ? info.pbRatio.toFixed(2) : "—",  C.text],
    ["BETA",     info?.beta     ? info.beta.toFixed(2)    : "—",  C.muted],
    ["RSI~",     rsiApprox      ? rsiApprox.toFixed(0)    : "—",
                 rsiApprox ? (rsiApprox > 70 ? C.down : rsiApprox < 30 ? C.up : C.text) : C.muted],
    ["MKTCAP",   fmtMktCap(info?.marketCap, currency),  C.text],
    ["DIV%",     info?.dividendYield
                   ? (info.dividendYield * 100).toFixed(2) + "%"
                   : "—",  C.up],
    ["EPS",      info?.eps ? info.eps.toFixed(2) : "—",  C.text],
    ["52W%",     range52,  C.muted],
  ];

  return (
    <div className="p-3 border-t" style={{ borderColor: C.border }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[12px] font-mono font-bold tracking-widest uppercase"
          style={{ color: C.muted }}>TECH / RISK ENGINE</div>
        {isLoading && <RefreshCw className="w-3 h-3 animate-spin" style={{ color: C.muted }} />}
      </div>
      <div className="grid grid-cols-4 gap-px" style={{ background: C.border }}>
        {metrics.map(([l, v, clr]) => (
          <div key={l} className="px-2 py-1.5" style={{ background: C.panel2 }}>
            <div className="text-[11px] font-mono" style={{ color: C.muted }}>{l}</div>
            <div className="text-[14px] font-mono font-bold" style={{ color: clr }}>{v}</div>
          </div>
        ))}
      </div>
      {rsiApprox != null && (
        <div className="mt-1 text-[11px] font-mono" style={{ color: C.muted }}>
          * RSI는 당일 변동률 기반 추정치입니다
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CROSS ASSET TABLE  (real data from batch live)
// ══════════════════════════════════════════════════════════════════════════════
function CrossAssetTable({ stocks, onSelect }: { stocks: Record<string,any>; onSelect?: (s:string)=>void }) {
  const syms = ["AAPL","NVDA","TSLA","MSFT","AMZN","META","SPY","QQQ","GC=F","BTC-USD"];
  return (
    <div className="p-3 border-t" style={{ borderColor: C.border }}>
      <div className="text-[12px] font-mono font-bold tracking-widest uppercase mb-2"
        style={{ color: C.muted }}>CROSS ASSET SNAPSHOT</div>
      <div className="overflow-x-auto" style={{ scrollbarWidth:"none" }}>
        <table className="w-full" style={{ minWidth:300, borderCollapse:"collapse" }}>
          <thead>
            <tr>
              {["SYMBOL","LAST","CHG%","VOL"].map(h => (
                <td key={h} className={cn("text-[11px] font-mono pb-1",
                  h === "SYMBOL" ? "" : "text-right")}
                  style={{ color:C.muted }}>{h}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            {syms.map(sym => {
              const q  = stocks[sym];
              const up = isUp(q?.changePercent);
              return (
                <tr key={sym} className="border-t cursor-pointer"
                  style={{ borderColor:C.border+"50" }}
                  onClick={() => onSelect?.(sym)}
                  onMouseEnter={e => (e.currentTarget.style.background = C.accent+"10")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td className="py-1">
                    <span className="text-[13px] font-mono font-bold"
                      style={{ color:C.info }}>{sym.replace("=F","").replace("-USD","")}</span>
                  </td>
                  <td className="text-[13px] font-mono text-right py-1"
                    style={{ color:C.text }}>
                    {q ? fmtPrice(q.price, sym) : <span style={{ color:C.muted }}>—</span>}
                  </td>
                  <td className={cn("text-[13px] font-mono font-bold text-right",
                    q ? (up ? "text-[#00c896]" : "text-[#ff4757]") : "")}>
                    {q ? fmtPct(q.changePercent) : <span style={{ color:C.muted }}>—</span>}
                  </td>
                  <td className="text-[13px] font-mono text-right"
                    style={{ color:C.muted }}>
                    {q ? fmtVol(q.volume) : "—"}
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
// YIELD CURVE PANEL  — Treasury yields 3M / 5Y / 10Y / 30Y
// ══════════════════════════════════════════════════════════════════════════════
function YieldCurvePanel({ stocks }: { stocks: Record<string,any> }) {
  const pts = [
    { label:"3M",  sym:"^IRX" },
    { label:"5Y",  sym:"^FVX" },
    { label:"10Y", sym:"^TNX" },
    { label:"30Y", sym:"^TYX" },
  ];
  const vals = pts.map(p => ({ ...p, y: stocks[p.sym]?.price as number|undefined }));
  const y10  = stocks["^TNX"]?.price as number|undefined;
  const y3m  = stocks["^IRX"]?.price as number|undefined;
  const inverted = y10 != null && y3m != null && y10 < y3m;
  const maxY = Math.max(...vals.map(v => v.y ?? 0), 0.01);

  return (
    <div className="p-3 border-t" style={{ borderColor:C.border }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase"
          style={{ color:C.muted }}>YIELD CURVE</span>
        {inverted && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold"
            style={{ background:C.down+"33", color:C.down }}>
            ⚠ INVERTED
          </span>
        )}
      </div>
      <div className="flex items-end gap-2 h-16">
        {vals.map(({ label, sym, y }) => {
          const h   = y && maxY ? Math.max(6, (y/maxY)*52) : 4;
          const clr = inverted && sym === "^IRX" ? C.down : C.info;
          return (
            <div key={sym} className="flex-1 flex flex-col items-center gap-0.5">
              <span className="text-[11px] font-mono font-bold" style={{ color:clr }}>
                {y != null ? y.toFixed(2)+"%" : "—"}
              </span>
              <div className="w-full rounded-sm transition-all duration-700"
                style={{ height:h, background: clr+(inverted && sym==="^IRX" ? "bb" : "55") }} />
              <span className="text-[10px] font-mono" style={{ color:C.muted }}>{label}</span>
            </div>
          );
        })}
      </div>
      {y10 != null && y3m != null && (
        <div className="mt-1.5 text-[11px] font-mono" style={{ color:C.muted }}>
          10Y-3M 스프레드:{" "}
          <span style={{ color:(y10-y3m)>=0 ? C.up : C.down }}>
            {(y10-y3m)>=0?"+":" "}{(y10-y3m).toFixed(2)}%
          </span>
          {inverted && <span className="ml-1" style={{ color:C.down }}>경기침체 신호</span>}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GLOBAL MARKETS PANEL  — world indices table
// ══════════════════════════════════════════════════════════════════════════════
const WORLD_INDICES = [
  { sym:"SPY",    label:"S&P 500",  flag:"🇺🇸" },
  { sym:"QQQ",    label:"NASDAQ",   flag:"🇺🇸" },
  { sym:"^KS11",  label:"KOSPI",    flag:"🇰🇷" },
  { sym:"^N225",  label:"NIKKEI",   flag:"🇯🇵" },
  { sym:"^GDAXI", label:"DAX",      flag:"🇩🇪" },
  { sym:"^FTSE",  label:"FTSE 100", flag:"🇬🇧" },
  { sym:"^HSI",   label:"HSI",      flag:"🇭🇰" },
];

function GlobalMarketsPanel({ stocks }: { stocks: Record<string,any> }) {
  return (
    <div className="p-3 border-t" style={{ borderColor:C.border }}>
      <div className="text-[12px] font-mono font-bold tracking-widest uppercase mb-1.5"
        style={{ color:C.muted }}>GLOBAL MARKETS</div>
      <table className="w-full" style={{ borderCollapse:"collapse" }}>
        <thead>
          <tr>
            <td className="text-[10px] font-mono pb-1" style={{ color:C.muted }}>INDEX</td>
            <td className="text-[10px] font-mono pb-1 text-right" style={{ color:C.muted }}>LAST</td>
            <td className="text-[10px] font-mono pb-1 text-right" style={{ color:C.muted }}>CHG%</td>
          </tr>
        </thead>
        <tbody>
          {WORLD_INDICES.map(({ sym, label, flag }) => {
            const q  = stocks[sym];
            const up = isUp(q?.changePercent);
            return (
              <tr key={sym} className="border-t" style={{ borderColor:C.border+"40" }}>
                <td className="py-0.5">
                  <span className="text-[12px] font-mono" style={{ color:C.muted }}>
                    {flag} {label}
                  </span>
                </td>
                <td className="text-right text-[12px] font-mono" style={{ color:C.text }}>
                  {q ? fmtPrice(q.price, sym) : "—"}
                </td>
                <td className="text-right text-[12px] font-mono font-bold"
                  style={{ color: q ? (up ? C.up : C.down) : C.muted }}>
                  {q ? fmtPct(q.changePercent) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMMODITY & FX PANEL
// ══════════════════════════════════════════════════════════════════════════════
const COMM_DEF = [
  { sym:"GC=F",  label:"Gold",    emoji:"🥇" },
  { sym:"SI=F",  label:"Silver",  emoji:"🥈" },
  { sym:"CL=F",  label:"WTI",     emoji:"🛢️" },
  { sym:"HG=F",  label:"Copper",  emoji:"🔶" },
  { sym:"NG=F",  label:"NatGas",  emoji:"🔥" },
];
const FX_DEF = [
  { sym:"KRW=X",    label:"USD/KRW" },
  { sym:"EURUSD=X", label:"EUR/USD" },
  { sym:"GBPUSD=X", label:"GBP/USD" },
  { sym:"JPY=X",    label:"USD/JPY" },
];

function CommodityFXPanel({ stocks }: { stocks: Record<string,any> }) {
  return (
    <div className="p-3 border-t" style={{ borderColor:C.border }}>
      <div className="text-[12px] font-mono font-bold tracking-widest uppercase mb-1.5"
        style={{ color:C.muted }}>COMMODITIES</div>
      <div className="grid grid-cols-2 gap-1 mb-3">
        {COMM_DEF.map(({ sym, label, emoji }) => {
          const q  = stocks[sym];
          const up = isUp(q?.changePercent);
          return (
            <div key={sym} className="rounded px-1.5 py-1"
              style={{ background:C.panel2, border:`1px solid ${C.border}` }}>
              <div className="text-[11px] font-mono" style={{ color:C.muted }}>{emoji} {label}</div>
              <div className="text-[13px] font-mono font-bold" style={{ color:C.text }}>
                {q ? `$${q.price?.toFixed(sym==="GC=F"||sym==="SI=F" ? 2 : (sym==="HG=F"?4:2))}` : "—"}
              </div>
              <div className="text-[11px] font-mono font-bold"
                style={{ color: q ? (up ? C.up : C.down) : C.muted }}>
                {q ? fmtPct(q.changePercent) : "—"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[12px] font-mono font-bold tracking-widest uppercase mb-1"
        style={{ color:C.muted }}>FX RATES</div>
      {FX_DEF.map(({ sym, label }) => {
        const q  = stocks[sym];
        const up = isUp(q?.changePercent);
        return (
          <div key={sym} className="flex items-center justify-between py-1 border-t"
            style={{ borderColor:C.border+"40" }}>
            <span className="text-[12px] font-mono" style={{ color:C.muted }}>{label}</span>
            <span className="text-[12px] font-mono" style={{ color:C.text }}>
              {q ? q.price?.toFixed(sym==="KRW=X" ? 0 : sym==="JPY=X" ? 2 : 4) : "—"}
            </span>
            <span className="text-[11px] font-mono font-bold"
              style={{ color: q ? (up ? C.up : C.down) : C.muted }}>
              {q ? fmtPct(q.changePercent) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MACRO SIGNAL PANEL  — 4 key derived macro signals
// ══════════════════════════════════════════════════════════════════════════════
function MacroSignalPanel({ stocks }: { stocks: Record<string,any> }) {
  const vix   = stocks["^VIX"]?.price as number|undefined;
  const tnx   = stocks["^TNX"]?.price as number|undefined;
  const irx   = stocks["^IRX"]?.price as number|undefined;
  const dxy   = stocks["DX-Y.NYB"]?.price as number|undefined;
  const dxyC  = stocks["DX-Y.NYB"]?.changePercent as number|undefined;
  const hyg   = stocks["HYG"]?.changePercent as number|undefined;
  const lqd   = stocks["LQD"]?.changePercent as number|undefined;
  const spread = tnx != null && irx != null ? +(tnx - irx).toFixed(2) : null;
  const creditStress = hyg != null && lqd != null ? +(hyg - lqd).toFixed(2) : null;

  const signals: { label: string; value: string; sub: string; color: string }[] = [
    {
      label: "수익률 곡선",
      value: spread != null ? `${spread >= 0 ? "+" : ""}${spread}%` : "—",
      sub:   spread != null ? (spread < 0 ? "⚠ 역전 (침체 신호)" : spread < 0.5 ? "평탄화" : "정상") : "",
      color: spread != null ? (spread < 0 ? C.down : spread < 0.5 ? C.warn : C.up) : C.muted,
    },
    {
      label: "VIX 공포지수",
      value: vix != null ? vix.toFixed(1) : "—",
      sub:   vix != null ? (vix > 30 ? "극단적 공포" : vix > 20 ? "불안정" : vix > 15 ? "보통" : "안정") : "",
      color: vix != null ? (vix > 30 ? C.down : vix > 20 ? C.warn : C.up) : C.muted,
    },
    {
      label: "신용 스프레드",
      value: creditStress != null ? `${creditStress >= 0 ? "+" : ""}${creditStress}%` : "—",
      sub:   creditStress != null ? (creditStress < -0.3 ? "⚠ 신용 긴축" : creditStress > 0.3 ? "신용 이완" : "중립") : "HYG vs LQD",
      color: creditStress != null ? (creditStress < -0.3 ? C.down : creditStress > 0.3 ? C.up : C.muted) : C.muted,
    },
    {
      label: "달러 강도(DXY)",
      value: dxy != null ? dxy.toFixed(2) : "—",
      sub:   dxyC != null ? `${dxyC >= 0 ? "▲" : "▼"}${Math.abs(dxyC).toFixed(2)}% 오늘` : "",
      color: dxyC != null ? (dxyC > 0.5 ? C.down : dxyC < -0.5 ? C.up : C.muted) : C.muted,
    },
  ];

  return (
    <div className="p-3 border-t" style={{ borderColor: C.border }}>
      <div className="text-[12px] font-mono font-bold tracking-widest uppercase mb-1.5"
        style={{ color: C.muted }}>거시 신호 · MACRO SIGNALS</div>
      <div className="grid grid-cols-2 gap-1">
        {signals.map(s => (
          <div key={s.label} className="rounded px-2 py-1.5"
            style={{ background: C.panel2, border: `1px solid ${s.color}30` }}>
            <div className="text-[10px] font-mono mb-0.5" style={{ color: C.muted }}>{s.label}</div>
            <div className="text-[13px] font-mono font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] font-mono mt-0.5" style={{ color: s.color + "cc" }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BOND ETF PANEL  — duration ladder + credit
// ══════════════════════════════════════════════════════════════════════════════
const BOND_ETFS = [
  { sym:"TLT", label:"TLT", ko:"미국 장기채(20Y+)",  note:"금리민감↑" },
  { sym:"IEF", label:"IEF", ko:"미국 중기채(7-10Y)", note:"중간위험" },
  { sym:"SHY", label:"SHY", ko:"미국 단기채(1-3Y)",  note:"금리민감↓" },
  { sym:"TIP", label:"TIP", ko:"물가연동채(TIPS)",    note:"인플레 헤지" },
  { sym:"HYG", label:"HYG", ko:"하이일드 회사채",     note:"신용위험↑" },
  { sym:"LQD", label:"LQD", ko:"투자등급 회사채",     note:"신용위험↓" },
  { sym:"EMB", label:"EMB", ko:"신흥국 채권",         note:"EM 리스크" },
];

function BondETFPanel({ stocks }: { stocks: Record<string,any> }) {
  // 상대 스케일: 가장 큰 절대변동을 기준으로 정규화
  const pcts = BOND_ETFS.map(e => Math.abs(stocks[e.sym]?.changePercent ?? 0));
  const maxPct = Math.max(...pcts, 0.2); // 최소 0.2% 기준선 유지

  return (
    <div className="p-3 border-t" style={{ borderColor: C.border }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase"
          style={{ color: C.muted }}>채권 ETF · BOND ETFs</span>
        <span className="text-[10px] font-mono" style={{ color: C.muted }}>금리↑ = 채권↓</span>
      </div>
      {BOND_ETFS.map(({ sym, label, ko, note }) => {
        const q   = stocks[sym];
        const pct = q?.changePercent as number|undefined;
        const up  = (pct ?? 0) >= 0;
        // 상대 스케일: 최대값이 85%를 채우도록
        const barW = pct != null ? Math.min((Math.abs(pct) / maxPct) * 85, 100) : 0;
        return (
          <div key={sym} className="grid gap-1 py-1 border-t"
            style={{ borderColor: C.border + "30", gridTemplateColumns:"36px 1fr 48px 46px" }}>
            {/* 티커 */}
            <span className="text-[12px] font-mono font-bold self-center" style={{ color: C.info }}>{label}</span>
            {/* 한글명 + 바 */}
            <div className="flex flex-col justify-center gap-0.5 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono truncate" style={{ color: C.muted }}>{ko}</span>
                <span className="text-[9px] font-mono shrink-0 px-0.5 rounded"
                  style={{ background: C.border, color: C.muted + "aa" }}>{note}</span>
              </div>
              <div className="relative h-[5px] rounded-full overflow-hidden w-full" style={{ background: C.border }}>
                <div className="absolute left-0 h-full rounded-full transition-all duration-500"
                  style={{ width: `${barW}%`, background: up ? C.up : C.down }} />
              </div>
            </div>
            {/* 등락률 */}
            <span className="text-[12px] font-mono font-bold text-right self-center"
              style={{ color: pct != null ? (up ? C.up : C.down) : C.muted }}>
              {pct != null ? `${up?"+":""}${pct.toFixed(2)}%` : "—"}
            </span>
            {/* 가격 */}
            <span className="text-[12px] font-mono text-right self-center" style={{ color: C.text }}>
              {q?.price != null ? `$${q.price.toFixed(2)}` : "—"}
            </span>
          </div>
        );
      })}
      <div className="mt-1 text-[10px] font-mono" style={{ color: C.muted }}>
        ※ TIP↑=인플레 기대상승 · HYG↓=신용시장 긴축 신호
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DOLLAR & FX EXTENDED PANEL
// ══════════════════════════════════════════════════════════════════════════════
const DOLLAR_FX_DEF = [
  { sym:"DX-Y.NYB", label:"DXY",     desc:"달러 인덱스",  toFix:2 },
  { sym:"EURUSD=X", label:"EUR/USD", desc:"유로",         toFix:4 },
  { sym:"GBPUSD=X", label:"GBP/USD", desc:"파운드",       toFix:4 },
  { sym:"JPY=X",    label:"USD/JPY", desc:"엔화",         toFix:2 },
  { sym:"KRW=X",    label:"USD/KRW", desc:"원화",         toFix:0 },
  { sym:"CNY=X",    label:"USD/CNY", desc:"위안화",       toFix:4 },
  { sym:"AUDUSD=X", label:"AUD/USD", desc:"호주달러",     toFix:4 },
];

function DollarFXPanel({ stocks }: { stocks: Record<string,any> }) {
  const dxy    = stocks["DX-Y.NYB"]?.price as number|undefined;
  const dxyChg = stocks["DX-Y.NYB"]?.changePercent as number|undefined;
  const dxyStrength = dxy != null
    ? (dxy > 106 ? "매우 강세" : dxy > 103 ? "강세" : dxy > 99 ? "보통" : "약세")
    : "—";

  return (
    <div className="p-3 border-t" style={{ borderColor: C.border }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase"
          style={{ color: C.muted }}>달러 & 통화 · FX</span>
        {dxy != null && (
          <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded"
            style={{
              color: (dxyChg ?? 0) > 0 ? C.down : C.up,
              background: ((dxyChg ?? 0) > 0 ? C.down : C.up) + "20"
            }}>
            DXY {dxy.toFixed(2)} {dxyStrength}
          </span>
        )}
      </div>
      {DOLLAR_FX_DEF.map(({ sym, label, desc, toFix }) => {
        const q   = stocks[sym];
        const pct = q?.changePercent as number|undefined;
        const up  = (pct ?? 0) >= 0;
        // DXY up = USD strong = bad for EM/commodities; for FX pairs it's inverted
        const isDXY = sym === "DX-Y.NYB";
        const clr = pct != null
          ? (isDXY
              ? (up ? C.down : C.up)   // DXY up = dollar strong = risk off
              : (sym.startsWith("USD") || sym === "JPY=X" || sym === "KRW=X" || sym === "CNY=X"
                  ? (up ? C.down : C.up)
                  : (up ? C.up : C.down)))
          : C.muted;
        return (
          <div key={sym} className="flex items-center justify-between py-1 border-t"
            style={{ borderColor: C.border + "30" }}>
            <div className="min-w-0">
              <span className="text-[12px] font-mono font-bold" style={{ color: C.text }}>{label}</span>
              <span className="text-[10px] font-mono ml-1" style={{ color: C.muted }}>{desc}</span>
            </div>
            <div className="text-right flex items-center gap-2 shrink-0">
              <span className="text-[12px] font-mono" style={{ color: C.text }}>
                {q?.price != null ? q.price.toFixed(toFix) : "—"}
              </span>
              <span className="text-[11px] font-mono font-bold w-[44px] text-right" style={{ color: clr }}>
                {pct != null ? `${up?"+":""}${pct.toFixed(2)}%` : "—"}
              </span>
            </div>
          </div>
        );
      })}
      <div className="mt-1.5 text-[10px] font-mono" style={{ color: C.muted }}>
        * DXY↑ = 달러강세 → 원자재↓·신흥국↓ 압박
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMMODITY EXTENDED PANEL  — energy, metals, agriculture
// ══════════════════════════════════════════════════════════════════════════════
const COMM_EXT_DEF = [
  // Energy
  { sym:"CL=F",  label:"WTI유가",   group:"에너지", unit:"$", toFix:2 },
  { sym:"BZ=F",  label:"브렌트유",  group:"에너지", unit:"$", toFix:2 },
  { sym:"NG=F",  label:"천연가스",  group:"에너지", unit:"$", toFix:3 },
  // Metals
  { sym:"GC=F",  label:"금",       group:"귀금속", unit:"$", toFix:0 },
  { sym:"SI=F",  label:"은",       group:"귀금속", unit:"$", toFix:3 },
  { sym:"HG=F",  label:"구리",     group:"산업금속", unit:"$", toFix:4 },
  // Agriculture
  { sym:"ZW=F",  label:"밀",       group:"농산물", unit:"¢", toFix:0 },
  { sym:"ZC=F",  label:"옥수수",   group:"농산물", unit:"¢", toFix:0 },
];

function CommExtPanel({ stocks }: { stocks: Record<string,any> }) {
  const groups = ["에너지","귀금속","산업금속","농산물"];
  return (
    <div className="p-3 border-t" style={{ borderColor: C.border }}>
      <div className="text-[12px] font-mono font-bold tracking-widest uppercase mb-1.5"
        style={{ color: C.muted }}>원자재 · COMMODITIES</div>
      {groups.map(grp => {
        const items = COMM_EXT_DEF.filter(c => c.group === grp);
        return (
          <div key={grp} className="mb-2">
            <div className="text-[10px] font-mono mb-0.5" style={{ color: C.muted + "cc" }}>{grp}</div>
            <div className="grid grid-cols-3 gap-px" style={{ background: C.border }}>
              {items.map(({ sym, label, unit, toFix }) => {
                const q   = stocks[sym];
                const pct = q?.changePercent as number|undefined;
                const up  = (pct ?? 0) >= 0;
                return (
                  <div key={sym} className="px-1.5 py-1" style={{ background: C.panel2 }}>
                    <div className="text-[10px] font-mono" style={{ color: C.muted }}>{label}</div>
                    <div className="text-[13px] font-mono font-bold" style={{ color: C.text }}>
                      {q?.price != null ? `${unit}${q.price.toFixed(toFix)}` : "—"}
                    </div>
                    <div className="text-[11px] font-mono font-bold"
                      style={{ color: pct != null ? (up ? C.up : C.down) : C.muted }}>
                      {pct != null ? `${up?"+":""}${pct.toFixed(2)}%` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {/* Brent-WTI spread */}
      {(() => {
        const brent = stocks["BZ=F"]?.price as number|undefined;
        const wti   = stocks["CL=F"]?.price as number|undefined;
        if (!brent || !wti) return null;
        const spread = +(brent - wti).toFixed(2);
        return (
          <div className="mt-1 text-[10px] font-mono" style={{ color: C.muted }}>
            브렌트-WTI 스프레드: <span style={{ color: C.info }}>${spread >= 0 ? "+" : ""}{spread}</span>
            <span className="ml-1">{spread > 3 ? "(공급 우려)" : spread < 1 ? "(정상범위)" : "(보통)"}</span>
          </div>
        );
      })()}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INTEREST RATE DETAIL PANEL  — global rates + SKEW
// ══════════════════════════════════════════════════════════════════════════════
function RatesDetailPanel({ stocks }: { stocks: Record<string,any> }) {
  const yields = [
    { sym:"^IRX", label:"미 3개월",  toFix:3 },
    { sym:"^FVX", label:"미 5년",    toFix:3 },
    { sym:"^TNX", label:"미 10년",   toFix:3 },
    { sym:"^TYX", label:"미 30년",   toFix:3 },
  ];
  const tnx  = stocks["^TNX"]?.price as number|undefined;
  const irx  = stocks["^IRX"]?.price as number|undefined;
  const tyx  = stocks["^TYX"]?.price as number|undefined;
  const fvx  = stocks["^FVX"]?.price as number|undefined;
  const skew = stocks["^SKEW"]?.price as number|undefined;
  const vix  = stocks["^VIX"]?.price as number|undefined;
  const termPremium = tyx != null && tnx != null ? +(tyx - tnx).toFixed(2) : null;
  const bellyCurve  = tnx != null && irx != null ? +(tnx - irx).toFixed(2) : null;
  const twos5s = fvx != null && irx != null ? +(fvx - irx).toFixed(2) : null;

  return (
    <div className="p-3 border-t" style={{ borderColor: C.border }}>
      <div className="text-[12px] font-mono font-bold tracking-widest uppercase mb-1.5"
        style={{ color: C.muted }}>금리 상세 · RATES DETAIL</div>

      {/* Yield bars */}
      <div className="flex items-end gap-1.5 h-12 mb-1">
        {yields.map(({ sym, label, toFix }) => {
          const p = stocks[sym]?.price as number|undefined;
          const maxY = Math.max(...yields.map(y => (stocks[y.sym]?.price as number|undefined) ?? 0), 0.01);
          const h = p ? Math.max(6, (p/maxY)*44) : 4;
          const up = (stocks[sym]?.changePercent ?? 0) >= 0;
          return (
            <div key={sym} className="flex-1 flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-mono font-bold" style={{ color: up ? C.up : C.down }}>
                {p != null ? p.toFixed(toFix)+"%" : "—"}
              </span>
              <div className="w-full rounded-t transition-all"
                style={{ height: h, background: C.info + "66" }} />
              <span className="text-[9px] font-mono" style={{ color: C.muted }}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* Spreads */}
      <div className="grid grid-cols-2 gap-px mt-1" style={{ background: C.border }}>
        {[
          { label:"3M-10Y 스프레드", val:bellyCurve, inv: bellyCurve != null && bellyCurve < 0 },
          { label:"10Y-30Y 기간프리미엄", val:termPremium, inv:false },
        ].map(({ label, val, inv }) => (
          <div key={label} className="px-1.5 py-1" style={{ background: C.panel2 }}>
            <div className="text-[10px] font-mono" style={{ color: C.muted }}>{label}</div>
            <div className="text-[14px] font-mono font-bold"
              style={{ color: val != null ? (inv ? C.down : val >= 0 ? C.up : C.down) : C.muted }}>
              {val != null ? `${val >= 0 ? "+" : ""}${val}%` : "—"}
            </div>
            {inv && val != null && val < 0 && (
              <div className="text-[10px] font-mono" style={{ color: C.down }}>⚠ 역전</div>
            )}
          </div>
        ))}
      </div>

      {/* SKEW + VIX ratio */}
      {(skew != null || vix != null) && (
        <div className="mt-1.5 grid grid-cols-2 gap-px" style={{ background: C.border }}>
          {skew != null && (
            <div className="px-1.5 py-1" style={{ background: C.panel2 }}>
              <div className="text-[10px] font-mono" style={{ color: C.muted }}>SKEW 지수</div>
              <div className="text-[14px] font-mono font-bold"
                style={{ color: skew > 140 ? C.down : skew > 120 ? C.warn : C.up }}>
                {skew.toFixed(1)}
              </div>
              <div className="text-[10px] font-mono" style={{ color: C.muted }}>
                {skew > 140 ? "테일 리스크↑" : skew > 120 ? "주의" : "낮음"}
              </div>
            </div>
          )}
          {vix != null && skew != null && (
            <div className="px-1.5 py-1" style={{ background: C.panel2 }}>
              <div className="text-[10px] font-mono" style={{ color: C.muted }}>SKEW/VIX 비율</div>
              <div className="text-[14px] font-mono font-bold"
                style={{ color: (skew/vix) > 8 ? C.down : C.up }}>
                {(skew/vix).toFixed(1)}×
              </div>
              <div className="text-[10px] font-mono" style={{ color: C.muted }}>
                {(skew/vix) > 8 ? "꼬리위험 내재" : "정상 범위"}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FUNDAMENTALS PANEL  (stock info endpoint — correct field names)
// ══════════════════════════════════════════════════════════════════════════════
function FundamentalsPanel({ symbol, quote, lang = "ko" as Lang }: { symbol:string; quote:any; lang?:Lang }) {
  const { data: info, isLoading, isError } = useStockInfo(symbol);
  const [translatedDesc, setTranslatedDesc] = useState<string|null>(null);
  const [transLoading, setTransLoading] = useState(false);

  const hi    = info?.["52WeekHigh"];
  const lo    = info?.["52WeekLow"];
  const price = quote?.price;
  const rangePct = (hi && lo && price && hi !== lo)
    ? ((price - lo) / (hi - lo) * 100)
    : null;

  async function translateDesc() {
    if (!info?.description) return;
    setTransLoading(true);
    try {
      const sysMsg = lang === "ja"
        ? "以下の英語の企業説明文を自然な日本語に翻訳してください。2〜3文で簡潔にまとめてください。"
        : "다음 영어 기업 설명을 자연스러운 한국어로 번역해주세요. 2~3문장으로 간결하게 요약해주세요.";
      const res = await fetch("/api/news/summarize", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ title: info.description, lang }),
      });
      const d = await res.json();
      setTranslatedDesc(d.summary || info.description);
    } catch { setTranslatedDesc(info.description); }
    finally { setTransLoading(false); }
  }

  const rows: [string, string][] = [
    ["시가총액",   fmtMktCap(info?.marketCap, info?.currency)],
    ["P/E",        info?.peRatio       ? info.peRatio.toFixed(1) : "—"],
    ["P/B",        info?.pbRatio       ? info.pbRatio.toFixed(2) : "—"],
    ["EPS",        info?.eps           ? (info.currency === "KRW" ? `₩${Math.round(info.eps).toLocaleString()}` : `$${info.eps.toFixed(2)}`) : "—"],
    ["배당수익률", info?.dividendYield  ? `${(info.dividendYield*100).toFixed(2)}%` : "—"],
    ["베타",       info?.beta          ? info.beta.toFixed(2) : "—"],
    ["52W 고가",   hi                  ? fmtPrice(hi, symbol)  : "—"],
    ["52W 저가",   lo                  ? fmtPrice(lo, symbol)  : "—"],
    ["평균거래량", fmtVol(info?.avgVolume)],
    ["통화",       info?.currency      || "—"],
  ];

  return (
    <div className="border-b" style={{ borderColor: C.border }}>
      <div className="px-2 py-1.5 border-b flex items-center justify-between"
        style={{ borderColor:C.border, background:C.header }}>
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase"
          style={{ color:C.muted }}>FUNDAMENTALS</span>
        <div className="flex items-center gap-2">
          <StatusBadge isLoading={isLoading} isError={isError}
            isLive={!isLoading && !isError && !!info} />
          <Link href={`/stock/${symbol}`} className="text-[12px] font-mono" style={{ color:C.info }}>→</Link>
        </div>
      </div>

      {/* 52-week range bar */}
      {!isLoading && rangePct != null && (
        <div className="px-2 py-2 border-b" style={{ borderColor:C.border }}>
          <div className="flex justify-between text-[11px] font-mono mb-1" style={{ color:C.muted }}>
            <span>{fmtPrice(lo, symbol)}</span>
            <span>52W RANGE</span>
            <span>{fmtPrice(hi, symbol)}</span>
          </div>
          <div className="relative h-1.5 rounded-full" style={{ background:C.border }}>
            <div className="absolute h-full rounded-full"
              style={{ width:`${rangePct}%`, background:`linear-gradient(to right,${C.down},${C.up})` }} />
            <div className="absolute w-2 h-2 rounded-full -translate-y-1/4 border border-white"
              style={{ left:`${rangePct}%`, background:C.text }} />
          </div>
        </div>
      )}

      {isLoading ? (
        Array.from({length:6}).map((_,i) => <SkeletonRow key={i} cols={2} />)
      ) : isError ? (
        <div className="px-2 py-3 text-[13px] font-mono flex items-center gap-2"
          style={{ color:C.down }}>
          <AlertTriangle className="w-3 h-3" /> 펀더멘탈 로드 실패
        </div>
      ) : (
        rows.map(([l, v]) => (
          <div key={l} className="flex items-center justify-between px-2 py-1 border-b"
            style={{ borderColor:C.border+"40" }}>
            <span className="text-[12px] font-mono" style={{ color:C.muted }}>{l}</span>
            <span className="text-[13px] font-mono font-bold" style={{ color:C.text }}>{v}</span>
          </div>
        ))
      )}

      {/* Description snippet with translation */}
      {info?.description && (
        <div className="px-2 py-2 border-t" style={{ borderColor:C.border+"40" }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono font-bold" style={{ color:C.muted }}>{T("companyDesc",lang)}</span>
            {lang !== "en" && !translatedDesc && (
              <button onClick={translateDesc} disabled={transLoading}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ background:C.info+"22", color:C.info }}>
                {transLoading ? "..." : T("translateDesc",lang)}
              </button>
            )}
          </div>
          <p className="text-[12px] font-mono leading-relaxed line-clamp-4"
            style={{ color:C.muted }}>
            {translatedDesc || info.description}
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EARNINGS / CALENDAR PANEL (lazy loaded)
// ══════════════════════════════════════════════════════════════════════════════
function CalendarPanel() {
  const { data, isLoading, isError } = useCalendar();
  const today = new Date().getDate();
  const events = (data || [])
    .filter((e:any) => new Date(e.date||"").getDate() >= today)
    .slice(0, 6);

  return (
    <div className="border-b" style={{ borderColor:C.border }}>
      <div className="px-2 py-1.5 border-b flex items-center justify-between"
        style={{ borderColor:C.border, background:C.header }}>
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase"
          style={{ color:C.muted }}>CALENDAR</span>
        <Link href="/calendar" className="text-[12px] font-mono" style={{ color:C.info }}>→</Link>
      </div>
      {isLoading ? (
        Array.from({length:3}).map((_,i) => <SkeletonRow key={i} cols={2} />)
      ) : isError || !events.length ? (
        <div className="px-2 py-2 text-[13px] font-mono" style={{ color:C.muted }}>이벤트 없음</div>
      ) : events.map((ev:any, i:number) => (
        <div key={i} className="flex items-start gap-2 px-2 py-1.5 border-b"
          style={{ borderColor:C.border+"40" }}>
          <div className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0" style={{
            background: ev.importance==="high" ? C.down : ev.importance==="medium" ? C.warn : C.info
          }} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-mono truncate" style={{ color:C.text }}>
              {ev.name||ev.title}
            </div>
            <div className="text-[12px] font-mono" style={{ color:C.muted }}>{ev.date}</div>
          </div>
          <span className="text-[11px] font-mono shrink-0 px-1 py-0.5 rounded" style={{
            background: ev.importance==="high" ? C.down+"22" : ev.importance==="medium" ? C.warn+"22" : C.info+"22",
            color:      ev.importance==="high" ? C.down      : ev.importance==="medium" ? C.warn      : C.info,
          }}>
            {ev.importance?.toUpperCase()||"LOW"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NEWS PANEL — language-aware, market/company toggle, AI multi-lang summary
// ══════════════════════════════════════════════════════════════════════════════
function NewsPanel({ lang = "ko" as Lang, symbol = "", showToggle = false }) {
  const marketNews = useNews(lang as Lang);
  const stockNews  = useStockNews(symbol);

  const [mode, setMode] = useState<"market"|"company">("market");
  const activeQuery = (showToggle && mode === "company") ? stockNews : marketNews;
  const rawItems = activeQuery.data;
  const items: any[] = (
    Array.isArray(rawItems) ? rawItems :
    Array.isArray(rawItems?.news) ? rawItems.news :
    []
  ).slice(0, 20);

  const { isLoading, isError } = activeQuery;

  const [expanded, setExpanded] = useState<number|null>(null);
  const [summaries, setSummaries] = useState<Record<string, Record<Lang,string>>>({});
  const [generating, setGenerating] = useState<{key:string;lang:Lang}|null>(null);

  async function generateSummary(key: string, title: string, tLang: Lang) {
    if (summaries[key]?.[tLang]) { return; }
    setGenerating({ key, lang: tLang });
    try {
      const res = await fetch("/api/news/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, lang: tLang }),
      });
      const d = await res.json();
      setSummaries(prev => ({ ...prev, [key]: { ...(prev[key]||{}), [tLang]: d.summary || "" } }));
    } catch {
      setSummaries(prev => ({ ...prev, [key]: { ...(prev[key]||{}), [tLang]: T("loadFail", tLang) } }));
    } finally {
      setGenerating(null);
    }
  }

  // What to show inline below title (default summary in user's language)
  function getInlineSummary(item: any): string | null {
    if (lang === "ko" && item.koreanSummary) return item.koreanSummary;
    if (lang === "ja" && item.japaneseSummary) return item.japaneseSummary;
    return null;
  }

  const LANGS: {code:Lang; flag:string; label:string}[] = [
    { code:"ko", flag:"🇰🇷", label:"한" },
    { code:"en", flag:"🇺🇸", label:"EN" },
    { code:"ja", flag:"🇯🇵", label:"日" },
  ];

  return (
    <div className="border-b" style={{ borderColor:C.border }}>
      <div className="px-2 py-1.5 border-b flex items-center justify-between"
        style={{ borderColor:C.border, background:C.header }}>
        <div className="flex items-center gap-1.5">
          <Newspaper className="w-3 h-3" style={{ color:C.info }} />
          {showToggle ? (
            <div className="flex items-center gap-0.5">
              {(["market","company"] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setExpanded(null); }}
                  className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold"
                  style={{
                    background: mode===m ? C.info+"33" : "transparent",
                    color: mode===m ? C.info : C.muted,
                    border: `1px solid ${mode===m ? C.info+"50" : "transparent"}`,
                  }}>
                  {m === "market" ? T("marketNews", lang) : T("stockNews", lang)}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-[12px] font-mono font-bold tracking-widest uppercase"
              style={{ color:C.muted }}>{T("marketNews", lang)}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge isLoading={isLoading} isError={isError}
            isLive={!isLoading && !isError && items.length > 0} />
          <Link href="/hot-issues" className="text-[12px] font-mono" style={{ color:C.info }}>→</Link>
        </div>
      </div>

      {isLoading ? (
        Array.from({length:4}).map((_,i) => <SkeletonRow key={i} cols={2} />)
      ) : isError ? (
        <div className="px-2 py-3 text-[12px] font-mono flex items-center gap-2" style={{ color:C.down }}>
          <AlertTriangle className="w-3 h-3" /> {T("loadFail", lang)}
        </div>
      ) : !items.length ? (
        <div className="px-2 py-2 text-[12px] font-mono" style={{ color:C.muted }}>{T("noData", lang)}</div>
      ) : items.map((item:any, i:number) => {
        const itemKey = `${mode}-${i}`;
        const isOpen = expanded === i;
        const inlineSummary = getInlineSummary(item);
        const genLang = (generating?.key === itemKey) ? generating.lang : null;
        return (
          <div key={itemKey} className="border-b" style={{ borderColor:C.border+"40" }}>
            <div className="flex items-start gap-2 px-2 py-2 cursor-pointer"
              style={{ background: isOpen ? C.panel2 : "" }}
              onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = C.panel2+"80"; }}
              onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = ""; }}
              onClick={() => setExpanded(isOpen ? null : i)}>
              <span className="text-[12px] font-mono font-bold shrink-0 mt-0.5"
                style={{ color: i===0 ? C.down : C.muted }}>
                {i===0 ? "HOT" : String(i+1).padStart(2,"0")}
              </span>
              <div className="flex-1 min-w-0">
                {/* Show title in original language */}
                <div className="text-[13px] font-mono leading-snug line-clamp-2"
                  style={{ color:C.text }}>{item.title}</div>
                {/* Show inline summary in user's language when collapsed */}
                {inlineSummary && !isOpen && (
                  <div className="text-[12px] font-mono leading-snug mt-0.5 line-clamp-1"
                    style={{ color:C.muted }}>
                    {lang === "ko" ? "🇰🇷" : lang === "ja" ? "🇯🇵" : "🇺🇸"} {inlineSummary}
                  </div>
                )}
              </div>
              <span style={{ color:C.muted, flexShrink:0 }}>
                {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </span>
            </div>

            {isOpen && (
              <div className="px-2 pb-2 overflow-hidden" style={{ background:C.panel2 }}>
                {/* Inline Korean summary */}
                {inlineSummary && (
                  <div className="text-[12px] font-mono leading-relaxed mb-1.5 px-1.5 py-1 rounded break-words"
                    style={{ background:C.border+"40", color:C.text, wordBreak:"break-word" }}>
                    {lang === "ko" ? "🇰🇷" : lang === "ja" ? "🇯🇵" : "🇺🇸"} {inlineSummary}
                  </div>
                )}

                {/* AI multi-lang summary buttons */}
                <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                  <Languages className="w-2.5 h-2.5 shrink-0" style={{ color:C.info }} />
                  <span className="text-[11px] font-mono" style={{ color:C.muted }}>{T("aiSummary", lang)}</span>
                  {LANGS.map(({ code, flag, label }) => {
                    const hasSummary = !!summaries[itemKey]?.[code];
                    const isGen = genLang === code;
                    return (
                      <button key={code}
                        onClick={() => generateSummary(itemKey, item.title, code)}
                        disabled={genLang !== null}
                        className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold"
                        style={{
                          background: hasSummary ? C.info+"22" : C.border+"60",
                          color: hasSummary ? C.info : C.muted,
                          border: `1px solid ${hasSummary ? C.info+"40" : C.border}`,
                          opacity: genLang && !isGen ? 0.5 : 1,
                        }}>
                        {isGen ? <Loader2 className="w-2 h-2 animate-spin inline" /> : `${flag} ${label}`}
                      </button>
                    );
                  })}
                </div>

                {/* Generated summaries — each fully visible, text wraps */}
                {LANGS.map(({ code, flag }) => summaries[itemKey]?.[code] && (
                  <div key={code}
                    className="text-[12px] font-mono leading-relaxed mb-1 px-1.5 py-1 rounded break-words"
                    style={{
                      background:C.header, color:C.text,
                      border:`1px solid ${C.border}`,
                      wordBreak:"break-word", overflowWrap:"anywhere",
                    }}>
                    <span style={{ color:C.info }}>{flag} </span>{summaries[itemKey][code]}
                  </div>
                ))}

                <a href={item.link||"#"} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] font-mono mt-0.5 block truncate"
                  style={{ color:C.info }}>
                  {T("readMore", lang)} {item.publisher ? `· ${item.publisher}` : "→"}
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPACT STOCK NEWS (chart tab, below chart)
// ══════════════════════════════════════════════════════════════════════════════
function StockNewsCompact({ symbol, lang = "ko" as Lang }: { symbol:string; lang:Lang }) {
  const { data, isLoading, isError } = useStockNews(symbol);
  const items: any[] = (
    Array.isArray(data) ? data :
    Array.isArray(data?.news) ? data.news :
    []
  ).slice(0, 5);

  const isIndex = symbol.startsWith("^") || symbol.endsWith("=F") || symbol.endsWith("=X") || symbol.startsWith("BTC");
  if (isIndex) return null;

  const symLabel = symbol.replace(".KS","").replace("^","");

  return (
    <div className="border-t" style={{ borderColor:C.border }}>
      <div className="px-3 py-1.5 flex items-center justify-between border-b"
        style={{ borderColor:C.border, background:C.header }}>
        <div className="flex items-center gap-1.5">
          <Newspaper className="w-3 h-3" style={{ color:C.warn }} />
          <span className="text-[12px] font-mono font-bold uppercase tracking-widest"
            style={{ color:C.muted }}>{symLabel} {T("stockNews", lang)}</span>
        </div>
        <StatusBadge isLoading={isLoading} isError={isError}
          isLive={!isLoading && !isError && items.length > 0} />
      </div>
      {isLoading ? Array.from({length:3}).map((_,i) => <SkeletonRow key={i} cols={2} />) :
       isError   ? <div className="px-3 py-2 text-[12px] font-mono" style={{ color:C.muted }}>{T("loadFail", lang)}</div> :
       !items.length ? <div className="px-3 py-2 text-[12px] font-mono" style={{ color:C.muted }}>{T("noData", lang)}</div> :
       items.map((item:any, i:number) => {
         const summary = lang === "ko" ? item.koreanSummary : null;
         return (
           <a key={i} href={item.link||"#"} target="_blank" rel="noopener noreferrer"
             className="flex items-start gap-2 px-3 py-2 border-b"
             style={{ borderColor:C.border+"40" }}
             onMouseEnter={e => (e.currentTarget.style.background = C.panel2)}
             onMouseLeave={e => (e.currentTarget.style.background = "")}>
             <span className="text-[12px] font-mono font-bold shrink-0 mt-0.5"
               style={{ color:C.warn }}>{String(i+1).padStart(2,"0")}</span>
             <div className="min-w-0 flex-1">
               <div className="text-[13px] font-mono leading-snug line-clamp-2"
                 style={{ color:C.text }}>{item.title}</div>
               {summary && (
                 <div className="text-[12px] font-mono mt-0.5 line-clamp-1" style={{ color:C.muted }}>
                   🇰🇷 {summary}
                 </div>
               )}
               <span className="text-[11px] font-mono" style={{ color:C.muted }}>
                 {item.publisher || ""}
               </span>
             </div>
           </a>
         );
       })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INSIDER TRADING PANEL
// ══════════════════════════════════════════════════════════════════════════════
function InsiderPanel({ symbol, lang = "ko" as Lang }: { symbol:string; lang:Lang }) {
  const { data, isLoading, isError } = useInsider(symbol);
  const trades: any[] = (data?.trades || []).slice(0, 8);
  const [collapsed, setCollapsed] = useState(false);

  const buys  = trades.filter(t => t.transactionType === "Purchase" || t.transactionType === "Buy");
  const sells = trades.filter(t => t.transactionType === "Sale" || t.transactionType === "Sell");

  function fmtVal(v: number) {
    if (!v) return "—";
    if (v >= 1_000_000) return `$${(v/1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `$${(v/1_000).toFixed(0)}K`;
    return `$${v}`;
  }

  return (
    <div className="border-b" style={{ borderColor:C.border }}>
      <button className="w-full px-2 py-1.5 flex items-center justify-between border-b"
        style={{ borderColor:C.border, background:C.header }}
        onClick={() => setCollapsed(p => !p)}>
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="w-3 h-3" style={{ color:C.warn }} />
          <span className="text-[12px] font-mono font-bold tracking-widest uppercase"
            style={{ color:C.muted }}>{T("insiderTrades", lang)}</span>
          {!isLoading && !isError && trades.length > 0 && (
            <span className="text-[11px] font-mono px-1 rounded"
              style={{ background:C.up+"22", color:C.up }}>
              {buys.length}{T("buyCount", lang)}
            </span>
          )}
          {!isLoading && !isError && sells.length > 0 && (
            <span className="text-[11px] font-mono px-1 rounded"
              style={{ background:C.down+"22", color:C.down }}>
              {sells.length}{T("sellCount", lang)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge isLoading={isLoading} isError={isError}
            isLive={!isLoading && !isError && trades.length > 0} />
          {collapsed ? <ChevronDown className="w-3 h-3" style={{ color:C.muted }} />
                     : <ChevronUp   className="w-3 h-3" style={{ color:C.muted }} />}
        </div>
      </button>

      {!collapsed && (
        isLoading ? Array.from({length:3}).map((_,i) => <SkeletonRow key={i} cols={3} />) :
        isError   ? <div className="px-2 py-2 text-[12px] font-mono flex items-center gap-1"
                      style={{ color:C.down }}><AlertTriangle className="w-3 h-3"/>{T("loadFail",lang)}</div> :
        !trades.length ? <div className="px-2 py-2 text-[12px] font-mono" style={{ color:C.muted }}>{T("noInsider",lang)}</div> :
        trades.map((t:any, i:number) => {
          const isBuy = t.transactionType === "Purchase" || t.transactionType === "Buy";
          const isSell = t.transactionType === "Sale" || t.transactionType === "Sell";
          const col = isBuy ? C.up : isSell ? C.down : C.muted;
          return (
            <div key={i} className="flex items-start gap-1.5 px-2 py-1.5 border-b"
              style={{ borderColor:C.border+"40" }}>
              <div className="mt-0.5 shrink-0">
                {isBuy  ? <TrendingUp   className="w-3 h-3" style={{ color:C.up }} />
               : isSell ? <TrendingDown className="w-3 h-3" style={{ color:C.down }} />
               :           <ArrowUpRight className="w-3 h-3" style={{ color:C.muted }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[12px] font-mono font-bold truncate" style={{ color:C.text }}>
                    {(t.owner||"").split(" ").slice(0,2).join(" ")}
                  </span>
                  <span className="text-[12px] font-mono font-bold shrink-0" style={{ color:col }}>
                    {fmtVal(t.value)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="text-[11px] font-mono truncate" style={{ color:C.muted }}>
                    {(t.relationship||"").split(" ").slice(0,3).join(" ")}
                  </span>
                  <span className="text-[11px] font-mono shrink-0" style={{ color:C.muted }}>
                    {t.date?.slice(5) || ""}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INSTITUTIONAL HOLDERS PANEL
// ══════════════════════════════════════════════════════════════════════════════
function InstitutionalPanel({ symbol, lang = "ko" as Lang }: { symbol:string; lang:Lang }) {
  const { data, isLoading, isError } = useInstitutional(symbol);
  const holders: any[] = (data?.holders || []).slice(0, 6);
  const [collapsed, setCollapsed] = useState(false);
  const maxPct = Math.max(...holders.map((h:any) => h.pctHeld || 0), 1);

  function fmtShares(v: number) {
    if (v >= 1_000_000_000) return `${(v/1_000_000_000).toFixed(2)}B`;
    if (v >= 1_000_000)     return `${(v/1_000_000).toFixed(1)}M`;
    if (v >= 1_000)         return `${(v/1_000).toFixed(0)}K`;
    return String(v);
  }

  return (
    <div className="border-b" style={{ borderColor:C.border }}>
      <button className="w-full px-2 py-1.5 flex items-center justify-between border-b"
        style={{ borderColor:C.border, background:C.header }}
        onClick={() => setCollapsed(p => !p)}>
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3 h-3" style={{ color:C.info }} />
          <span className="text-[12px] font-mono font-bold tracking-widest uppercase"
            style={{ color:C.muted }}>{T("institutions", lang)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge isLoading={isLoading} isError={isError}
            isLive={!isLoading && !isError && holders.length > 0} />
          {collapsed ? <ChevronDown className="w-3 h-3" style={{ color:C.muted }} />
                     : <ChevronUp   className="w-3 h-3" style={{ color:C.muted }} />}
        </div>
      </button>

      {!collapsed && (
        isLoading ? Array.from({length:4}).map((_,i) => <SkeletonRow key={i} cols={3} />) :
        isError   ? <div className="px-2 py-2 text-[12px] font-mono flex items-center gap-1"
                      style={{ color:C.down }}><AlertTriangle className="w-3 h-3"/>{T("loadFail",lang)}</div> :
        !holders.length ? <div className="px-2 py-2 text-[12px] font-mono" style={{ color:C.muted }}>{T("noHolders",lang)}</div> :
        holders.map((h:any, i:number) => {
          const pct   = h.pctHeld || 0;
          const barW  = Math.round((pct / maxPct) * 100);
          const name  = (h.holder || "").replace(/,?\s*(LLC|Inc\.|Corp\.|L\.P\.)/, "").trim();
          return (
            <div key={i} className="px-2 py-1.5 border-b" style={{ borderColor:C.border+"40" }}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[12px] font-mono truncate flex-1" style={{ color:C.text }}>
                  {name.length > 22 ? name.slice(0,22)+"…" : name}
                </span>
                <span className="text-[12px] font-mono font-bold shrink-0 ml-1" style={{ color:C.info }}>
                  {pct.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background:C.border }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width:`${barW}%`, background:`${C.info}99` }} />
                </div>
                <span className="text-[11px] font-mono shrink-0" style={{ color:C.muted }}>
                  {fmtShares(h.shares || 0)}주
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALYST RATINGS PANEL
// ══════════════════════════════════════════════════════════════════════════════
function AnalystPanel({ symbol, lang = "ko" as Lang }: { symbol:string; lang:Lang }) {
  const { data, isLoading, isError } = useAnalyst(symbol);
  const [collapsed, setCollapsed] = useState(false);

  const sum = data?.summary || {};
  const strongBuy  = sum.strongBuy  || 0;
  const buy        = sum.buy        || 0;
  const hold       = sum.hold       || 0;
  const sell       = sum.sell       || 0;
  const strongSell = sum.strongSell || 0;
  const total      = strongBuy + buy + hold + sell + strongSell;

  const bullPct = total ? Math.round((strongBuy + buy) / total * 100) : 0;
  const holdPct = total ? Math.round(hold / total * 100) : 0;
  const bearPct = total ? Math.round((sell + strongSell) / total * 100) : 0;

  const target   = data?.targetPrice;
  const curr     = data?.currentPrice;
  const upside   = (target && curr && curr > 0) ? ((target - curr) / curr * 100) : null;
  const shortPct = data?.shortPctFloat;
  const actions  = (data?.recentActions || []).slice(0, 4);

  function gradeColor(g: string) {
    const lo = (g||"").toLowerCase();
    if (lo.includes("buy") || lo.includes("outperform") || lo.includes("overweight")) return C.up;
    if (lo.includes("sell") || lo.includes("underperform") || lo.includes("underweight")) return C.down;
    return C.warn;
  }

  return (
    <div className="border-b" style={{ borderColor:C.border }}>
      <button className="w-full px-2 py-1.5 flex items-center justify-between border-b"
        style={{ borderColor:C.border, background:C.header }}
        onClick={() => setCollapsed(p => !p)}>
        <div className="flex items-center gap-1.5">
          <Target className="w-3 h-3" style={{ color:C.up }} />
          <span className="text-[12px] font-mono font-bold tracking-widest uppercase"
            style={{ color:C.muted }}>{T("analystRatings", lang)}</span>
          {!isLoading && total > 0 && (
            <span className="text-[11px] font-mono px-1 rounded"
              style={{ background:C.up+"22", color:C.up }}>{bullPct}% {T("buyCount",lang)}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge isLoading={isLoading} isError={isError}
            isLive={!isLoading && !isError && total > 0} />
          {collapsed ? <ChevronDown className="w-3 h-3" style={{ color:C.muted }} />
                     : <ChevronUp   className="w-3 h-3" style={{ color:C.muted }} />}
        </div>
      </button>

      {!collapsed && (
        isLoading ? Array.from({length:4}).map((_,i) => <SkeletonRow key={i} cols={3} />) :
        isError   ? <div className="px-2 py-2 text-[12px] font-mono flex items-center gap-1"
                      style={{ color:C.down }}><AlertTriangle className="w-3 h-3"/>{T("loadFail",lang)}</div> :
        <div>
          {total > 0 && (
            <div className="px-2 pt-2 pb-1.5">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[11px] font-mono" style={{ color:C.up }}>
                  {T("strongBuy",lang)}{strongBuy}·{T("buyCount",lang)}{buy}
                </span>
                <span className="flex-1" />
                <span className="text-[11px] font-mono" style={{ color:C.warn }}>{T("holdCount",lang)}{hold}</span>
                <span className="flex-1" />
                <span className="text-[11px] font-mono" style={{ color:C.down }}>{T("sellCount",lang)}{sell+strongSell}</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                {bullPct > 0 && <div style={{ width:`${bullPct}%`, background:C.up, transition:"width 0.4s" }} />}
                {holdPct > 0 && <div style={{ width:`${holdPct}%`, background:C.warn, transition:"width 0.4s" }} />}
                {bearPct > 0 && <div style={{ width:`${bearPct}%`, background:C.down, transition:"width 0.4s" }} />}
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[11px] font-mono font-bold" style={{ color:C.up }}>{bullPct}%</span>
                <span className="text-[11px] font-mono font-bold" style={{ color:C.warn }}>{holdPct}%</span>
                <span className="text-[11px] font-mono font-bold" style={{ color:C.down }}>{bearPct}%</span>
              </div>
            </div>
          )}

          {(target || shortPct !== null) && (
            <div className="flex items-center gap-2 px-2 py-1.5 border-t" style={{ borderColor:C.border+"40" }}>
              {target && (
                <div className="flex-1">
                  <div className="text-[11px] font-mono" style={{ color:C.muted }}>{T("targetPrice",lang)}</div>
                  <div className="text-[13px] font-mono font-bold" style={{ color:C.text }}>
                    ${target.toFixed(2)}
                    {upside !== null && (
                      <span className="ml-1 text-[12px]" style={{ color: upside >= 0 ? C.up : C.down }}>
                        {upside >= 0 ? "▲" : "▼"}{Math.abs(upside).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              )}
              {shortPct !== null && (
                <div className="flex-1">
                  <div className="text-[11px] font-mono" style={{ color:C.muted }}>{T("shortFloat",lang)}</div>
                  <div className="text-[13px] font-mono font-bold"
                    style={{ color: shortPct > 10 ? C.down : shortPct > 5 ? C.warn : C.text }}>
                    {shortPct.toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          )}

          {actions.length > 0 && (
            <div className="border-t" style={{ borderColor:C.border+"40" }}>
              <div className="px-2 py-1 text-[11px] font-mono font-bold tracking-widest uppercase"
                style={{ color:C.muted }}>{T("recentReports",lang)}</div>
              {actions.map((a:any, i:number) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1 border-b"
                  style={{ borderColor:C.border+"30" }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-mono truncate" style={{ color:C.muted }}>
                      {a.firm?.slice(0,16) || "—"}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {a.fromGrade && (
                        <>
                          <span className="text-[11px] font-mono" style={{ color:gradeColor(a.fromGrade) }}>
                            {a.fromGrade.slice(0,10)}
                          </span>
                          <span className="text-[11px] font-mono" style={{ color:C.muted }}>→</span>
                        </>
                      )}
                      <span className="text-[11px] font-mono font-bold" style={{ color:gradeColor(a.toGrade) }}>
                        {(a.toGrade||"—").slice(0,12)}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono shrink-0" style={{ color:C.muted }}>
                    {a.date?.slice(5) || ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          {total === 0 && actions.length === 0 && (
            <div className="px-2 py-2 text-[12px] font-mono" style={{ color:C.muted }}>
              {T("noAnalyst",lang)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AI MARKET ANALYSIS PANEL — real market signals, no site nav links
// ══════════════════════════════════════════════════════════════════════════════
function AIPanel({ symbol, lang = "ko" as Lang }: { symbol:string; lang:Lang }) {
  const { data: mood } = useMood();
  const { data: sectorData } = useSectors();
  const { data: analystData } = useAnalyst(symbol);
  const [brief, setBrief]   = useState<string|null>(null);
  const [genLoading, setGenLoading] = useState(false);

  const sectors: any[] = (sectorData?.sectors || []).slice(0, 5);
  const fgIndex = mood?.index ?? null;
  const fgLabel = mood?.label ?? "";
  const fgColor = fgIndex !== null
    ? fgIndex >= 60 ? C.up : fgIndex <= 40 ? C.down : C.warn
    : C.muted;

  const target = analystData?.targetPrice;
  const curr   = analystData?.currentPrice;
  const upside = (target && curr && curr > 0) ? ((target - curr) / curr * 100) : null;
  const sum    = analystData?.summary || {};
  const total  = (sum.strongBuy||0)+(sum.buy||0)+(sum.hold||0)+(sum.sell||0)+(sum.strongSell||0);
  const bullPct = total ? Math.round(((sum.strongBuy||0)+(sum.buy||0))/total*100) : null;

  async function generateBrief() {
    setGenLoading(true);
    const symLabel = symbol.replace("^","").replace(".KS","").replace("=F","").replace("=X","");
    const context = [
      `Symbol: ${symLabel}`,
      fgIndex !== null ? `Fear/Greed: ${fgIndex} (${fgLabel})` : "",
      sectors.length ? `Top sectors: ${sectors.map((s:any) => `${s.symbol} ${s.changePercent>=0?"+":""}${(s.changePercent||0).toFixed(1)}%`).join(", ")}` : "",
      bullPct !== null ? `Analyst consensus: ${bullPct}% buy` : "",
      upside !== null ? `Target upside: ${upside.toFixed(1)}%` : "",
    ].filter(Boolean).join(". ");

    const promptMap: Record<Lang, string> = {
      ko: `당신은 전문 투자 분석가입니다. 다음 시장 데이터를 바탕으로 ${symLabel} 종목에 대한 간결한 AI 시장 분석을 2-3문장으로 작성하세요. 투자자 관점의 핵심 인사이트를 제공하세요.`,
      en: `You are a professional investment analyst. Based on the following market data, write a concise 2-3 sentence AI market brief for ${symLabel}. Focus on key investment insights.`,
      ja: `あなたはプロの投資アナリストです。以下の市場データを基に、${symLabel}についての簡潔なAI市場分析を2〜3文で作成してください。`,
    };
    try {
      const res = await fetch("/api/news/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: context, lang }),
      });
      const d = await res.json();
      setBrief(d.summary || "");
    } catch { setBrief(lang === "ko" ? "분석 생성 실패" : lang === "ja" ? "分析失敗" : "Analysis failed"); }
    finally { setGenLoading(false); }
  }

  return (
    <div className="p-2 space-y-2">
      <div className="text-[12px] font-mono font-bold tracking-widest uppercase"
        style={{ color:C.muted }}>{T("aiMarket",lang)}</div>

      {/* Fear & Greed gauge */}
      {fgIndex !== null && (
        <div className="rounded p-2" style={{ background:C.panel2, border:`1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono" style={{ color:C.muted }}>{T("fearGreed",lang)}</span>
            <span className="text-[12px] font-mono font-bold" style={{ color:fgColor }}>{fgLabel}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background:C.border }}>
            <div className="h-full rounded-full transition-all"
              style={{ width:`${fgIndex}%`, background:`linear-gradient(to right,${C.down},${C.warn},${C.up})` }} />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[10px] font-mono" style={{ color:C.down }}>{lang==="ko"?"공포":lang==="ja"?"恐怖":"Fear"}</span>
            <span className="text-[11px] font-mono font-bold" style={{ color:fgColor }}>{fgIndex}</span>
            <span className="text-[10px] font-mono" style={{ color:C.up }}>{lang==="ko"?"탐욕":lang==="ja"?"強欲":"Greed"}</span>
          </div>
        </div>
      )}

      {/* Analyst signal for selected stock */}
      {bullPct !== null && (
        <div className="rounded p-1.5 flex items-center gap-2"
          style={{ background:C.panel2, border:`1px solid ${C.border}` }}>
          <div className="flex-1">
            <div className="text-[11px] font-mono" style={{ color:C.muted }}>
              {symbol.replace("^","").replace(".KS","")} {T("analystRatings",lang)}
            </div>
            <div className="text-[13px] font-mono font-bold" style={{ color: bullPct>=60 ? C.up : bullPct>=40 ? C.warn : C.down }}>
              {bullPct}% {T("buyCount",lang)}
            </div>
          </div>
          {upside !== null && (
            <div className="text-right shrink-0">
              <div className="text-[11px] font-mono" style={{ color:C.muted }}>{T("upside",lang)}</div>
              <div className="text-[13px] font-mono font-bold" style={{ color: upside>=0?C.up:C.down }}>
                {upside>=0?"▲":"▼"}{Math.abs(upside).toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI brief generator */}
      {brief ? (
        <div className="rounded p-2 text-[12px] font-mono leading-relaxed"
          style={{ background:C.header, color:C.text, border:`1px solid ${C.info}40` }}>
          <span style={{ color:C.info }}>AI▸ </span>{brief}
          <button onClick={() => setBrief(null)}
            className="ml-1 text-[11px]" style={{ color:C.muted }}>✕</button>
        </div>
      ) : (
        <button onClick={generateBrief} disabled={genLoading}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[13px] font-mono font-bold"
          style={{ background:C.info+"22", color:C.info, border:`1px solid ${C.info}40`,
                   opacity: genLoading ? 0.7 : 1 }}>
          {genLoading
            ? <><Loader2 className="w-3 h-3 animate-spin"/>{lang==="ko"?"분석 생성 중...":lang==="ja"?"生成中...":"Generating..."}</>
            : <><Bot className="w-3 h-3"/>{T("genAnalysis",lang)}</>}
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PEER COMPARISON PANEL  — compact terminal-themed peer comparison
// ══════════════════════════════════════════════════════════════════════════════
function PeerPanel({ symbol, lang = "ko" as Lang }: { symbol:string; lang:Lang }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/stocks/peers", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/peers/${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!symbol,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });

  const peers: any[] = data?.peers ?? [];
  if (!isLoading && peers.length === 0) return null;

  const mainStock  = peers.find((p:any) => p.symbol === symbol);
  const otherPeers = peers.filter((p:any) => p.symbol !== symbol);

  function sAvg(key: keyof any): number|null {
    const vals = otherPeers.map((p:any) => p[key]).filter((v:any) => v != null && isFinite(v)) as number[];
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  }

  const avgPE  = sAvg("peRatio");
  const avgPB  = sAvg("pbRatio");
  const avgDiv = sAvg("dividendYield");

  function badge(mine:number|null, avg:number|null, lowerBetter:boolean) {
    if (!mine || !avg || avg === 0) return null;
    const r = mine / avg;
    const better = lowerBetter ? r < 0.95 : r > 1.05;
    const worse  = lowerBetter ? r > 1.05 : r < 0.95;
    if (better) return <span className="text-[10px] font-mono px-1 rounded" style={{ background:C.up+"22", color:C.up }}>
      {lang==="ko"? (lowerBetter?"저평가":"우수") : lang==="ja"?(lowerBetter?"割安":"優秀"):(lowerBetter?"低":"↑")}
    </span>;
    if (worse) return <span className="text-[10px] font-mono px-1 rounded" style={{ background:C.down+"22", color:C.down }}>
      {lang==="ko"? (lowerBetter?"고평가":"평균↓") : lang==="ja"?(lowerBetter?"割高":"↓"):">Avg"}
    </span>;
    return <span className="text-[10px] font-mono px-1 rounded" style={{ background:C.border, color:C.muted }}>
      {lang==="ko"?"평균":lang==="ja"?"平均":"Avg"}
    </span>;
  }

  const title = lang==="ko"?"동종업계 비교":lang==="ja"?"同業比較":"Peer Compare";

  return (
    <div className="border-b" style={{ borderColor:C.border }}>
      {/* Header */}
      <div className="px-2 py-1.5 border-b flex items-center justify-between"
        style={{ borderColor:C.border, background:C.header }}>
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase" style={{ color:C.muted }}>
          {title}
        </span>
        <StatusBadge isLoading={isLoading} isError={false} isLive={peers.length > 0} />
      </div>

      {isLoading ? (
        Array.from({length:4}).map((_,i) => <SkeletonRow key={i} />)
      ) : (
        <>
          {/* Sector eval row */}
          {mainStock && (
            <div className="px-2 py-1.5 border-b grid gap-x-2 gap-y-1"
              style={{ borderColor:C.border+"60", gridTemplateColumns:"1fr 1fr 1fr" }}>
              <div className="text-center">
                <div className="text-[10px] font-mono" style={{ color:C.muted }}>P/E</div>
                <div className="text-[13px] font-mono font-bold" style={{ color:C.text }}>
                  {mainStock.peRatio != null ? mainStock.peRatio.toFixed(1) : "—"}
                </div>
                <div className="mt-0.5">{badge(mainStock.peRatio, avgPE, true)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-mono" style={{ color:C.muted }}>P/B</div>
                <div className="text-[13px] font-mono font-bold" style={{ color:C.text }}>
                  {mainStock.pbRatio != null ? mainStock.pbRatio.toFixed(2) : "—"}
                </div>
                <div className="mt-0.5">{badge(mainStock.pbRatio, avgPB, true)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-mono" style={{ color:C.muted }}>배당</div>
                <div className="text-[13px] font-mono font-bold" style={{ color:C.text }}>
                  {mainStock.dividendYield != null ? `${(mainStock.dividendYield*100).toFixed(2)}%` : "—"}
                </div>
                <div className="mt-0.5">{badge(mainStock.dividendYield, avgDiv, false)}</div>
              </div>
            </div>
          )}

          {/* Peer table header */}
          <div className="grid px-2 py-0.5" style={{ gridTemplateColumns:"1fr 52px 36px 36px", background:C.panel2 }}>
            {["종목","가격","P/E","수익률"].map(h => (
              <span key={h} className="text-[10px] font-mono uppercase text-right first:text-left" style={{ color:C.muted }}>{h}</span>
            ))}
          </div>

          {/* Peer rows */}
          {peers.slice(0, 8).map((p:any) => {
            const isMain = p.symbol === symbol;
            const locName = getLocalizedCompanyName(p.name || p.symbol, lang);
            const displayName = locName || p.name || p.symbol;
            return (
              <div key={p.symbol} className="grid px-2 py-0.5"
                style={{
                  gridTemplateColumns:"1fr 52px 36px 36px",
                  background: isMain ? C.info+"18" : "transparent",
                  borderLeft: isMain ? `2px solid ${C.info}` : "2px solid transparent",
                }}>
                <div className="min-w-0">
                  <div className="text-[11px] font-mono font-bold truncate" style={{ color: isMain ? C.info : C.text }}>
                    {displayName.length > 14 ? displayName.slice(0, 14) + "…" : displayName}
                  </div>
                  <div className="text-[9px] font-mono truncate" style={{ color:C.muted }}>
                    {p.symbol}
                  </div>
                </div>
                <div className="text-right text-[11px] font-mono" style={{ color:C.text }}>
                  {p.price != null ? p.price.toLocaleString("en-US",{maximumFractionDigits:1}) : "—"}
                </div>
                <div className="text-right text-[11px] font-mono" style={{ color:C.muted }}>
                  {p.peRatio != null ? p.peRatio.toFixed(1) : "—"}
                </div>
                <div className="text-right text-[11px] font-mono" style={{ color: (p.operatingMargin??0)>=0?C.up:C.down }}>
                  {p.operatingMargin != null ? `${(p.operatingMargin*100).toFixed(1)}%` : "—"}
                </div>
              </div>
            );
          })}
          {data?.isSectorFallback && (
            <div className="px-2 py-1 text-[10px] font-mono" style={{ color:C.muted }}>
              * {lang==="ko"?"섹터 기반 비교":lang==="ja"?"セクター比較":"Sector-based"}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TODAY'S REPORTS PANEL  — Korean + International research reports
// ══════════════════════════════════════════════════════════════════════════════
const KR_REPORT_SYMS = ["005930.KS","000660.KS","005380.KS","035420.KS","035720.KS"];

function TodayReportsPanel({ lang = "ko" as Lang }: { lang:Lang }) {
  const intlQuery = useNews(lang);
  const krQuery   = useQuery<any>({
    queryKey: ["/api/stocks/news/005930.KS", lang],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/news/005930.KS?lang=en`);
      if (!res.ok) return { news: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const intlItems: any[] = (() => {
    const raw: any = intlQuery.data;
    return (Array.isArray(raw) ? raw : Array.isArray(raw?.news) ? raw.news : []).slice(0, 8);
  })();
  const krItems: any[] = ((krQuery.data as any)?.news || []).slice(0, 6);

  const [expandedIntl, setExpandedIntl] = useState<number|null>(null);
  const [expandedKr,   setExpandedKr]   = useState<number|null>(null);
  const [summaries, setSummaries] = useState<Record<string,string>>({});
  const [generating, setGenerating] = useState<string|null>(null);

  async function genSummary(key: string, title: string) {
    if (summaries[key] || generating) return;
    setGenerating(key);
    try {
      const res = await fetch("/api/news/summarize", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ title, lang }),
      });
      const d = await res.json();
      setSummaries(p => ({ ...p, [key]: d.summary || "" }));
    } catch { setSummaries(p => ({ ...p, [key]: "요약 실패" })); }
    finally { setGenerating(null); }
  }

  function ReportItem({ item, idx, section, expanded, setExpanded }: {
    item:any; idx:number; section:string; expanded:number|null; setExpanded:(n:number|null)=>void
  }) {
    const key = `${section}-${idx}`;
    const isOpen = expanded === idx;
    const koSummary = item.koreanSummary as string | undefined;
    const jaSummary = item.japaneseSummary as string | undefined;
    const displayTitle = lang === "ko" && koSummary ? koSummary
      : lang === "ja" && jaSummary ? jaSummary
      : item.title;
    const showOriginal = lang !== "en" && displayTitle !== item.title;
    return (
      <div className="border-b" style={{ borderColor:C.border+"40" }}>
        <button className="w-full text-left px-2 py-1.5 hover:bg-white/5 transition-colors"
          onClick={() => {
            setExpanded(isOpen ? null : idx);
            if (!isOpen) genSummary(key, item.title);
          }}>
          <div className="text-[12px] font-mono leading-snug mb-0.5" style={{ color:C.text }}>
            {displayTitle}
          </div>
          {showOriginal && (
            <div className="text-[10px] font-mono leading-snug mb-0.5 line-clamp-1" style={{ color:C.muted }}>
              {item.title}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono" style={{ color:C.muted }}>{item.publisher || "—"}</span>
            {item.publishedAt && (
              <span className="text-[10px] font-mono" style={{ color:C.muted }}>
                · {Math.round((Date.now()/1000 - item.publishedAt)/3600)}h
              </span>
            )}
          </div>
        </button>
        {isOpen && (
          <div className="px-2 pb-2 space-y-1.5">
            {summaries[key] ? (
              <div className="rounded p-1.5" style={{ background:C.info+"15", border:`1px solid ${C.info}30` }}>
                <span className="text-[10px] font-mono font-bold" style={{ color:C.info }}>AI▸ </span>
                <span className="text-[12px] font-mono" style={{ color:C.text }}>{summaries[key]}</span>
              </div>
            ) : generating === key ? (
              <div className="text-[11px] font-mono flex items-center gap-1" style={{ color:C.muted }}>
                <Loader2 className="w-3 h-3 animate-spin" /> {T("loading", lang)}
              </div>
            ) : null}
            {item.link && (
              <a href={item.link} target="_blank" rel="noopener noreferrer"
                className="text-[11px] font-mono" style={{ color:C.info }}>
                {T("readMore", lang)} ↗
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-b" style={{ borderColor:C.border }}>
      <div className="px-2 py-1.5 border-b flex items-center justify-between"
        style={{ borderColor:C.border, background:C.header }}>
        <div className="flex items-center gap-1.5">
          <FileText className="w-3 h-3" style={{ color:C.warn }} />
          <span className="text-[12px] font-mono font-bold tracking-widest uppercase"
            style={{ color:C.muted }}>{T("todayReports",lang)}</span>
        </div>
        <StatusBadge isLoading={intlQuery.isLoading || krQuery.isLoading}
          isError={intlQuery.isError} isLive={intlItems.length > 0} />
      </div>

      {/* Korean Reports */}
      <div className="px-2 py-1 border-b" style={{ borderColor:C.border+"60", background:C.panel2+"80" }}>
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-mono font-bold" style={{ color:C.up }}>🇰🇷</span>
          <span className="text-[11px] font-mono font-bold" style={{ color:C.muted }}>{T("domesticReport",lang)}</span>
        </div>
      </div>
      {krQuery.isLoading
        ? Array.from({length:3}).map((_,i) => <SkeletonRow key={i} cols={2}/>)
        : krItems.length === 0
        ? <div className="px-2 py-2 text-[11px] font-mono" style={{ color:C.muted }}>{T("noData",lang)}</div>
        : krItems.map((item,i) => (
            <ReportItem key={i} item={item} idx={i} section="kr"
              expanded={expandedKr} setExpanded={setExpandedKr} />
          ))
      }

      {/* International Reports */}
      <div className="px-2 py-1 border-b border-t mt-1" style={{ borderColor:C.border+"60", background:C.panel2+"80" }}>
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-mono font-bold" style={{ color:C.info }}>🌐</span>
          <span className="text-[11px] font-mono font-bold" style={{ color:C.muted }}>{T("intlReport",lang)}</span>
        </div>
      </div>
      {intlQuery.isLoading
        ? Array.from({length:4}).map((_,i) => <SkeletonRow key={i} cols={2}/>)
        : intlItems.length === 0
        ? <div className="px-2 py-2 text-[11px] font-mono" style={{ color:C.muted }}>{T("noData",lang)}</div>
        : intlItems.map((item,i) => (
            <ReportItem key={i} item={item} idx={i} section="intl"
              expanded={expandedIntl} setExpanded={setExpandedIntl} />
          ))
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STOCK REPORT PANEL  — company-specific research / news for fund tab
// ══════════════════════════════════════════════════════════════════════════════
function StockReportPanel({ symbol, lang = "ko" as Lang }: { symbol:string; lang:Lang }) {
  const { data, isLoading, isError } = useStockNews(symbol);
  const items: any[] = ((data as any)?.news || []).slice(0, 10);
  const [expanded, setExpanded] = useState<number|null>(null);
  const [summaries, setSummaries] = useState<Record<string,string>>({});
  const [generating, setGenerating] = useState<string|null>(null);

  async function genSummary(key: string, title: string) {
    if (summaries[key] || generating) return;
    setGenerating(key);
    try {
      const res = await fetch("/api/news/summarize", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ title, lang }),
      });
      const d = await res.json();
      setSummaries(p => ({ ...p, [key]: d.summary || "" }));
    } catch { setSummaries(p => ({ ...p, [key]: T("loadFail",lang) })); }
    finally { setGenerating(null); }
  }

  return (
    <div className="border-b" style={{ borderColor:C.border }}>
      <div className="px-2 py-1.5 border-b flex items-center justify-between"
        style={{ borderColor:C.border, background:C.header }}>
        <div className="flex items-center gap-1.5">
          <FileText className="w-3 h-3" style={{ color:C.warn }} />
          <span className="text-[12px] font-mono font-bold tracking-widest uppercase"
            style={{ color:C.muted }}>{T("stockReport",lang)}</span>
        </div>
        <StatusBadge isLoading={isLoading} isError={isError} isLive={items.length > 0} />
      </div>
      {isLoading
        ? Array.from({length:4}).map((_,i) => <SkeletonRow key={i} cols={2}/>)
        : isError || items.length === 0
        ? <div className="px-2 py-2 text-[12px] font-mono" style={{ color:C.muted }}>{T("noData",lang)}</div>
        : items.map((item:any, i:number) => {
            const key = `sr-${i}`;
            const isOpen = expanded === i;
            const koSummary = item.koreanSummary as string | undefined;
            const jaSummary = item.japaneseSummary as string | undefined;
            const displayTitle = lang === "ko" && koSummary ? koSummary
              : lang === "ja" && jaSummary ? jaSummary
              : item.title;
            const showOriginal = lang !== "en" && displayTitle !== item.title;
            return (
              <div key={i} className="border-b" style={{ borderColor:C.border+"40" }}>
                <button className="w-full text-left px-2 py-1.5 hover:bg-white/5 transition-colors"
                  onClick={() => { setExpanded(isOpen ? null : i); if (!isOpen) genSummary(key, item.title); }}>
                  <div className="text-[12px] font-mono leading-snug mb-0.5" style={{ color:C.text }}>
                    {displayTitle}
                  </div>
                  {showOriginal && (
                    <div className="text-[10px] font-mono leading-snug mb-0.5 line-clamp-1" style={{ color:C.muted }}>
                      {item.title}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono" style={{ color:C.muted }}>{item.publisher||"—"}</span>
                    {item.publishedAt && (
                      <span className="text-[10px] font-mono" style={{ color:C.muted }}>
                        · {Math.round((Date.now()/1000 - item.publishedAt)/3600)}h
                      </span>
                    )}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-2 pb-2 space-y-1.5">
                    {summaries[key] ? (
                      <div className="rounded p-1.5" style={{ background:C.info+"15", border:`1px solid ${C.info}30` }}>
                        <span className="text-[10px] font-mono font-bold" style={{ color:C.info }}>AI▸ </span>
                        <span className="text-[12px] font-mono" style={{ color:C.text }}>{summaries[key]}</span>
                      </div>
                    ) : generating === key ? (
                      <div className="text-[11px] font-mono flex items-center gap-1" style={{ color:C.muted }}>
                        <Loader2 className="w-3 h-3 animate-spin" /> {T("loading",lang)}
                      </div>
                    ) : null}
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] font-mono" style={{ color:C.info }}>
                        {T("readMore",lang)} ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// QUEST MINI BAR
// ══════════════════════════════════════════════════════════════════════════════
function QuestBar() {
  const { data: user } = useUser();
  const { data: quests } = useQuery<any[]>({
    queryKey: ["/api/quests/daily"],
    staleTime: 60_000,
    retry: 1,
  });
  const total  = quests?.length || 6;
  const done   = quests?.filter((q:any) => q.isCompleted).length || 0;
  const pct    = total ? Math.round(done/total*100) : 0;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b shrink-0"
      style={{ borderColor:C.border, background:C.panel }}>
      <div className="flex-1">
        <div className="flex justify-between mb-0.5">
          <span className="text-[12px] font-mono" style={{ color:C.muted }}>오늘의 퀘스트</span>
          <span className="text-[12px] font-mono font-bold" style={{ color:C.up }}>{done}/{total} 완료</span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background:C.border }}>
          <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background:C.up }} />
        </div>
      </div>
      {user && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3" style={{ color:C.warn }} />
            <span className="text-[13px] font-mono font-bold" style={{ color:C.warn }}>{user.xp}</span>
          </div>
          <div className="flex items-center gap-1">
            <Flame className="w-3 h-3" style={{ color:"#ff6b35" }} />
            <span className="text-[13px] font-mono font-bold" style={{ color:"#ff6b35" }}>{user.streak}일</span>
          </div>
        </div>
      )}
      <Link href="/quests" className="text-[12px] font-mono px-2 py-0.5 rounded font-bold"
        style={{ background:C.up+"22", color:C.up }}>GO</Link>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SYMBOL SEARCH  — supports Korean names + English names + tickers
// ══════════════════════════════════════════════════════════════════════════════
const QUICK_SYMS = ["AAPL","NVDA","TSLA","MSFT","AMZN","META","005930.KS","^KS11","BTC-USD","GOOGL","QQQ","SPY"];

function SymbolSearch({ onSelect, stocks = {} }: {
  onSelect:(s:string)=>void;
  stocks?: Record<string,any>;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  // Live API search (for non-Korean queries, covers Japanese, US, etc.)
  const { data: liveResults = [] } = useStockSearch(
    debouncedQ.length >= 2 && !containsKorean(debouncedQ) ? debouncedQ : ""
  );

  const staticResults: {ticker:string; name:string}[] = useMemo(() => {
    const q = query.trim();
    if (!q) {
      return QUICK_SYMS.map(t => {
        const a = KOREAN_STOCK_ALIASES.find(x => x.ticker === t);
        return { ticker: t, name: a?.ko || a?.en || t };
      });
    }
    if (containsKorean(q)) {
      return searchByKoreanAlias(q).slice(0, 10).map(a => ({ ticker: a.ticker, name: a.ko }));
    }
    const up = q.toUpperCase();
    const tickerHits = QUICK_SYMS.filter(s => s.startsWith(up));
    const nameHits = KOREAN_STOCK_ALIASES
      .filter(a =>
        a.en.toLowerCase().includes(q.toLowerCase()) &&
        !tickerHits.includes(a.ticker)
      )
      .slice(0, 6)
      .map(a => a.ticker);
    return Array.from(new Set([...tickerHits, ...nameHits])).slice(0, 9).map(t => {
      const a = KOREAN_STOCK_ALIASES.find(x => x.ticker === t);
      return { ticker: t, name: a?.ko || a?.en || t };
    });
  }, [query]);

  // Merge static + live, deduplicate
  const results: {ticker:string; name:string; isLive?:boolean}[] = useMemo(() => {
    const q = query.trim();
    if (!q || containsKorean(q)) return staticResults;
    const staticTickers = new Set(staticResults.map(r => r.ticker));
    const liveOnly = liveResults
      .filter(r => !staticTickers.has(r.ticker))
      .map(r => ({ ...r, isLive: true }));
    return [...staticResults, ...liveOnly].slice(0, 12);
  }, [staticResults, liveResults, query]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (containsKorean(q)) {
      const found = searchByKoreanAlias(q);
      if (found.length > 0) { onSelect(found[0].ticker); setQuery(""); setFocused(false); return; }
    }
    onSelect(q.toUpperCase());
    setQuery(""); setFocused(false);
  }

  return (
    <div className="relative shrink-0">
      <form onSubmit={submit} className="flex items-center">
        <div className="flex items-center px-2 gap-1.5 rounded"
          style={{ background:C.panel2, border:`1px solid ${C.border}`, minWidth:170 }}>
          <Search className="w-3 h-3 shrink-0" style={{ color:C.muted }} />
          <input value={query} onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="티커·한글·이름 검색..."
            className="bg-transparent text-[14px] font-mono py-1 outline-none w-32"
            style={{ color:C.text, caretColor:C.info }} />
        </div>
      </form>
      {focused && results.length > 0 && (
        <div className="absolute top-full left-0 z-50 rounded shadow-xl mt-1 py-1 min-w-[220px]"
          style={{ background:C.panel2, border:`1px solid ${C.border}` }}>
          {results.map(({ ticker, name }) => {
            const q = stocks[ticker];
            const up = isUp(q?.changePercent);
            return (
              <button key={ticker}
                onMouseDown={() => { onSelect(ticker); setQuery(""); setFocused(false); }}
                className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-[#1a2d42]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-mono font-bold shrink-0" style={{ color:C.info }}>
                    {ticker.endsWith(".KS") && name ? name : ticker.replace(".KS","").replace("^","")}
                  </span>
                  <span className="text-[12px] font-mono truncate" style={{ color:C.muted }}>
                    {ticker.endsWith(".KS") && name ? ticker.replace(".KS","") : name}
                  </span>
                </div>
                {q?.changePercent != null && (
                  <span className={cn("text-[12px] font-mono font-bold shrink-0 ml-2",
                    up ? "text-[#00c896]" : "text-[#ff4757]")}>
                    {fmtPct(q.changePercent)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MACRO PANEL — Bond yields, volatility index, commodities
// ══════════════════════════════════════════════════════════════════════════════
const MACRO_DEF = [
  { sym:"^TNX",  label:"미10Y",   unit:"%", toFix:3 },
  { sym:"^VIX",  label:"VIX",    unit:"",  toFix:2 },
  { sym:"^IRX",  label:"3M금리",  unit:"%", toFix:3 },
  { sym:"GC=F",  label:"금(Gold)",unit:"$", toFix:0 },
  { sym:"CL=F",  label:"WTI유가", unit:"$", toFix:2 },
  { sym:"JPY=X", label:"USD/JPY", unit:"",  toFix:2 },
];

function MacroPanel({ stocks }: { stocks: Record<string,any> }) {
  return (
    <div className="p-3 border-t" style={{ borderColor:C.border }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-mono font-bold tracking-widest uppercase"
          style={{ color:C.muted }}>MACRO / RATES</span>
        <Link href="/calendar" className="text-[12px] font-mono" style={{ color:C.info }}>→</Link>
      </div>
      <div className="grid grid-cols-3 gap-0.5" style={{ background:C.border }}>
        {MACRO_DEF.map(({ sym, label, unit, toFix }) => {
          const q = stocks[sym];
          const price = q?.price;
          const pct = q?.changePercent;
          const up = (pct ?? 0) >= 0;
          // VIX is inverse (higher = more fear = bad)
          const clr = price != null
            ? (sym === "^VIX" ? (up ? C.down : C.up) : (up ? C.up : C.down))
            : C.muted;
          return (
            <div key={sym} className="px-1.5 py-1.5" style={{ background:C.panel2 }}>
              <div className="text-[10px] font-mono truncate" style={{ color:C.muted }}>{label}</div>
              <div className="text-[14px] font-mono font-bold" style={{ color: clr }}>
                {price != null
                  ? `${unit === "$" ? "$" : ""}${price.toFixed(toFix)}${unit === "%" ? "%" : ""}`
                  : "—"}
              </div>
              {pct != null && (
                <div className="text-[11px] font-mono" style={{ color: clr }}>
                  {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// F-KEY STRIP
// ══════════════════════════════════════════════════════════════════════════════
const FKEYS = [
  {key:"F2",label:"PRO",      href:"/pro"},
  {key:"F3",label:"QUESTS",   href:"/quests"},
  {key:"F4",label:"NEWS",     href:"/hot-issues"},
  {key:"F5",label:"INVESTORS",href:"/investors"},
  {key:"F6",label:"CALENDAR", href:"/calendar"},
  {key:"F7",label:"TRENDS",   href:"/market-trends"},
  {key:"F8",label:"WATCHLIST",href:"/watchlist"},
  {key:"F9",label:"RRG",      href:"/rrg"},
];
function FKeyStrip() {
  return (
    <div className="flex items-stretch border-t overflow-x-auto shrink-0"
      style={{ borderColor:C.border, background:C.header, scrollbarWidth:"none" }}>
      {FKEYS.map(({ key, label, href }) => (
        <Link key={key} href={href}
          className="flex items-center gap-1 px-3 py-1.5 border-r text-[12px] font-mono shrink-0 hover:bg-[#111a26]"
          style={{ borderColor:C.border }}>
          <span className="font-bold" style={{ color:C.info }}>{key}</span>
          <span style={{ color:C.muted }}>{label}</span>
        </Link>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MOBILE TABS
// ══════════════════════════════════════════════════════════════════════════════
type MTab = "market"|"macro"|"chart"|"news"|"fund";
const MOBILE_TABS: {id:MTab;label:string;icon:React.ReactNode}[] = [
  {id:"market", label:"시장", icon:<Activity className="w-4 h-4"/>},
  {id:"macro",  label:"거시", icon:<TrendingUp className="w-4 h-4"/>},
  {id:"chart",  label:"차트", icon:<BarChart2 className="w-4 h-4"/>},
  {id:"news",   label:"뉴스", icon:<Newspaper className="w-4 h-4"/>},
  {id:"fund",   label:"정보", icon:<DollarSign className="w-4 h-4"/>},
];

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function DinoTerminal() {
  const { data: user } = useUser();
  const lang = ((user?.language as Lang) || "ko") as Lang;
  const [selected, setSelected] = useState("005930.KS");
  const [pIdx, setPIdx] = useState(2);        // 2 = "1M" (0=1D,1=5D,2=1M...)
  const [mTab, setMTab] = useState<MTab>("market");
  const [watchSyms, setWatchSyms] = useState<string[]>(loadWatchSyms);
  const [watchNames, setWatchNames] = useState<Record<string,string>>(loadWatchNames);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => { localStorage.setItem("dino-terminal-tab", mTab); }, [mTab]);

  function handleWatchUpdate(syms: string[], names: Record<string,string>) {
    setWatchSyms(syms);
    setWatchNames(names);
    saveWatchSyms(syms, names);
  }

  // ─── FAST FIRST LOAD: only batch live prices ───────────────────────────────
  const allSyms = Array.from(new Set([...watchSyms, ...INDEX_SYMS, ...CROSS_SYMS, ...MACRO_SYMS, ...GLOBAL_SYMS, selected]));
  const { data: stocks = {}, isLoading: liveLdg, isError: liveErr } = useLivePrices(allSyms);
  const quote = stocks[selected];

  const selectSym = useCallback((s: string) => {
    setSelected(s);
    setMTab("chart");
  }, []);

  // ─── DESKTOP ───────────────────────────────────────────────────────────────
  const Desktop = (
    <div className="hidden md:flex flex-col h-full overflow-hidden"
      style={{ background:C.bg, color:C.text }}>

      {/* ── TOP BAR: search | live tickers | clock | user stats ── */}
      <div className="flex items-center gap-0 border-b shrink-0"
        style={{ borderColor:C.border, background:C.header, height:36 }}>

        {/* Search */}
        <div className="px-2 border-r shrink-0" style={{ borderColor:C.border }}>
          <SymbolSearch onSelect={selectSym} stocks={stocks} />
        </div>

        {/* Live index tickers */}
        <div className="flex items-center flex-1 overflow-hidden">
          {["SPY","QQQ","^KS11","BTC-USD","^TNX","^VIX","GC=F","CL=F"].map((sym) => {
            const q = stocks[sym];
            if (!q) return null;
            const up = (q.changePercent ?? 0) >= 0;
            const isRate = sym === "^TNX" || sym === "^IRX";
            const isVix  = sym === "^VIX";
            return (
              <div key={sym} className="flex items-center gap-1.5 px-2.5 border-r h-full shrink-0"
                style={{ borderColor:C.border }}>
                <span className="text-[12px] font-mono" style={{ color:C.muted }}>
                  {INDEX_LBL[sym] || sym.replace("^","")}
                </span>
                <span className="text-[12px] font-mono font-bold" style={{
                  color: isVix ? (up ? C.down : C.up) : (up ? C.up : C.down)
                }}>
                  {isRate
                    ? `${q.price?.toFixed(3)}%`
                    : isVix
                    ? q.price?.toFixed(2)
                    : `${up?"▲":"▼"}${Math.abs(q.changePercent??0).toFixed(2)}%`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Clock + user stats */}
        <div className="flex items-center gap-3 px-3 border-l shrink-0"
          style={{ borderColor:C.border }}>
          <TerminalClock />
          {user && (
            <div className="flex items-center gap-2 text-[13px] font-mono">
              <span style={{ color:C.warn }}>⚡{user.xp}</span>
              <span style={{ color:"#ff6b35" }}>🔥{user.streak}일</span>
              <span className="px-1.5 py-0.5 rounded font-bold"
                style={{ background:C.up+"22", color:C.up }}>Lv.{user.level}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── 5-COLUMN BLOOMBERG GRID ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ▌COL 1 (185px) — Market overview + Movers + Volume + Watchlist ▐ */}
        <div className="w-[185px] shrink-0 border-r overflow-y-auto flex flex-col"
          style={{ borderColor:C.border, scrollbarWidth:"none" }}>
          <MarketPulseWidget liveStocks={stocks} />
          <MarketMoversPanel onSelect={selectSym} />
          <VolumePulsePanel />
          <GlobalMiniPanel stocks={stocks} />
          <CryptoMiniPanel stocks={stocks} />
          <RatesMiniPanel stocks={stocks} />
          <SectorMap />
          <WatchGrid stocks={stocks} onSelect={selectSym} selected={selected} isLoading={liveLdg}
            watchSyms={watchSyms} watchNames={watchNames} onEditOpen={() => setShowEditModal(true)} />
        </div>

        {/* ▌COL 2 (flex) — Chart + TechEngine + MacroPanel ▐ */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <SymbolHeader symbol={selected} quote={quote} />

          {/* Period tabs row */}
          <div className="flex items-center gap-1.5 px-2 py-1 border-b shrink-0"
            style={{ borderColor:C.border, background:C.header }}>
            {PERIODS.map((p, i) => (
              <button key={p.label} onClick={() => setPIdx(i)}
                className="px-2 py-0.5 rounded text-[12px] font-mono font-bold"
                style={{
                  background: pIdx===i ? C.info+"33" : "transparent",
                  color:      pIdx===i ? C.info       : C.muted,
                  border:    `1px solid ${pIdx===i ? C.info+"50" : "transparent"}`,
                }}>{p.label}</button>
            ))}
            <div className="flex-1" />
            <Link href={`/stock/${selected}`} className="text-[12px] font-mono"
              style={{ color:C.info }}>
              {lang === "ko" ? "고급 차트→" : lang === "ja" ? "詳細チャート→" : "Full Chart→"}
            </Link>
          </div>

          {/* Chart — FIXED HEIGHT */}
          <div style={{ height:160, flexShrink:0, padding:"4px 4px 0" }}>
            <PriceChart symbol={selected} periodIdx={pIdx} isMarketOpen={quote?.isMarketOpen === true}
              prevClose={(quote?.price && quote?.change != null) ? quote.price - quote.change : 0} />
          </div>

          {/* Scrollable: TechEngine + PeerPanel + Macro rates */}
          <div className="flex-1 border-t overflow-y-auto" style={{ borderColor:C.border, scrollbarWidth:"none" }}>
            <TechEngine symbol={selected} quote={quote} />
            <PeerPanel symbol={selected} lang={lang} />
            <MacroPanel stocks={stocks} />
          </div>
        </div>

        {/* ▌COL 3 (155px) — Yield Curve + Global Markets + Commodities/FX ▐ */}
        <div className="w-[155px] shrink-0 border-l overflow-y-auto flex flex-col"
          style={{ borderColor:C.border, scrollbarWidth:"none" }}>
          <YieldCurvePanel stocks={stocks} />
          <GlobalMarketsPanel stocks={stocks} />
          <CommodityFXPanel stocks={stocks} />
        </div>

        {/* ▌COL 4 (175px) — Fundamentals + Analyst + Insider + Institutional + Stock Reports ▐ */}
        <div className="w-[175px] shrink-0 border-l overflow-y-auto flex flex-col"
          style={{ borderColor:C.border, scrollbarWidth:"none" }}>
          <FundamentalsPanel symbol={selected} quote={quote} lang={lang} />
          <AnalystPanel symbol={selected} lang={lang} />
          <InsiderPanel symbol={selected} lang={lang} />
          <InstitutionalPanel symbol={selected} lang={lang} />
          <StockReportPanel symbol={selected} lang={lang} />
        </div>

        {/* ▌COL 5 (195px) — News + Reports + Calendar + AI ▐ */}
        <div className="w-[195px] shrink-0 border-l overflow-y-auto flex flex-col"
          style={{ borderColor:C.border, scrollbarWidth:"none" }}>
          <NewsPanel lang={lang} symbol={selected} showToggle={true} />
          <TodayReportsPanel lang={lang} />
          <CalendarPanel />
          <AIPanel symbol={selected} lang={lang} />
        </div>
      </div>

      <FKeyStrip />
    </div>
  );

  // ─── MOBILE ────────────────────────────────────────────────────────────────
  const Mobile = (
    <div className="flex md:hidden flex-col"
      style={{ minHeight:"60vh", background:C.bg, color:C.text }}>

      {/* Mobile top bar: symbol + price + search */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0"
        style={{ borderColor:C.border, background:C.header }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono font-bold" style={{ color:C.info }}>
              {selected.endsWith(".KS") && watchNames[selected]
                ? watchNames[selected]
                : selected.replace("^","").replace(".KS","").replace("=F","").replace("=X","")}
            </span>
            {quote && (
              <span className="text-[14px] font-mono font-bold"
                style={{ color: isUp(quote.changePercent) ? C.up : C.down }}>
                {fmtPct(quote.changePercent)}
              </span>
            )}
          </div>
          {/* Mini index ticker row */}
          <div className="flex items-center gap-3 mt-0.5 overflow-x-auto" style={{ scrollbarWidth:"none" }}>
            {["SPY","QQQ","^KS11","BTC-USD"].map(sym => {
              const q = stocks[sym];
              if (!q) return null;
              const up = (q.changePercent ?? 0) >= 0;
              return (
                <span key={sym} className="text-[12px] font-mono shrink-0"
                  style={{ color: up ? C.up : C.down }}>
                  {INDEX_LBL[sym]||sym} {up?"▲":"▼"}{Math.abs(q.changePercent??0).toFixed(1)}%
                </span>
              );
            })}
          </div>
        </div>
        <SymbolSearch onSelect={selectSym} />
      </div>

      <QuestBar />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth:"none" }}>

        {/* ── MARKET TAB: dense index grid + movers + volume + sectors + watchlist ── */}
        {mTab === "market" && (
          <>
            <MarketPulseWidget liveStocks={stocks} />
            <MarketMoversPanel onSelect={selectSym} />
            <VolumePulsePanel />
            <GlobalMiniPanel stocks={stocks} />
            <CryptoMiniPanel stocks={stocks} />
            <RatesMiniPanel stocks={stocks} />
            <SectorMap />
            <WatchGrid stocks={stocks} onSelect={selectSym} selected={selected} isLoading={liveLdg}
              watchSyms={watchSyms} watchNames={watchNames} onEditOpen={() => setShowEditModal(true)} />
          </>
        )}

        {/* ── CHART TAB: chart (220px) + tech + cross-asset + stock news ── */}
        {mTab === "chart" && (
          <>
            <SymbolHeader symbol={selected} quote={quote} />
            <div className="flex items-center gap-1 px-2 py-1.5 border-b flex-wrap"
              style={{ borderColor:C.border, background:C.header }}>
              {PERIODS.map((p, i) => (
                <button key={p.label} onClick={() => setPIdx(i)}
                  className="px-2 py-0.5 rounded text-[12px] font-mono font-bold"
                  style={{
                    background: pIdx===i ? C.info+"33" : C.panel2,
                    color:      pIdx===i ? C.info       : C.muted,
                    border:    `1px solid ${pIdx===i ? C.info+"50" : C.border}`,
                  }}>{p.label}</button>
              ))}
              <div className="flex-1" />
              <Link href={`/stock/${selected}`} className="text-[12px] font-mono" style={{ color:C.info }}>
                {lang==="ko"?"고급→":lang==="ja"?"詳細→":"Full→"}
              </Link>
            </div>
            <div style={{ height:180, padding:"4px" }}>
              <PriceChart symbol={selected} periodIdx={pIdx} isMarketOpen={quote?.isMarketOpen === true}
                prevClose={(quote?.price && quote?.change != null) ? quote.price - quote.change : 0} />
            </div>
            <TechEngine symbol={selected} quote={quote} />
            <CrossAssetTable stocks={stocks} onSelect={sym => { selectSym(sym); }} />
            <StockNewsCompact symbol={selected} lang={lang} />
          </>
        )}

        {/* ── NEWS TAB: market + company news toggle + today's reports + calendar ── */}
        {mTab === "news" && (
          <>
            <NewsPanel lang={lang} symbol={selected} showToggle={true} />
            <TodayReportsPanel lang={lang} />
            <CalendarPanel />
          </>
        )}

        {/* ── MACRO TAB: full macro suite ── */}
        {mTab === "macro" && (
          <>
            <MacroSignalPanel stocks={stocks} />
            <RatesDetailPanel stocks={stocks} />
            <YieldCurvePanel stocks={stocks} />
            <BondETFPanel stocks={stocks} />
            <DollarFXPanel stocks={stocks} />
            <GlobalMarketsPanel stocks={stocks} />
            <CommExtPanel stocks={stocks} />
          </>
        )}

        {/* ── INFO TAB: fundamentals + peer compare + analyst + insider + reports + AI ── */}
        {mTab === "fund" && (
          <>
            <FundamentalsPanel symbol={selected} quote={quote} lang={lang} />
            <PeerPanel symbol={selected} lang={lang} />
            <AnalystPanel symbol={selected} lang={lang} />
            <InsiderPanel symbol={selected} lang={lang} />
            <InstitutionalPanel symbol={selected} lang={lang} />
            <StockReportPanel symbol={selected} lang={lang} />
            <AIPanel symbol={selected} lang={lang} />
          </>
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="flex items-stretch border-t shrink-0"
        style={{ borderColor:C.border, background:C.header }}>
        {MOBILE_TABS.map(tab => {
          const active = mTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setMTab(tab.id)}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
              style={{
                color:      active ? C.info : C.muted,
                borderTop: `2px solid ${active ? C.info : "transparent"}`,
              }}>
              {tab.icon}
              <span className="text-[12px] font-mono font-bold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ background:C.bg }}>
      {Desktop}
      {Mobile}
      {showEditModal && (
        <WatchEditModal
          watchSyms={watchSyms}
          watchNames={watchNames}
          onUpdate={handleWatchUpdate}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}
