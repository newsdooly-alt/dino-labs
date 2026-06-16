import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Clock, ChevronRight, ChevronDown, ChevronUp, Radio, Flame, ArrowUpDown, Globe2 } from "lucide-react";
import { NewsDetailModal, NewsItem } from "@/components/NewsDetailModal";

type SortOrder = "latest" | "importance";

interface HotIssueItem extends NewsItem {
  thumbnail: string | null;
  isMarketImpact?: boolean;
}

interface HotIssuesResponse {
  issues: HotIssueItem[];
  count: number;
  fetchedAt: number;
}

type CategoryId = "all" | "breaking" | "market" | "analysis" | "corporate" | "economy";

const BATCH = 20;

function timeAgo(ts: number, lang: string): string {
  const diff = Math.floor((Date.now() - ts * 1000) / 1000);
  if (diff < 60) return lang === "ko" ? "방금" : lang === "ja" ? "たった今" : "just now";
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return lang === "ko" ? `${m}분 전` : lang === "ja" ? `${m}分前` : `${m}m ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return lang === "ko" ? `${h}시간 전` : lang === "ja" ? `${h}時間前` : `${h}h ago`;
  }
  const d = Math.floor(diff / 86400);
  return lang === "ko" ? `${d}일 전` : lang === "ja" ? `${d}日前` : `${d}d ago`;
}

function normalizePublisher(raw: string): string {
  const s = (raw || "").toLowerCase().trim();
  if (s.includes("reuters")) return "Reuters";
  if (s.includes("bloomberg")) return "Bloomberg";
  if (s.includes("cnbc")) return "CNBC";
  if (s.includes("associated press") || s === "ap" || s.includes("ap news")) return "AP News";
  if (s.includes("wall street journal") || s === "wsj") return "WSJ";
  if (s.includes("financial times") || s === "ft.com" || s === "ft") return "FT";
  if (s.includes("seeking alpha")) return "Seeking Alpha";
  if (s.includes("motley fool")) return "Motley Fool";
  if (s.includes("barron")) return "Barron's";
  if (s.includes("marketwatch")) return "MarketWatch";
  if (s.includes("benzinga")) return "Benzinga";
  if (s.includes("yahoo")) return "Yahoo Finance";
  if (s.includes("nikkei")) return "Nikkei";
  if (s.includes("investing.com")) return "Investing.com";
  if (s.includes("thestreet") || s.includes("the street")) return "TheStreet";
  if (s.includes("zacks")) return "Zacks";
  if (s.includes("investor") && s.includes("business")) return "IBD";
  if (s.includes("fortune")) return "Fortune";
  if (s.includes("forbes")) return "Forbes";
  return raw || "Other";
}

const PUBLISHER_BADGE: Record<string, string> = {
  Reuters: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Bloomberg: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CNBC: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "AP News": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  WSJ: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
  FT: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  "Seeking Alpha": "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  "Motley Fool": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  "Barron's": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  MarketWatch: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Benzinga: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

function publisherBadgeClass(name: string): string {
  return PUBLISHER_BADGE[name] || "bg-muted text-muted-foreground";
}

type RawCategory = Exclude<CategoryId, "all">;

const CATEGORY_META: Record<RawCategory, { ko: string; en: string; ja: string; cls: string }> = {
  breaking: { ko: "속보", en: "Breaking", ja: "速報", cls: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
  market:   { ko: "시황", en: "Markets",  ja: "市況", cls: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  analysis: { ko: "분석", en: "Analysis", ja: "分析", cls: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" },
  corporate:{ ko: "기업", en: "Corporate",ja: "企業", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  economy:  { ko: "경제", en: "Economy",  ja: "経済", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
};

function detectCategory(item: HotIssueItem): RawCategory {
  const title = (item.title || "").toLowerCase();
  const summary = (item.summary || "").toLowerCase();
  const full = title + " " + summary;

  // Extract URL slug for original English keyword matching
  const slug = ((item.link || "").split("/").pop() || "").replace(/[-_]/g, " ").replace(/\.\w+$/, "").toLowerCase();
  const eng = slug + " " + full; // combined English slug + Korean text

  const ageHours = item.publishedAt ? (Date.now() / 1000 - item.publishedAt) / 3600 : 999;

  // ── 1. ECONOMY ─────────────────────────────────────────────────────────────
  // English slug patterns
  const econEng = /\bgdp\b|inflation|cpi\b|pce\b|unemployment|nonfarm|jobs report|jobless|consumer price|trade war|trade deal|trade deficit|tariff|fiscal policy|federal budget|national debt|federal reserve|the fed\b|fomc|interest rate|rate hike|rate cut|monetary policy|quantitative easing|quantitative tightening|treasury yield|debt ceiling|recession|economic growth|us economy|global economy|fed chair|jerome powell|powell|yellen|treasury secretary|yield curve|10.year yield|bond yield|oil price|crude price|crude oil|energy price|commodity price|gold price|dollar index|dollar strength|usd|forex/.test(slug);
  // Korean text patterns
  const econKo = /유가|금리|인플레|물가|연준|연방준비|국채|gdp|무역|관세|경기|재정|기준금리|고용|실업|소비자물가|생산자물가|fomc|jerome powell|파월|옐런|재무부|수익률|채권|달러|달러화|원유|원자재|금값|환율|무역적자|수출입/.test(full);
  if (econEng || econKo) return "economy";

  // ── 2. ANALYSIS ────────────────────────────────────────────────────────────
  // English slug patterns
  const analEng = /analyst|upgrade|downgrade|price target|buy rating|sell rating|overweight|underweight|outperform|underperform|neutral|hold rating|initiates coverage|reiterates|raises target|cuts target|research note|eps estimate|earnings estimate|earnings beat|earnings miss|earnings preview|revenue guidance|outlook raised|outlook lowered|raises guidance|cuts guidance|consensus|wall street expects|target price|fair value|valuation|resets target|revisits target|sets target|stock target|lowers target|raises pt|cuts pt|jpmorgan|goldman sachs|morgan stanley|bank of america|citi|ubs|barclays|rbc|piper|bernstein|needham|wedbush|jefferies|cowen|stifel|mizuho|hsbc/.test(slug);
  // Korean text patterns
  const analKo = /목표가|투자의견|상향|하향|매수|매도|중립|보유|애널리스트|분석가|리서치|실적 전망|주가 목표|jp모건|골드만|모건스탠리|뱅크오브아메리카|씨티|목표 주가|분기 실적|연간 전망|eps|per|pbr|fair value|밸류에이션|주가수익/.test(full);
  if (analEng || analKo) return "analysis";

  // ── 3. MARKET ──────────────────────────────────────────────────────────────
  // English slug patterns
  const mktEng = /s.p 500|nasdaq|dow jones|dow industrials|kospi|nikkei|stock market|wall street|broad market|market rally|market selloff|market crash|market correction|equity market|global market|futures rise|futures fall|stocks surge|stocks plunge|stocks rally|stocks drop|index gain|index fall|bull market|bear market/.test(slug);
  // Korean text patterns (보강: 시장 전반 움직임)
  const mktKo = /나스닥|s&p|코스피|닛케이|다우|증시|주식 시장|주가 급등|주가 급락|증시 상승|증시 하락|선물 시장|시장 전반|지수 상승|지수 하락|불마켓|베어마켓/.test(full);
  // isMarketImpact from backend (macro articles)
  if (mktEng || mktKo || item.isMarketImpact) return "market";

  // ── 4. BREAKING ────────────────────────────────────────────────────────────
  const brkEng = /merger|acquisition|takeover|buyout|recall|investigation|fine[sd]|penalty|lawsuit|bankruptcy|chapter 11|layoffs|job cuts|resigns|fired|ceo appointed|names ceo|deal announced|deal signed|deal agreed|ipo|spinoff|breakup/.test(slug);
  const brkKo = /합병|인수|리콜|조사|벌금|소송|파산|해고|감원|사임|CEO 교체|CEO 임명|이사회|분사|스핀오프|상장|기업공개/.test(full);
  if (ageHours < 12 && (brkEng || brkKo)) return "breaking";

  // ── 5. Default ─────────────────────────────────────────────────────────────
  return "corporate";
}

function NewsCard({
  item, idx, lang, onClick,
}: { item: HotIssueItem & { _publisher: string; _category: RawCategory }; idx: number; lang: string; onClick: () => void }) {
  const isKo = lang === "ko";
  const isJa = lang === "ja";
  const cat = CATEGORY_META[item._category];
  const catLabel = isKo ? cat.ko : isJa ? cat.ja : cat.en;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.4) }}
      onClick={onClick}
      className="group flex flex-col gap-3 py-5 border-b border-border/60 last:border-0 cursor-pointer hover:bg-muted/30 px-2 rounded-lg transition-colors"
      data-testid={`card-news-${idx}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("text-xs font-bold px-2 py-1 rounded-md", publisherBadgeClass(item._publisher))}>
          {item._publisher}
        </span>
        <span className={cn("text-xs font-semibold px-2 py-1 rounded-md", cat.cls)}>
          {catLabel}
        </span>
        {item.isHot && (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md bg-primary text-primary-foreground">
            <Flame className="w-3 h-3" />HOT
          </span>
        )}
        {item.isMarketImpact && (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md bg-orange-500 text-white">
            <Globe2 className="w-3 h-3" />
            {isKo ? "시장영향" : isJa ? "市場影響" : "Impact"}
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {timeAgo(item.publishedAt, lang)}
        </span>
      </div>

      <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
        {item.title}
      </p>

      {item.summary && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {item.summary}
        </p>
      )}

      <div className="flex items-center justify-end">
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary/70 group-hover:text-primary transition-colors">
          {isKo ? "AI 분석" : isJa ? "AI分析" : "AI Analysis"}
          <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </motion.div>
  );
}

