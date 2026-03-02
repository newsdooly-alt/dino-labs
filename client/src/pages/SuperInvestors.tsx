import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Briefcase, Info, TrendingUp, TrendingDown, Minus,
  PieChart as PieChartIcon, List, Search, ChevronDown, ChevronUp, Globe,
  RefreshCw, CheckCircle2, ExternalLink, AlertCircle,
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

export default function SuperInvestors() {
  const { data: user } = useUser();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<InvestorCategory | "all">("all");
  const [showAllHoldings, setShowAllHoldings] = useState(false);
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

  // Real SEC EDGAR 13F data — fetched on demand when investor detail is opened
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
      if (!res.ok) throw new Error(`13F fetch failed: ${res.status}`);
      return res.json();
    },
    enabled: !!selectedId,
    staleTime: 24 * 60 * 60 * 1000, // 24h — same as server cache
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

  // Merge real SEC EDGAR data with static editorial commentary (whyTheyBought)
  const effectiveHoldings = useMemo(() => {
    if (!selectedInvestor) return [];
    if (!real13F || !real13F.holdings?.length) return selectedInvestor.holdings;

    // Build a ticker→static-holding map for commentary lookup
    const staticByTicker = new Map(
      selectedInvestor.holdings.map((h) => [h.ticker.toUpperCase(), h])
    );

    return real13F.holdings.map((rh) => {
      const staticMatch = staticByTicker.get(rh.ticker.toUpperCase());
      return {
        ticker: rh.ticker || rh.cusip,
        company: rh.company,
        sector: staticMatch?.sector || (rh.putCall ? "Options" : "Equity"),
        shares: rh.shares,
        weight: rh.weight,
        change: (staticMatch?.change || "Held") as "Bought" | "Sold" | "Held" | "New",
        changePct: staticMatch?.changePct ?? null,
        whyTheyBoughtEn: staticMatch?.whyTheyBoughtEn ||
          `${rh.company} represents ${rh.weight}% of the portfolio with $${(rh.value / 1000).toFixed(1)}M position size (${rh.shares.toLocaleString()} shares). Source: SEC EDGAR 13F filing, CUSIP ${rh.cusip}.`,
        whyTheyBoughtKo: staticMatch?.whyTheyBoughtKo ||
          `${rh.company}는 포트폴리오의 ${rh.weight}%를 차지하며 $${(rh.value / 1000).toFixed(1)}M 포지션 (${rh.shares.toLocaleString()}주)입니다. 출처: SEC EDGAR 13F, CUSIP ${rh.cusip}.`,
        _isRealData: true,
        _cusip: rh.cusip,
        _valueUSD: rh.value,
        _putCall: rh.putCall,
      };
    });
  }, [selectedInvestor, real13F]);

  const displayedHoldings = useMemo(() => {
    const src = effectiveHoldings.length > 0 ? effectiveHoldings : (selectedInvestor?.holdings ?? []);
    return showAllHoldings ? src : src.slice(0, 10);
  }, [effectiveHoldings, selectedInvestor, showAllHoldings]);

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
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
                <Briefcase className="w-8 h-8 text-primary" />
                {t.super_investors}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                {t.super_investors_desc}
              </p>
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
                  {/* SEC EDGAR Live Data Status Banner */}
                  {isLoading13F && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 text-sm font-medium">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {lang === "ko"
                        ? "SEC EDGAR에서 최신 13F 파일링 데이터 불러오는 중…"
                        : "Fetching latest 13F filing from SEC EDGAR…"}
                    </div>
                  )}
                  {!isLoading13F && real13F && (
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 overflow-hidden">
                      {/* Main info row */}
                      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          {lang === "ko" ? (
                            <>{real13F.fromDB ? "DB 캐시" : "SEC EDGAR 신규"} · {real13F.holdingCount}개 종목 전체</>
                          ) : (
                            <>{real13F.fromDB ? "DB Cache" : "Freshly Fetched"} · {real13F.holdingCount} total holdings</>
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
                      {/* Filing metadata row */}
                      <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-emerald-500/5 border-t border-emerald-500/15 text-[11px] text-emerald-700 dark:text-emerald-400">
                        <span className="flex items-center gap-1">
                          <span className="font-bold">{lang === "ko" ? "보고서 기준일:" : "Report Date:"}</span>
                          <span className="font-mono">{real13F.periodOfReport}</span>
                        </span>
                        <span className="opacity-40">·</span>
                        <span className="flex items-center gap-1">
                          <span className="font-bold">{lang === "ko" ? "공시 일자:" : "Filing Date:"}</span>
                          <span className="font-mono">{real13F.filingDate}</span>
                        </span>
                        <span className="opacity-40">·</span>
                        <span className="flex items-center gap-1">
                          <span className="font-bold">{lang === "ko" ? "DB 동기화:" : "Last Synced:"}</span>
                          <span className="font-mono">
                            {real13F.lastSynced
                              ? new Date(real13F.lastSynced).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" })
                              : "—"}
                          </span>
                        </span>
                        <span className="opacity-40">·</span>
                        <span className="flex items-center gap-1">
                          <span className="font-bold">{lang === "ko" ? "비중:" : "Weights:"}</span>
                          <span>{lang === "ko" ? "직접 계산 (합계=100%)" : "Calculated (sum=100%)"}</span>
                        </span>
                      </div>
                    </div>
                  )}
                  {!isLoading13F && isError13F && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {lang === "ko"
                        ? "SEC EDGAR 데이터 로드 실패 — 저장된 데이터를 표시합니다. 이 투자자는 13F 공시 의무가 없거나 미국 주식 보유량이 기준 이하일 수 있습니다."
                        : "Could not load live SEC data — showing curated static holdings. This investor may not be required to file 13F with the SEC (e.g. non-US managers or AUM below threshold)."}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-primary text-primary-foreground border-none shadow-lg">
                      <CardContent className="pt-6">
                        <p className="text-sm font-bold uppercase opacity-80">{t.portfolio_value}</p>
                        <p className="text-4xl font-display font-bold mt-1">
                          {real13F
                            ? `$${(real13F.totalValueUSD / 1e9).toFixed(2)}B`
                            : formatAum(selectedInvestor.aum, selectedInvestor.aumUnit, lang, krwRate)}
                        </p>
                        {real13F && (
                          <p className="text-xs opacity-70 mt-1">
                            {lang === "ko" ? "SEC 13F 실제 신고 기준" : "Per SEC 13F filing"}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="border-2">
                      <CardContent className="pt-6">
                        <p className="text-sm font-bold uppercase text-muted-foreground">
                          {lang === "ko" ? "데이터 기준" : "Data as of"}
                        </p>
                        <p className="text-2xl font-display font-bold text-foreground mt-1">
                          {real13F ? real13F.periodOfReport : selectedInvestor.lastUpdated}
                        </p>
                        <p className="text-xs text-muted-foreground font-medium mt-1">
                          {real13F
                            ? (lang === "ko" ? `신고일: ${real13F.filingDate}` : `Filed: ${real13F.filingDate}`)
                            : selectedInvestor.filingType}
                        </p>
                        {real13F ? (
                          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            {lang === "ko" ? "SEC EDGAR 실제 데이터" : "Live SEC EDGAR"}
                          </div>
                        ) : (
                          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {lang === "ko" ? "최신 데이터" : "Latest Data"}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

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
                      {/* ── Mobile card layout (< sm) ── */}
                      <div className="block sm:hidden space-y-2 overflow-x-hidden">
                        {displayedHoldings.map((holding, idx) => (
                          <Card key={holding.ticker} className="border overflow-hidden" data-testid={`card-holding-mobile-${holding.ticker}`}>
                            <CardContent className="p-3">
                              {/* Row 1: index + name + weight */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                  <span className="text-muted-foreground font-mono text-xs mt-0.5 shrink-0 w-5 text-right">{idx + 1}</span>
                                  <span className="font-bold text-sm leading-tight">{getCompanyName(holding.company, lang)}</span>
                                </div>
                                <span className="text-lg font-display font-bold text-primary shrink-0">{holding.weight}%</span>
                              </div>
                              {/* Row 2: ticker · sector · change badges */}
                              <div className="flex items-center gap-1.5 mt-1 ml-7 flex-wrap">
                                <span className="text-xs font-mono text-muted-foreground">{holding.ticker}</span>
                                {holding.putCall && holding.putCall !== "None" && holding.putCall !== "" && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">{holding.putCall}</span>
                                )}
                                <span className="text-muted-foreground text-xs">·</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{getSectorName(holding.sector, lang)}</span>
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
                        ))}
                        {/* View All / Show Less (mobile) */}
                        {(real13F ? real13F.holdingCount : selectedInvestor.holdings.length) > 10 && (
                          <div className="text-center pt-1">
                            <Button
                              variant="ghost"
                              onClick={() => setShowAllHoldings(!showAllHoldings)}
                              className="font-bold text-primary hover:text-primary hover:bg-primary/10"
                              data-testid="button-toggle-holdings-mobile"
                            >
                              {showAllHoldings ? (
                                <><ChevronUp className="w-4 h-4 mr-2" />{lang === "ko" ? "접기" : "Show Less"}</>
                              ) : (
                                <><ChevronDown className="w-4 h-4 mr-2" />{lang === "ko" ? `전체 보기 (${real13F ? real13F.holdingCount : selectedInvestor.holdings.length}개)` : `View All ${real13F ? real13F.holdingCount : selectedInvestor.holdings.length} Holdings`}</>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* ── Desktop table layout (≥ sm) ── */}
                      <Card className="hidden sm:block border-2 overflow-hidden">
                        <div className="overflow-x-auto">
                          <div className="min-w-[580px]">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase tracking-wider text-[10px] w-8">#</th>
                                  <th className="px-4 py-3 text-left font-bold text-muted-foreground uppercase tracking-wider text-[10px]">{t.company}</th>
                                  <th className="px-4 py-3 text-right font-bold text-muted-foreground uppercase tracking-wider text-[10px]">{t.weight}</th>
                                  <th className="px-4 py-3 text-center font-bold text-muted-foreground uppercase tracking-wider text-[10px]">{t.change}</th>
                                  <th className="px-4 py-3 text-center font-bold text-muted-foreground uppercase tracking-wider text-[10px]">{t.why_bought}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {displayedHoldings.map((holding, idx) => (
                                  <tr key={holding.ticker} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-4 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                                    <td className="px-4 py-4">
                                      <div>
                                        <div className="font-bold text-foreground text-sm leading-tight">
                                          {getCompanyName(holding.company, lang)}
                                        </div>
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
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* View All / Show Less (desktop) */}
                        {(real13F ? real13F.holdingCount : selectedInvestor.holdings.length) > 10 && (
                          <div className="border-t border-border p-4 text-center">
                            <Button
                              variant="ghost"
                              onClick={() => setShowAllHoldings(!showAllHoldings)}
                              className="font-bold text-primary hover:text-primary hover:bg-primary/10"
                              data-testid="button-toggle-holdings"
                            >
                              {showAllHoldings ? (
                                <><ChevronUp className="w-4 h-4 mr-2" />{lang === "ko" ? "접기" : "Show Less"}</>
                              ) : (
                                <><ChevronDown className="w-4 h-4 mr-2" />{lang === "ko" ? `전체 보기 (${real13F ? real13F.holdingCount : selectedInvestor.holdings.length}개)` : `View All ${real13F ? real13F.holdingCount : selectedInvestor.holdings.length} Holdings`}</>
                              )}
                            </Button>
                          </div>
                        )}
                        {selectedInvestor.holdings.length <= 10 && (
                          <div className="border-t border-border px-4 py-3">
                            <p className="text-[10px] text-muted-foreground text-center font-medium">
                              {lang === "ko"
                                ? `총 ${real13F ? real13F.holdingCount : selectedInvestor.holdings.length}개 보유 종목 · 상위 포지션 기준`
                                : `${real13F ? real13F.holdingCount : selectedInvestor.holdings.length} holdings shown · Top positions by weight`}
                            </p>
                          </div>
                        )}
                      </Card>
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
