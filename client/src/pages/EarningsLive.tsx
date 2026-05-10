import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { apiRequest } from "@/lib/queryClient";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, Brain, Search, ChevronRight,
  ExternalLink, FileText, Mic, BarChart2, Clock, Globe, AlertCircle, Loader2,
  ChevronLeft, Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getLocalizedCompanyName } from "@/lib/stockNames";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UpcomingItem {
  symbol: string;
  name: string;
  nextEarningsDate: string;
  epsEstimate: number | null;
  sector: string | null;
  currentPrice: number | null;
  changePercent: number | null;
  marketCap: number | null;
  currency?: string; // "KRW" | "USD" | "JPY"
}

interface EarningsHistory {
  date: string;
  epsEstimate: number | null;
  epsActual: number | null;
  surprisePct: number | null;
}

interface RevenueHistory {
  date: string;
  revenue: number;
}

interface EarningsData {
  nextEarningsDate: string | null;
  nextEpsEstimate: number | null;
  nextEpsHigh: number | null;
  nextEpsLow: number | null;
  lastEarningsDate: string | null;
  lastEpsActual: number | null;
  lastEpsEstimate: number | null;
  lastSurprisePct: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  history: EarningsHistory[];
  revenueHistory: RevenueHistory[];
  nextRevEstimate: number | null;
}

interface AIAnalysis {
  verdict: "BEAT" | "MISS" | "IN-LINE";
  verdictDetail: string;
  keyTakeaways: string[];
  sentiment: "Positive" | "Neutral" | "Negative";
  sentimentScore: number;
  guidanceOutlook: string;
  marketContext?: string;
}

// ── Currency Helpers ───────────────────────────────────────────────────────────

function getCurrency(symbol: string): "USD" | "KRW" | "JPY" {
  const s = symbol.toUpperCase();
  if (s.endsWith(".KS") || s.endsWith(".KQ")) return "KRW";
  if (s.endsWith(".T"))  return "JPY";
  return "USD";
}

function currencySymbol(currency: "USD" | "KRW" | "JPY"): string {
  return currency === "KRW" ? "₩" : currency === "JPY" ? "¥" : "$";
}

/** Format revenue with correct currency and scale for the stock's exchange */
function formatRevenue(v: number | null | undefined, symbol: string): string {
  if (v == null) return "—";
  const currency = getCurrency(symbol);
  const absV = Math.abs(v);
  const sym = currencySymbol(currency);

  if (currency === "KRW") {
    if (absV >= 1e12) return `${sym}${(v / 1e12).toFixed(1)}조`;
    if (absV >= 1e8)  return `${sym}${(v / 1e8).toFixed(0)}억`;
    return `${sym}${v.toLocaleString("ko-KR")}`;
  }
  if (currency === "JPY") {
    if (absV >= 1e12) return `${sym}${(v / 1e12).toFixed(1)}조`;
    if (absV >= 1e8)  return `${sym}${(v / 1e8).toFixed(0)}억`;
    return `${sym}${v.toLocaleString("ja-JP")}`;
  }
  // USD
  if (absV >= 1e12) return `${sym}${(v / 1e12).toFixed(2)}T`;
  if (absV >= 1e9)  return `${sym}${(v / 1e9).toFixed(2)}B`;
  if (absV >= 1e6)  return `${sym}${(v / 1e6).toFixed(1)}M`;
  return `${sym}${v.toLocaleString()}`;
}

/** Format EPS with correct currency — KRW EPS is whole won, USD is dollars */
function formatEps(v: number | null | undefined, symbol: string): string {
  if (v == null) return "—";
  const currency = getCurrency(symbol);
  const sym = currencySymbol(currency);
  if (currency === "KRW") return `${sym}${Math.round(v).toLocaleString("ko-KR")}`;
  if (currency === "JPY") return `${sym}${Math.round(v).toLocaleString("ja-JP")}`;
  return `${sym}${Number(v).toFixed(2)}`;
}

