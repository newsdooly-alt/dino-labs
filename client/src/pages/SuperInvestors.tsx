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
  accessionNumber: string;
  totalValueUSD: number;
  holdingCount: number;
  holdings: Real13FHolding[];
  fetchedAt: string;
  source: string;
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

const KO_COMPANY_NAMES: Record<string, string> = {
  "Apple Inc.": "애플",
  "Microsoft Corp.": "마이크로소프트",
  "Microsoft Corp": "마이크로소프트",
  "Alphabet Inc.": "알파벳",
  "Amazon.com": "아마존",
  "NVIDIA Corporation": "엔비디아",
  "Meta Platforms": "메타",
  "Tesla Inc.": "테슬라",
  "Berkshire Hathaway": "버크셔 해서웨이",
  "JPMorgan Chase": "JP모건 체이스",
  "Visa Inc.": "비자",
  "Mastercard": "마스터카드",
  "Bank of America": "뱅크오브아메리카",
  "Wells Fargo": "웰스파고",
  "Goldman Sachs": "골드만삭스",
  "Morgan Stanley": "모건스탠리",
  "Chevron Corp": "셰브론",
  "Exxon Mobil": "엑슨모빌",
  "Johnson & Johnson": "존슨앤드존슨",
  "Procter & Gamble": "프록터앤드갬블",
  "Coca-Cola": "코카콜라",
  "PepsiCo": "펩시코",
  "Walmart Inc.": "월마트",
  "Costco": "코스트코",
  "Home Depot": "홈디포",
  "McDonald's": "맥도날드",
  "Starbucks": "스타벅스",
  "Nike Inc.": "나이키",
  "Walt Disney": "월트 디즈니",
  "Netflix Inc.": "넷플릭스",
  "Salesforce": "세일즈포스",
  "Adobe Inc.": "어도비",
  "Intel Corporation": "인텔",
  "Qualcomm": "퀄컴",
  "Broadcom": "브로드컴",
  "PayPal": "페이팔",
  "Shopify": "쇼피파이",
  "Uber Technologies": "우버",
  "Airbnb": "에어비앤비",
  "Spotify": "스포티파이",
  "Palantir Technologies": "팔란티어",
  "Snowflake": "스노우플레이크",
  "CrowdStrike": "크라우드스트라이크",
  "Palo Alto Networks": "팰로앨토 네트웍스",
  "ServiceNow": "서비스나우",
  "Workday": "워크데이",
  "Eli Lilly & Co.": "일라이 릴리",
  "AbbVie": "애브비",
  "Bristol-Myers Squibb": "브리스톨-마이어스 스큅",
  "UnitedHealth Group": "유나이티드헬스 그룹",
  "Cigna": "시그나",
  "CVS Health": "CVS 헬스",
  "Humana": "휴마나",
  "American Express": "아메리칸 익스프레스",
  "Occidental Petroleum": "옥시덴탈 페트롤리엄",
  "Kraft Heinz": "크래프트 하인즈",
  "Moody's Corp": "무디스",
  "VeriSign Inc.": "베리사인",
  "DaVita Inc.": "다비타",
  "Marriott International": "메리어트 인터내셔널",
  "Booking Holdings": "부킹 홀딩스",
  "JD.com Inc.": "JD닷컴",
  "Alibaba Group": "알리바바",
  "Baidu": "바이두",
  "Tencent": "텐센트",
  "SPDR S&P 500 ETF": "S&P 500 ETF (SPY)",
  "iShares Emerging Markets ETF": "이머징마켓 ETF (EEM)",
  "SPDR Gold Shares ETF": "금 ETF (GLD)",
  "iShares Core S&P 500 ETF": "iShares S&P 500 ETF",
  "GEO Group Inc.": "지오 그룹",
  "HCA Healthcare": "HCA 헬스케어",
  "Pfizer Inc.": "화이자",
  "Biogen": "바이오젠",
  "CRISPR Therapeutics": "CRISPR 테라퓨틱스",
  "Barrick Gold": "배릭 골드",
  "Wheaton Precious Metals": "휘튼 프리셔스 메탈스",
  "Omega Healthcare": "오메가 헬스케어",
  "Pinterest": "핀터레스트",
  "Texas Instruments": "텍사스 인스트루먼트",
  "Chipotle Mexican Grill": "치폴레",
  "Howard Hughes Holdings": "하워드 휴즈 홀딩스",
  "DBS Group Holdings": "DBS 그룹",
  "Sea Limited": "씨 리미티드",
  "Toyota Motor": "토요타 자동차",
  "SoftBank Group": "소프트뱅크 그룹",
  "Nintendo": "닌텐도",
  "Coinbase": "코인베이스",
  "Roku Inc.": "로쿠",
  "MercadoLibre": "메르카도리브레",
  "Vistra Corp": "비스트라",
  "CVR Energy": "CVR 에너지",
  "Qurate Retail": "쿠레이트 리테일",
  "PTC Inc.": "PTC",
  "Everi Holdings": "에버리 홀딩스",
  "Rain Industries": "레인 인더스트리스",
  "Allison Transmission": "앨리슨 트랜스미션",
  "Cellebrite DI": "셀레브라이트",
  "Eli Lilly & Co": "일라이 릴리",
  "삼성전자 (Samsung Electronics)": "삼성전자",
  "SK하이닉스 (SK Hynix)": "SK하이닉스",
  "현대자동차 (Hyundai Motor)": "현대자동차",
  "NAVER Corp.": "네이버",
};

