import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Clock, ChevronRight, ChevronDown, Radio, Globe2, Flame } from "lucide-react";
import { NewsDetailModal, NewsItem } from "@/components/NewsDetailModal";

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
  const full = (title + " " + (item.summary || "")).toLowerCase();
  const ageHours = item.publishedAt ? (Date.now() / 1000 - item.publishedAt) / 3600 : 999;

  // 1. Economy — macro data & Fed policy FIRST (before market, so "Fed cuts rates" → 경제)
  if (/\bgdp\b|inflation\b|cpi\b|\bpce\b|unemployment rate|nonfarm|jobs report|consumer price index|trade (war|deal|deficit)|tariff|import (duty|tariff)|fiscal policy|federal budget|national debt|federal reserve|the fed\b|\bfomc\b|interest rate (hike|cut|hold|rise|fall)|rate (hike|cut|pause|decision)|monetary policy|quantitative (easing|tightening)|rate cut|rate hike|treasury yield/.test(full)) return "economy";

  // 2. Market — broad market movement & indices
  if (item.isMarketImpact ||
    /\bs&p 500\b|\bnasdaq\b|\bdow jones\b|\bdow industrials\b|\bkospi\b|\bnikkei\b|stock market (rises?|falls?|rallies|drops?|surges?|tumbles?|gains?|loses?|climbs?|slides?)|wall street|broad market|market (rally|selloff|sell-off|crash|correction|pullback|rebound|rout)|equity markets?|global markets?|markets (open|close|rise|fall)/.test(full)) return "market";

  // 3. Analysis — analyst actions, ratings, price targets, earnings estimates
  if (/\banalyst\b|upgrades? (to|from)|downgrades? (to|from)|price target|buy rating|sell rating|overweight|underweight|outperform|underperform|initiates? coverage|reiterates?|maintains? (buy|sell|hold|neutral)|raises? (price target|\bpt\b)|cuts? (price target|\bpt\b)|research note|eps (forecast|estimate|beat|miss|surprise)|earnings (estimate|forecast|beat|miss|preview|surprise)|revenue (guidance|forecast|estimate|beat|miss)|outlook (raised|lowered|maintained|cut)|raises? guidance|cuts? guidance|consensus estimate|price target raised|price target cut/.test(full)) return "analysis";

  // 4. Breaking — recent news with genuinely urgent/significant event language
  if (ageHours < 4 &&
    /\bbreaking\b|just in\b|deal\b|merger\b|acquisition\b|takeover\b|buyout\b|recall\b|investigation\b|fined?\b|penalty\b|lawsuit\b|bankruptcy\b|layoffs?\b|job cuts?\b|\bceo\b resigns?|appointed? (ceo|cfo|chairman)|names? (ceo|cfo)|announces? deal|signs? deal/.test(full)) return "breaking";

  // 5. Default — company-specific news
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
      className="group flex flex-col gap-2 py-4 border-b border-border/60 last:border-0 cursor-pointer hover:bg-muted/30 px-1 rounded-lg transition-colors"
      data-testid={`card-news-${idx}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-md", publisherBadgeClass(item._publisher))}>
          {item._publisher}
        </span>
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", cat.cls)}>
          {catLabel}
        </span>
        {item.isHot && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground">
            <Flame className="w-2.5 h-2.5" />HOT
          </span>
        )}
        {item.isMarketImpact && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-orange-500 text-white">
            <Globe2 className="w-2.5 h-2.5" />
            {isKo ? "시장영향" : isJa ? "市場影響" : "Impact"}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
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

  const publishers = useMemo(() => {
    const counts: Record<string, number> = {};
    enriched.forEach((i) => { counts[i._publisher] = (counts[i._publisher] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched.filter((i) => {
      if (selectedPublisher !== "all" && i._publisher !== selectedPublisher) return false;
      if (selectedCategory !== "all" && i._category !== selectedCategory) return false;
      return true;
    });
  }, [enriched, selectedPublisher, selectedCategory]);

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
