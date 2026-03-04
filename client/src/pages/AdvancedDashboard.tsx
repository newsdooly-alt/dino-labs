import { useQuery } from "@tanstack/react-query";
import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useUser } from "@/hooks/use-user";
import { getLocalizedCompanyName } from "@/lib/stockNames";
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
  TrendingUp, BarChart3, Lightbulb,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { translations } from "@/lib/translations";

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
];

const SCREENER_SYMS = SCREENER_STOCKS.map(s => s.symbol);
const ALL_SYMS_WITH_SPY = ["SPY", ...SCREENER_SYMS].join(",");

// History period used for Stage Analysis SMA calculations only
const HISTORY_PERIOD = { period: "1mo", interval: "1d" };

type MobileTab = "earnings" | "rrg" | "insights";

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
  const { theme } = useTheme();
  const { formatPrice, isKoreanStock, isJapaneseStock } = useCurrency();
  const { data: user } = useUser();
  const lang = (user?.language || "en") as string;
  const t = translations[lang as keyof typeof translations];

  const isDark = theme === "dark";
  const tickColor = isDark ? "#9ca3af" : "#6b7280";
  const tooltipBg = isDark ? "#111827" : "#ffffff";
  const tooltipBorder = isDark ? "#374151" : "#e5e7eb";

  // UI state
  const [selectedSymbol, setSelectedSymbol] = useState("NVDA");
  const [mobileTab, setMobileTab] = useState<MobileTab>("earnings");
  const [screenerSort, setScreenerSort] = useState<"rs" | "name" | "change" | "vol">("rs");
  const [screenerSearch, setScreenerSearch] = useState("");
  const [rrgFocused, setRrgFocused] = useState(false);
  const [showAllInvestors, setShowAllInvestors] = useState(false);

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

  const isPositive = (quote?.changePercent ?? 0) >= 0;
  const displayName = getLocalizedCompanyName(cleanCompanyName(quote?.name || selectedSymbol), lang);
  const selectedScreenerInfo = SCREENER_STOCKS.find(s => s.symbol === selectedSymbol);
  const visibleInvestors = showAllInvestors ? SUPER_INVESTOR_TIPS : SUPER_INVESTOR_TIPS.slice(0, 5);

  // ── Stock chip strip (reused on mobile + desktop left panel) ───────
  const StockChipStrip = () => (
    <div className="overflow-x-auto border-b border-border/30 flex-shrink-0" style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="flex gap-1 px-2 py-1.5" style={{ minWidth: "max-content" }}>
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
              <span>{s.flag} {s.symbol.replace(".KS", "").replace(".KQ", "")}</span>
              <span className={cp >= 0 ? "text-emerald-500" : "text-rose-500"}>{cp >= 0 ? "+" : ""}{cp.toFixed(1)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Screener Panel (PC left sidebar) ───────────────────────────────
  const ScreenerPanel = () => (
    <div className="flex flex-col h-full overflow-hidden">
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
        {isScreenerLoading ? (
          <div className="p-3 space-y-1.5">{Array(8).fill(0).map((_, i) => <div key={i} className="h-10 bg-muted/50 rounded-lg animate-pulse" />)}</div>
        ) : screenerRows.map(row => {
          const isSelected = row.symbol === selectedSymbol;
          const isKrStock = row.symbol.endsWith(".KS") || row.symbol.endsWith(".KQ");
          const priceFmt = row.price == null ? "--"
            : isKrStock ? `₩${Math.round(row.price).toLocaleString()}`
            : `$${row.price.toFixed(2)}`;
          const displayN = getLocalizedCompanyName(cleanCompanyName(row.name), lang);
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
                  <p className={cn("text-sm font-bold font-mono", earnings?.lastEpsActual != null ? (earnings.lastEpsActual >= 0 ? "text-emerald-500" : "text-rose-500") : "")}>
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
                  {lang === "ko" ? "📊 어닝스 히스토리 (예상 vs 실제)" : "📊 Earnings History (Est vs Act)"}
                </p>
                {/* Header row */}
                <div className="grid grid-cols-4 gap-1 mb-1.5 px-0.5">
                  {[lang === "ko" ? "분기" : "Quarter", lang === "ko" ? "예상" : "Est", lang === "ko" ? "실제" : "Act", lang === "ko" ? "서프라이즈" : "Surp"].map(h => (
                    <p key={h} className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide">{h}</p>
                  ))}
                </div>
                <div className="space-y-1">
                  {(earnings.history as any[]).filter((h: any) => h.epsActual != null).slice(0, 6).map((h: any, i: number) => {
                    const beat = h.epsActual != null && h.epsEstimate != null && h.epsActual >= h.epsEstimate;
                    const hasBeatMiss = h.epsEstimate != null && h.epsActual != null;
                    return (
                      <div key={i} className={cn("grid grid-cols-4 gap-1 items-center rounded-lg px-1.5 py-1",
                        hasBeatMiss ? (beat ? "bg-emerald-500/8 border border-emerald-500/20" : "bg-rose-500/8 border border-rose-500/20") : "bg-background/30")}>
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {new Date(h.date).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "short", year: "2-digit" })}
                        </span>
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {h.epsEstimate != null ? `$${h.epsEstimate.toFixed(2)}` : "--"}
                        </span>
                        <span className={cn("text-[9px] font-mono font-bold", h.epsActual >= 0 ? "text-emerald-500" : "text-rose-500")}>
                          ${h.epsActual.toFixed(2)}
                        </span>
                        <span className={cn("text-[9px] font-bold",
                          h.surprisePct != null ? (h.surprisePct >= 0 ? "text-emerald-500" : "text-rose-500") : "text-muted-foreground")}>
                          {h.surprisePct != null ? `${h.surprisePct >= 0 ? "+" : ""}${h.surprisePct.toFixed(1)}%` : hasBeatMiss ? (beat ? "Beat" : "Miss") : "--"}
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
        <EarningsPanel />
      </div>
      {/* RRG — bottom, collapsible */}
      <div className={cn("flex-shrink-0 overflow-y-auto transition-all duration-300", rrgFocused ? "h-[520px]" : "h-[340px]")}>
        <RRGChartPanel compact />
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="w-full overflow-x-hidden" style={{ maxWidth: "100vw" }}>

      {/* ── Title bar (shared) ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">DinoInvest <span className="text-primary">Pro</span></span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">{lang === "ko" ? "고급 대시보드" : "Advanced"}</Badge>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {quote?.isMarketOpen != null && (
            <>
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", quote.isMarketOpen ? "bg-green-500 animate-pulse" : "bg-gray-400")} />
              <span className="hidden sm:inline">{quote.isMarketOpen ? (lang === "ko" ? "장 개장" : "Market Open") : (lang === "ko" ? "장 마감" : "Closed")}</span>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MOBILE LAYOUT (< md)
          Stock chips → Chart (60vh) → Tabs → Scrollable content
      ══════════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col">

        {/* Stock chip horizontal strip */}
        <StockChipStrip />

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

        {/* TradingView Chart — fixed 60vh */}
        <div className="w-full flex-shrink-0" style={{ height: "60vh", minHeight: 280, maxHeight: 520 }}>
          <TradingViewChart
            symbol={selectedSymbol}
            periodKey="1m"
            chartType="candle"
            isDark={isDark}
            lang={lang === "ko" ? "ko" : "en"}
            fillContainer
          />
        </div>

        {/* Tab nav — directly below chart */}
        <div className="flex border-b border-border bg-background sticky top-[49px] z-10">
          {([
            { key: "earnings" as MobileTab, icon: Calendar,   label: lang === "ko" ? "실적" : "Earnings" },
            { key: "rrg"      as MobileTab, icon: BarChart3,  label: "RRG" },
            { key: "insights" as MobileTab, icon: Lightbulb,  label: lang === "ko" ? "인사이트" : "Insights" },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setMobileTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-colors",
                mobileTab === tab.key
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`mobile-tab-${tab.key}`}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content — scrollable, natural height */}
        <div className="w-full">
          {mobileTab === "earnings" && <EarningsPanel />}
          {mobileTab === "rrg"      && <RRGChartPanel />}
          {mobileTab === "insights" && <InsightsPanel />}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DESKTOP LAYOUT (md+)  — 3-column, fixed viewport height
      ══════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex" style={{ height: "calc(100vh - 57px)" }}>

        {/* Col 1: Screener (200px) */}
        <div className="w-[200px] flex-shrink-0 border-r border-border/50 overflow-hidden flex flex-col">
          <ScreenerPanel />
        </div>

        {/* Col 2: Chart (flex-1) */}
        <div className="flex-1 min-w-0 border-r border-border/50 overflow-hidden flex flex-col">
          <ChartHeader />
          <div className="flex-1 min-h-0">
            <TradingViewChart
              symbol={selectedSymbol}
              periodKey="1m"
              chartType="candle"
              isDark={isDark}
              lang={lang === "ko" ? "ko" : "en"}
              fillContainer
            />
          </div>
        </div>

        {/* Col 3: Right panel — Earnings + RRG (290px) */}
        <div className="w-[290px] flex-shrink-0 overflow-hidden flex flex-col">
          <RightPanel />
        </div>
      </div>

    </div>
  );
}