const KO_INVESTOR_NAMES: Record<string, string> = {
  "Warren Buffett": "워런 버핏",
  "Seth Klarman": "세스 클라만",
  "Carl Icahn": "칼 아이칸",
  "David Einhorn": "데이비드 아인혼",
  "Mohnish Pabrai": "모니시 파브라이",
  "Bill Miller": "빌 밀러",
  "Chase Coleman III": "체이스 콜먼",
  "Cathie Wood": "캐시 우드",
  "Ray Dalio": "레이 달리오",
  "George Soros": "조지 소로스",
  "Stanley Druckenmiller": "스탠리 드러켄밀러",
  "Ken Griffin": "켄 그리핀",
  "Izzy Englander": "이지 잉글랜더",
  "Michael Burry": "마이클 버리",
  "Jim Simons": "짐 사이먼스",
  "Steve Cohen": "스티브 코헨",
  "Bill Ackman": "빌 애크먼",
  "Paul Singer": "폴 싱어",
  "Dan Loeb": "댄 로브",
  "국민연금공단 (NPS)": "국민연금공단",
  "GPIF": "GPIF (일본)",
  "GIC Singapore": "GIC 싱가포르",
  "Temasek Holdings": "테마섹",
  "Norway Pension Fund (NBIM)": "노르웨이 국부펀드",
  "ADIA": "아부다비투자청",
  "Saudi Arabia PIF": "사우디 PIF",
  "CalPERS": "캘퍼스",
  "BlackRock": "블랙록",
  "Vanguard Group": "뱅가드",
  "State Street SSGA": "스테이트 스트리트",
  "Fidelity Investments": "피델리티",
  "T. Rowe Price": "T. 로우 프라이스",
};

const KO_SECTOR_NAMES: Record<string, string> = {
  "Technology": "기술주",
  "Healthcare": "헬스케어",
  "Financials": "금융",
  "Consumer Staples": "필수소비재",
  "Consumer Discretionary": "경기소비재",
  "Energy": "에너지",
  "Communication Services": "통신 서비스",
  "Industrials": "산업재",
  "Materials": "소재",
  "Real Estate": "부동산",
  "Utilities": "유틸리티",
  "Fixed Income": "채권",
  "ETFs": "ETF",
  "Commodities": "원자재",
  "Cash & Others": "현금 및 기타",
  "Other": "기타",
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
  if (lang === "ko" && KO_COMPANY_NAMES[company]) {
    return KO_COMPANY_NAMES[company];
  }
  return company;
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

  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/13f-cache/clear");
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
                    <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        {lang === "ko" ? (
                          <>SEC EDGAR 실제 데이터 · {real13F.holdingCount}개 종목 · 보고 기간: {real13F.periodOfReport}</>
                        ) : (
                          <>Live SEC EDGAR data · {real13F.holdingCount} holdings · Period: {real13F.periodOfReport}</>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${real13F.cik}&type=13F-HR&dateb=&owner=include&count=10`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                          data-testid="link-sec-edgar"
                        >
                          <ExternalLink className="w-3 h-3" />
                          SEC.gov
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => {
                            clearCacheMutation.mutate(undefined, {
                              onSuccess: () => refetch13F(),
                            });
                          }}
                          disabled={clearCacheMutation.isPending}
                          data-testid="button-refresh-13f"
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 ${clearCacheMutation.isPending ? "animate-spin" : ""}`} />
                          {lang === "ko" ? "새로고침" : "Refresh"}
                        </Button>
                      </div>
                    </div>
                  )}
                  {!isLoading13F && isError13F && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {lang === "ko"
                        ? "SEC EDGAR 데이터를 불러올 수 없어 저장된 데이터를 표시합니다. 이 투자자는 13F 공시가 없을 수 있습니다."
                        : "Could not load live SEC data — showing curated static holdings. This investor may not file 13F with the SEC."}
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
                      <Card className="border-2 overflow-hidden">
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
                                    <td className="px-4 py-4 text-muted-foreground font-mono text-xs">
                                      {idx + 1}
                                    </td>
                                    <td className="px-4 py-4">
                                      <div>
                                        <div className="font-bold text-foreground">
                                          {getCompanyName(holding.company, lang)}
                                        </div>
                                        <div className="text-xs font-mono text-muted-foreground tracking-widest">
                                          {holding.ticker}
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
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setWhyDialogHolding({
                                          ticker: holding.ticker,
                                          company: holding.company,
                                          en: holding.whyTheyBoughtEn,
                                          ko: holding.whyTheyBoughtKo,
                                        })}
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

                        {/* View All / Show Less */}
                        {(real13F ? real13F.holdingCount : selectedInvestor.holdings.length) > 10 && (
                          <div className="border-t border-border p-4 text-center">
                            <Button
                              variant="ghost"
                              onClick={() => setShowAllHoldings(!showAllHoldings)}
                              className="font-bold text-primary hover:text-primary hover:bg-primary/10"
                              data-testid="button-toggle-holdings"
                            >
                              {showAllHoldings ? (
                                <>
                                  <ChevronUp className="w-4 h-4 mr-2" />
                                  {lang === "ko" ? "접기" : "Show Less"}
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4 mr-2" />
                                  {lang === "ko"
                                    ? `전체 보기 (${real13F ? real13F.holdingCount : selectedInvestor.holdings.length}개)`
                                    : `View All ${real13F ? real13F.holdingCount : selectedInvestor.holdings.length} Holdings`}
                                </>
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