function formatSurprise(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function formatMarketCap(v: number | null, symbol: string, lang: string): string {
  if (!v) return "";
  const currency = getCurrency(symbol);
  const sym = currencySymbol(currency);
  if (currency === "KRW") {
    if (v >= 1e12) return lang === "ko" ? `${sym}${(v / 1e12).toFixed(1)}조` : `${sym}${(v / 1e12).toFixed(1)}T`;
    if (v >= 1e8)  return lang === "ko" ? `${sym}${(v / 1e8).toFixed(0)}억`  : `${sym}${(v / 1e9).toFixed(1)}B`;
    return "";
  }
  if (v >= 1e12) return `${sym}${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `${sym}${(v / 1e9).toFixed(1)}B`;
  return "";
}

/** Revenue chart: KRW divides by 조, USD by billion */
function revenueChartUnit(symbol: string): { divisor: number; label: string } {
  const c = getCurrency(symbol);
  if (c === "KRW") return { divisor: 1e12, label: "조" };
  if (c === "JPY") return { divisor: 1e12, label: "T¥" };
  return { divisor: 1e9, label: "B" };
}

// ── Date / TZ Helpers ──────────────────────────────────────────────────────────

function toLocalDateLabel(isoDate: string | null, tz: string, lang: string): string {
  if (!isoDate) return "—";
  try {
    // Assume 4 PM ET for US stocks (typical earnings release); Korean stocks release at open
    const d = new Date(isoDate + "T16:00:00-05:00");
    return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", {
      timeZone: tz, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
    }).format(d);
  } catch {
    return isoDate.slice(0, 10);
  }
}

function toLocalDateOnly(isoDate: string | null, tz: string, lang: string): string {
  if (!isoDate) return "—";
  try {
    const d = new Date(isoDate + "T00:00:00");
    return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", {
      timeZone: tz, month: "short", day: "numeric", year: "numeric",
    }).format(d);
  } catch {
    return isoDate.slice(0, 10);
  }
}

function getTzAbbr(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en", { timeZoneName: "short", timeZone: tz })
      .formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value || tz;
  } catch { return tz; }
}

function quarterLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q}'${String(d.getFullYear()).slice(2)}`;
}

// ── IR Links ──────────────────────────────────────────────────────────────────

const IR_LINKS: Record<string, { ir?: string; webcast?: string }> = {
  AAPL:  { ir: "https://investor.apple.com", webcast: "https://investor.apple.com" },
  MSFT:  { ir: "https://www.microsoft.com/en-us/investor", webcast: "https://www.microsoft.com/en-us/investor" },
  NVDA:  { ir: "https://investor.nvidia.com/financial-information/quarterly-results/", webcast: "https://investor.nvidia.com/" },
  GOOGL: { ir: "https://abc.xyz/investor/", webcast: "https://abc.xyz/investor/" },
  GOOG:  { ir: "https://abc.xyz/investor/", webcast: "https://abc.xyz/investor/" },
  AMZN:  { ir: "https://ir.aboutamazon.com/quarterly-results/", webcast: "https://ir.aboutamazon.com/" },
  META:  { ir: "https://investor.fb.com/financials/quarterly-earnings/", webcast: "https://investor.fb.com/" },
  TSLA:  { ir: "https://ir.tesla.com/#quarterly-disclosure", webcast: "https://ir.tesla.com/" },
  AMD:   { ir: "https://ir.amd.com/financial-information/quarterly-results", webcast: "https://ir.amd.com/" },
  NFLX:  { ir: "https://ir.netflix.net/ir/doc/quarterly-earnings", webcast: "https://ir.netflix.net/" },
  AVGO:  { ir: "https://investors.broadcom.com/financial-information/quarterly-earnings", webcast: "https://investors.broadcom.com/" },
  JPM:   { ir: "https://jpmorganchase.com/ir", webcast: "https://jpmorganchase.com/ir" },
  BAC:   { ir: "https://investor.bankofamerica.com/press-releases", webcast: "https://investor.bankofamerica.com/" },
  GS:    { ir: "https://www.goldmansachs.com/investor-relations/", webcast: "https://www.goldmansachs.com/investor-relations/" },
  V:     { ir: "https://investor.visa.com/financial-information/quarterly-earnings/", webcast: "https://investor.visa.com/" },
  MA:    { ir: "https://investor.mastercard.com/financial-information/quarterly-earnings/", webcast: "https://investor.mastercard.com/" },
  WMT:   { ir: "https://stock.walmart.com", webcast: "https://stock.walmart.com" },
  CRM:   { ir: "https://investor.salesforce.com/financial-information/quarterly-earnings/", webcast: "https://investor.salesforce.com/" },
  JNJ:   { ir: "https://investor.jnj.com/quarterly-results", webcast: "https://investor.jnj.com/" },
  UNH:   { ir: "https://ir.unitedhealthgroup.com/financial-information/quarterly-results/", webcast: "https://ir.unitedhealthgroup.com/" },
  ORCL:  { ir: "https://investor.oracle.com/investor-news/quarterly-earnings/", webcast: "https://investor.oracle.com/" },
  ADBE:  { ir: "https://www.adobe.com/investor-relations.html", webcast: "https://www.adobe.com/investor-relations.html" },
  INTC:  { ir: "https://www.intc.com/financial-information/quarterly-earnings/", webcast: "https://www.intc.com/" },
};

function getIRLinks(symbol: string) {
  return IR_LINKS[symbol.toUpperCase()] || {};
}

// ── AI Cache (localStorage, 2-hour TTL) ───────────────────────────────────────

const AI_CACHE_KEY = "earnings_ai_cache_v2";
const AI_CACHE_TTL = 2 * 60 * 60 * 1000;

function loadAiCache(): Record<string, { analysis: AIAnalysis; analyzedAt: number }> {
  try {
    const obj = JSON.parse(localStorage.getItem(AI_CACHE_KEY) || "{}");
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]: any) => v.analyzedAt && now - v.analyzedAt < AI_CACHE_TTL)
    ) as any;
  } catch { return {}; }
}