export default function HotIssues() {
  const { data: user } = useUser();
  const lang = (user?.language || "ko") as string;
  const isKo = lang === "ko";
  const isJa = lang === "ja";

  const [selectedPublisher, setSelectedPublisher] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>("all");
  const [displayCount, setDisplayCount] = useState(BATCH);
  const [selectedIssue, setSelectedIssue] = useState<HotIssueItem | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");
  const [topNewsOpen, setTopNewsOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<HotIssuesResponse>({
    queryKey: ["/api/news/hot-issues"],
    queryFn: async () => {
      const res = await fetch("/api/news/hot-issues");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10,
    refetchOnMount: true,
    retry: 1,
  });

  const enriched = useMemo(() => {
    return (data?.issues || []).map((item) => ({
      ...item,
      _publisher: normalizePublisher(item.publisher),
      _category: detectCategory(item),
    }));
  }, [data]);

  // "오늘 주요뉴스" — top 8 most important articles
  const topNews = useMemo(() => {
    const scored = enriched.map(i => {
      let score = 0;
      if (i.isHot) score += 30;
      if (i.isMarketImpact) score += 20;
      if (i._category === "breaking") score += 15;
      if (i._category === "economy") score += 8;
      if (i._category === "market") score += 6;
      if (i._category === "analysis") score += 4;
      // freshness bonus (articles within last 6h)
      const ageH = i.publishedAt ? (Date.now() / 1000 - i.publishedAt) / 3600 : 999;
      if (ageH < 2) score += 10;
      else if (ageH < 6) score += 5;
      return { ...i, _score: score };
    });
    return scored
      .filter(i => i._score >= 4)
      .sort((a, b) => b._score - a._score || (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
      .slice(0, 8);
  }, [enriched]);

  const publishers = useMemo(() => {
    const counts: Record<string, number> = {};
    enriched.forEach((i) => { counts[i._publisher] = (counts[i._publisher] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [enriched]);

  const filtered = useMemo(() => {
    const base = enriched.filter((i) => {
      if (selectedPublisher !== "all" && i._publisher !== selectedPublisher) return false;
      if (selectedCategory !== "all" && i._category !== selectedCategory) return false;
      return true;
    });
    if (sortOrder === "importance") {
      return [...base].sort((a, b) => {
        const scoreA = (a.isHot ? 30 : 0) + (a.isMarketImpact ? 20 : 0) + (a._category === "breaking" ? 15 : a._category === "economy" ? 8 : a._category === "market" ? 6 : a._category === "analysis" ? 4 : 0);
        const scoreB = (b.isHot ? 30 : 0) + (b.isMarketImpact ? 20 : 0) + (b._category === "breaking" ? 15 : b._category === "economy" ? 8 : b._category === "market" ? 6 : b._category === "analysis" ? 4 : 0);
        return scoreB - scoreA || (b.publishedAt ?? 0) - (a.publishedAt ?? 0);
      });
    }
    // latest (default) — already sorted by server
    return base;
  }, [enriched, selectedPublisher, selectedCategory, sortOrder]);

  const visible = filtered.slice(0, displayCount);
  const hasMore = displayCount < filtered.length;

  const pageTitle = isKo ? "실시간 뉴스" : isJa ? "ライブニュース" : "Live News";

  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
  };

  const CATS: { id: CategoryId; ko: string; en: string; ja: string }[] = [
    { id: "all",       ko: "전체",  en: "All",      ja: "全て" },
    { id: "breaking",  ko: "속보",  en: "Breaking", ja: "速報" },
    { id: "market",    ko: "시황",  en: "Markets",  ja: "市況" },
    { id: "analysis",  ko: "분석",  en: "Analysis", ja: "分析" },
    { id: "corporate", ko: "기업",  en: "Corporate",ja: "企業" },
    { id: "economy",   ko: "경제",  en: "Economy",  ja: "経済" },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-5"
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Radio className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-live-news-title">
                {pageTitle}
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {dataUpdatedAt
                  ? (isKo ? `${fmt(dataUpdatedAt)} 기준` : isJa ? `${fmt(dataUpdatedAt)} 時点` : `as of ${fmt(dataUpdatedAt)}`)
                  : "—"}
                {enriched.length > 0 && (
                  <span className="ml-1 text-primary font-semibold">
                    {isKo ? `${enriched.length}건` : isJa ? `${enriched.length}件` : `${enriched.length} articles`}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-refresh-news"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            {isKo ? "새로고침" : isJa ? "更新" : "Refresh"}
          </button>
        </div>
      </motion.div>

      {/* Publisher filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide -mx-1 px-1">
        {["all", ...publishers].map((pub) => (
          <button
            key={pub}
            onClick={() => { setSelectedPublisher(pub); setDisplayCount(BATCH); }}
            className={cn(
              "flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all whitespace-nowrap",
              selectedPublisher === pub
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            )}
            data-testid={`tab-publisher-${pub}`}
          >
            {pub === "all"
              ? (isKo ? "전체" : isJa ? "全て" : "All")
              : pub}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide -mx-1 px-1">
        {CATS.map((cat) => {
          const label = isKo ? cat.ko : isJa ? cat.ja : cat.en;
          const isActive = selectedCategory === cat.id;
          const meta = cat.id !== "all" ? CATEGORY_META[cat.id as RawCategory] : null;
          return (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setDisplayCount(BATCH); }}
              className={cn(
                "flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-all whitespace-nowrap",
                isActive
                  ? meta ? cn(meta.cls, "border-transparent shadow-sm") : "bg-foreground text-background border-transparent"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              )}
              data-testid={`chip-category-${cat.id}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── 오늘 주요뉴스 ─────────────────────────────────────────────────── */}
      {!isLoading && topNews.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setTopNewsOpen(v => !v)}
            className="w-full flex items-center justify-between mb-3 group"
            data-testid="button-toggle-top-news"
          >
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-bold text-foreground">
                {isKo ? "오늘 주요뉴스" : isJa ? "今日のトップニュース" : "Top Stories"}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-muted-foreground group-hover:border-primary/40 transition-colors">
              {topNewsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </div>
          </button>

          <AnimatePresence>
            {topNewsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div
                  ref={scrollRef}
                  className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1"
                >
                  {topNews.map((item, idx) => {
                    const cat = CATEGORY_META[item._category];
                    const catLabel = isKo ? cat.ko : isJa ? cat.ja : cat.en;
                    return (
                      <button
                        key={`top-${idx}`}
                        onClick={() => setSelectedIssue(item)}
                        className="flex-shrink-0 w-52 text-left rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/30 transition-all active:scale-[0.98] overflow-hidden"
                        data-testid={`card-top-news-${idx}`}
                      >
                        {item.thumbnail && (
                          <div className="w-full h-24 overflow-hidden bg-muted">
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          </div>
                        )}
                        <div className="p-3">
                          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            <span className="text-xs font-bold text-muted-foreground">
                              {item._publisher}
                            </span>
                            <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-md", cat.cls)}>
                              {catLabel}
                            </span>
                            {item.isHot && (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                                🔥 HOT
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-3">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {item.publishedAt ? timeAgo(item.publishedAt, lang) : "—"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── 뉴스 목록 헤더 (정렬) ──────────────────────────────────────────── */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-foreground">
            {isKo ? "뉴스" : isJa ? "ニュース" : "News"}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">
              {filtered.length}{isKo ? "건" : isJa ? "件" : ""}
            </span>
          </span>
          <div className="flex items-center gap-1 bg-muted/50 rounded-full p-0.5 border border-border">
            <ArrowUpDown className="w-3 h-3 text-muted-foreground ml-2" />
            <button
              onClick={() => { setSortOrder("latest"); setDisplayCount(BATCH); }}
              className={cn(
                "text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all",
                sortOrder === "latest"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="button-sort-latest"
            >
              {isKo ? "최신순" : isJa ? "新着順" : "Latest"}
            </button>
            <button
              onClick={() => { setSortOrder("importance"); setDisplayCount(BATCH); }}
              className={cn(
                "text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all",
                sortOrder === "importance"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="button-sort-importance"
            >
              {isKo ? "중요도순" : isJa ? "重要度順" : "Importance"}
            </button>
          </div>
        </div>
      )}

      {/* News list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="py-4 border-b border-border/60">
              <div className="flex gap-2 mb-2">
                <div className="h-5 w-16 rounded-md bg-muted animate-pulse" />
                <div className="h-5 w-12 rounded-md bg-muted animate-pulse" />
                <div className="h-5 w-10 rounded-md bg-muted animate-pulse ml-auto" />
              </div>
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse mb-1" />
              <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 text-muted-foreground"
        >
          <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {isKo ? "해당 뉴스가 없습니다" : isJa ? "ニュースがありません" : "No news found"}
          </p>
          <button
            onClick={() => { setSelectedPublisher("all"); setSelectedCategory("all"); }}
            className="mt-3 text-sm text-primary underline"
          >
            {isKo ? "필터 초기화" : isJa ? "フィルターをリセット" : "Clear filters"}
          </button>
        </motion.div>
      ) : (
        <div>
          <AnimatePresence>
            {visible.map((item, idx) => (
              <NewsCard
                key={`${item.publishedAt}-${idx}`}
                item={item}
                idx={idx}
                lang={lang}
                onClick={() => setSelectedIssue(item)}
              />
            ))}
          </AnimatePresence>

          {hasMore && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-4"
            >
              <button
                onClick={() => setDisplayCount((c) => c + BATCH)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary/30 text-sm font-semibold text-primary hover:border-primary hover:bg-primary/5 transition-all active:scale-[0.98]"
                data-testid="button-load-more-news"
              >
                <ChevronDown className="w-4 h-4" />
                {isKo
                  ? `뉴스 더보기 (${Math.min(filtered.length - displayCount, BATCH)}건 더)`
                  : isJa
                  ? `もっと見る（${Math.min(filtered.length - displayCount, BATCH)}件）`
                  : `Load ${Math.min(filtered.length - displayCount, BATCH)} more`}
              </button>
              <p className="text-center text-[11px] text-muted-foreground mt-2">
                {isKo
                  ? `전체 ${filtered.length}건 중 ${displayCount}건 표시`
                  : isJa
                  ? `全${filtered.length}件中${displayCount}件を表示`
                  : `Showing ${displayCount} of ${filtered.length}`}
              </p>
            </motion.div>
          )}

          {!hasMore && visible.length > BATCH && (
            <p className="text-center text-xs text-muted-foreground pt-4">
              {isKo ? "✓ 모든 뉴스를 불러왔습니다" : isJa ? "✓ すべて読み込みました" : "✓ All news loaded"}
            </p>
          )}
        </div>
      )}

      <NewsDetailModal item={selectedIssue} onClose={() => setSelectedIssue(null)} />
    </div>
  );
}
