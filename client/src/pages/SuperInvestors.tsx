import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Briefcase, Info, TrendingUp, TrendingDown, Minus,
  PieChart as PieChartIcon, List, Search, Globe,
  RefreshCw, CheckCircle2, ExternalLink, AlertCircle, FileText, CircleDot,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import type { SuperInvestor, InvestorCategory } from "@shared/super-investor";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  KO_COMPANY_NAMES,
  KO_INVESTOR_NAMES,
  KO_SECTOR_NAMES,
  getLocalizedCompanyName,
} from "@/lib/stockNames";

// Real 13F data shape from SEC EDGAR
interface Real13FHolding {
  rank: number;
  ticker: string;
  company: string;
  cusip: string;
  value: number;
  shares: number;
  weight: number;
  putCall: string;
}
interface Real13FData {
  investorId: string;
  cik: string;
  entityName: string;
  periodOfReport: string;
  filingDate: string;
  lastSynced: string;
  totalValueUSD: number;
  holdingCount: number;
  holdings: Real13FHolding[];
  source: string;
  fromDB: boolean;
  isStaleData?: boolean;
  notSynced?: boolean;
}

const CATEGORY_LABELS: Record<InvestorCategory | "all", { en: string; ko: string; emoji: string }> = {
  all:      { en: "All",           ko: "전체",      emoji: "🌐" },
  value:    { en: "Value",         ko: "가치",      emoji: "💎" },
  growth:   { en: "Growth",        ko: "성장",      emoji: "🚀" },
  macro:    { en: "Macro",         ko: "매크로",    emoji: "🌍" },
  hedge:    { en: "Hedge Fund",    ko: "헤지펀드",  emoji: "⚡" },
  activist: { en: "Activist",      ko: "행동주의",  emoji: "📣" },
  sovereign:{ en: "Sovereign Fund",ko: "국부펀드",  emoji: "🏛️" },
  index:    { en: "Index / Passive",ko: "인덱스",   emoji: "📊" },
};

const POPULARITY_ORDER = [
  "buffett", "dalio", "wood", "burry", "ackman",
  "soros", "druckenmiller", "simons", "griffin", "cohen",
  "loeb", "singer", "englander", "klarman", "icahn",
  "einhorn", "pabrai", "miller", "coleman",
  "blackrock", "vanguard", "statestreet", "fidelity", "troweprice",
  "nps", "gpif", "nbim", "gic", "temasek", "calpers", "adia", "pif",
];

function getInvestorDisplayName(name: string, lang: string): string {
  if (lang === "ko" && KO_INVESTOR_NAMES[name]) return KO_INVESTOR_NAMES[name];
  return name;
}

function getCompanyName(company: string, lang: string): string {
  return getLocalizedCompanyName(company, lang);
}

function getSectorName(sector: string, lang: string): string {
  if (lang === "ko" && KO_SECTOR_NAMES[sector]) return KO_SECTOR_NAMES[sector];
  return sector;
}

function getCategoryLabel(category: string | undefined): { en: string; ko: string; emoji: string } {
  return CATEGORY_LABELS[category as InvestorCategory] ?? CATEGORY_LABELS["value"];
}

function formatAum(aum: number, aumUnit: string, lang: string, krwRate: number): string {
  let usdBillions: number;
  if (aumUnit === "T₩") {
    usdBillions = (aum * 1000) / krwRate;
  } else if (aumUnit === "T¥") {
    usdBillions = (aum * 1000) / 150;
  } else {
    usdBillions = aum;
  }

  if (lang === "ko") {
    if (aumUnit === "T₩") {
      return aum >= 1000
        ? `${aum.toLocaleString()}조 원`
        : `${aum}조 원`;
    }
    if (aumUnit === "T¥") {
      return `${aum}조 엔`;
    }
    const krwTotal = usdBillions * 1e9 * krwRate;
    const jo = Math.floor(krwTotal / 1e12);
    const eok = Math.floor((krwTotal % 1e12) / 1e8);
    if (jo >= 10000) return `약 ${(jo / 10000).toFixed(1)}경 원`;
    if (jo >= 100) return `약 ${Math.round(jo / 100) * 100}조 원`;
    if (jo >= 1) return eok >= 100 ? `약 ${jo}조 ${Math.round(eok / 100) * 100}억 원` : `약 ${jo}조 원`;
    return `약 ${Math.round(krwTotal / 1e8)}억 원`;
  }

  if (aumUnit === "T₩" || aumUnit === "T¥") {
    const rounded = Math.round(usdBillions);
    return rounded >= 1000 ? `$${(rounded / 1000).toFixed(1)}T` : `$${rounded}B`;
  }
  return aum >= 1000 ? `$${(aum / 1000).toFixed(1)}T` : `$${aum}B`;
}

// Format a USD value in the user's preferred display currency
function formatValueUSD(usd: number, lang: string, krwRate: number, jpyRate = 155): string {
  if (lang === "ko") {
    const krw = usd * krwRate;
    const jo = Math.floor(krw / 1e12);
    const eok = Math.floor((krw % 1e12) / 1e8);
    if (jo >= 10000) return `약 ${(jo / 10000).toFixed(1)}경 원`;
    if (jo >= 1000) return `약 ${Math.round(jo / 100) * 100}조 원`;
    if (jo >= 100) return `약 ${Math.round(jo / 10) * 10}조 원`;
    if (jo >= 1) return eok >= 100 ? `약 ${jo}조 ${Math.round(eok / 100) * 100}억 원` : `약 ${jo}조 원`;
    const eokOnly = Math.floor(krw / 1e8);
    if (eokOnly >= 1) return `약 ${eokOnly.toLocaleString("ko-KR")}억 원`;
    return `약 ${Math.round(krw / 1e4).toLocaleString("ko-KR")}만 원`;
  }
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
  return `$${Math.round(usd).toLocaleString()}`;
}

