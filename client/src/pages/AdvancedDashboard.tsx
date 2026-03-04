import { useQuery } from "@tanstack/react-query";
import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useUser } from "@/hooks/use-user";
import { getLocalizedCompanyName, getNameByTicker } from "@/lib/stockNames";
import { cleanCompanyName } from "@/lib/stockUtils";
import { calculateSMA } from "@/lib/technicalAnalysis";
import { cn } from "@/lib/utils";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceArea, ReferenceLine,
} from "recharts";
import { TradingViewChart } from "@/components/TradingViewChart";
import { Input } from "@/components/ui/input";
import {
  Activity, ChevronRight, Zap, Globe,
  Calendar, Maximize2, Minimize2, DollarSign,
  TrendingUp, BarChart3, Lightbulb, Search, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { translations } from "@/lib/translations";

// ── Exchange flag helper ─────────────────────────────────────────────
function exchangeFlag(sym: string): string {
  if (sym.endsWith(".KS") || sym.endsWith(".KQ")) return "🇰🇷";
  if (sym.endsWith(".T"))  return "🇯🇵";
  if (sym.endsWith(".HK")) return "🇭🇰";
  if (sym.endsWith(".L"))  return "🇬🇧";
  if (sym.endsWith(".PA") || sym.endsWith(".AS")) return "🇪🇺";
  if (sym.endsWith(".DE") || sym.endsWith(".SW")) return "🇪🇺";
  return "🇺🇸";
}

// ── GlobalSymbolSearch (module-level – never re-mounts on parent renders) ──
interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency?: string;
  isKorean?: boolean;
}
interface GlobalSymbolSearchProps {
  lang: string;
  onSelectSymbol: (symbol: string) => void;
}
function GlobalSymbolSearch({ lang, onSelectSymbol }: GlobalSymbolSearchProps) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef  = useRef<HTMLInputElement>(null);
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 1) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/stocks/search?query=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data: SearchResult[] = await res.json();
        setResults(data.slice(0, 8));
        setOpen(true);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => doSearch(val), 200);
  }, [doSearch]);

  const handleSelect = useCallback((sym: string) => {
    setQuery("");
    setResults([]);
    setOpen(false);
    onSelectSymbol(sym);
  }, [onSelectSymbol]);

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const placeholder = lang === "ko" ? "종목 검색… (예: AAPL, 삼성, TOYOTA)" : "Search symbol… (e.g. CIEN, SAMSUNG, TOYOTA)";

  return (
    <div ref={wrapperRef} className="relative flex-1 max-w-xs sm:max-w-sm">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          data-testid="input-global-symbol-search"
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full h-7 pl-8 pr-7 text-[11px] bg-muted/50 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/60"
        />
        {query && (
          <button
            data-testid="button-clear-search"
            onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-background border border-border rounded-md shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">{lang === "ko" ? "검색 중…" : "Searching…"}</div>
          )}
          {!loading && results.length === 0 && query.trim().length > 0 && (
            <div className="px-3 py-2 text-[11px] text-muted-foreground">{lang === "ko" ? "결과 없음" : "No results"}</div>
          )}
          {results.map((r) => (
            <button
              key={r.symbol}
              data-testid={`result-symbol-${r.symbol}`}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(r.symbol); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors border-b border-border/30 last:border-0"
            >
              <span className="text-base shrink-0">{exchangeFlag(r.symbol)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-semibold text-foreground font-mono">{r.symbol}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">{r.type}</span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {getNameByTicker(r.symbol, lang) ?? getLocalizedCompanyName(r.name, lang)}
                </div>
              </div>
              <span className="text-[9px] text-muted-foreground/60 shrink-0">{r.currency || ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  { symbol: "7203.T",    flag: "🇯🇵", sectorEn: "Automotive",       sectorKo: "자동차" },
  { symbol: "6758.T",    flag: "🇯🇵", sectorEn: "Technology",       sectorKo: "기술" },
  { symbol: "8306.T",    flag: "🇯🇵", sectorEn: "Finance",          sectorKo: "금융" },
];

const SCREENER_SYMS = SCREENER_STOCKS.map(s => s.symbol);
const ALL_SYMS_WITH_SPY = ["SPY", ...SCREENER_SYMS].join(",");

// History period used for Stage Analysis SMA calculations only
const HISTORY_PERIOD = { period: "1mo", interval: "1d" };

// ── Symbol → Sector ETF mapping for contextual RRG analysis ─────────
const SYMBOL_SECTOR_ETF: Record<string, { etf: string; sectorEn: string; sectorKo: string }> = {
  NVDA:        { etf: "XLK",  sectorEn: "Technology",          sectorKo: "기술" },
  AAPL:        { etf: "XLK",  sectorEn: "Technology",          sectorKo: "기술" },
  MSFT:        { etf: "XLK",  sectorEn: "Technology",          sectorKo: "기술" },
  AMD:         { etf: "XLK",  sectorEn: "Technology",          sectorKo: "기술" },
  TSLA:        { etf: "XLY",  sectorEn: "Consumer Discretionary", sectorKo: "임의소비재" },
  AMZN:        { etf: "XLY",  sectorEn: "Consumer Discretionary", sectorKo: "임의소비재" },
  META:        { etf: "XLC",  sectorEn: "Communication Services", sectorKo: "커뮤니케이션" },
  GOOGL:       { etf: "XLC",  sectorEn: "Communication Services", sectorKo: "커뮤니케이션" },
  NFLX:        { etf: "XLC",  sectorEn: "Communication Services", sectorKo: "커뮤니케이션" },
  JPM:         { etf: "XLF",  sectorEn: "Financials",          sectorKo: "금융" },
  XOM:         { etf: "XLE",  sectorEn: "Energy",              sectorKo: "에너지" },
  "005930.KS": { etf: "XLK",  sectorEn: "Technology",          sectorKo: "기술" },
  "000660.KS": { etf: "XLK",  sectorEn: "Technology",          sectorKo: "기술" },
  "005380.KS": { etf: "XLY",  sectorEn: "Consumer Discretionary", sectorKo: "임의소비재" },
  "035420.KS": { etf: "XLC",  sectorEn: "Communication Services", sectorKo: "커뮤니케이션" },
  "7203.T":    { etf: "XLY",  sectorEn: "Consumer Discretionary", sectorKo: "임의소비재" },
  "6758.T":    { etf: "XLK",  sectorEn: "Technology",          sectorKo: "기술" },
  "8306.T":    { etf: "XLF",  sectorEn: "Financials",          sectorKo: "금융" },
  SPY:         { etf: "XLK",  sectorEn: "Broad Market",        sectorKo: "전체 시장" },
};

// ── Sector RRG data ──────────────────────────────────────────────────
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
  if (rs > 4)   return { label: lang === "ko" ? "급등 🚀" : "Breakout 🚀", color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30" };
  if (rs > 1.5) return { label: lang === "ko" ? "강세 ▲" : "Strong ▲",    color: "text-green-400 bg-green-500/10 border-green-500/25" };
  if (rs > -1)  return { label: lang === "ko" ? "중립 ─" : "Neutral ─",    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25" };
  if (rs > -3)  return { label: lang === "ko" ? "약세 ▼" : "Weak ▼",       color: "text-orange-400 bg-orange-500/10 border-orange-500/25" };
  return           { label: lang === "ko" ? "급락 ⚠" : "Breakdown ⚠",     color: "text-rose-400 bg-rose-500/15 border-rose-500/30" };
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

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Super Investor Tips ───────────────────────────────────────────────
const SUPER_INVESTOR_TIPS = [
  { name: "Warren Buffett",      initials: "WB", color: "#1d4ed8", tip: "Buy wonderful companies at fair prices, not fair companies at wonderful prices.", tipKo: "훌륭한 회사를 공정한 가격에 사세요. 공정한 회사를 훌륭한 가격에 사지 마세요." },
  { name: "Peter Lynch",         initials: "PL", color: "#16a34a", tip: "Invest in what you know. The best investments are often hiding in plain sight.", tipKo: "아는 것에 투자하세요. 최고의 투자는 종종 눈앞에 있습니다." },
  { name: "Charlie Munger",      initials: "CM", color: "#7c3aed", tip: "Invert, always invert. Avoiding stupidity is easier than seeking brilliance.", tipKo: "항상 뒤집어 생각하세요. 어리석음을 피하는 것이 탁월함을 추구하는 것보다 쉽습니다." },
  { name: "Howard Marks",        initials: "HM", color: "#b45309", tip: "The most important thing is understanding market cycles and where we stand in them.", tipKo: "가장 중요한 것은 시장 사이클을 이해하고 우리가 어디에 있는지 파악하는 것입니다." },
  { name: "Ray Dalio",           initials: "RD", color: "#0891b2", tip: "Diversify well. No one asset is always better; balance is the key to all-weather investing.", tipKo: "잘 분산하세요. 어떤 자산도 항상 좋지 않습니다. 균형이 전천후 투자의 핵심입니다." },
  { name: "Cathie Wood",         initials: "CW", color: "#db2777", tip: "Disruptive innovation is the key to outsized long-term returns. Focus on the five-year horizon.", tipKo: "파괴적 혁신이 장기 초과 수익의 열쇠입니다. 5년 지평을 바라보세요." },
  { name: "Michael Burry",       initials: "MB", color: "#dc2626", tip: "Everyone is a genius in a bull market. Real investing is about finding value when no one else is looking.", tipKo: "강세장에서는 모두가 천재입니다. 진정한 투자는 아무도 보지 않을 때 가치를 찾는 것입니다." },
  { name: "Bill Ackman",         initials: "BA", color: "#ea580c", tip: "Concentration is the key to great returns. Find a few extraordinary businesses and bet big.", tipKo: "집중이 높은 수익의 핵심입니다. 탁월한 기업 몇 곳을 찾아 크게 베팅하세요." },
  { name: "George Soros",        initials: "GS", color: "#4338ca", tip: "It's not whether you're right or wrong, but how much you make when right and lose when wrong.", tipKo: "옳고 그름이 아니라, 옳을 때 얼마나 버느냐, 틀릴 때 얼마나 잃느냐가 중요합니다." },
  { name: "Stan Druckenmiller",  initials: "SD", color: "#065f46", tip: "Earnings don't move the overall market; the Fed does. Follow the liquidity.", tipKo: "실적이 시장 전체를 움직이는 것이 아니라 연준이 움직입니다. 유동성을 따라가세요." },
  { name: "Jim Simons",          initials: "JS", color: "#9333ea", tip: "We follow the data, not our emotions. Quantitative discipline beats gut feeling every time.", tipKo: "우리는 감정이 아닌 데이터를 따릅니다. 정량적 규율은 항상 직감을 이깁니다." },
  { name: "Ken Griffin",         initials: "KG", color: "#0369a1", tip: "Liquidity management and risk control are as important as finding the right trade.", tipKo: "유동성 관리와 리스크 통제는 올바른 거래를 찾는 것만큼 중요합니다." },
  { name: "Seth Klarman",        initials: "SK", color: "#92400e", tip: "Value investing is at its core the marriage of a contrarian streak and a calculator.", tipKo: "가치 투자의 핵심은 역발상과 계산기의 결합입니다." },
  { name: "Carl Icahn",          initials: "CI", color: "#be123c", tip: "In life and business, there are two cardinal sins: the first is to act precipitously without thought, and the second is to not act at all.", tipKo: "삶과 비즈니스에서 두 가지 중대한 죄악이 있습니다: 생각 없이 섣불리 행동하는 것과 전혀 행동하지 않는 것입니다." },
  { name: "David Tepper",        initials: "DT", color: "#0f766e", tip: "The most profitable time to invest is when people are most fearful. Fear creates opportunity.", tipKo: "투자의 가장 수익성 높은 시기는 사람들이 가장 두려워할 때입니다. 두려움이 기회를 만듭니다." },
  { name: "Joel Greenblatt",     initials: "JG", color: "#1e40af", tip: "Figure out the value of something, and then pay a lot less for it. Simple, not easy.", tipKo: "무언가의 가치를 파악하고 훨씬 적게 지불하세요. 단순하지만 쉽지 않습니다." },
  { name: "Mohnish Pabrai",      initials: "MP", color: "#374151", tip: "Heads I win, tails I don't lose much. Look for bets with asymmetric upside.", tipKo: "앞면이면 이기고, 뒷면이면 별로 잃지 않습니다. 비대칭적 상승이 있는 베팅을 찾으세요." },
  { name: "Bill Miller",         initials: "BM", color: "#5b21b6", tip: "Valuation matters only in the long run. In the short run, sentiment and momentum rule.", tipKo: "밸류에이션은 장기에만 중요합니다. 단기에는 심리와 모멘텀이 지배합니다." },
];

// ── Main Component ────────────────────────────────────────────────────
export default function AdvancedDashboard() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const { theme } = useTheme();
  const { formatPrice, isKoreanStock, isJapaneseStock } = useCurrency();
  const { data: user } = useUser();
  const lang = (user?.language || "en") as string;
  const t = translations[lang as keyof typeof translations];

  const isDark = theme === "dark";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const tooltipBg = isDark ? "#111827" : "#ffffff";
  const tooltipBorder = isDark ? "#374151" : "#e5e7eb";

  // Read ticker from URL param (?symbol=AAPL) — set by Pro Dashboard button in StockDetail
  const urlSymbol = useMemo(() => {
    const s = new URLSearchParams(searchStr).get("symbol");
    return s ? s.toUpperCase() : null;
  }, [searchStr]);

  // UI state — initialise from URL param if present, otherwise default to NVDA
  const [selectedSymbol, setSelectedSymbol] = useState(() => urlSymbol || "NVDA");

  // If symbol from URL isn't in our screener list, track it as an extra symbol
  const isExtraSymbol = urlSymbol && !SCREENER_STOCKS.some(s => s.symbol === urlSymbol);

  // Sync selectedSymbol when URL param changes (e.g. user navigates from a different stock)
  React.useEffect(() => {
    if (urlSymbol) setSelectedSymbol(urlSymbol);
  }, [urlSymbol]);
  const [screenerSort, setScreenerSort] = useState<"rs" | "name" | "change" | "vol">("rs");
  const [screenerSearch, setScreenerSearch] = useState("");
  const [rrgFocused, setRrgFocused] = useState(false);
  const [showAllInvestors, setShowAllInvestors] = useState(true);
  const [rankTab, setRankTab] = useState<"actives" | "gainers" | "losers">("actives");
  const [leftTab, setLeftTab] = useState<"screener" | "actives" | "gainers" | "losers">("screener");

  const isKr = isKoreanStock(selectedSymbol);
  const isJp = isJapaneseStock(selectedSymbol);
  const nativeCurrency = isKr ? "KRW" : isJp ? "JPY" : "USD";

  // ── Batch screener quotes ──────────────────────────────────────────
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

  // ── Live quote ─────────────────────────────────────────────────────
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

  // ── Stock info ─────────────────────────────────────────────────────
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

  // ── Earnings ───────────────────────────────────────────────────────
  const { data: earnings, isLoading: isEarningsLoading } = useQuery<any>({
    queryKey: ["/api/stocks/earnings", selectedSymbol],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/earnings/${selectedSymbol}`);
      if (!res.ok) return { nextEarningsDate: null, lastEpsActual: null, history: [] };
      return res.json();
    },
    enabled: !!selectedSymbol,
    staleTime: 6 * 60 * 60 * 1000,
  });

  // ── History for Stage Analysis SMA ─────────────────────────────────
  const { data: history } = useQuery<any>({
    queryKey: ["/api/stocks/history", selectedSymbol, HISTORY_PERIOD.period, HISTORY_PERIOD.interval],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/history/${selectedSymbol}?period=${HISTORY_PERIOD.period}&interval=${HISTORY_PERIOD.interval}`);
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

  const lastIdx   = rawHistory.length - 1;
  const lastSMA50  = lastIdx >= 0 ? (sma50[lastIdx]  ?? null) : null;
  const lastSMA200 = lastIdx >= 0 ? (sma200[lastIdx] ?? null) : null;
  const lastPrice  = lastIdx >= 0 ? rawHistory[lastIdx].close : (quote?.price ?? 0);
  const stageInfo  = getStageAnalysis(lastPrice, lastSMA50, lastSMA200, lang);

  const positiveRS = screenerRows.filter(s => s.rs > 0).length;
  const breadthPct = screenerRows.length > 0 ? Math.round((positiveRS / screenerRows.length) * 100) : 0;

  const { data: breadthData } = useQuery<any>({
    queryKey: ["/api/market/breadth"],
    queryFn: async () => {
      const res = await fetch("/api/market/breadth");
      if (!res.ok) return { pctAboveSMA50: 0, pctAboveSMA200: 0, above50: 0, above200: 0, total: 0 };
      return res.json();
    },
    staleTime: 15 * 60 * 1000,
  });

  const { data: gainersData = [], isLoading: isGainersLoading } = useQuery<any[]>({
    queryKey: ["/api/market/gainers"],
    queryFn: async () => { const r = await fetch("/api/market/gainers"); return r.ok ? r.json() : []; },
    staleTime: 5 * 60 * 1000, refetchInterval: 5 * 60 * 1000,
  });
  const { data: losersData = [], isLoading: isLosersLoading } = useQuery<any[]>({
    queryKey: ["/api/market/losers"],
    queryFn: async () => { const r = await fetch("/api/market/losers"); return r.ok ? r.json() : []; },
    staleTime: 5 * 60 * 1000, refetchInterval: 5 * 60 * 1000,
  });
  const { data: activesData = [], isLoading: isActivesLoading } = useQuery<any[]>({
    queryKey: ["/api/market/actives"],
    queryFn: async () => { const r = await fetch("/api/market/actives"); return r.ok ? r.json() : []; },
    staleTime: 5 * 60 * 1000, refetchInterval: 5 * 60 * 1000,
  });

  const isPositive = (quote?.changePercent ?? 0) >= 0;
  const displayName = getNameByTicker(selectedSymbol, lang) ?? getLocalizedCompanyName(cleanCompanyName(quote?.name || selectedSymbol), lang);
  const selectedScreenerInfo = SCREENER_STOCKS.find(s => s.symbol === selectedSymbol);
  const visibleInvestors = showAllInvestors ? SUPER_INVESTOR_TIPS : SUPER_INVESTOR_TIPS.slice(0, 5);

  // ── Stock chip strip (reused on mobile + desktop left panel) ───────
  const StockChipStrip = () => (
    <div className="overflow-x-auto border-b border-border/30 flex-shrink-0" style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="flex gap-1 px-2 py-1.5" style={{ minWidth: "max-content" }}>
        {/* Extra symbol chip (when navigated from a stock not in screener list) */}
        {isExtraSymbol && urlSymbol && (
          <button
            key={urlSymbol}
            onClick={() => setSelectedSymbol(urlSymbol)}
            className={cn(
              "flex flex-col items-center px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors shrink-0 border border-violet-400/40",
              selectedSymbol === urlSymbol ? "bg-primary/20 text-primary border-primary/40" : "text-violet-400 bg-violet-500/10 hover:bg-violet-500/20"
            )}
            data-testid={`stock-chip-extra-${urlSymbol}`}
          >
            <span>🔍 {urlSymbol.replace(".KS", "").replace(".KQ", "").replace(".T", "")}</span>
            <span className="text-[9px] text-muted-foreground">{lang === "ko" ? "탐색 중" : "Browsing"}</span>
          </button>
        )}
        {SCREENER_STOCKS.map(s => {
          const isSelected = s.symbol === selectedSymbol;
          const q = screenerData?.quotes?.find(q => q.symbol === s.symbol);
          const cp = q?.changePercent ?? 0;
          return (
            <button
              key={s.symbol}
              onClick={() => setSelectedSymbol(s.symbol)}
              className={cn(
                "flex flex-col items-center px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors shrink-0",
                isSelected ? "bg-primary/20 text-primary border border-primary/40" : "text-muted-foreground hover:bg-muted/50"
              )}
              data-testid={`stock-chip-${s.symbol}`}
            >
              <span>{s.flag} {(() => {
                const isGlobalChip = s.symbol.endsWith(".KS") || s.symbol.endsWith(".KQ") || s.symbol.endsWith(".T");
                const raw = s.symbol.replace(".KS","").replace(".KQ","").replace(".T","");
                return isGlobalChip ? (getNameByTicker(s.symbol, lang) ?? raw) : raw;
              })()}</span>
              <span className={cp >= 0 ? "text-emerald-500" : "text-rose-500"}>{cp >= 0 ? "+" : ""}{cp.toFixed(1)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Ranking List (shared: mobile + desktop tabs) ──────────────────
  const RankingStockList = ({ data, isLoading, emptyMsg }: { data: any[]; isLoading: boolean; emptyMsg: string }) => (
    <div className="flex-1 overflow-y-auto">
      {isLoading ? (
        <div className="p-2 space-y-1">{Array(10).fill(0).map((_, i) => <div key={i} className="h-9 bg-muted/50 rounded-lg animate-pulse" />)}</div>
      ) : data.length === 0 ? (
        <div className="p-4 text-center text-[10px] text-muted-foreground">{emptyMsg}</div>
      ) : data.map((row: any) => {
        const cp: number = typeof row.changePercent === "number" ? row.changePercent : 0;
        const isSelected = row.symbol === selectedSymbol;
        const isKrRow = row.symbol?.endsWith(".KS") || row.symbol?.endsWith(".KQ");
        const isJpRow = row.symbol?.endsWith(".T");
        const tickerName = getNameByTicker(row.symbol, lang);
        const localizedName = tickerName ?? getLocalizedCompanyName(cleanCompanyName(row.name || ""), lang);
        const price = typeof row.price === "number" ? row.price : null;
        const priceFmt = price == null ? "--"
          : isKrRow ? `₩${Math.round(price).toLocaleString()}`
          : isJpRow ? `¥${Math.round(price).toLocaleString()}`
          : `$${price.toFixed(2)}`;
        const displaySymbol = isKrRow
          ? row.symbol.replace(".KS", "").replace(".KQ", "")
          : row.symbol;
        return (
          <button
            key={row.symbol}
            onClick={() => setSelectedSymbol(row.symbol)}
            className={cn("w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-b border-border/20",
              isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/50")}
            data-testid={`ranking-stock-${row.symbol}`}
          >
            <div className="flex-1 min-w-0">
              <p className={cn("text-[11px] font-bold truncate", isSelected ? "text-primary" : "")}>{localizedName}</p>
              <p className="text-[9px] text-muted-foreground truncate">{displaySymbol}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] font-mono font-semibold">{priceFmt}</p>
              <p className={cn("text-[10px] font-bold", cp >= 0 ? "text-emerald-500" : "text-rose-500")}>
                {cp >= 0 ? "+" : ""}{cp.toFixed(2)}%
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );

  // ── Market Ranking Panel tabs (reusable, tab state passed in) ──────
  const MarketRankingTabs = ({ tab, setTab }: { tab: "actives"|"gainers"|"losers"; setTab: (t: "actives"|"gainers"|"losers") => void }) => (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b border-border/40 flex-shrink-0">
        {([
          ["actives", "🔥", lang === "ko" ? "인기" : "Active"],
          ["gainers", "🚀", lang === "ko" ? "급등" : "Gainers"],
          ["losers",  "📉", lang === "ko" ? "급락" : "Losers"],
        ] as const).map(([key, icon, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("flex-1 flex flex-col items-center py-1.5 text-[10px] font-bold transition-colors",
              tab === key ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground")}
            data-testid={`ranking-tab-${key}`}>
            <span className="text-sm leading-none">{icon}</span>
            <span className="mt-0.5">{label}</span>
          </button>
        ))}
      </div>
      {tab === "actives" && <RankingStockList data={activesData} isLoading={isActivesLoading} emptyMsg={lang === "ko" ? "데이터 없음" : "No data"} />}
      {tab === "gainers" && <RankingStockList data={gainersData} isLoading={isGainersLoading} emptyMsg={lang === "ko" ? "데이터 없음" : "No data"} />}
      {tab === "losers"  && <RankingStockList data={losersData}  isLoading={isLosersLoading}  emptyMsg={lang === "ko" ? "데이터 없음" : "No data"} />}
    </div>
  );

  // ── Screener Panel (PC left sidebar) ───────────────────────────────
  const ScreenerPanel = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar: Screener | Popular | Gainers | Losers */}
      <div className="flex border-b border-border/40 flex-shrink-0">
        <button onClick={() => setLeftTab("screener")}
          className={cn("flex-1 py-1.5 text-[10px] font-bold transition-colors",
            leftTab === "screener" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground")}
          data-testid="left-tab-screener">
          📊 {lang === "ko" ? "스크리너" : "Screen"}
        </button>
        {(["actives","gainers","losers"] as const).map(key => {
          const labels: Record<string,string[]> = { actives: ["🔥","인기","Active"], gainers: ["🚀","급등","Gain"], losers: ["📉","급락","Loss"] };
          const [icon, ko, en] = labels[key];
          return (
            <button key={key} onClick={() => setLeftTab(key)}
              className={cn("flex-1 py-1.5 text-[10px] font-bold transition-colors",
                leftTab === key ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground")}
              data-testid={`left-tab-${key}`}>
              {icon} {lang === "ko" ? ko : en}
            </button>
          );
        })}
      </div>

      {/* Screener tab content */}
      {leftTab === "screener" && (
        <>
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
                <button key={key} onClick={() => setScreenerSort(key)}
                  className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold", screenerSort === key ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}
                  data-testid={`sort-screener-${key}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto border-t border-border/30">
            {isExtraSymbol && urlSymbol && (
              <button onClick={() => setSelectedSymbol(urlSymbol)}
                className={cn("w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-b border-border/30",
                  selectedSymbol === urlSymbol ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/50")}
                data-testid={`screener-stock-extra-${urlSymbol}`}>
                <span className="text-sm shrink-0">🔍</span>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-bold truncate", selectedSymbol === urlSymbol ? "text-primary" : "text-violet-400")}>
                    {quote?.name ? cleanCompanyName(quote.name) : urlSymbol}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{urlSymbol}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] text-violet-400 font-medium">{lang === "ko" ? "탐색 중" : "Browsing"}</p>
                </div>
              </button>
            )}
            {isScreenerLoading ? (
              <div className="p-3 space-y-1.5">{Array(8).fill(0).map((_, i) => <div key={i} className="h-10 bg-muted/50 rounded-lg animate-pulse" />)}</div>
            ) : screenerRows.map(row => {
              const isSelected = row.symbol === selectedSymbol;
              const isKrStock = row.symbol.endsWith(".KS") || row.symbol.endsWith(".KQ");
              const priceFmt = row.price == null ? "--"
                : isKrStock ? `₩${Math.round(row.price).toLocaleString()}`
                : `$${row.price.toFixed(2)}`;
              const displayN = getNameByTicker(row.symbol, lang) ?? getLocalizedCompanyName(cleanCompanyName(row.name), lang);
              return (
                <button key={row.symbol} onClick={() => setSelectedSymbol(row.symbol)}
                  className={cn("w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-b border-border/30",
                    isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/50")}
                  data-testid={`screener-stock-${row.symbol}`}>
                  <span className="text-sm shrink-0">{row.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-bold truncate", isSelected ? "text-primary" : "")}>{displayN}</p>
                    <p className="text-[10px] text-muted-foreground">{row.symbol}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-semibold">{priceFmt}</p>
                    <p className={cn("text-[10px] font-bold", row.rs >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {screenerSort === "change" ? `${row.changePercent >= 0 ? "+" : ""}${row.changePercent.toFixed(2)}%` : `RS ${row.rs >= 0 ? "+" : ""}${row.rs.toFixed(1)}%`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Ranking tab contents — directly show list, no inner tab bar */}
      {leftTab === "actives" && <div className="flex-1 min-h-0 overflow-hidden flex flex-col"><RankingStockList data={activesData} isLoading={isActivesLoading} emptyMsg={lang === "ko" ? "데이터 없음" : "No data"} /></div>}
      {leftTab === "gainers" && <div className="flex-1 min-h-0 overflow-hidden flex flex-col"><RankingStockList data={gainersData} isLoading={isGainersLoading} emptyMsg={lang === "ko" ? "데이터 없음" : "No data"} /></div>}
      {leftTab === "losers"  && <div className="flex-1 min-h-0 overflow-hidden flex flex-col"><RankingStockList data={losersData}  isLoading={isLosersLoading}  emptyMsg={lang === "ko" ? "데이터 없음" : "No data"} /></div>}
    </div>
  );

  // ── Chart Header (PC only — minimal, no period buttons) ────────────
  const ChartHeader = () => (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border/50 flex-shrink-0 bg-background/80">
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-semibold text-muted-foreground truncate block">{displayName}</span>
        <div className="flex items-center gap-2">
          {isQuoteLoading ? <div className="h-5 w-20 bg-muted rounded animate-pulse" /> : (
            <>
              <span className="text-base font-bold font-mono">{formatPrice(quote?.price, { nativeCurrency })}</span>
              <span className={cn("text-xs font-semibold", isPositive ? "text-emerald-500" : "text-rose-500")}>
                {isPositive ? "+" : ""}{(quote?.changePercent ?? 0).toFixed(2)}%
              </span>
              <span className="text-[10px] text-muted-foreground">{lang === "ko" ? "오늘" : "today"}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {quote?.isMarketOpen != null && (
          <>
            <span className={cn("w-1.5 h-1.5 rounded-full", quote.isMarketOpen ? "bg-green-500 animate-pulse" : "bg-gray-400")} />
            <span className="text-[10px] text-muted-foreground">{quote.isMarketOpen ? (lang === "ko" ? "개장" : "Open") : (lang === "ko" ? "마감" : "Closed")}</span>
          </>
        )}
      </div>
    </div>
  );

  // ── Earnings Panel ─────────────────────────────────────────────────
  const EarningsPanel = () => {
    const daysLeft = daysUntil(earnings?.nextEarningsDate);
    return (
      <div className="space-y-3 p-3">
        {isEarningsLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted/50 rounded-xl animate-pulse" />)}</div>
        ) : (
          <>
            {/* Next Earnings */}
            <div className="bg-muted/40 rounded-xl p-3 border border-border/30">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  {lang === "ko" ? "다음 실적 발표" : "Next Earnings"}
                </p>
              </div>
              {earnings?.nextEarningsDate ? (
                <>
                  <p className="text-sm font-bold font-mono text-foreground">
                    {new Date(earnings.nextEarningsDate).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                  {daysLeft != null && (
                    <p className={cn("text-[10px] font-semibold mt-0.5", daysLeft <= 14 ? "text-amber-500" : "text-muted-foreground")}>
                      {daysLeft <= 0 ? (lang === "ko" ? "오늘 또는 지남" : "Today or passed")
                        : lang === "ko" ? `${daysLeft}일 후` : `in ${daysLeft} days`}
                    </p>
                  )}
                  {earnings?.nextEpsEstimate != null && (
                    <div className="mt-1.5 bg-background/50 rounded-lg p-2">
                      <p className="text-[9px] text-muted-foreground">{lang === "ko" ? "EPS 컨센서스" : "EPS Consensus"}</p>
                      <p className="text-sm font-mono font-bold">${earnings.nextEpsEstimate.toFixed(2)}</p>
                      {earnings.nextEpsLow != null && earnings.nextEpsHigh != null && (
                        <p className="text-[9px] text-muted-foreground">{lang === "ko" ? "범위" : "Range"}: <span className="font-mono">${earnings.nextEpsLow.toFixed(2)} – ${earnings.nextEpsHigh.toFixed(2)}</span></p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{lang === "ko" ? "예정일 미확정" : "Date not confirmed"}</p>
              )}
            </div>

            {/* Last Quarter summary row */}
            <div className="bg-muted/40 rounded-xl p-3 border border-border/30">
              <div className="flex items-center gap-1.5 mb-2">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{lang === "ko" ? "최근 실적 요약" : "Last Quarter"}</p>
                {earnings?.lastEarningsDate && (
                  <span className="text-[9px] text-muted-foreground ml-auto">
                    {new Date(earnings.lastEarningsDate).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "short", year: "2-digit" })}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <p className="text-[9px] text-muted-foreground">{lang === "ko" ? "실제 EPS" : "Actual EPS"}</p>
                  <p className={cn("text-sm font-bold font-mono",
                    earnings?.lastEpsActual != null && earnings?.lastEpsEstimate != null
                      ? earnings.lastEpsActual > earnings.lastEpsEstimate ? "text-emerald-500"
                        : earnings.lastEpsActual < earnings.lastEpsEstimate ? "text-rose-500"
                        : "text-foreground"
                      : "")}>
                    {earnings?.lastEpsActual != null ? `$${earnings.lastEpsActual.toFixed(2)}` : "--"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground">{lang === "ko" ? "예상 EPS" : "Est. EPS"}</p>
                  <p className="text-sm font-bold font-mono text-muted-foreground">
                    {earnings?.lastEpsEstimate != null ? `$${earnings.lastEpsEstimate.toFixed(2)}` : "--"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground">{lang === "ko" ? "서프라이즈" : "Surprise"}</p>
                  {earnings?.lastSurprisePct != null ? (
                    <p className={cn("text-sm font-bold font-mono", earnings.lastSurprisePct >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {earnings.lastSurprisePct >= 0 ? "+" : ""}{earnings.lastSurprisePct.toFixed(1)}%
                    </p>
                  ) : <p className="text-sm font-bold font-mono text-muted-foreground">--</p>}
                </div>
              </div>
              {/* Beat/Miss badge */}
              {earnings?.lastSurprisePct != null && (
                <div className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                  earnings.lastSurprisePct >= 0 ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30" : "bg-rose-500/15 text-rose-500 border border-rose-500/30")}>
                  {earnings.lastSurprisePct >= 0 ? "✓ Beat" : "✗ Miss"}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/20">
                <div>
                  <p className="text-[9px] text-muted-foreground">{lang === "ko" ? "연간 EPS" : "Trailing EPS"}</p>
                  <p className="text-xs font-bold font-mono">{earnings?.trailingEps != null ? `$${earnings.trailingEps.toFixed(2)}` : "--"}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground">{lang === "ko" ? "예상 연간 EPS" : "Forward EPS"}</p>
                  <p className="text-xs font-bold font-mono text-primary">{earnings?.forwardEps != null ? `$${earnings.forwardEps.toFixed(2)}` : "--"}</p>
                </div>
              </div>
            </div>

            {/* Quarterly Beat/Miss history table */}
            {earnings?.history?.length > 1 && (
              <div className="bg-muted/40 rounded-xl p-3 border border-border/30">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
                  {lang === "ko" ? "📊 과거 실적" : "📊 Past Earnings"}
                </p>
                {/* Header row */}
                <div className="grid grid-cols-3 gap-1 mb-1.5 px-0.5">
                  {[lang === "ko" ? "분기" : "Quarter", lang === "ko" ? "시장 예상치" : "Est. EPS", lang === "ko" ? "실제 발표치" : "Act. EPS"].map(h => (
                    <p key={h} className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide">{h}</p>
                  ))}
                </div>
                <div className="space-y-1">
                  {(earnings.history as any[]).filter((h: any) => h.epsActual != null).slice(0, 6).map((h: any, i: number) => {
                    const hasBeatMiss = h.epsEstimate != null && h.epsActual != null;
                    const beat = hasBeatMiss && h.epsActual > h.epsEstimate;
                    const miss = hasBeatMiss && h.epsActual < h.epsEstimate;
                    return (
                      <div key={i} className={cn("grid grid-cols-3 gap-1 items-center rounded-lg px-1.5 py-1",
                        beat ? "bg-emerald-500/8 border border-emerald-500/20" :
                        miss ? "bg-rose-500/8 border border-rose-500/20" : "bg-background/30")}>
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {new Date(h.date).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "short", year: "2-digit" })}
                        </span>
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {h.epsEstimate != null ? `$${h.epsEstimate.toFixed(2)}` : "--"}
                        </span>
                        <span className={cn("text-[9px] font-mono font-bold",
                          beat ? "text-emerald-500" : miss ? "text-rose-500" : "text-foreground")}>
                          ${h.epsActual.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Key Metrics */}
            <div className="bg-muted/40 rounded-xl p-3 border border-border/30">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">{lang === "ko" ? "핵심 지표" : "Key Metrics"}</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { lbl: lang === "ko" ? "시가총액" : "Mkt Cap", val: formatMarketCap(info?.marketCap) },
                  { lbl: lang === "ko" ? "PER" : "P/E",          val: info?.peRatio?.toFixed(1) ?? "--" },
                  { lbl: lang === "ko" ? "52주 고" : "52W High", val: info?.["52WeekHigh"] != null ? `$${info["52WeekHigh"].toFixed(0)}` : "--" },
                  { lbl: lang === "ko" ? "52주 저" : "52W Low",  val: info?.["52WeekLow"]  != null ? `$${info["52WeekLow"].toFixed(0)}`  : "--" },
                  { lbl: lang === "ko" ? "베타" : "Beta",         val: info?.beta?.toFixed(2) ?? "--" },
                  { lbl: lang === "ko" ? "배당수익" : "Div Yld",  val: info?.dividendYield != null ? `${(info.dividendYield * 100).toFixed(2)}%` : "--" },
                ].map(({ lbl, val }) => (
                  <div key={lbl} className="bg-background/40 rounded-lg p-1.5">
                    <p className="text-[9px] text-muted-foreground">{lbl}</p>
                    <p className="text-xs font-bold font-mono">{val}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // ── RRG Chart Panel ────────────────────────────────────────────────
  const RRGChartPanel = ({ compact = false }: { compact?: boolean }) => {
    const miniRRGData = SECTOR_QUADRANTS.map(s => ({ ...s, x: QUADRANT_POS[s.label]?.x ?? 100, y: QUADRANT_POS[s.label]?.y ?? 100 }));
    const quadrantLabel = (q: string) => {
      if (q === "leading")   return lang === "ko" ? "선도" : "Leading";
      if (q === "weakening") return lang === "ko" ? "약화" : "Weakening";
      if (q === "lagging")   return lang === "ko" ? "지연" : "Lagging";
      return lang === "ko" ? "회복" : "Improving";
    };
    const chartH = rrgFocused ? 340 : compact ? 240 : 220;
    const dotR = rrgFocused ? 10 : 8;
    return (
      <div className="space-y-3 p-3">
        <div className="bg-muted/40 rounded-xl p-3 border border-border/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              {lang === "ko" ? "🔄 섹터 순환 (RRG)" : "🔄 Sector Rotation (RRG)"}
            </p>
            <button onClick={() => setRrgFocused(f => !f)}
              className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              data-testid="btn-rrg-focus" title={rrgFocused ? "Collapse" : "Focus Mode"}>
              {rrgFocused ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="relative" style={{ height: chartH }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 22, right: 20, bottom: 6, left: 6 }}>
                <ReferenceArea x1={100} x2={112} y1={100} y2={110} fill="rgba(34,197,94,0.10)" />
                <ReferenceArea x1={88}  x2={100} y1={100} y2={110} fill="rgba(99,102,241,0.10)" />
                <ReferenceArea x1={100} x2={112} y1={90}  y2={100} fill="rgba(234,179,8,0.10)" />
                <ReferenceArea x1={88}  x2={100} y1={90}  y2={100} fill="rgba(239,68,68,0.10)" />
                <XAxis type="number" dataKey="x" domain={[88, 112]} tick={false} axisLine={false} tickLine={false} />
                <YAxis type="number" dataKey="y" domain={[90, 110]} tick={false} axisLine={false} tickLine={false} />
                <ReferenceLine x={100} stroke={tickColor} strokeDasharray="3 3" strokeWidth={0.75} strokeOpacity={0.6} />
                <ReferenceLine y={100} stroke={tickColor} strokeDasharray="3 3" strokeWidth={0.75} strokeOpacity={0.6} />
                <Tooltip content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div style={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 6, padding: "5px 10px", fontSize: 11 }}>
                      <p style={{ fontWeight: 700, color: d.color }}>{d.label} <span style={{ color: tickColor, fontSize: 10 }}>{lang === "ko" ? d.labelKo : d.label}</span></p>
                      <p style={{ color: tickColor, fontSize: 10 }}>{quadrantLabel(d.q)}</p>
                    </div>
                  );
                }} />
                <Scatter data={miniRRGData} shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (!cx || !cy) return <g />;
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={dotR} fill={payload.color} opacity={0.92} />
                      <text x={cx} y={cy + dotR * 0.42} textAnchor="middle" fontSize={rrgFocused ? 8.5 : 7} fill="white" fontWeight="bold">
                        {payload.label.replace("XL", "")}
                      </text>
                    </g>
                  );
                }} />
              </ScatterChart>
            </ResponsiveContainer>
            {/* High-contrast quadrant labels */}
            <div className="absolute top-0 right-1 text-[10px] text-emerald-400 font-bold drop-shadow-sm">{lang === "ko" ? "선도 ↗" : "Leading ↗"}</div>
            <div className="absolute top-0 left-1 text-[10px] text-indigo-400 font-bold drop-shadow-sm">{lang === "ko" ? "회복 ↗" : "Improving ↗"}</div>
            <div className="absolute bottom-0 right-1 text-[10px] text-yellow-400 font-bold drop-shadow-sm">{lang === "ko" ? "약화 ↘" : "Weakening ↘"}</div>
            <div className="absolute bottom-0 left-1 text-[10px] text-rose-400 font-bold drop-shadow-sm">{lang === "ko" ? "지연 ↙" : "Lagging ↙"}</div>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {SECTOR_QUADRANTS.map(s => (
              <span key={s.label} className="flex items-center gap-0.5 text-[9px]">
                <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: s.color }} />
                <span className="text-muted-foreground">{lang === "ko" ? s.labelKo : s.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Professional RRG Analysis — stock-specific */}
        {(() => {
          const sectorInfo = SYMBOL_SECTOR_ETF[selectedSymbol];
          const etf = sectorInfo?.etf;
          const sectorData = etf ? SECTOR_QUADRANTS.find(s => s.label === etf) : null;
          const quadrant = sectorData?.q || "leading";

          // Stock's RS vs SPY from screenerRows; fall back to live quote diff
          const stockRow = screenerRows.find(r => r.symbol === selectedSymbol);
          const stockRS = stockRow?.rs ?? ((quote?.changePercent ?? 0) - spyChange);

          // Peer comparison within same sector
          const peers = screenerRows.filter(r => {
            const peerSector = SYMBOL_SECTOR_ETF[r.symbol];
            return peerSector?.etf === etf && r.symbol !== selectedSymbol;
          });
          const peerAvgRS = peers.length > 0 ? peers.reduce((s, p) => s + p.rs, 0) / peers.length : 0;
          const stockVsPeers = stockRS - peerAvgRS;
          const outperforming = stockVsPeers > 0;

          const quadrantLabel = {
            leading:   { en: "Leading ↗",   ko: "선도 ↗",   color: "text-emerald-500", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/25" },
            improving: { en: "Improving ↗", ko: "회복 ↗",   color: "text-indigo-500",  bgColor: "bg-indigo-500/10",  borderColor: "border-indigo-500/25" },
            weakening: { en: "Weakening ↘", ko: "약화 ↘",   color: "text-yellow-500",  bgColor: "bg-yellow-500/10",  borderColor: "border-yellow-500/25" },
            lagging:   { en: "Lagging ↙",   ko: "지연 ↙",   color: "text-rose-500",    bgColor: "bg-rose-500/10",    borderColor: "border-rose-500/25" },
          }[quadrant as keyof typeof quadrantLabel] || { en: "Leading ↗", ko: "선도 ↗", color: "text-emerald-500", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/25" };

          // Signal logic
          const signal = (() => {
            if (quadrant === "leading" && outperforming) return { en: "Strong Buy", ko: "강력 매수", color: "text-emerald-500" };
            if (quadrant === "leading" && !outperforming) return { en: "Hold / Buy Dip", ko: "보유 / 조정 시 매수", color: "text-emerald-400" };
            if (quadrant === "improving" && outperforming) return { en: "Accumulate", ko: "분할 매수", color: "text-indigo-500" };
            if (quadrant === "improving" && !outperforming) return { en: "Watch Closely", ko: "주시", color: "text-indigo-400" };
            if (quadrant === "weakening" && outperforming) return { en: "Reduce Position", ko: "비중 축소", color: "text-yellow-500" };
            if (quadrant === "weakening" && !outperforming) return { en: "Sell / Avoid", ko: "매도 / 회피", color: "text-orange-500" };
            if (quadrant === "lagging" && outperforming) return { en: "Wait for Turn", ko: "반전 대기", color: "text-rose-400" };
            return { en: "Avoid", ko: "회피", color: "text-rose-500" };
          })();

          const sectorName = sectorInfo ? (lang === "ko" ? sectorInfo.sectorKo : sectorInfo.sectorEn) : (lang === "ko" ? "전체 시장" : "Broad Market");
          const etfLabel = etf || "SPY";
          const ql = lang === "ko" ? quadrantLabel.ko : quadrantLabel.en;
          const rsSign = stockRS >= 0 ? "+" : "";
          const peerSign = stockVsPeers >= 0 ? "+" : "";

          const line1 = lang === "ko"
            ? `${etfLabel} (${sectorName}) 섹터는 현재 S&P 500 대비 [${ql}] 사분면에 위치하여 상대적 강도를 ${quadrant === "leading" || quadrant === "improving" ? "강화" : "약화"}하고 있습니다.`
            : `The ${etfLabel} (${sectorName}) sector is in the [${ql}] quadrant, showing ${quadrant === "leading" || quadrant === "improving" ? "strengthening" : "weakening"} relative strength vs. the S&P 500.`;

          const line2 = sectorInfo
            ? (lang === "ko"
                ? `${selectedSymbol.replace(".KS","").replace(".KQ","")}는 섹터 동종 기업 대비 RS ${peerSign}${stockVsPeers.toFixed(1)}%로 ${outperforming ? "초과 성과" : "하회 성과"}를 보이며, 롤테이션 모멘텀 기준 [${signal.ko}] 신호입니다.`
                : `${selectedSymbol.replace(".KS","").replace(".KQ","")} ${outperforming ? "outperforms" : "underperforms"} sector peers by ${peerSign}${stockVsPeers.toFixed(1)}% RS differential, suggesting a [${signal.en}] signal based on rotation momentum.`)
            : (lang === "ko"
                ? `${selectedSymbol}의 현재 RS는 S&P 500 대비 ${rsSign}${stockRS.toFixed(1)}%입니다. 전체 시장 추세를 참고하세요.`
                : `${selectedSymbol} has a current RS of ${rsSign}${stockRS.toFixed(1)}% vs. S&P 500. Monitor broader market trend.`);

          return (
            <div className={cn("rounded-xl p-3 border overflow-hidden", quadrantLabel.bgColor, quadrantLabel.borderColor)} data-testid="rrg-analysis-box">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">
                  {lang === "ko" ? "📡 RRG 섹터 분석" : "📡 RRG Sector Analysis"}
                </p>
                <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-md border", quadrantLabel.bgColor, quadrantLabel.borderColor, quadrantLabel.color)}>
                  {lang === "ko" ? quadrantLabel.ko : quadrantLabel.en}
                </span>
              </div>
              <p className={cn("text-[10px] leading-relaxed mb-1.5", quadrantLabel.color)}>
                {line1}
              </p>
              <p className="text-[10px] leading-relaxed text-foreground/80">
                {line2}
              </p>
              {sectorInfo && (
                <div className="flex gap-3 mt-2 pt-2 border-t border-border/30 flex-wrap">
                  <span className="text-[9px] text-muted-foreground">
                    RS vs SPY: <span className={stockRS >= 0 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>{rsSign}{stockRS.toFixed(2)}%</span>
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    vs Sector: <span className={stockVsPeers >= 0 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>{peerSign}{stockVsPeers.toFixed(2)}%</span>
                  </span>
                  <span className={cn("text-[9px] font-bold ml-auto", signal.color)}>
                    ▶ {lang === "ko" ? signal.ko : signal.en}
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        <button onClick={() => navigate("/market-trends")}
          className="text-[10px] text-primary hover:underline flex items-center gap-1 justify-center py-1 w-full">
          <Globe className="w-3 h-3" />{lang === "ko" ? "전체 RRG 보기 →" : "Full RRG Chart →"}
        </button>
      </div>
    );
  };

  // ── Insights Panel (Stage Analysis + Market Breadth + Super Investor Tips) ─────
  const InsightsPanel = () => (
    <div className="space-y-3 p-3">
      {/* Stage Analysis */}
      <div className="bg-muted/40 rounded-xl p-3 border border-border/30">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
          {lang === "ko" ? "📊 스테이지 분석" : "📊 Stage Analysis"}
        </p>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: stageInfo.color }} />
          <span className="text-sm font-bold" style={{ color: stageInfo.color }}>{stageInfo.stage}</span>
          <span className="text-[10px] text-muted-foreground">{stageInfo.desc}</span>
        </div>
        <div className="flex gap-4 text-[10px] mt-1">
          {lastSMA50  != null && <p className="text-amber-500 font-mono">SMA50: {formatPrice(lastSMA50,  { nativeCurrency, compact: true })}</p>}
          {lastSMA200 != null && <p className="text-rose-400 font-mono">SMA200: {formatPrice(lastSMA200, { nativeCurrency, compact: true })}</p>}
        </div>
      </div>

      {/* Market Breadth */}
      <div className="bg-muted/40 rounded-xl p-3 border border-border/30">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
          {lang === "ko" ? "📈 시장 폭 지수" : "📈 Market Breadth"}
        </p>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">{lang === "ko" ? "RS 양수 종목" : "Positive RS vs SPY"}</span>
          <span className="text-xs font-bold" style={{ color: breadthPct >= 50 ? "#22c55e" : "#ef4444" }}>{breadthPct}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-1">
          <div className="h-full rounded-full transition-all" style={{ width: `${breadthPct}%`, background: breadthPct >= 50 ? "#22c55e" : "#ef4444" }} />
        </div>
        <p className="text-[9px] text-muted-foreground">{positiveRS}/{screenerRows.length} {lang === "ko" ? "종목이 SPY 대비 강세" : "stocks outperforming SPY"}</p>
        {breadthData && breadthData.total > 0 && (
          <div className="mt-2 space-y-2">
            {[
              { lbl: lang === "ko" ? "SMA50 위" : "Above SMA50",  pct: breadthData.pctAboveSMA50,  color: "#f59e0b" },
              { lbl: lang === "ko" ? "SMA200 위" : "Above SMA200", pct: breadthData.pctAboveSMA200, color: "#ef4444" },
            ].map(({ lbl, pct, color }) => (
              <div key={lbl}>
                <div className="flex justify-between text-[9px] mb-0.5">
                  <span className="text-muted-foreground">{lbl}</span>
                  <span className="font-semibold" style={{ color }}>{pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, opacity: 0.75 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Super Investor List */}
      <div className="bg-muted/40 rounded-xl border border-border/30 overflow-hidden">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <div className="flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] font-bold text-primary uppercase tracking-wide">
              {lang === "ko" ? "슈퍼 투자자" : "Super Investors"}
            </p>
          </div>
          <button
            onClick={() => navigate("/investors")}
            className="text-[9px] font-bold text-primary hover:underline flex items-center gap-0.5"
            data-testid="button-view-all-investors"
          >
            {lang === "ko" ? "전체 보기 →" : "View All →"}
          </button>
        </div>
        <div className="divide-y divide-border/30">
          {visibleInvestors.map((inv) => (
            <div key={inv.name} className="flex items-start gap-2.5 px-3 py-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 mt-0.5"
                style={{ backgroundColor: inv.color }}
              >
                {inv.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-foreground leading-tight">{inv.name}</p>
                <p className="text-[9px] text-muted-foreground leading-relaxed italic mt-0.5 line-clamp-2">
                  "{lang === "ko" ? inv.tipKo : inv.tip}"
                </p>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setShowAllInvestors(v => !v)}
          className="w-full py-2 text-[9px] font-bold text-muted-foreground hover:text-primary transition-colors border-t border-border/30 flex items-center justify-center gap-1"
          data-testid="button-toggle-all-investors"
        >
          {showAllInvestors
            ? (lang === "ko" ? "접기 ▲" : "Show Less ▲")
            : (lang === "ko" ? `${SUPER_INVESTOR_TIPS.length - 5}명 더 보기 ▼` : `+${SUPER_INVESTOR_TIPS.length - 5} more ▼`)}
        </button>
      </div>

      {/* Stock description if available */}
      {info?.description && (
        <div className="bg-muted/40 rounded-xl p-3 border border-border/30">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
            {lang === "ko" ? "회사 소개" : "About"}
          </p>
          <p className="text-[10px] leading-relaxed text-foreground/75 line-clamp-4">
            {lang === "ko" && info.descriptionKo ? info.descriptionKo : info.description}
          </p>
        </div>
      )}
    </div>
  );

  // ── Right Panel (PC) = Earnings + RRG stacked ──────────────────────
  const RightPanel = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Earnings — top half, scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto border-b border-border/50">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide px-3 pt-3 pb-1">
          {lang === "ko" ? "📅 실적 & 어닝스" : "📅 Earnings & Data"}
        </p>
        {EarningsPanel()}
      </div>
      {/* RRG — bottom, collapsible */}
      <div className={cn("flex-shrink-0 overflow-y-auto transition-all duration-300", rrgFocused ? "h-[520px]" : "h-[340px]")}>
        {RRGChartPanel({ compact: true })}
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="w-full overflow-x-hidden" style={{ maxWidth: "100vw" }}>

      {/* ── Title bar (shared) ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 shrink-0">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold hidden sm:inline">DinoInvest <span className="text-primary">Pro</span></span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary hidden sm:inline-flex">{lang === "ko" ? "고급" : "Pro"}</Badge>
        </div>
        <GlobalSymbolSearch lang={lang} onSelectSymbol={setSelectedSymbol} />
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
          {quote?.isMarketOpen != null && (
            <>
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", quote.isMarketOpen ? "bg-green-500 animate-pulse" : "bg-gray-400")} />
              <span className="hidden sm:inline">{quote.isMarketOpen ? (lang === "ko" ? "장 개장" : "Open") : (lang === "ko" ? "장 마감" : "Closed")}</span>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MOBILE LAYOUT (< md)
          Search → Chips → Price → Chart (50vh) → RRG → Earnings → Investors
      ══════════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col w-full overflow-x-hidden" style={{ maxWidth: "100vw" }}>

          {/* Stock chip horizontal strip */}
        {StockChipStrip()}

        {/* Price header */}
        <div className="flex items-center gap-3 px-3 py-2 border-b border-border/30 bg-background flex-shrink-0">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-semibold text-muted-foreground truncate block">{displayName}</span>
            <div className="flex items-center gap-2">
              {isQuoteLoading ? <div className="h-5 w-20 bg-muted rounded animate-pulse" /> : (
                <>
                  <span className="text-base font-bold font-mono">{formatPrice(quote?.price, { nativeCurrency })}</span>
                  <span className={cn("text-xs font-bold", isPositive ? "text-emerald-500" : "text-rose-500")}>
                    {isPositive ? "+" : ""}{(quote?.changePercent ?? 0).toFixed(2)}%
                  </span>
                </>
              )}
            </div>
          </div>
          {selectedScreenerInfo && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
              {lang === "ko" ? selectedScreenerInfo.sectorKo : selectedScreenerInfo.sectorEn}
            </Badge>
          )}
        </div>

        {/* TradingView Chart — fixed 50vh */}
        <div className="w-full flex-shrink-0 overflow-hidden" style={{ height: "50vh", minHeight: 260, maxHeight: 480 }}>
          <TradingViewChart
            symbol={selectedSymbol}
            periodKey="1m"
            chartType="candle"
            isDark={isDark}
            lang={lang === "ko" ? "ko" : "en"}
            fillContainer
            onSymbolChange={setSelectedSymbol}
          />
        </div>

        {/* ── Market Ranking Panel (mobile) — below chart ─────────── */}
        <div className="w-full border-t border-border/30 flex-shrink-0" style={{ maxWidth: "100vw" }}>
          <div className="px-0">
            <div className="flex border-b border-border/40">
              {([
                ["actives", "🔥", lang === "ko" ? "인기주식" : "Most Active"],
                ["gainers", "🚀", lang === "ko" ? "급등주" : "Top Gainers"],
                ["losers",  "📉", lang === "ko" ? "급락주" : "Top Losers"],
              ] as const).map(([key, icon, label]) => (
                <button key={key} onClick={() => setRankTab(key)}
                  className={cn("flex-1 flex items-center justify-center gap-1 py-2 text-[11px] font-bold transition-colors",
                    rankTab === key ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground")}
                  data-testid={`mobile-rank-tab-${key}`}>
                  {icon} {label}
                </button>
              ))}
            </div>
            {/* Compact scrollable list — max 8 rows shown */}
            <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
              {rankTab === "actives" && <RankingStockList data={activesData} isLoading={isActivesLoading} emptyMsg={lang === "ko" ? "데이터 없음" : "No data"} />}
              {rankTab === "gainers" && <RankingStockList data={gainersData} isLoading={isGainersLoading} emptyMsg={lang === "ko" ? "데이터 없음" : "No data"} />}
              {rankTab === "losers"  && <RankingStockList data={losersData}  isLoading={isLosersLoading}  emptyMsg={lang === "ko" ? "데이터 없음" : "No data"} />}
            </div>
          </div>
        </div>

        {/* RRG Section */}
        <div className="w-full border-t border-border/30">
          {RRGChartPanel({})}
        </div>

        {/* Earnings Section */}
        <div className="w-full border-t border-border/30">
          {EarningsPanel()}
        </div>

        {/* Super Investors — full list with scroll toggle */}
        <div className="w-full border-t border-border/30 pb-6">
          {InsightsPanel()}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DESKTOP LAYOUT (md+)  — 3-column, fixed viewport height
      ══════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex" style={{ height: "calc(100vh - 57px)" }}>

        {/* Col 1: Screener (200px) */}
        <div className="w-[200px] flex-shrink-0 border-r border-border/50 overflow-hidden flex flex-col">
          {ScreenerPanel()}
        </div>

        {/* Col 2: Chart (flex-1) */}
        <div className="flex-1 min-w-0 border-r border-border/50 overflow-hidden flex flex-col">
          {ChartHeader()}
          <div className="flex-1 min-h-0">
            <TradingViewChart
              symbol={selectedSymbol}
              periodKey="1m"
              chartType="candle"
              isDark={isDark}
              lang={lang === "ko" ? "ko" : "en"}
              fillContainer
              onSymbolChange={setSelectedSymbol}
            />
          </div>
        </div>

        {/* Col 3: Right panel — Earnings + RRG (290px) */}
        <div className="w-[290px] flex-shrink-0 overflow-hidden flex flex-col">
          {RightPanel()}
        </div>
      </div>

    </div>
  );
}