function saveAiCache(cache: Record<string, { analysis: AIAnalysis; analyzedAt: number }>) {
  try { localStorage.setItem(AI_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function VerdictBadge({ verdict, size = "md" }: { verdict: "BEAT" | "MISS" | "IN-LINE"; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "text-lg px-5 py-2" : size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";
  if (verdict === "BEAT")
    return <span className={cn("inline-flex items-center gap-1.5 font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40", sz)}><TrendingUp className="w-4 h-4" />BEAT</span>;
  if (verdict === "MISS")
    return <span className={cn("inline-flex items-center gap-1.5 font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40", sz)}><TrendingDown className="w-4 h-4" />MISS</span>;
  return <span className={cn("inline-flex items-center gap-1.5 font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40", sz)}><Minus className="w-4 h-4" />IN-LINE</span>;
}

function SurpriseCell({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  const n = Number(v);
  return <span className={cn("font-semibold", n > 0 ? "text-emerald-400" : n < 0 ? "text-rose-400" : "text-muted-foreground")}>{formatSurprise(n)}</span>;
}

function SentimentMeter({ score, sentiment }: { score: number; sentiment: string }) {
  const pct = Math.min(100, Math.max(0, ((score - 1) / 9) * 100));
  const color = sentiment === "Positive" ? "bg-emerald-500" : sentiment === "Negative" ? "bg-rose-500" : "bg-amber-500";
  const lbl = sentiment === "Positive" ? "🟢 긍정적 / Positive" : sentiment === "Negative" ? "🔴 부정적 / Negative" : "🟡 중립 / Neutral";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Sentiment</span>
        <span className="font-semibold">{lbl}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Bearish</span><span className="font-mono">{score}/10</span><span>Bullish</span>
      </div>
    </div>
  );
}

function EpsTooltip({ active, payload, label, symbol }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-sm space-y-1 min-w-[140px]">
      <p className="font-bold text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-mono font-semibold">{p.value != null ? formatEps(p.value, symbol) : "—"}</span>
        </p>
      ))}
    </div>
  );
}

