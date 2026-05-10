import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { apiRequest } from "@/lib/queryClient";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, Brain, Search, ChevronRight,
  ExternalLink, FileText, Mic, BarChart2, Clock, Globe, AlertCircle, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getLocalizedCompanyName } from "@/lib/stockNames";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UpcomingItem {
  symbol: string;
  name: string;
  nextEarningsDate: string;
  epsEstimate: number | null;
  sector: string | null;
  currentPrice: number | null;
  changePercent: number | null;
  marketCap: number | null;
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
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRevenue(v: number | null | undefined, lang: string): string {
  if (v == null) return "—";
  const absV = Math.abs(v);
  if (lang === "ko") {
    if (absV >= 1e12) return `${(v / 1e12).toFixed(2)}조`;
    if (absV >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
    return v.toLocaleString();
  }
  if (absV >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (absV >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (absV >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function formatEps(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${Number(v).toFixed(2)}`;
}

function formatSurprise(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function formatMarketCap(v: number | null, lang: string): string {
  if (!v) return "";
  if (lang === "ko") {
    if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조원`;
    if (v >= 1e8) return `${(v / 1e8).toFixed(0)}억`;
    return "";
  }
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  return "";
}

/** Convert ISO date string to user's local timezone label */
function toLocalDateLabel(isoDate: string | null, tz: string, lang: string): string {
  if (!isoDate) return "—";
  try {
    const d = new Date(isoDate + "T16:00:00-05:00"); // assume 4 PM ET as typical US earnings time
    return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", {
      timeZone: tz,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
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
      timeZone: tz,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return isoDate.slice(0, 10);
  }
}

function getTzAbbr(tz: string): string {
  try {
    return (
      new Intl.DateTimeFormat("en", { timeZoneName: "short", timeZone: tz })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value || tz
    );
  } catch {
    return tz;
  }
}

function quarterLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const m = d.getMonth();
  const y = d.getFullYear();
  const q = Math.floor(m / 3) + 1;
  return `Q${q}'${String(y).slice(2)}`;
}

// ── IR Links ──────────────────────────────────────────────────────────────────

const IR_LINKS: Record<string, { ir?: string; webcast?: string; slides?: string }> = {
  AAPL:  { ir: "https://investor.apple.com/news/default.aspx", webcast: "https://investor.apple.com/news/default.aspx" },
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
  JPM:   { ir: "https://jpmorganchaseco.gcs-web.com/financial-information/quarterly-earnings", webcast: "https://www.jpmorganchase.com/ir" },
  BAC:   { ir: "https://investor.bankofamerica.com/press-releases", webcast: "https://investor.bankofamerica.com/" },
  GS:    { ir: "https://www.goldmansachs.com/investor-relations/", webcast: "https://www.goldmansachs.com/investor-relations/" },
  V:     { ir: "https://investor.visa.com/financial-information/quarterly-earnings/", webcast: "https://investor.visa.com/" },
  WMT:   { ir: "https://stock.walmart.com/financial-information/sec-filings/", webcast: "https://stock.walmart.com/" },
  CRM:   { ir: "https://investor.salesforce.com/financial-information/quarterly-earnings/", webcast: "https://investor.salesforce.com/" },
  JNJ:   { ir: "https://investor.jnj.com/quarterly-results", webcast: "https://investor.jnj.com/" },
  UNH:   { ir: "https://ir.unitedhealthgroup.com/financial-information/quarterly-results/", webcast: "https://ir.unitedhealthgroup.com/" },
};

function getIRLinks(symbol: string) {
  return IR_LINKS[symbol.toUpperCase()] || {};
}

// ── AI Analysis Cache (localStorage with 2-hour TTL) ──────────────────────────

const AI_CACHE_KEY = "earnings_ai_cache_v1";
const AI_CACHE_TTL = 2 * 60 * 60 * 1000;

function loadAiCache(): Record<string, { analysis: AIAnalysis; analyzedAt: number }> {
  try {
    const raw = localStorage.getItem(AI_CACHE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    const now = Date.now();
    const cleaned: Record<string, { analysis: AIAnalysis; analyzedAt: number }> = {};
    for (const [k, v] of Object.entries(obj) as any[]) {
      if (v.analyzedAt && now - v.analyzedAt < AI_CACHE_TTL) cleaned[k] = v;
    }
    return cleaned;
  } catch {
    return {};
  }
}

function saveAiCache(cache: Record<string, { analysis: AIAnalysis; analyzedAt: number }>) {
  try {
    localStorage.setItem(AI_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

// ── Verdict Badge ─────────────────────────────────────────────────────────────

function VerdictBadge({ verdict, size = "md" }: { verdict: "BEAT" | "MISS" | "IN-LINE"; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "text-lg px-5 py-2" : size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";
  if (verdict === "BEAT")
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40", sizeClass)}>
        <TrendingUp className="w-4 h-4" /> BEAT
      </span>
    );
  if (verdict === "MISS")
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40", sizeClass)}>
        <TrendingDown className="w-4 h-4" /> MISS
      </span>
    );
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40", sizeClass)}>
      <Minus className="w-4 h-4" /> IN-LINE
    </span>
  );
}

// ── Surprise Cell ─────────────────────────────────────────────────────────────

function SurpriseCell({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  const n = Number(v);
  const cls = n > 0 ? "text-emerald-400 font-semibold" : n < 0 ? "text-rose-400 font-semibold" : "text-muted-foreground";
  return <span className={cls}>{formatSurprise(n)}</span>;
}

// ── Sentiment Meter ───────────────────────────────────────────────────────────

function SentimentMeter({ score, sentiment }: { score: number; sentiment: string }) {
  const pct = Math.min(100, Math.max(0, ((score - 1) / 9) * 100));
  const color = sentiment === "Positive" ? "bg-emerald-500" : sentiment === "Negative" ? "bg-rose-500" : "bg-amber-500";
  const label = sentiment === "Positive" ? "🟢 긍정적 / Positive" : sentiment === "Negative" ? "🔴 부정적 / Negative" : "🟡 중립 / Neutral";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Sentiment</span>
        <span className="font-semibold">{label}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Bearish</span>
        <span className="font-mono">{score}/10</span>
        <span>Bullish</span>
      </div>
    </div>
  );
}

// ── Custom Tooltip for EPS Chart ──────────────────────────────────────────────

function EpsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-sm space-y-1 min-w-[140px]">
      <p className="font-bold text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-mono font-semibold">{p.value != null ? `$${Number(p.value).toFixed(2)}` : "—"}</span>
        </p>
      ))}
    </div>
  );
}

// ── Tab types (mobile) ────────────────────────────────────────────────────────
type MobileTab = "upcoming" | "detail" | "ai";

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function EarningsLive() {
  const { data: user } = useUser();
  const lang = (user?.language || "ko") as "en" | "ko" | "ja";

  // Detect user timezone
  const userTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const tzAbbr = useMemo(() => getTzAbbr(userTz), [userTz]);

  // State
  const [selectedSymbol, setSelectedSymbol] = useState<string>("AAPL");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiCache, setAiCache] = useState<Record<string, { analysis: AIAnalysis; analyzedAt: number }>>(() => loadAiCache());
  const [mobileTab, setMobileTab] = useState<MobileTab>("upcoming");
  const analyzeTriggeredRef = useRef<Set<string>>(new Set());

  // ── Fetch upcoming earnings ──────────────────────────────────────────────
  const { data: upcomingData, isLoading: upcomingLoading, refetch: refetchUpcoming } = useQuery<{ upcoming: UpcomingItem[] }>({
    queryKey: ["/api/earnings/upcoming"],
    staleTime: 25 * 60 * 1000,
  });

  // ── Fetch selected stock earnings detail ─────────────────────────────────
  const { data: earningsData, isLoading: earningsLoading } = useQuery<EarningsData>({
    queryKey: ["/api/stocks/earnings", selectedSymbol],
    queryFn: () => fetch(`/api/stocks/earnings/${encodeURIComponent(selectedSymbol)}`).then((r) => r.json()),
    enabled: !!selectedSymbol,
    staleTime: 5 * 60 * 1000,
  });

  // ── Fetch live quote for selected stock ──────────────────────────────────
  const { data: liveQuotes } = useQuery<Record<string, any>>({
    queryKey: ["/api/stocks/live", selectedSymbol],
    queryFn: () => fetch(`/api/stocks/live?symbols=${selectedSymbol}`).then((r) => r.json()),
    enabled: !!selectedSymbol,
    refetchInterval: 30000,
    staleTime: 20000,
  });

  const liveQuote = liveQuotes?.[selectedSymbol];

  // ── AI Analysis mutation ──────────────────────────────────────────────────
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

  // ── Auto-trigger AI analysis when earnings data loads ────────────────────
  useEffect(() => {
    if (!selectedSymbol || !earningsData) return;
    const lastQ = earningsData.history?.find((h) => h.epsActual != null);
    if (!lastQ) return;
    if (aiCache[selectedSymbol]) return;
    if (analyzeTriggeredRef.current.has(selectedSymbol)) return;
    analyzeTriggeredRef.current.add(selectedSymbol);

    const upcomingItem = upcomingData?.upcoming?.find((u) => u.symbol === selectedSymbol);
    analyzeMutation.mutate({
      symbol: selectedSymbol,
      name: upcomingItem?.name || selectedSymbol,
      epsActual: lastQ.epsActual,
      epsEstimate: lastQ.epsEstimate,
      surprisePct: lastQ.surprisePct,
      revenueActual: earningsData.revenueHistory?.[0]?.revenue ?? null,
      revenueEstimate: null,
      quarter: quarterLabel(lastQ.date),
      lang,
    });
  }, [selectedSymbol, earningsData]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const aiResult = aiCache[selectedSymbol]?.analysis ?? null;

  const filteredUpcoming = useMemo(() => {
    const list = upcomingData?.upcoming || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((u) => u.symbol.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
  }, [upcomingData, searchQuery]);

  // EPS chart data (last 6 quarters from history, oldest first)
  const epsChartData = useMemo(() => {
    if (!earningsData?.history) return [];
    return earningsData.history
      .filter((h) => h.epsActual != null)
      .slice(0, 7)
      .reverse()
      .map((h) => ({
        quarter: quarterLabel(h.date),
        Estimate: h.epsEstimate,
        Actual: h.epsActual,
        beat: h.epsActual != null && h.epsEstimate != null ? h.epsActual >= h.epsEstimate : null,
      }));
  }, [earningsData]);

  // Revenue chart data (last 6 quarters, oldest first)
  const revChartData = useMemo(() => {
    if (!earningsData?.revenueHistory) return [];
    return earningsData.revenueHistory.slice(0, 6).reverse().map((r) => ({
      quarter: quarterLabel(r.date),
      Revenue: parseFloat((r.revenue / 1e9).toFixed(2)),
    }));
  }, [earningsData]);

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
    const lastQ = earningsData?.history?.find((h) => h.epsActual != null);
    if (!lastQ) return;
    analyzeTriggeredRef.current.delete(selectedSymbol);
    const newCache = { ...aiCache };
    delete newCache[selectedSymbol];
    setAiCache(newCache);
    saveAiCache(newCache);
    analyzeTriggeredRef.current.add(selectedSymbol);
    const upcomingItem = upcomingData?.upcoming?.find((u) => u.symbol === selectedSymbol);
    analyzeMutation.mutate({
      symbol: selectedSymbol,
      name: upcomingItem?.name || selectedSymbol,
      epsActual: lastQ.epsActual,
      epsEstimate: lastQ.epsEstimate,
      surprisePct: lastQ.surprisePct,
      revenueActual: earningsData?.revenueHistory?.[0]?.revenue ?? null,
      revenueEstimate: null,
      quarter: quarterLabel(lastQ.date),
      lang,
    });
  };

  // ── Labels ────────────────────────────────────────────────────────────────
  const label = {
    title:    lang === "ko" ? "실적 Live" : lang === "ja" ? "決算ライブ" : "Earnings Live",
    upcoming: lang === "ko" ? "예정 실적" : lang === "ja" ? "予定" : "Upcoming",
    detail:   lang === "ko" ? "실적 상세" : lang === "ja" ? "詳細" : "Detail",
    ai:       lang === "ko" ? "AI 분석" : lang === "ja" ? "AI分析" : "AI Analysis",
    search:   lang === "ko" ? "종목 검색..." : "Search ticker...",
    eps_actual: lang === "ko" ? "EPS 실적" : "EPS Actual",
    eps_est:    lang === "ko" ? "EPS 추정" : "EPS Estimate",
    surprise:   lang === "ko" ? "서프라이즈" : "Surprise",
    revenue:    lang === "ko" ? "매출" : "Revenue",
    history:    lang === "ko" ? "분기별 실적 히스토리" : "Quarterly Earnings History",
    loading:    lang === "ko" ? "로딩 중..." : "Loading...",
    noData:     lang === "ko" ? "데이터 없음" : "No data",
    refresh:    lang === "ko" ? "새로고침" : "Refresh",
    analyze:    lang === "ko" ? "AI 재분석" : "Re-analyze",
    key_takeaways: lang === "ko" ? "핵심 포인트" : "Key Takeaways",
    guidance:      lang === "ko" ? "가이던스/전망" : "Guidance & Outlook",
    links:         lang === "ko" ? "IR 자료 링크" : "IR Links",
    webcast:       lang === "ko" ? "실적 발표 웹캐스트" : "Earnings Webcast",
    ir_page:       lang === "ko" ? "IR 페이지" : "Investor Relations",
    sec_edgar:     lang === "ko" ? "SEC EDGAR 공시" : "SEC EDGAR Filing",
    yahoo:         lang === "ko" ? "Yahoo Finance 재무제표" : "Yahoo Finance Financials",
    next_earnings: lang === "ko" ? "다음 실적 발표" : "Next Earnings",
    last_earnings: lang === "ko" ? "최근 실적 발표" : "Last Earnings",
    tz_note:       lang === "ko" ? `귀하의 현지 시간 (${tzAbbr})` : `Your local time (${tzAbbr})`,
    no_upcoming:   lang === "ko" ? "예정 실적 없음" : "No upcoming earnings found",
    ai_analyzing:  lang === "ko" ? "AI 분석 중..." : "Analyzing...",
    ai_not_ready:  lang === "ko" ? "최근 실적 데이터가 있으면 자동으로 분석됩니다." : "AI analysis will auto-trigger when recent earnings data is available.",
    rev_chart:     lang === "ko" ? "분기별 매출 (단위: 십억달러)" : "Quarterly Revenue (Billions $)",
    eps_chart:     lang === "ko" ? "분기별 EPS 비교" : "Quarterly EPS Comparison",
  };

  // ── Upcoming Panel ────────────────────────────────────────────────────────
  const UpcomingPanel = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-foreground text-sm">{label.upcoming}</h2>
        <button
          onClick={() => refetchUpcoming()}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
          title={label.refresh}
          data-testid="button-refresh-upcoming"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleManualSearch} className="mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={label.search}
            className="pl-8 h-8 text-xs bg-muted/50"
            data-testid="input-earnings-search"
          />
        </div>
      </form>

      <div className="flex items-center gap-1.5 mb-2">
        <Globe className="w-3 h-3 text-primary" />
        <span className="text-[10px] text-primary font-medium">{label.tz_note}</span>
      </div>

      {upcomingLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filteredUpcoming.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="text-muted-foreground text-xs">{label.no_upcoming}</div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filteredUpcoming.map((item) => {
            const isSelected = item.symbol === selectedSymbol;
            const localDate = toLocalDateLabel(item.nextEarningsDate, userTz, lang);
            const daysUntil = Math.ceil((new Date(item.nextEarningsDate + "T00:00:00").getTime() - Date.now()) / 86400000);
            const isToday = daysUntil === 0;
            const isPast = daysUntil < 0;
            const localName = getLocalizedCompanyName(item.name, lang) || item.name;
            return (
              <button
                key={item.symbol}
                onClick={() => handleSelectSymbol(item.symbol)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl border transition-all duration-150 group",
                  isSelected
                    ? "bg-primary/10 border-primary/40 shadow-[0_0_12px_rgba(34,197,94,0.1)]"
                    : "bg-card border-border hover:bg-muted/60 hover:border-border"
                )}
                data-testid={`button-earnings-${item.symbol}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={cn("font-bold text-xs font-mono", isSelected ? "text-primary" : "text-foreground")}>
                    {item.symbol}
                  </span>
                  {isToday && (
                    <Badge className="text-[9px] px-1.5 py-0 bg-rose-500/20 text-rose-400 border-rose-500/30">
                      TODAY
                    </Badge>
                  )}
                  {isPast && (
                    <Badge className="text-[9px] px-1.5 py-0 bg-muted text-muted-foreground border-border">
                      PAST
                    </Badge>
                  )}
                  <ChevronRight className={cn("w-3 h-3 ml-auto shrink-0 transition-transform", isSelected ? "text-primary rotate-90" : "text-muted-foreground group-hover:translate-x-0.5")} />
                </div>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{localName}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                  <span className="text-[10px] text-muted-foreground">{localDate}</span>
                </div>
                {item.epsEstimate != null && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {lang === "ko" ? "EPS 추정" : "EPS Est"}: <span className="font-mono text-foreground">{formatEps(item.epsEstimate)}</span>
                  </p>
                )}
                {item.marketCap && (
                  <p className="text-[10px] text-muted-foreground">{formatMarketCap(item.marketCap, lang)}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Detail Panel ──────────────────────────────────────────────────────────
  const DetailPanel = () => {
    if (earningsLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (!earningsData) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">{label.noData}</div>
      );
    }

    const lastQ = earningsData.history?.find((h) => h.epsActual != null);
    const surprise = lastQ?.surprisePct;
    const surpriseCls =
      surprise != null && surprise > 0
        ? "border-emerald-500/40 bg-emerald-500/5"
        : surprise != null && surprise < 0
        ? "border-rose-500/40 bg-rose-500/5"
        : "border-border bg-card";

    const upcomingItem = upcomingData?.upcoming?.find((u) => u.symbol === selectedSymbol);
    const localName = upcomingItem ? (getLocalizedCompanyName(upcomingItem.name, lang) || upcomingItem.name) : selectedSymbol;

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className={cn("rounded-2xl border p-4", surpriseCls)}>
          <div className="flex flex-wrap items-start gap-3 justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xl font-bold font-mono text-foreground">{selectedSymbol}</span>
                {liveQuote?.price && (
                  <span className="text-lg font-semibold text-foreground">${Number(liveQuote.price).toFixed(2)}</span>
                )}
                {liveQuote?.changePercent != null && (
                  <span className={cn("text-sm font-semibold", liveQuote.changePercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {liveQuote.changePercent >= 0 ? "+" : ""}{Number(liveQuote.changePercent).toFixed(2)}%
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm mt-0.5">{localName}</p>
            </div>
            {lastQ && (
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground">{label.last_earnings}: {toLocalDateOnly(earningsData.lastEarningsDate, userTz, lang)}</span>
                {surprise != null && (
                  <span className={cn("text-sm font-bold", surprise > 0 ? "text-emerald-400" : surprise < 0 ? "text-rose-400" : "text-amber-400")}>
                    EPS {surprise > 0 ? "▲" : surprise < 0 ? "▼" : "—"} {formatSurprise(surprise)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 4 key stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {[
              { label: label.eps_actual, value: formatEps(lastQ?.epsActual), cls: lastQ?.surprisePct != null && lastQ.surprisePct > 0 ? "text-emerald-400" : lastQ?.surprisePct != null && lastQ.surprisePct < 0 ? "text-rose-400" : "text-foreground" },
              { label: label.eps_est,    value: formatEps(lastQ?.epsEstimate), cls: "text-foreground" },
              { label: label.surprise,   value: formatSurprise(lastQ?.surprisePct), cls: lastQ?.surprisePct != null && lastQ.surprisePct > 0 ? "text-emerald-400 font-bold" : lastQ?.surprisePct != null && lastQ.surprisePct < 0 ? "text-rose-400 font-bold" : "text-foreground" },
              { label: label.revenue,    value: formatRevenue(earningsData.revenueHistory?.[0]?.revenue, lang), cls: "text-foreground" },
            ].map((stat) => (
              <div key={stat.label} className="bg-background/60 rounded-xl border border-border p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">{stat.label}</p>
                <p className={cn("text-base font-bold font-mono", stat.cls)}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Next earnings info */}
          {earningsData.nextEarningsDate && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-background/60 rounded-xl border border-border px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {label.next_earnings}:{" "}
                <span className="text-foreground font-semibold">
                  {toLocalDateLabel(earningsData.nextEarningsDate, userTz, lang)}
                </span>{" "}
                <span className="text-muted-foreground">({tzAbbr})</span>
                {earningsData.nextEpsEstimate != null && (
                  <> · EPS Est: <span className="font-mono text-foreground">{formatEps(earningsData.nextEpsEstimate)}</span></>
                )}
              </span>
            </div>
          )}
        </div>

        {/* EPS Chart */}
        {epsChartData.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="font-semibold text-sm text-foreground mb-3">{label.eps_chart}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={epsChartData} barGap={3} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `$${v}`} />
                <Tooltip content={<EpsTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                <Bar dataKey="Estimate" fill="rgba(148,163,184,0.5)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Actual" radius={[3, 3, 0, 0]}>
                  {epsChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.beat === true ? "#10b981" : entry.beat === false ? "#f43f5e" : "#6366f1"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Revenue Chart */}
        {revChartData.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4">
            <h3 className="font-semibold text-sm text-foreground mb-3">{label.rev_chart}</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={revChartData} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `$${v}B`} />
                <Tooltip formatter={(v: any) => [`$${v}B`, lang === "ko" ? "매출" : "Revenue"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="Revenue" fill="rgba(99,102,241,0.7)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Historical Table */}
        {earningsData.history.length > 0 && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-sm text-foreground">{label.history}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Quarter</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">{label.eps_est}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">{label.eps_actual}</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">{label.surprise}</th>
                    {earningsData.revenueHistory.length > 0 && (
                      <th className="text-right px-4 py-2 text-xs font-semibold text-muted-foreground">{label.revenue}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {earningsData.history.filter((h) => h.epsActual != null).slice(0, 8).map((h, idx) => {
                    const revEntry = earningsData.revenueHistory.find((r) => r.date === h.date);
                    const beat = h.epsActual != null && h.epsEstimate != null ? h.epsActual >= h.epsEstimate : null;
                    return (
                      <tr key={h.date} className={cn("border-b border-border/50", idx === 0 && "bg-primary/5")}>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-foreground">{quarterLabel(h.date)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">{formatEps(h.epsEstimate)}</td>
                        <td className={cn("px-4 py-2.5 text-right font-mono text-xs font-semibold", beat === true ? "text-emerald-400" : beat === false ? "text-rose-400" : "text-foreground")}>
                          {formatEps(h.epsActual)}
                          {beat === true && " ▲"}
                          {beat === false && " ▼"}
                        </td>
                        <td className="px-4 py-2.5 text-right"><SurpriseCell v={h.surprisePct} /></td>
                        {earningsData.revenueHistory.length > 0 && (
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-foreground">{formatRevenue(revEntry?.revenue ?? null, lang)}</td>
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

  // ── AI + Links Panel ──────────────────────────────────────────────────────
  const AiPanel = () => {
    const irLinks = getIRLinks(selectedSymbol);
    const isAnalyzing = analyzeMutation.isPending;
    const lastQ = earningsData?.history?.find((h) => h.epsActual != null);

    return (
      <div className="space-y-4">
        {/* AI Analysis Card */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">{label.ai}</h3>
            </div>
            {lastQ?.epsActual != null && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2.5"
                onClick={handleReAnalyze}
                disabled={isAnalyzing}
                data-testid="button-reanalyze"
              >
                {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                <span className="ml-1">{label.analyze}</span>
              </Button>
            )}
          </div>

          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">{label.ai_analyzing}</p>
            </div>
          )}

          {!isAnalyzing && !aiResult && (
            <div className="py-6 text-center">
              <Brain className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{label.ai_not_ready}</p>
            </div>
          )}

          {!isAnalyzing && aiResult && (
            <div className="space-y-4">
              {/* Verdict */}
              <div className="flex flex-col items-center gap-2 py-3 border border-border rounded-xl bg-muted/20">
                <VerdictBadge verdict={aiResult.verdict} size="lg" />
                <p className="text-xs text-muted-foreground text-center px-3 leading-relaxed">{aiResult.verdictDetail}</p>
              </div>

              {/* Sentiment Meter */}
              <SentimentMeter score={aiResult.sentimentScore} sentiment={aiResult.sentiment} />

              {/* Key Takeaways */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{label.key_takeaways}</h4>
                <ul className="space-y-2">
                  {(aiResult.keyTakeaways || []).map((point, i) => (
                    <li key={i} className="flex gap-2 text-xs text-foreground leading-relaxed">
                      <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Guidance */}
              {aiResult.guidanceOutlook && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <h4 className="text-[10px] font-semibold text-amber-400 mb-1 uppercase tracking-wide">{label.guidance}</h4>
                  <p className="text-xs text-foreground leading-relaxed">{aiResult.guidanceOutlook}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* IR Links */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">{label.links}</h3>
          </div>
          <div className="space-y-2">
            {irLinks.webcast && (
              <a href={irLinks.webcast} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/40 hover:bg-primary/10 hover:text-primary transition-colors text-xs group border border-transparent hover:border-primary/20"
                data-testid="link-webcast">
                <Mic className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="text-foreground group-hover:text-primary">{label.webcast}</span>
                <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
              </a>
            )}
            {irLinks.ir && (
              <a href={irLinks.ir} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/40 hover:bg-primary/10 hover:text-primary transition-colors text-xs group border border-transparent hover:border-primary/20"
                data-testid="link-ir-page">
                <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-foreground group-hover:text-primary">{label.ir_page}</span>
                <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
              </a>
            )}
            <a href={`https://finance.yahoo.com/quote/${selectedSymbol}/financials/`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/40 hover:bg-primary/10 hover:text-primary transition-colors text-xs group border border-transparent hover:border-primary/20"
              data-testid="link-yahoo">
              <BarChart2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="text-foreground group-hover:text-primary">{label.yahoo}</span>
              <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
            </a>
            <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${selectedSymbol}&type=10-Q&dateb=&owner=include&count=10`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/40 hover:bg-primary/10 hover:text-primary transition-colors text-xs group border border-transparent hover:border-primary/20"
              data-testid="link-sec">
              <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-foreground group-hover:text-primary">{label.sec_edgar}</span>
              <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
            </a>
          </div>
        </div>

        {/* Timezone validation note */}
        <div className="bg-muted/30 rounded-xl border border-border p-3">
          <div className="flex items-start gap-2">
            <Globe className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <div className="text-[10px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">{label.tz_note}</span>
              <br />
              {lang === "ko"
                ? `미국 동부 기준 오후 4:00 (ET) = ${getTzAbbr("Asia/Seoul")} 오전 5:00 (EDT 기준 / 다음날)`
                : `4:00 PM ET = ${tzAbbr} ${toLocalDateLabel(new Date().toISOString().slice(0, 10), userTz, lang)}`}
              <br />
              <span className="text-primary">
                {lang === "ko" ? "Intl.DateTimeFormat으로 DST 자동 처리됨" : "DST handled automatically via Intl.DateTimeFormat"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Mobile tab bar ────────────────────────────────────────────────────────
  const mobileTabs: { id: MobileTab; label: string }[] = [
    { id: "upcoming", label: label.upcoming },
    { id: "detail",   label: label.detail },
    { id: "ai",       label: label.ai },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <div className="px-4 md:px-8 pt-6 pb-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{label.title}</h1>
            <p className="text-xs text-muted-foreground">
              {lang === "ko"
                ? `실시간 실적 발표 · AI 분석 · ${tzAbbr} 시간대`
                : `Real-time earnings · AI analysis · ${tzAbbr} timezone`}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] text-primary bg-primary/10 rounded-full px-2.5 py-1 border border-primary/20">
            <Globe className="w-3 h-3" />
            {tzAbbr}
          </div>
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex border-b border-border bg-card">
        {mobileTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMobileTab(tab.id)}
            className={cn(
              "flex-1 py-3 text-xs font-semibold transition-colors",
              mobileTab === tab.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            )}
            data-testid={`tab-earnings-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop: 3-column layout */}
      <div className="hidden md:grid md:grid-cols-[280px_1fr_320px] h-[calc(100vh-97px)] overflow-hidden">
        {/* Left: Upcoming */}
        <div className="border-r border-border p-4 overflow-y-auto">
          <UpcomingPanel />
        </div>
        {/* Center: Detail */}
        <div className="overflow-y-auto p-6">
          <DetailPanel />
        </div>
        {/* Right: AI + Links */}
        <div className="border-l border-border p-4 overflow-y-auto">
          <AiPanel />
        </div>
      </div>

      {/* Mobile: Tabbed content */}
      <div className="md:hidden px-4 py-4 overflow-y-auto min-h-[calc(100vh-160px)]">
        {mobileTab === "upcoming" && <UpcomingPanel />}
        {mobileTab === "detail" && <DetailPanel />}
        {mobileTab === "ai" && <AiPanel />}
      </div>
    </div>
  );
}