export default function SuperInvestors() {
  const { data: user } = useUser();
  const lang = (user?.language || "ko") as keyof typeof translations;
  const t = translations[lang];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<InvestorCategory | "all">("all");
  const [whyDialogHolding, setWhyDialogHolding] = useState<{
    ticker: string; company: string; en: string; ko: string;
  } | null>(null);

  const { data: investors, isLoading } = useQuery<SuperInvestor[]>({
    queryKey: ["/api/super-investors"],
  });

  const { data: exchangeRateData } = useQuery<{ rate: number }>({
    queryKey: ["/api/exchange-rate"],
  });
  const krwRate = exchangeRateData?.rate ?? 1440;

  const selectedInvestor = investors?.find((inv) => inv.id === selectedId);

  // Real SEC EDGAR 13F data — served instantly from DB; never auto-fetches from SEC on user click
  const {
    data: real13F,
    isLoading: isLoading13F,
    isError: isError13F,
    refetch: refetch13F,
  } = useQuery<Real13FData>({
    queryKey: ["/api/13f", selectedId],
    queryFn: async () => {
      if (!selectedId) throw new Error("No investor selected");
      const res = await fetch(`/api/13f/${selectedId}`, { credentials: "include" });
      if (!res.ok && res.status !== 202) throw new Error(`13F fetch failed: ${res.status}`);
      const json = await res.json();
      return json as Real13FData;
    },
    enabled: !!selectedId,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      await apiRequest("POST", `/api/13f-sync/${selectedId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/13f", selectedId] });
      refetch13F();
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/13f-sync-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/13f"] });
    },
  });

  const filteredInvestors = useMemo(() => {
    if (!investors) return [];
    return investors
      .filter((inv) => {
        const matchesCategory = activeCategory === "all" || inv.category === activeCategory;
        if (!matchesCategory) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const nameMatch = inv.name.toLowerCase().includes(q);
        const koNameMatch = KO_INVESTOR_NAMES[inv.name]?.toLowerCase().includes(q) ?? false;
        const firmMatch = inv.firm.toLowerCase().includes(q);
        const holdingMatch = inv.holdings.some(
          (h) => h.ticker.toLowerCase().includes(q) || h.company.toLowerCase().includes(q)
        );
        return nameMatch || koNameMatch || firmMatch || holdingMatch;
      })
      .sort((a, b) => {
        const ai = POPULARITY_ORDER.indexOf(a.id);
        const bi = POPULARITY_ORDER.indexOf(b.id);
        const aRank = ai === -1 ? 999 : ai;
        const bRank = bi === -1 ? 999 : bi;
        return aRank - bRank;
      });
  }, [investors, activeCategory, searchQuery]);

  // Determine if the selected investor has a CIK mapping (i.e., should have SEC 13F data).
  // When notSynced=true for a CIK-mapped investor, we must NOT fall back to static data.
  // We infer this from the API response: 404 = no CIK, 202 = notSynced, 200 = data.
  const investorHasCIK = !isError13F; // 404 means no CIK; anything else means CIK exists

  // Determine if data is significantly outdated (more than 15 months old)
  const isDataOutdated = real13F && !real13F.notSynced && !!real13F.periodOfReport && (() => {
    const period = new Date(real13F.periodOfReport);
    const fifteenMonthsAgo = new Date();
    fifteenMonthsAgo.setMonth(fifteenMonthsAgo.getMonth() - 15);
    return period < fifteenMonthsAgo;
  })();

  // Merge real SEC EDGAR data with static editorial commentary (whyTheyBought).
  // PRINCIPLE: "Wrong Data = Zero Data"
  // • If a CIK-mapped investor hasn't been synced yet → return [] (show "Verifying" state)
  // • If no CIK (isError13F / sovereign funds etc.) → return static curated holdings
  // • If synced with real data → return real data merged with editorial commentary
  const effectiveHoldings = useMemo(() => {
    if (!selectedInvestor) return [];

    // CIK-mapped investor but not yet synced → "Verifying Data..." state (no static fallback)
    if (investorHasCIK && (!real13F || real13F.notSynced)) return [];

    // No CIK / non-SEC investor (sovereign funds, index funds) → show curated static data
    if (!real13F || real13F.notSynced || !real13F.holdings?.length) return selectedInvestor.holdings;

    // Real DB-sourced 13F data — merge with editorial commentary for "why they bought"
    const staticByTicker = new Map(
      selectedInvestor.holdings.map((h) => [h.ticker.toUpperCase(), h])
    );

    return real13F.holdings.map((rh) => {
      const staticMatch = staticByTicker.get(rh.ticker.toUpperCase());
      const koName = getLocalizedCompanyName(rh.company, "ko");
      const displayName = rh.ticker || rh.cusip;
      const valueM = (rh.value / 1000).toFixed(1);
      return {
        ticker: displayName,
        company: rh.company,
        sector: staticMatch?.sector || (rh.putCall ? "Options" : "Equity"),
        shares: rh.shares,
        weight: rh.weight,
        change: (staticMatch?.change || "Held") as "Bought" | "Sold" | "Held" | "New",
        changePct: staticMatch?.changePct ?? null,
        whyTheyBoughtEn: staticMatch?.whyTheyBoughtEn ||
          `${rh.company} represents ${rh.weight}% of the portfolio with a $${valueM}M position (${rh.shares.toLocaleString()} shares). Source: SEC EDGAR 13F-HR (verified), CUSIP ${rh.cusip}.`,
        whyTheyBoughtKo: staticMatch?.whyTheyBoughtKo ||
          `${koName}(${displayName})는 포트폴리오의 ${rh.weight}%를 차지하며 $${valueM}M 포지션 (${rh.shares.toLocaleString()}주)입니다. 출처: SEC EDGAR 13F-HR 검증 데이터, CUSIP ${rh.cusip}.`,
        _isRealData: true,
        _cusip: rh.cusip,
        _valueUSD: rh.value,
        _putCall: rh.putCall,
      };
    });
  }, [selectedInvestor, real13F, investorHasCIK]);

  const displayedHoldings = useMemo(() => {
    return effectiveHoldings;
  }, [effectiveHoldings]);

  // Tickers for live price fetching — US-style tickers (batch 1); KRX/JPN fetched separately below
  const liveQuoteTickers = useMemo(() => {
    if (!effectiveHoldings.length) return [];
    return effectiveHoldings
      .slice(0, 25)
      .map((h) => h.ticker)
      .filter((t) => t && !t.includes("CUSIP") && !t.endsWith(".KS") && !t.endsWith(".T") && !t.endsWith(".TI"));
  }, [effectiveHoldings]);

  const liveQuoteLocalTickers = useMemo(() => {
    if (!effectiveHoldings.length) return [];
    return effectiveHoldings
      .slice(0, 25)
      .map((h) => h.ticker)
      .filter((t) => t && (t.endsWith(".KS") || t.endsWith(".T")));
  }, [effectiveHoldings]);

  const { data: liveQuoteData } = useQuery<{ quotes: { symbol: string; price: number; isStale: boolean }[] }>({
    queryKey: ["/api/stocks/quotes", liveQuoteTickers.join(",")],
    queryFn: async () => {
      if (!liveQuoteTickers.length) return { quotes: [] };
      const res = await fetch(`/api/stocks/quotes?symbols=${liveQuoteTickers.join(",")}`, { credentials: "include" });
      if (!res.ok) return { quotes: [] };
      return res.json();
    },
    enabled: !!liveQuoteTickers.length && !!selectedId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: liveQuoteLocalData } = useQuery<{ quotes: { symbol: string; price: number; isStale: boolean }[] }>({
    queryKey: ["/api/stocks/quotes", liveQuoteLocalTickers.join(",")],
    queryFn: async () => {
      if (!liveQuoteLocalTickers.length) return { quotes: [] };
      const res = await fetch(`/api/stocks/quotes?symbols=${liveQuoteLocalTickers.join(",")}`, { credentials: "include" });
      if (!res.ok) return { quotes: [] };
      return res.json();
    },
    enabled: !!liveQuoteLocalTickers.length && !!selectedId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Map ticker → current price for quick lookups
  const livePriceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of liveQuoteData?.quotes ?? []) {
      if (q.price > 0) m.set(q.symbol.toUpperCase(), q.price);
    }
    for (const q of liveQuoteLocalData?.quotes ?? []) {
      if (q.price > 0) m.set(q.symbol.toUpperCase(), q.price);
    }
    return m;
  }, [liveQuoteData, liveQuoteLocalData]);

  // Estimated current portfolio value (live prices × share counts, + priceApprox fallback for KRX/JPN)
  const estimatedCurrentValueUSD = useMemo(() => {
    if (!effectiveHoldings.length) return null;
    let total = 0;
    let covered = 0;
    for (const h of effectiveHoldings) {
      const ticker = h.ticker.toUpperCase();
      const livePrice = livePriceMap.get(ticker);
      const priceApprox = (h as any).priceApprox as number | undefined;
      const isKRX = h.ticker.endsWith(".KS");
      const isJPN = h.ticker.endsWith(".T");

      if (livePrice && livePrice > 0 && h.shares > 0) {
        // KRX live prices are in KRW, JPN in JPY — convert to USD
        const usdVal = isKRX
          ? (livePrice * h.shares) / krwRate
          : isJPN
          ? (livePrice * h.shares) / 155
          : livePrice * h.shares;
        total += usdVal;
        covered++;
      } else if (priceApprox && priceApprox > 0 && h.shares > 0) {
        // Convert local currency to USD for KRX/JPN holdings
        const usdVal = isKRX
          ? (priceApprox * h.shares) / krwRate
          : isJPN
          ? (priceApprox * h.shares) / 155
          : priceApprox * h.shares;
        total += usdVal;
        covered++;
      }
    }
    // Only return if we have prices for ≥3 holdings (to avoid misleading partial estimates)
    return covered >= 3 ? { value: total, coveredCount: covered, totalCount: effectiveHoldings.length } : null;
  }, [livePriceMap, effectiveHoldings, krwRate]);

  // Coverage scope label for 13F vs sovereign funds
  const coverageScopeNote = useMemo(() => {
    if (!selectedInvestor) return null;
    if (real13F && !real13F.notSynced) {
      return {
        en: `US-listed equities only (SEC 13F). Total AUM may be higher — includes non-US holdings, bonds, private equity, and cash not required to be disclosed.`,
        ko: `미국 상장 주식만 포함 (SEC 13F 공시). 실제 운용 자산은 더 클 수 있음 — 비미국 보유 종목, 채권, 사모 펀드, 현금은 13F 공시 대상 아님.`,
      };
    }
    if (selectedInvestor.category === "sovereign" || selectedInvestor.category === "index") {
      return {
        en: `Displayed holdings are key positions from official disclosures. Total AUM (${formatAum(selectedInvestor.aum, selectedInvestor.aumUnit, "en", krwRate)}) includes domestic equities, foreign equities, bonds, and alternatives across all markets.`,
        ko: `표시된 보유 종목은 공식 공시의 주요 포지션입니다. 총 운용 자산 (${formatAum(selectedInvestor.aum, selectedInvestor.aumUnit, "ko", krwRate)})은 국내외 주식, 채권, 대체 자산 등 모든 시장을 포함합니다.`,
      };
    }
    return null;
  }, [selectedInvestor, real13F, krwRate]);

  const categoryKeys: (InvestorCategory | "all")[] = [
    "all", "value", "growth", "macro", "hedge", "activist", "sovereign", "index"
  ];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-10 w-64 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Why They Bought Dialog */}
      <Dialog open={!!whyDialogHolding} onOpenChange={() => setWhyDialogHolding(null)}>
        <DialogContent className="max-w-md rounded-2xl border-2">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Info className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  {lang === "ko" ? "매수 이유" : "Why They Bought"}
                </DialogTitle>
                <p className="text-xs font-mono text-muted-foreground">
                  {whyDialogHolding?.ticker} · {whyDialogHolding ? getCompanyName(whyDialogHolding.company, lang) : ""}
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
              <p className="text-sm leading-relaxed text-foreground">
                {lang === "ko" ? whyDialogHolding?.ko : whyDialogHolding?.en}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              {lang === "ko"
                ? "* 교육 목적의 투자 철학 해설입니다. 투자 조언이 아닙니다."
                : "* Educational investment philosophy summary. Not financial advice."}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <AnimatePresence mode="wait">
        {!selectedId ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
                  <Briefcase className="w-8 h-8 text-primary" />
                  {t.super_investors}
                </h1>
                <p className="text-muted-foreground mt-2 max-w-2xl">
                  {t.super_investors_desc}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2 border-2 font-bold"
                onClick={() => syncAllMutation.mutate()}
                disabled={syncAllMutation.isPending}
                data-testid="button-sync-all-13f"
                title={lang === "ko" ? "모든 투자자의 SEC EDGAR 13F 데이터를 DB에 동기화" : "Sync all investors' 13F data from SEC EDGAR to DB"}
              >
                <RefreshCw className={`w-4 h-4 ${syncAllMutation.isPending ? "animate-spin" : ""}`} />
                {syncAllMutation.isPending
                  ? (lang === "ko" ? "동기화 중..." : "Syncing...")
                  : (lang === "ko" ? "전체 데이터 동기화" : "Sync All Data")}
              </Button>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={lang === "ko" ? "투자자명, 회사명, 종목 검색..." : "Search investors, firms, or tickers..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 rounded-xl border-2 bg-background"
                data-testid="input-investor-search"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap gap-2">
              {categoryKeys.map((cat) => {
                const label = CATEGORY_LABELS[cat];
                const count = cat === "all"
                  ? investors?.length ?? 0
                  : investors?.filter((i) => i.category === cat).length ?? 0;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    data-testid={`filter-${cat}`}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${
                      activeCategory === cat
                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                        : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <span>{label.emoji}</span>
                    <span>{lang === "ko" ? label.ko : label.en}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      activeCategory === cat ? "bg-white/20" : "bg-muted"
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Results Count */}
            <p className="text-sm text-muted-foreground font-medium">
              {lang === "ko"
                ? `${filteredInvestors.length}명의 투자자`
                : `${filteredInvestors.length} investor${filteredInvestors.length !== 1 ? "s" : ""}`}
              {searchQuery && (
                <span className="ml-1 text-primary">
                  {lang === "ko" ? `"${searchQuery}" 검색 결과` : `for "${searchQuery}"`}
                </span>
              )}
            </p>

            {/* Investor Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredInvestors.map((investor) => (
                <Card
                  key={investor.id}
                  className="group hover:border-primary/50 transition-all cursor-pointer overflow-hidden border-2 hover:shadow-lg"
                  onClick={() => { setSelectedId(investor.id); setShowAllHoldings(false); }}
                  data-testid={`card-investor-${investor.id}`}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-lg flex-shrink-0"
                        style={{ backgroundColor: investor.avatarColor }}
                      >
                        {investor.initials}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base group-hover:text-primary transition-colors leading-tight truncate">
                          {getInvestorDisplayName(investor.name, lang)}
                        </CardTitle>
                        <CardDescription className="font-medium text-xs leading-tight line-clamp-2">
                          {investor.firm}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                            {t.portfolio_value}
                          </p>
                          <p className="text-xl font-display font-bold text-primary">
                            {formatAum(investor.aum, investor.aumUnit, lang, krwRate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary text-[10px]">
                            {investor.country}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-muted"
                            style={{ backgroundColor: investor.avatarColor + "15", color: investor.avatarColor }}
                          >
                            {lang === "ko"
                              ? getCategoryLabel(investor.category).ko
                              : getCategoryLabel(investor.category).en}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(lang === "ko" ? investor.styleTagsKo : investor.styleTagsEn).slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] font-bold uppercase tracking-tighter">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Button className="w-full rounded-xl font-bold" data-testid={`button-view-${investor.id}`}>
                        {t.view_portfolio}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredInvestors.length === 0 && (
              <div className="text-center py-16">
                <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-bold text-muted-foreground">
                  {lang === "ko" ? "검색 결과가 없습니다." : "No investors found."}
                </p>
                <Button variant="ghost" onClick={() => { setSearchQuery(""); setActiveCategory("all"); }} className="mt-3">
                  {lang === "ko" ? "필터 초기화" : "Clear filters"}
                </Button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <Button
              variant="ghost"
              onClick={() => setSelectedId(null)}
              className="group -ml-2 text-muted-foreground hover:text-primary transition-colors"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              {t.back}
            </Button>

            {selectedInvestor && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Section */}
                <div className="lg:col-span-1 space-y-6">
                  <Card className="border-2 shadow-xl overflow-hidden">
                    <div
                      className="h-32 w-full relative"
                      style={{ backgroundColor: selectedInvestor.avatarColor + "20" }}
                    >
                      <div className="absolute -bottom-10 left-6">
                        <div
                          className="w-24 h-24 rounded-3xl flex items-center justify-center text-3xl font-bold text-white shadow-2xl border-4 border-card"
                          style={{ backgroundColor: selectedInvestor.avatarColor }}
                        >
                          {selectedInvestor.initials}
                        </div>
                      </div>
                    </div>
                    <CardHeader className="pt-14 pb-4">
                      <CardTitle className="text-xl leading-tight">
                        {getInvestorDisplayName(selectedInvestor.name, lang)}
                      </CardTitle>
                      <CardDescription className="text-base font-semibold text-primary leading-tight">
                        {selectedInvestor.firm}
                      </CardDescription>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary text-xs">
                          {selectedInvestor.country}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{ backgroundColor: selectedInvestor.avatarColor + "15", color: selectedInvestor.avatarColor, borderColor: selectedInvestor.avatarColor + "40" }}
                        >
                          {getCategoryLabel(selectedInvestor.category).emoji}{" "}
                          {lang === "ko"
                            ? getCategoryLabel(selectedInvestor.category).ko
                            : getCategoryLabel(selectedInvestor.category).en}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <h4 className="text-sm font-bold uppercase text-muted-foreground">{t.biography}</h4>
                        <p className="text-sm leading-relaxed text-foreground/80">
                          {lang === "ko" ? selectedInvestor.biographyKo : selectedInvestor.biographyEn}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-bold uppercase text-muted-foreground">{t.investment_style}</h4>
                        <p className="text-sm leading-relaxed text-foreground/80 p-3 bg-muted rounded-xl border border-border/50 italic">
                          "{lang === "ko" ? selectedInvestor.styleKo : selectedInvestor.styleEn}"
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(lang === "ko" ? selectedInvestor.styleTagsKo : selectedInvestor.styleTagsEn).map((tag) => (
                          <Badge key={tag} className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-3 py-1">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Portfolio Content */}
                <div className="lg:col-span-2 space-y-8">
                  {/* SEC EDGAR Data Status Banner */}
                  {isLoading13F && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 text-sm font-medium">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {lang === "ko" ? "DB에서 13F 데이터 로드 중…" : "Loading 13F data from DB…"}
                    </div>
                  )}
                  {!isLoading13F && real13F?.notSynced && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 overflow-hidden">
                      <div className="flex items-center justify-between gap-2 px-4 py-3">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-bold">
                          <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
                          {lang === "ko"
                            ? "데이터 검증 중… (SEC EDGAR 13F 동기화 필요)"
                            : "Verifying Data… (SEC EDGAR 13F sync required)"}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-3 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-bold shrink-0"
                          onClick={() => syncMutation.mutate()}
                          disabled={syncMutation.isPending}
                          data-testid="button-sync-13f-investor"
                        >
                          <RefreshCw className={`w-3 h-3 mr-1.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                          {syncMutation.isPending
                            ? (lang === "ko" ? "동기화 중..." : "Syncing...")
                            : (lang === "ko" ? "지금 동기화" : "Sync Now")}
                        </Button>
                      </div>
                      <div className="px-4 py-2 bg-amber-500/5 border-t border-amber-500/15 text-[11px] text-amber-700 dark:text-amber-400">
                        {lang === "ko"
                          ? "정확한 데이터가 DB에 저장될 때까지 포트폴리오를 표시하지 않습니다. 잘못된 데이터는 표시하지 않습니다."
                          : "Portfolio will not be shown until verified data is stored in the DB. Wrong data = zero data."}
                      </div>
                    </div>
                  )}
                  {!isLoading13F && real13F && !real13F.notSynced && isDataOutdated && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-400 text-xs font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        {lang === "ko"
                          ? `⚠️ 최신 공시: ${real13F.periodOfReport} (공시 일자: ${real13F.filingDate}) — SEC EDGAR에 최신 13F 제출이 없을 수 있습니다`
                          : `⚠️ Latest available filing: ${real13F.periodOfReport} (filed ${real13F.filingDate}) — this fund may not have filed a more recent 13F-HR with the SEC`}
                      </span>
                    </div>
                  )}
                  {!isLoading13F && real13F && !real13F.notSynced && (
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 overflow-hidden">
                      {/* Main info row */}
                      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          {lang === "ko" ? (
                            <>DB 검증 데이터 · {real13F.holdingCount}개 종목{real13F.isStaleData ? " · 갱신 권장" : ""}</>
                          ) : (
                            <>Verified DB Data · {real13F.holdingCount} holdings{real13F.isStaleData ? " · refresh recommended" : ""}</>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${real13F.cik}&type=13F-HR&dateb=&owner=include&count=10`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline"
                            data-testid="link-sec-edgar"
                          >
                            <ExternalLink className="w-3 h-3" />
                            SEC.gov
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[11px] px-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => syncMutation.mutate()}
                            disabled={syncMutation.isPending}
                            data-testid="button-refresh-13f"
                          >
                            <RefreshCw className={`w-3 h-3 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                            {lang === "ko" ? "재동기화" : "Re-sync"}
                          </Button>
                        </div>
                      </div>
                      {/* Filing metadata row — the three verified data points */}
                      <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-emerald-500/5 border-t border-emerald-500/15 text-[11px] text-emerald-700 dark:text-emerald-400">
                        <span className="flex items-center gap-1">
                          <span className="font-bold">{lang === "ko" ? "보고서 기준일:" : "Report Period:"}</span>
                          <span className="font-mono font-semibold">{real13F.periodOfReport}</span>
                        </span>
                        <span className="opacity-40">·</span>
                        <span className="flex items-center gap-1">
                          <span className="font-bold">{lang === "ko" ? "공시 일자:" : "Filed:"}</span>
                          <span className="font-mono font-semibold">{real13F.filingDate}</span>
                        </span>
                        <span className="opacity-40">·</span>
                        <span className="flex items-center gap-1">
                          <span className="font-bold">{lang === "ko" ? "DB 동기화:" : "DB Synced:"}</span>
                          <span className="font-mono">
                            {real13F.lastSynced
                              ? new Date(real13F.lastSynced).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" })
                              : "—"}
                          </span>
                        </span>
                        <span className="opacity-40">·</span>
                        <span className="flex items-center gap-1">
                          <span className="font-bold">{lang === "ko" ? "출처:" : "Source:"}</span>
                          <span>{lang === "ko" ? "SEC EDGAR 13F 검증 데이터" : "SEC EDGAR 13F-HR (verified)"}</span>
                        </span>
                      </div>
                    </div>
                  )}
                  {!isLoading13F && isError13F && selectedInvestor && (
                    (selectedInvestor.category === "sovereign" || (selectedInvestor.category === "index" && !["blackrock","vanguard","statestreet","fidelity","troweprice"].includes(selectedInvestor.id))) ? (
                      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5">
                          <FileText className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
                            {lang === "ko" ? "공식 공시 데이터 (SEC 13F 미해당 기관)" : "Official Disclosure Data (Non-13F Institution)"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-blue-500/5 border-t border-blue-500/15 text-[11px] text-blue-700 dark:text-blue-400">
                          <span className="flex items-center gap-1">
                            <span className="font-bold">{lang === "ko" ? "데이터 출처:" : "Source:"}</span>
                            <span>{selectedInvestor.dataSource || selectedInvestor.filingType}</span>
                          </span>
                          {selectedInvestor.dataSourceUrl && (
                            <>
                              <span className="opacity-40">·</span>
                              <a
                                href={selectedInvestor.dataSourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 hover:underline font-semibold"
                                data-testid="link-official-disclosure"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {lang === "ko" ? "공식 사이트" : "Official Source"}
                              </a>
                            </>
                          )}
                          <span className="opacity-40">·</span>
                          <span className="flex items-center gap-1">
                            <span className="font-bold">{lang === "ko" ? "최종 갱신:" : "Updated:"}</span>
                            <span>{selectedInvestor.lastUpdated}</span>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {lang === "ko"
                          ? "SEC EDGAR 데이터 로드 실패 — 저장된 데이터를 표시합니다. 이 투자자는 13F 공시 의무가 없거나 미국 주식 보유량이 기준 이하일 수 있습니다."
                          : "Could not load SEC data — showing curated static holdings. This investor may not be required to file 13F with the SEC (e.g. non-US managers or AUM below threshold)."}
                      </div>
                    )
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* ── Portfolio Value Card ── */}
                    <Card className="bg-primary text-primary-foreground border-none shadow-lg">
                      <CardContent className="pt-5 pb-4">
                        {/* Top: Filing-date value */}
                        <p className="text-xs font-bold uppercase opacity-70 tracking-wider">
                          {real13F && !real13F.notSynced
                            ? (lang === "ko" ? "공시 기준 포트폴리오 가치" : "Portfolio Value (Filing Date)")
                            : (lang === "ko" ? "총 운용 자산 (AUM)" : "Total AUM")}
                        </p>
                        <p className="text-4xl font-display font-bold mt-1 leading-none">
                          {real13F && !real13F.notSynced
                            ? formatValueUSD(real13F.totalValueUSD * 1000, lang, krwRate)
                            : formatAum(selectedInvestor.aum, selectedInvestor.aumUnit, lang, krwRate)}
                        </p>
                        <p className="text-[11px] opacity-60 mt-1">
                          {real13F && !real13F.notSynced
                            ? (lang === "ko" ? `${real13F.periodOfReport} 기준 · 공시 일자: ${real13F.filingDate}` : `As of ${real13F.periodOfReport} · Filed ${real13F.filingDate}`)
                            : (lang === "ko" ? `${selectedInvestor.lastUpdated} 기준` : `As of ${selectedInvestor.lastUpdated}`)}
                        </p>

                        {/* Divider */}
                        {estimatedCurrentValueUSD && (
                          <div className="mt-3 pt-3 border-t border-white/20">
                            <p className="text-[10px] font-bold uppercase opacity-70 tracking-wider">
                              {lang === "ko" ? "실시간 추정 현재가치" : "Est. Current Market Value"}
                            </p>
                            <p className="text-2xl font-display font-bold mt-0.5 opacity-95">
                              {formatValueUSD(estimatedCurrentValueUSD.value, lang, krwRate)}
                            </p>
                            <p className="text-[10px] opacity-55 mt-0.5">
                              {lang === "ko"
                                ? `현재가 × 보유주수 (${estimatedCurrentValueUSD.coveredCount}/${estimatedCurrentValueUSD.totalCount}개 종목)`
                                : `Live price × shares held (${estimatedCurrentValueUSD.coveredCount}/${estimatedCurrentValueUSD.totalCount} positions)`}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* ── Report Period / Coverage Card ── */}
                    <Card className="border-2">
                      <CardContent className="pt-5 pb-4">
                        <p className="text-sm font-bold uppercase text-muted-foreground">
                          {lang === "ko" ? "보고서 기준일" : "Report Period"}
                        </p>
                        <p className="text-2xl font-display font-bold text-foreground mt-1">
                          {real13F && !real13F.notSynced ? real13F.periodOfReport : selectedInvestor.lastUpdated}
                        </p>
                        <p className="text-xs text-muted-foreground font-medium mt-1">
                          {real13F && !real13F.notSynced
                            ? (lang === "ko" ? `공시 일자: ${real13F.filingDate}` : `Filed: ${real13F.filingDate}`)
                            : selectedInvestor.filingType}
                        </p>
                        {real13F && !real13F.notSynced ? (
                          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {lang === "ko" ? "SEC EDGAR 검증 데이터" : "Verified SEC EDGAR"}
                          </div>
                        ) : selectedInvestor.dataSource ? (
                          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 text-[10px] font-bold max-w-full">
                            <FileText className="w-3 h-3 shrink-0" />
                            <span className="truncate">{selectedInvestor.dataSource}</span>
                          </div>
                        ) : (
                          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {lang === "ko" ? "공시 데이터" : "Official Data"}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Coverage scope disclaimer */}
                  {coverageScopeNote && (
                    <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border/50 text-muted-foreground text-[11px]">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/60" />
                      <span>{lang === "ko" ? coverageScopeNote.ko : coverageScopeNote.en}</span>
                    </div>
                  )}

                  <Tabs defaultValue="holdings" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-12 bg-muted p-1 rounded-xl">
                      <TabsTrigger value="holdings" className="rounded-lg font-bold">
                        <List className="w-4 h-4 mr-2" />
                        {t.top_holdings}
                      </TabsTrigger>
                      <TabsTrigger value="allocation" className="rounded-lg font-bold">
                        <PieChartIcon className="w-4 h-4 mr-2" />
                        {t.sector_allocation}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="holdings" className="mt-6">
                      {/* ── Verifying Data state — shown for CIK-mapped investors not yet synced ── */}
                      {investorHasCIK && !isLoading13F && effectiveHoldings.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                          </div>
                          <div>
                            <p className="font-bold text-lg text-foreground">
                              {lang === "ko" ? "데이터 검증 중…" : "Verifying Data…"}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                              {lang === "ko"
                                ? "SEC EDGAR 13F 데이터가 아직 DB에 저장되지 않았습니다. 검증 완료 전까지 포트폴리오를 표시하지 않습니다."
                                : "SEC EDGAR 13F data has not been verified and stored in the DB yet. Portfolio will not display until verified."}
                            </p>
                          </div>
                          <Button
                            onClick={() => syncMutation.mutate()}
                            disabled={syncMutation.isPending}
                            className="font-bold"
                            data-testid="button-sync-verifying"
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                            {syncMutation.isPending
                              ? (lang === "ko" ? "동기화 중..." : "Syncing...")
                              : (lang === "ko" ? "지금 동기화" : "Sync Now")}
                          </Button>
                        </div>
                      )}

                      {/* ── Mobile card layout (< sm) ── */}
                      {displayedHoldings.length > 0 && (
                      <div className="block sm:hidden">
                      <div className="overflow-y-auto pr-1" style={{ maxHeight: "70vh", WebkitOverflowScrolling: "touch" }}>
                      <div className="space-y-2 overflow-x-hidden">
                        {displayedHoldings.map((holding, idx) => {
                          const koName = getLocalizedCompanyName(holding.company, "ko");
                          const enName = holding.company;
                          const showKo = lang === "ko" && koName !== enName;
                          return (
                          <Card key={holding.ticker} className="border overflow-hidden" data-testid={`card-holding-mobile-${holding.ticker}`}>
                            <CardContent className="p-3">
                              {/* Row 1: rank + names + weight */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                  <span className="text-muted-foreground font-mono text-xs mt-1 shrink-0 w-5 text-right">{idx + 1}</span>
                                  <div className="min-w-0">
                                    {showKo ? (
                                      <>
                                        <p className="font-bold text-base leading-tight text-foreground">{koName}</p>
                                        <p className="text-xs text-muted-foreground leading-tight mt-0.5">{enName}</p>
                                      </>
                                    ) : (
                                      <p className="font-bold text-sm leading-tight">{enName}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-xl font-display font-bold text-primary block">{holding.weight}%</span>
                                  <span className="text-[10px] text-muted-foreground">{lang === "ko" ? "비중" : "weight"}</span>
                                  {(() => {
                                    const ticker = holding.ticker;
                                    const isKRX = ticker.endsWith(".KS");
                                    const isJPN = ticker.endsWith(".T");
                                    const livePrice = livePriceMap.get(ticker.toUpperCase());
                                    const priceApprox = (holding as any).priceApprox as number | undefined;
                                    const filingVal = (holding as any)._valueUSD ? (holding as any)._valueUSD * 1000 : null;
                                    let estVal: number | null = null;
                                    let isLive = false;
                                    if (livePrice && livePrice > 0 && holding.shares > 0) {
                                      // KRX live prices are in KRW, JPN in JPY — convert to USD
                                      estVal = isKRX
                                        ? (livePrice * holding.shares) / krwRate
                                        : isJPN
                                        ? (livePrice * holding.shares) / 155
                                        : livePrice * holding.shares;
                                      isLive = true;
                                    } else if (priceApprox && priceApprox > 0 && holding.shares > 0) {
                                      estVal = isKRX
                                        ? (priceApprox * holding.shares) / krwRate
                                        : isJPN
                                        ? (priceApprox * holding.shares) / 155
                                        : priceApprox * holding.shares;
                                    }
                                    const displayVal = estVal ?? filingVal;
                                    if (!displayVal) return null;
                                    return (
                                      <span className={`text-[10px] block mt-0.5 font-mono font-semibold ${estVal ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                        {formatValueUSD(displayVal, lang, krwRate)}
                                        {estVal && <span className="font-normal opacity-70 ml-0.5">{isLive ? (lang === "ko" ? "실시간" : "live") : (lang === "ko" ? "추정" : "est")}</span>}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                              {/* Row 2: ticker · sector · dataStatus · change badges */}
                              <div className="flex items-center gap-1.5 mt-1.5 ml-7 flex-wrap">
                                <span className="text-xs font-mono font-bold text-muted-foreground">{holding.ticker}</span>
                                {holding.putCall && holding.putCall !== "None" && holding.putCall !== "" && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">{holding.putCall}</span>
                                )}
                                <span className="text-muted-foreground text-xs">·</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{getSectorName(holding.sector, lang)}</span>
                                {holding.dataStatus === "estimated" && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-500 font-semibold">
                                    <CircleDot className="w-2.5 h-2.5" />{lang === "ko" ? "추정" : "Est."}
                                  </span>
                                )}
                                {holding.dataStatus === "verifying" && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500 font-semibold">
                                    <RefreshCw className="w-2.5 h-2.5" />{lang === "ko" ? "확인 중" : "Verifying"}
                                  </span>
                                )}
                                {holding.change === "Bought" && (
                                  <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none text-[10px] h-4 px-1.5">
                                    <TrendingUp className="w-2.5 h-2.5 mr-0.5" />{t.bought}
                                  </Badge>
                                )}
                                {holding.change === "Sold" && (
                                  <Badge className="bg-rose-500 hover:bg-rose-600 border-none text-[10px] h-4 px-1.5">
                                    <TrendingDown className="w-2.5 h-2.5 mr-0.5" />{t.sold}
                                  </Badge>
                                )}
                                {holding.change === "Held" && (
                                  <Badge variant="secondary" className="bg-muted text-muted-foreground border-none text-[10px] h-4 px-1.5">
                                    <Minus className="w-2.5 h-2.5 mr-0.5" />{t.held}
                                  </Badge>
                                )}
                                {holding.change === "New" && (
                                  <Badge className="bg-primary hover:bg-primary/90 border-none text-[10px] h-4 px-1.5">
                                    {t.new_pos}
                                  </Badge>
                                )}
                                {holding.changePct !== null && holding.changePct !== 0 && (
                                  <span className={holding.changePct > 0 ? "text-emerald-500 text-[10px] font-bold" : "text-rose-500 text-[10px] font-bold"}>
                                    {holding.changePct > 0 ? "+" : ""}{holding.changePct}%
                                  </span>
                                )}
                              </div>
                              {/* Row 3: full-width Why They Bought button */}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setWhyDialogHolding({
                                    ticker: holding.ticker,
                                    company: holding.company,
                                    en: holding.whyTheyBoughtEn,
                                    ko: holding.whyTheyBoughtKo,
                                  });
                                }}
                                className="w-full mt-2 rounded-lg h-8 text-xs font-bold border hover:bg-primary hover:text-white hover:border-primary transition-all"
                                data-testid={`button-why-mobile-${holding.ticker}`}
                              >
                                <Info className="w-3 h-3 mr-1" />
                                {t.learn_why}
                              </Button>
                            </CardContent>
                          </Card>
                          );
                        })}
                        {/* All holdings shown — no limit */}
                        {effectiveHoldings.length > 0 && (
                          <div className="text-center pt-1 pb-1">
                            <p className="text-[10px] text-muted-foreground font-medium">
                              {lang === "ko"
                                ? `전체 ${effectiveHoldings.length}개 보유 종목`
                                : `${effectiveHoldings.length} holdings · all shown`}
                            </p>
                          </div>
                        )}
                      </div>
                      </div>
                      </div>
                      )}

                      {/* ── Desktop table layout (≥ sm) ── */}
                      {displayedHoldings.length > 0 && (<Card className="hidden sm:block border-2 overflow-hidden">
                        <div className="overflow-x-auto">
                          <div className="min-w-[580px]">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase tracking-wider text-[10px] w-8">#</th>
                                  <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase tracking-wider text-[10px]">{t.company}</th>
                                  <th className="px-4 py-3 text-right font-bold text-muted-foreground uppercase tracking-wider text-[10px]">{t.weight}</th>
                                  <th className="px-4 py-3 text-right font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                                    {lang === "ko" ? "현재 추정가치" : "Est. Value"}
                                  </th>
                                  <th className="px-4 py-3 text-center font-bold text-muted-foreground uppercase tracking-wider text-[10px]">{t.change}</th>
                                  <th className="px-4 py-3 text-center font-bold text-muted-foreground uppercase tracking-wider text-[10px]">{t.why_bought}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {displayedHoldings.map((holding, idx) => {
                                  const koName = getLocalizedCompanyName(holding.company, "ko");
                                  const enName = holding.company;
                                  const showKo = lang === "ko" && koName !== enName;
                                  return (
                                  <tr key={holding.ticker} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-4 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                                    <td className="px-4 py-4">
                                      <div>
                                        {showKo ? (
                                          <>
                                            <div className="font-bold text-foreground text-sm leading-tight">{koName}</div>
                                            <div className="text-xs text-muted-foreground leading-tight mt-0.5">{enName}</div>
                                          </>
                                        ) : (
                                          <div className="font-bold text-foreground text-sm leading-tight">{enName}</div>
                                        )}
                                        <div className="text-xs font-mono text-muted-foreground mt-0.5">
                                          {holding.ticker}
                                          {holding.putCall && holding.putCall !== "None" && holding.putCall !== "" && (
                                            <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">{holding.putCall}</span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                      <div className="text-lg font-display font-bold text-primary">{holding.weight}%</div>
                                      <div className="text-[10px] text-muted-foreground font-medium uppercase">{getSectorName(holding.sector, lang)}</div>
                                      {holding.dataStatus === "estimated" && (
                                        <div className="inline-flex items-center gap-0.5 text-[10px] text-orange-500 font-semibold mt-0.5">
                                          <CircleDot className="w-2.5 h-2.5" />{lang === "ko" ? "추정치" : "Estimated"}
                                        </div>
                                      )}
                                      {holding.dataStatus === "verifying" && (
                                        <div className="inline-flex items-center gap-0.5 text-[10px] text-amber-500 font-semibold mt-0.5">
                                          <RefreshCw className="w-2.5 h-2.5" />{lang === "ko" ? "확인 중" : "Verifying..."}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                      {(() => {
                                        const ticker = holding.ticker;
                                        const isKRX = ticker.endsWith(".KS");
                                        const isJPN = ticker.endsWith(".T");
                                        const livePrice = livePriceMap.get(ticker.toUpperCase());
                                        const priceApprox = (holding as any).priceApprox as number | undefined;
                                        const filingVal = (holding as any)._valueUSD ? (holding as any)._valueUSD * 1000 : null;

                                        let estCurrentVal: number | null = null;
                                        let isLive = false;
                                        if (livePrice && livePrice > 0 && holding.shares > 0) {
                                          // KRX live prices are in KRW, JPN in JPY — convert to USD
                                          estCurrentVal = isKRX
                                            ? (livePrice * holding.shares) / krwRate
                                            : isJPN
                                            ? (livePrice * holding.shares) / 155
                                            : livePrice * holding.shares;
                                          isLive = true;
                                        } else if (priceApprox && priceApprox > 0 && holding.shares > 0) {
                                          estCurrentVal = isKRX
                                            ? (priceApprox * holding.shares) / krwRate
                                            : isJPN
                                            ? (priceApprox * holding.shares) / 155
                                            : priceApprox * holding.shares;
                                        }

                                        return (
                                          <div>
                                            {estCurrentVal ? (
                                              <>
                                                <div className="text-sm font-bold text-foreground font-mono">
                                                  {formatValueUSD(estCurrentVal, lang, krwRate)}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                                  {isLive
                                                    ? (lang === "ko" ? "현재가 추정" : "live est.")
                                                    : (lang === "ko" ? "근사치 추정" : "approx. est.")}
                                                </div>
                                                {filingVal && isLive && (
                                                  <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                                                    {formatValueUSD(filingVal, lang, krwRate)} {lang === "ko" ? "공시 기준" : "at filing"}
                                                  </div>
                                                )}
                                              </>
                                            ) : filingVal ? (
                                              <>
                                                <div className="text-sm font-semibold text-muted-foreground font-mono">
                                                  {formatValueUSD(filingVal, lang, krwRate)}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                                                  {lang === "ko" ? "공시 기준" : "at filing"}
                                                </div>
                                              </>
                                            ) : (
                                              <span className="text-muted-foreground/30 text-xs">—</span>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                      <div className="flex flex-col items-center gap-1">
                                        {holding.change === "Bought" && (
                                          <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none text-[10px]">
                                            <TrendingUp className="w-3 h-3 mr-1" />{t.bought}
                                          </Badge>
                                        )}
                                        {holding.change === "Sold" && (
                                          <Badge className="bg-rose-500 hover:bg-rose-600 border-none text-[10px]">
                                            <TrendingDown className="w-3 h-3 mr-1" />{t.sold}
                                          </Badge>
                                        )}
                                        {holding.change === "Held" && (
                                          <Badge variant="secondary" className="bg-muted text-muted-foreground border-none text-[10px]">
                                            <Minus className="w-3 h-3 mr-1" />{t.held}
                                          </Badge>
                                        )}
                                        {holding.change === "New" && (
                                          <Badge className="bg-primary hover:bg-primary/90 border-none text-[10px]">
                                            {t.new_pos}
                                          </Badge>
                                        )}
                                        {holding.changePct !== null && holding.changePct !== 0 && (
                                          <span className={holding.changePct > 0 ? "text-emerald-500 text-[10px] font-bold" : "text-rose-500 text-[10px] font-bold"}>
                                            {holding.changePct > 0 ? "+" : ""}{holding.changePct}%
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setWhyDialogHolding({
                                            ticker: holding.ticker,
                                            company: holding.company,
                                            en: holding.whyTheyBoughtEn,
                                            ko: holding.whyTheyBoughtKo,
                                          });
                                        }}
                                        className="rounded-full h-8 text-xs font-bold border-2 hover:bg-primary hover:text-white hover:border-primary transition-all"
                                        data-testid={`button-why-${holding.ticker}`}
                                      >
                                        <Info className="w-3 h-3 mr-1" />
                                        {t.learn_why}
                                      </Button>
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {effectiveHoldings.length > 0 && (
                          <div className="border-t border-border px-4 py-3">
                            <p className="text-[10px] text-muted-foreground text-center font-medium">
                              {lang === "ko"
                                ? `전체 ${effectiveHoldings.length}개 보유 종목 · 상위 포지션 기준`
                                : `All ${effectiveHoldings.length} holdings shown · Top positions by weight`}
                            </p>
                          </div>
                        )}
                      </Card>)}
                    </TabsContent>

                    <TabsContent value="allocation" className="mt-6">
                      <Card className="border-2 p-6">
                        <div className="h-[420px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={selectedInvestor.sectorAllocation.map(s => ({
                                  ...s,
                                  sector: getSectorName(s.sector, lang),
                                }))}
                                cx="50%"
                                cy="45%"
                                innerRadius={70}
                                outerRadius={130}
                                paddingAngle={4}
                                dataKey="weight"
                                nameKey="sector"
                              >
                                {selectedInvestor.sectorAllocation.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                              </Pie>
                              <RechartsTooltip
                                contentStyle={{ borderRadius: "16px", border: "2px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                                formatter={(value: number, name: string) => [`${value}%`, name]}
                                itemStyle={{ fontWeight: "bold" }}
                              />
                              <Legend
                                verticalAlign="bottom"
                                height={60}
                                formatter={(value, entry: any) => (
                                  <span className="text-xs font-semibold text-foreground">
                                    {value} <span className="text-muted-foreground font-normal">{entry?.payload?.weight}%</span>
                                  </span>
                                )}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-[10px] text-muted-foreground text-center mt-2 font-medium">
                          {lang === "ko"
                            ? `기준일: ${selectedInvestor.lastUpdated} · ${selectedInvestor.filingType}`
                            : `As of ${selectedInvestor.lastUpdated} · ${selectedInvestor.filingType}`}
                        </p>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