// ── Mobile tab types ──────────────────────────────────────────────────────────
type MobileTab = "upcoming" | "calendar" | "detail" | "ai";

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function EarningsLive() {
  const { data: user } = useUser();
  const lang = (user?.language || "ko") as "en" | "ko" | "ja";

  const userTz  = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const tzAbbr  = useMemo(() => getTzAbbr(userTz), [userTz]);

  const [selectedSymbol, setSelectedSymbol] = useState<string>("AAPL");
  const [searchQuery, setSearchQuery]       = useState("");
  const [mobileTab, setMobileTab]           = useState<MobileTab>("upcoming");
  const [calMonth, setCalMonth]             = useState(() => new Date());
  const [aiCache, setAiCache]               = useState(() => loadAiCache());
  const analyzeTriggeredRef                 = useRef<Set<string>>(new Set());

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: upcomingData, isLoading: upcomingLoading, refetch: refetchUpcoming } =
    useQuery<{ upcoming: UpcomingItem[] }>({
      queryKey: ["/api/earnings/upcoming"],
      staleTime: 25 * 60 * 1000,
    });

  const { data: earningsData, isLoading: earningsLoading } = useQuery<EarningsData>({
    queryKey: ["/api/stocks/earnings", selectedSymbol],
    queryFn: () => fetch(`/api/stocks/earnings/${encodeURIComponent(selectedSymbol)}`).then(r => r.json()),
    enabled: !!selectedSymbol,
    staleTime: 5 * 60 * 1000,
  });

  const { data: liveQuotes } = useQuery<Record<string, any>>({
    queryKey: ["/api/stocks/live", selectedSymbol],
    queryFn: () => fetch(`/api/stocks/live?symbols=${selectedSymbol}`).then(r => r.json()),
    enabled: !!selectedSymbol,
    refetchInterval: 30000,
    staleTime: 20000,
  });

  const liveQuote  = liveQuotes?.[selectedSymbol];
  const currency   = getCurrency(selectedSymbol);
  const priceSym   = currencySymbol(currency);

  // ── AI mutation ────────────────────────────────────────────────────────────
  const analyzeMutation = useMutation({
    mutationFn: async (payload: object) => {
      const res = await apiRequest("POST", "/api/earnings/analyze", payload);
      return res.json() as Promise<{ analysis: AIAnalysis; symbol: string; analyzedAt: number }>;
    },
    onSuccess: (data) => {
      const newCache = { ...aiCache, [data.symbol]: { analysis: data.analysis, analyzedAt: data.analyzedAt } };
      setAiCache(newCache);
      saveAiCache(newCache);
    },
  });

  // Auto-trigger AI analysis
  useEffect(() => {
    if (!selectedSymbol || !earningsData) return;
    const lastQ = earningsData.history?.find(h => h.epsActual != null);
    if (!lastQ || aiCache[selectedSymbol] || analyzeTriggeredRef.current.has(selectedSymbol)) return;
    analyzeTriggeredRef.current.add(selectedSymbol);
    const item = upcomingData?.upcoming?.find(u => u.symbol === selectedSymbol);
    analyzeMutation.mutate({
      symbol: selectedSymbol,
      name: item?.name || selectedSymbol,
      sector: item?.sector || null,
      currency,
      epsActual: lastQ.epsActual,
      epsEstimate: lastQ.epsEstimate,
      surprisePct: lastQ.surprisePct,
      revenueActual: earningsData.revenueHistory?.[0]?.revenue ?? null,
      quarter: quarterLabel(lastQ.date),
      lang,
    });
  }, [selectedSymbol, earningsData]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const aiResult = aiCache[selectedSymbol]?.analysis ?? null;

  const filteredUpcoming = useMemo(() => {
    const list = upcomingData?.upcoming || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(u => u.symbol.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
  }, [upcomingData, searchQuery]);

  const epsChartData = useMemo(() => {
    if (!earningsData?.history) return [];
    return earningsData.history
      .filter(h => h.epsActual != null).slice(0, 7).reverse()
      .map(h => ({
        quarter: quarterLabel(h.date),
        Estimate: h.epsEstimate,
        Actual:   h.epsActual,
        beat: h.epsActual != null && h.epsEstimate != null ? h.epsActual >= h.epsEstimate : null,
      }));
  }, [earningsData]);

  const revUnit = useMemo(() => revenueChartUnit(selectedSymbol), [selectedSymbol]);
  const revChartData = useMemo(() => {
    if (!earningsData?.revenueHistory) return [];
    return earningsData.revenueHistory.slice(0, 6).reverse().map(r => ({
      quarter: quarterLabel(r.date),
      Revenue: parseFloat((r.revenue / revUnit.divisor).toFixed(2)),
    }));
  }, [earningsData, revUnit]);

  // Calendar: group upcoming by date
  const earningsByDate = useMemo(() => {
    const map: Record<string, UpcomingItem[]> = {};
    for (const item of upcomingData?.upcoming || []) {
      const d = item.nextEarningsDate;
      if (!map[d]) map[d] = [];
      map[d].push(item);
    }
    return map;
  }, [upcomingData]);

  const handleSelectSymbol = useCallback((sym: string) => {
    setSelectedSymbol(sym.toUpperCase());
    setMobileTab("detail");
  }, []);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().toUpperCase();
    if (q) handleSelectSymbol(q);
  };

  const handleReAnalyze = () => {
    const lastQ = earningsData?.history?.find(h => h.epsActual != null);
    if (!lastQ) return;
    analyzeTriggeredRef.current.delete(selectedSymbol);
    const newCache = { ...aiCache }; delete newCache[selectedSymbol];
    setAiCache(newCache); saveAiCache(newCache);
    analyzeTriggeredRef.current.add(selectedSymbol);
    const item = upcomingData?.upcoming?.find(u => u.symbol === selectedSymbol);
    analyzeMutation.mutate({
      symbol: selectedSymbol,
      name: item?.name || selectedSymbol,
      sector: item?.sector || null,
      currency,
      epsActual: lastQ.epsActual,
      epsEstimate: lastQ.epsEstimate,
      surprisePct: lastQ.surprisePct,
      revenueActual: earningsData?.revenueHistory?.[0]?.revenue ?? null,
      quarter: quarterLabel(lastQ.date),
      lang,
    });
  };

  // ── Labels ─────────────────────────────────────────────────────────────────
  const L = {
    title:       lang === "ko" ? "실적 Live" : lang === "ja" ? "決算ライブ" : "Earnings Live",
    upcoming:    lang === "ko" ? "예정 실적" : lang === "ja" ? "予定" : "Upcoming",
    calendarTab: lang === "ko" ? "캘린더" : lang === "ja" ? "カレンダー" : "Calendar",
    detail:      lang === "ko" ? "실적 상세" : lang === "ja" ? "詳細" : "Detail",
    ai:          lang === "ko" ? "AI 분석" : lang === "ja" ? "AI分析" : "AI Analysis",
    search:      lang === "ko" ? "종목 검색..." : "Search ticker...",
    eps_actual:  lang === "ko" ? "EPS 실적" : "EPS Actual",
    eps_est:     lang === "ko" ? "EPS 추정" : "EPS Estimate",
    surprise:    lang === "ko" ? "서프라이즈" : "Surprise",
    revenue:     lang === "ko" ? "매출" : "Revenue",
    history:     lang === "ko" ? "분기별 실적 히스토리" : "Quarterly Earnings History",
    noData:      lang === "ko" ? "데이터 없음" : "No data",
    refresh:     lang === "ko" ? "새로고침" : "Refresh",
    reanalyze:   lang === "ko" ? "AI 재분석" : "Re-analyze",
    key_points:  lang === "ko" ? "핵심 포인트" : "Key Takeaways",
    guidance:    lang === "ko" ? "가이던스/전망" : "Guidance & Outlook",
    mkt_context: lang === "ko" ? "시장 맥락" : "Market Context",
    ir_links:    lang === "ko" ? "IR 자료 링크" : "IR Links",
    webcast:     lang === "ko" ? "실적 발표 웹캐스트" : "Earnings Webcast",
    ir_page:     lang === "ko" ? "IR 페이지" : "Investor Relations",
    sec_edgar:   lang === "ko" ? "SEC EDGAR 공시" : "SEC EDGAR Filing",
    yahoo_fin:   lang === "ko" ? "Yahoo Finance 재무제표" : "Yahoo Finance Financials",
    next_earn:   lang === "ko" ? "다음 실적 발표" : "Next Earnings",
    last_earn:   lang === "ko" ? "최근 실적 발표" : "Last Earnings",
    tz_note:     lang === "ko" ? `현지 시간 (${tzAbbr})` : `Local time (${tzAbbr})`,
    no_upcoming: lang === "ko" ? "예정 실적 없음" : "No upcoming earnings",
    analyzing:   lang === "ko" ? "AI 분석 중..." : "Analyzing...",
    ai_waiting:  lang === "ko" ? "최근 실적 데이터가 있으면 자동 분석됩니다." : "AI auto-triggers when earnings data loads.",
    eps_chart:   lang === "ko" ? "분기별 EPS 비교" : "Quarterly EPS",
    rev_chart:   lang === "ko" ? `분기별 매출 (${revUnit.label})` : `Quarterly Revenue (${revUnit.label})`,
  };

  // ── Calendar Panel ─────────────────────────────────────────────────────────
  const CalendarPanel = () => {
    const year    = calMonth.getFullYear();
    const month   = calMonth.getMonth();
    const today   = new Date();
    const first   = new Date(year, month, 1).getDay();       // 0=Sun
    const numDays = new Date(year, month + 1, 0).getDate();
    const weekDays = lang === "ko" ? ["일","월","화","수","목","금","토"] :
                     lang === "ja" ? ["日","月","火","水","木","金","土"] :
                                     ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

    const cells: (number | null)[] = [
      ...Array(first).fill(null),
      ...Array.from({ length: numDays }, (_, i) => i + 1),
    ];
    // Pad to complete weeks
    while (cells.length % 7 !== 0) cells.push(null);

    const monthLabel = calMonth.toLocaleDateString(
      lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US",
      { year: "numeric", month: "long" }
    );

    return (
      <div className="space-y-3">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-cal-prev"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-foreground text-sm">{monthLabel}</span>
          <button
            onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-cal-next"
          >
            <ChevronLeft className="w-4 h-4 rotate-180" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7">
          {weekDays.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} className="aspect-square" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const events  = earningsByDate[dateStr] || [];
            const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
            const hasEvents = events.length > 0;

            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[52px] rounded-lg border p-1 flex flex-col",
                  isToday ? "border-primary bg-primary/8" : hasEvents ? "border-border bg-card" : "border-border/30 bg-transparent",
                )}
              >
                <span className={cn("text-[10px] font-semibold mb-0.5 leading-none",
                  isToday ? "text-primary" : "text-muted-foreground"
                )}>{day}</span>
                <div className="flex-1 space-y-0.5 overflow-hidden">
                  {events.slice(0, 2).map(ev => {
                    const c = getCurrency(ev.symbol);
                    const dotColor = c === "KRW" ? "bg-blue-500" : c === "JPY" ? "bg-violet-500" : "bg-emerald-500";
                    return (
                      <button
                        key={ev.symbol}
                        onClick={() => handleSelectSymbol(ev.symbol)}
                        className={cn(
                          "w-full text-left text-[8px] font-bold truncate rounded px-1 py-0.5 leading-tight transition-colors",
                          ev.symbol === selectedSymbol
                            ? "bg-primary text-primary-foreground"
                            : `${dotColor.replace("bg-", "bg-").replace("500", "500/20")} text-foreground hover:opacity-80`
                        )}
                        data-testid={`cal-btn-${ev.symbol}`}
                      >
                        {ev.symbol.replace(".KS", "").replace(".KQ", "").replace(".T", "")}
                      </button>
                    );
                  })}
                  {events.length > 2 && (
                    <span className="text-[8px] text-muted-foreground leading-none">
                      +{events.length - 2}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground border-t border-border pt-2 mt-1">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/70 inline-block" />US</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500/70 inline-block" />KR</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-500/70 inline-block" />JP</span>
          <span className="ml-auto text-primary flex items-center gap-1"><Globe className="w-2.5 h-2.5" />{tzAbbr}</span>
        </div>

        {/* Upcoming list for this month */}
        {Object.entries(earningsByDate)
          .filter(([d]) => d.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, events]) => (
            <div key={date} className="border border-border rounded-xl overflow-hidden">
              <div className="px-3 py-1.5 bg-muted/50 border-b border-border">
                <span className="text-xs font-semibold text-foreground">
                  {new Date(date + "T00:00:00").toLocaleDateString(
                    lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US",
                    { month: "short", day: "numeric", weekday: "short" }
                  )}
                </span>
              </div>
              <div className="divide-y divide-border/50">
                {events.map(ev => {
                  const name = getLocalizedCompanyName(ev.name, lang) || ev.name;
                  const c = getCurrency(ev.symbol);
                  return (
                    <button
                      key={ev.symbol}
                      onClick={() => handleSelectSymbol(ev.symbol)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/60 transition-colors",
                        ev.symbol === selectedSymbol && "bg-primary/5"
                      )}
                    >
                      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                        c === "KRW" ? "bg-blue-400" : c === "JPY" ? "bg-violet-400" : "bg-emerald-400"
                      )} />
                      <span className="font-mono text-xs font-bold text-foreground w-20 shrink-0">
                        {ev.symbol.replace(".KS","").replace(".KQ","").replace(".T","")}
                      </span>
                      <span className="text-xs text-muted-foreground truncate flex-1">{name}</span>
                      {ev.epsEstimate != null && (
                        <span className="text-xs font-mono text-muted-foreground shrink-0">
                          {lang === "ko" ? "추정" : "Est"} {formatEps(ev.epsEstimate, ev.symbol)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    );
  };

  // ── Upcoming List Panel ────────────────────────────────────────────────────
  const UpcomingPanel = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-foreground text-sm">{L.upcoming}</h2>
        <button onClick={() => refetchUpcoming()}
          className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          data-testid="button-refresh-upcoming">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleManualSearch} className="mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder={L.search} className="pl-8 h-8 text-xs bg-muted/50"
            data-testid="input-earnings-search" />
        </div>
      </form>

      <div className="flex items-center gap-1.5 mb-2">
        <Globe className="w-3 h-3 text-primary" />
        <span className="text-[10px] text-primary font-medium">{L.tz_note}</span>
      </div>

      {upcomingLoading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : filteredUpcoming.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">{L.no_upcoming}</div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filteredUpcoming.map(item => {
            const isSelected = item.symbol === selectedSymbol;
            const localDate  = toLocalDateLabel(item.nextEarningsDate, userTz, lang);
            const days       = Math.ceil((new Date(item.nextEarningsDate + "T00:00:00").getTime() - Date.now()) / 86400000);
            const isToday    = days === 0;
            const isPast     = days < 0;
            const localName  = getLocalizedCompanyName(item.name, lang) || item.name;
            const c          = getCurrency(item.symbol);
            const countryDot = c === "KRW" ? "🇰🇷" : c === "JPY" ? "🇯🇵" : "🇺🇸";

            return (
              <button key={item.symbol} onClick={() => handleSelectSymbol(item.symbol)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-150 group",
                  isSelected
                    ? "bg-primary/10 border-primary/40 shadow-[0_0_12px_rgba(34,197,94,0.1)]"
                    : "bg-card border-border hover:bg-muted/60"
                )}
                data-testid={`button-earnings-${item.symbol}`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs">{countryDot}</span>
                  <span className={cn("font-bold text-xs font-mono", isSelected ? "text-primary" : "text-foreground")}>
                    {item.symbol.replace(".KS","").replace(".KQ","").replace(".T","")}
                  </span>
                  {isToday && <Badge className="text-[9px] px-1.5 py-0 bg-rose-500/20 text-rose-400 border-rose-500/30 ml-1">TODAY</Badge>}
                  {isPast  && <Badge className="text-[9px] px-1.5 py-0 bg-muted text-muted-foreground border-border ml-1">PAST</Badge>}
                  <ChevronRight className={cn("w-3 h-3 ml-auto shrink-0", isSelected ? "text-primary rotate-90" : "text-muted-foreground")} />
                </div>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{localName}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                  <span className="text-[10px] text-muted-foreground">{localDate}</span>
                </div>
                {item.epsEstimate != null && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    EPS Est: <span className="font-mono text-foreground">{formatEps(item.epsEstimate, item.symbol)}</span>
                  </p>
                )}
                {item.marketCap && (
                  <p className="text-[10px] text-muted-foreground">{formatMarketCap(item.marketCap, item.symbol, lang)}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Detail Panel ───────────────────────────────────────────────────────────
  const DetailPanel = () => {
    if (earningsLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
    if (!earningsData) return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">{L.noData}</div>;

    const lastQ    = earningsData.history?.find(h => h.epsActual != null);
    const surprise = lastQ?.surprisePct;
    const surpriseCls = surprise != null && surprise > 0
      ? "border-emerald-500/40 bg-emerald-500/5"
      : surprise != null && surprise < 0
      ? "border-rose-500/40 bg-rose-500/5"
      : "border-border bg-card";
    const item     = upcomingData?.upcoming?.find(u => u.symbol === selectedSymbol);
    const name     = item ? (getLocalizedCompanyName(item.name, lang) || item.name) : selectedSymbol;

    // Price display — KR stocks don't need USD prefix
    const priceDisplay = liveQuote?.price
      ? `${priceSym}${currency === "KRW"
          ? Math.round(liveQuote.price).toLocaleString("ko-KR")
          : Number(liveQuote.price).toFixed(2)}`
      : null;

    return (
      <div className="space-y-5">
        {/* Header card */}
        <div className={cn("rounded-2xl border p-4", surpriseCls)}>
          <div className="flex flex-wrap items-start gap-3 justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xl font-bold font-mono text-foreground">
                  {selectedSymbol.replace(".KS","").replace(".KQ","").replace(".T","")}
                </span>
                {priceDisplay && <span className="text-lg font-semibold text-foreground">{priceDisplay}</span>}
                {liveQuote?.changePercent != null && (
                  <span className={cn("text-sm font-semibold", liveQuote.changePercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {liveQuote.changePercent >= 0 ? "+" : ""}{Number(liveQuote.changePercent).toFixed(2)}%
                  </span>
                )}
                {/* Currency tag */}
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                  {currency}
                </span>
              </div>
              <p className="text-muted-foreground text-sm mt-0.5">{name}</p>
              {item?.sector && <p className="text-[10px] text-muted-foreground/70">{item.sector}</p>}
            </div>
            {lastQ && (
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground">{L.last_earn}: {toLocalDateOnly(earningsData.lastEarningsDate, userTz, lang)}</span>
                {surprise != null && (
                  <span className={cn("text-sm font-bold", surprise > 0 ? "text-emerald-400" : surprise < 0 ? "text-rose-400" : "text-amber-400")}>
                    EPS {surprise > 0 ? "▲" : "▼"} {formatSurprise(surprise)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 4 stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {[
              { label: L.eps_actual, value: formatEps(lastQ?.epsActual, selectedSymbol),   cls: surprise != null && surprise > 0 ? "text-emerald-400" : surprise != null && surprise < 0 ? "text-rose-400" : "text-foreground" },
              { label: L.eps_est,    value: formatEps(lastQ?.epsEstimate, selectedSymbol),  cls: "text-foreground" },
              { label: L.surprise,   value: formatSurprise(lastQ?.surprisePct),             cls: surprise != null && surprise > 0 ? "text-emerald-400 font-bold" : surprise != null && surprise < 0 ? "text-rose-400 font-bold" : "text-foreground" },
              { label: L.revenue,    value: formatRevenue(earningsData.revenueHistory?.[0]?.revenue, selectedSymbol), cls: "text-foreground" },
            ].map(stat => (
              <div key={stat.label} className="bg-background/60 rounded-xl border border-border p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">{stat.label}</p>
                <p className={cn("text-sm font-bold font-mono", stat.cls)}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Next earnings */}
          {earningsData.nextEarningsDate && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-background/60 rounded-xl border border-border px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {L.next_earn}:{" "}
                <span className="text-foreground font-semibold">{toLocalDateLabel(earningsData.nextEarningsDate, userTz, lang)}</span>
                {" "}<span className="text-muted-foreground">({tzAbbr})</span>
                {earningsData.nextEpsEstimate != null && (
                  <> · EPS Est: <span className="font-mono text-foreground">{formatEps(earningsData.nextEpsEstimate, selectedSymbol)}</span></>
                )}
              </span>
            </div>
          )}
        </div>

        {/* EPS Chart */}
        {epsChartData.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="font-semibold text-sm mb-3">{L.eps_chart}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={epsChartData} barGap={3} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={v => formatEps(v, selectedSymbol)} width={currency === "KRW" ? 80 : 50} />
                <Tooltip content={<EpsTooltip symbol={selectedSymbol} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                <Bar dataKey="Estimate" fill="rgba(148,163,184,0.4)" radius={[3,3,0,0]} />
                <Bar dataKey="Actual" radius={[3,3,0,0]}>
                  {epsChartData.map((e, i) => (
                    <Cell key={i} fill={e.beat === true ? "#10b981" : e.beat === false ? "#f43f5e" : "#6366f1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Revenue Chart */}
        {revChartData.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="font-semibold text-sm mb-3">{L.rev_chart}</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={revChartData} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={v => `${priceSym}${v}${revUnit.label}`} />
                <Tooltip
                  formatter={(v: any) => [`${priceSym}${v}${revUnit.label}`, L.revenue]}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="Revenue" fill="rgba(99,102,241,0.7)" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* History Table */}
        {earningsData.history.length > 0 && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-sm">{L.history}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Quarter</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">{L.eps_est}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">{L.eps_actual}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">{L.surprise}</th>
                    {earningsData.revenueHistory.length > 0 && (
                      <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">{L.revenue}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {earningsData.history.filter(h => h.epsActual != null).slice(0, 8).map((h, idx) => {
                    const rev  = earningsData.revenueHistory.find(r => r.date === h.date);
                    const beat = h.epsActual != null && h.epsEstimate != null ? h.epsActual >= h.epsEstimate : null;
                    return (
                      <tr key={h.date} className={cn("border-b border-border/50", idx === 0 && "bg-primary/5")}>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold">{quarterLabel(h.date)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">{formatEps(h.epsEstimate, selectedSymbol)}</td>
                        <td className={cn("px-4 py-2.5 text-right font-mono text-xs font-semibold", beat === true ? "text-emerald-400" : beat === false ? "text-rose-400" : "text-foreground")}>
                          {formatEps(h.epsActual, selectedSymbol)}{beat === true && " ▲"}{beat === false && " ▼"}
                        </td>
                        <td className="px-4 py-2.5 text-right"><SurpriseCell v={h.surprisePct} /></td>
                        {earningsData.revenueHistory.length > 0 && (
                          <td className="px-4 py-2.5 text-right font-mono text-xs">{formatRevenue(rev?.revenue ?? null, selectedSymbol)}</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── AI + Links Panel ───────────────────────────────────────────────────────
  const AiPanel = () => {
    const irLinks    = getIRLinks(selectedSymbol);
    const isAnalyzing = analyzeMutation.isPending;
    const lastQ      = earningsData?.history?.find(h => h.epsActual != null);
    const isKR       = currency === "KRW";

    return (
      <div className="space-y-4">
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm">{L.ai}</h3>
            </div>
            {lastQ?.epsActual != null && (
              <Button size="sm" variant="outline" className="h-7 text-xs px-2.5"
                onClick={handleReAnalyze} disabled={isAnalyzing} data-testid="button-reanalyze">
                {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                <span className="ml-1">{L.reanalyze}</span>
              </Button>
            )}
          </div>

          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">{L.analyzing}</p>
            </div>
          )}

          {!isAnalyzing && !aiResult && (
            <div className="py-6 text-center">
              <Brain className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{L.ai_waiting}</p>
            </div>
          )}

          {!isAnalyzing && aiResult && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2 py-3 border border-border rounded-xl bg-muted/20">
                <VerdictBadge verdict={aiResult.verdict} size="lg" />
                <p className="text-xs text-muted-foreground text-center px-3 leading-relaxed">{aiResult.verdictDetail}</p>
              </div>

              <SentimentMeter score={aiResult.sentimentScore} sentiment={aiResult.sentiment} />

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{L.key_points}</h4>
                <ul className="space-y-2">
                  {(aiResult.keyTakeaways || []).map((pt, i) => (
                    <li key={i} className="flex gap-2 text-xs leading-relaxed">
                      <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Market Context — new field */}
              {aiResult.marketContext && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <h4 className="text-[10px] font-semibold text-blue-400 mb-1 uppercase tracking-wide">{L.mkt_context}</h4>
                  <p className="text-xs leading-relaxed">{aiResult.marketContext}</p>
                </div>
              )}

              {aiResult.guidanceOutlook && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <h4 className="text-[10px] font-semibold text-amber-400 mb-1 uppercase tracking-wide">{L.guidance}</h4>
                  <p className="text-xs leading-relaxed">{aiResult.guidanceOutlook}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* IR Links */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm">{L.ir_links}</h3>
          </div>
          <div className="space-y-2">
            {irLinks.webcast && (
              <a href={irLinks.webcast} target="_blank" rel="noopener noreferrer" data-testid="link-webcast"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/40 hover:bg-primary/10 transition-colors text-xs group border border-transparent hover:border-primary/20">
                <Mic className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="group-hover:text-primary">{L.webcast}</span>
                <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
              </a>
            )}
            {irLinks.ir && (
              <a href={irLinks.ir} target="_blank" rel="noopener noreferrer" data-testid="link-ir-page"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/40 hover:bg-primary/10 transition-colors text-xs group border border-transparent hover:border-primary/20">
                <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="group-hover:text-primary">{L.ir_page}</span>
                <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
              </a>
            )}
            <a href={isKR
                ? `https://dart.fss.or.kr/dsab001/main.do`
                : `https://finance.yahoo.com/quote/${selectedSymbol}/financials/`}
              target="_blank" rel="noopener noreferrer" data-testid="link-financials"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/40 hover:bg-primary/10 transition-colors text-xs group border border-transparent hover:border-primary/20">
              <BarChart2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="group-hover:text-primary">{isKR ? "DART 공시" : L.yahoo_fin}</span>
              <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
            </a>
            {!isKR && (
              <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${selectedSymbol}&type=10-Q&dateb=&owner=include&count=10`}
                target="_blank" rel="noopener noreferrer" data-testid="link-sec"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/40 hover:bg-primary/10 transition-colors text-xs group border border-transparent hover:border-primary/20">
                <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="group-hover:text-primary">{L.sec_edgar}</span>
                <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
              </a>
            )}
          </div>
        </div>

        {/* TZ note */}
        <div className="bg-muted/30 rounded-xl border border-border p-3 text-[10px] text-muted-foreground leading-relaxed">
          <Globe className="w-3 h-3 text-primary inline mr-1" />
          <span className="font-semibold text-foreground">{L.tz_note}</span>
          {" · "}
          {lang === "ko"
            ? "미국 ET 오후 4:00 = KST 익일 오전 5:00 (EDT 기준)"
            : "4:00 PM ET → KST 5:00 AM next day (EDT)"}
          {" · "}
          <span className="text-primary">Intl.DateTimeFormat (DST auto)</span>
        </div>
      </div>
    );
  };

  // ── Tab definitions ────────────────────────────────────────────────────────
  const mobileTabs: { id: MobileTab; label: string }[] = [
    { id: "upcoming",  label: L.upcoming },
    { id: "calendar",  label: L.calendarTab },
    { id: "detail",    label: L.detail },
    { id: "ai",        label: L.ai },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Sticky page header */}
      <div className="px-4 md:px-8 pt-5 pb-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">{L.title}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {lang === "ko"
                ? `실시간 실적 발표 · AI 분석 · ${tzAbbr} 시간대`
                : `Real-time earnings · AI analysis · ${tzAbbr} timezone`}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-primary bg-primary/10 rounded-full px-2.5 py-1 border border-primary/20 shrink-0">
            <Globe className="w-3 h-3" />{tzAbbr}
          </div>
        </div>
      </div>

      {/* Mobile tab bar (4 tabs) */}
      <div className="md:hidden flex border-b border-border bg-card overflow-x-auto">
        {mobileTabs.map(tab => (
          <button key={tab.id} onClick={() => setMobileTab(tab.id)}
            className={cn(
              "flex-1 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap px-1 min-w-[64px]",
              mobileTab === tab.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            )}
            data-testid={`tab-earnings-${tab.id}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop: left list | center calendar+detail toggle | right AI */}
      <div className="hidden md:grid md:grid-cols-[260px_1fr_320px] h-[calc(100vh-97px)] overflow-hidden">
        {/* Left: Upcoming list */}
        <div className="border-r border-border p-4 overflow-y-auto">
          <UpcomingPanel />
        </div>

        {/* Center: Tab between Calendar and Detail */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex border-b border-border bg-card/50 shrink-0">
            <button
              onClick={() => setMobileTab("detail")}
              className={cn("flex-1 py-2.5 text-xs font-semibold transition-colors",
                mobileTab !== "calendar" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              )}>
              <BarChart2 className="w-3.5 h-3.5 inline mr-1" />{L.detail}
            </button>
            <button
              onClick={() => setMobileTab("calendar")}
              className={cn("flex-1 py-2.5 text-xs font-semibold transition-colors",
                mobileTab === "calendar" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              )}>
              <Calendar className="w-3.5 h-3.5 inline mr-1" />{L.calendarTab}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {mobileTab === "calendar" ? <CalendarPanel /> : <DetailPanel />}
          </div>
        </div>

        {/* Right: AI + Links */}
        <div className="border-l border-border p-4 overflow-y-auto">
          <AiPanel />
        </div>
      </div>

      {/* Mobile: tabbed content */}
      <div className="md:hidden px-4 py-4 overflow-y-auto min-h-[calc(100vh-160px)]">
        {mobileTab === "upcoming"  && <UpcomingPanel />}
        {mobileTab === "calendar"  && <CalendarPanel />}
        {mobileTab === "detail"    && <DetailPanel />}
        {mobileTab === "ai"        && <AiPanel />}
      </div>
    </div>
  );
}
