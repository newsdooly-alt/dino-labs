import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Flame, ExternalLink, RefreshCw, Clock, Filter, ChevronRight, ChevronDown } from "lucide-react";

interface HotIssueItem {
  title: string;
  summary: string;
  link: string;
  publisher: string;
  publishedAt: number;
  thumbnail: string | null;
  isHot: boolean;
  symbol: string;
}

interface HotIssuesResponse {
  issues: HotIssueItem[];
  count: number;
  fetchedAt: number;
}

const SYMBOL_FLAGS: Record<string, string> = {
  "NVDA": "🇺🇸", "AAPL": "🇺🇸", "TSLA": "🇺🇸", "MSFT": "🇺🇸",
  "AMZN": "🇺🇸", "META": "🇺🇸", "GOOGL": "🇺🇸",
  "005930.KS": "🇰🇷", "000660.KS": "🇰🇷", "035420.KS": "🇰🇷",
  "7203.T": "🇯🇵", "6758.T": "🇯🇵",
};

const SYMBOL_NAMES: Record<string, string> = {
  "NVDA": "엔비디아", "AAPL": "애플", "TSLA": "테슬라", "MSFT": "마이크로소프트",
  "AMZN": "아마존", "META": "메타", "GOOGL": "구글",
  "005930.KS": "삼성전자", "000660.KS": "SK하이닉스", "035420.KS": "네이버",
  "7203.T": "도요타", "6758.T": "소니",
};

const INITIAL_COUNT = 10;

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

function formatFetchTime(ts: number, lang: string): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  if (lang === "ko") return `${hh}:${mm} 기준`;
  if (lang === "ja") return `${hh}:${mm} 時点`;
  return `as of ${hh}:${mm}`;
}

function IssueCard({ issue, idx, lang }: { issue: HotIssueItem; idx: number; lang: string }) {
  const isKo = lang === "ko";
  const isJa = lang === "ja";
  return (
    <motion.a
      key={`${issue.symbol}-${idx}`}
      href={issue.link || "#"}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: idx * 0.04 }}
      className={cn(
        "group block rounded-2xl border p-5 transition-all duration-200 hover:shadow-lg active:scale-[0.99] cursor-pointer",
        issue.isHot
          ? "border-primary/40 bg-primary/5 hover:border-primary/70 hover:bg-primary/10 hover:shadow-primary/10"
          : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
      )}
      data-testid={`card-issue-${idx}`}
    >
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        {issue.isHot && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
            <Flame className="w-2.5 h-2.5" />
            HOT
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground/80">
          {SYMBOL_FLAGS[issue.symbol] || "🌐"}{" "}
          {SYMBOL_NAMES[issue.symbol] || issue.symbol}
        </span>
        <span className="text-[11px] text-muted-foreground ml-auto">
          {timeAgo(issue.publishedAt, lang)}
        </span>
      </div>

      <p className="text-base font-bold text-foreground leading-snug mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
        {issue.title}
      </p>

      {issue.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-3">
          {issue.summary}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
          <ExternalLink className="w-3 h-3 shrink-0" />
          {issue.publisher}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0 group-hover:gap-2 transition-all">
          {isKo ? "자세히 보기" : isJa ? "詳細を見る" : "Read more"}
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </motion.a>
  );
}

export default function HotIssues() {
  const { data: user } = useUser();
  const lang = (user?.language || "ko") as keyof typeof translations;
  const isKo = lang === "ko";
  const isJa = lang === "ja";

  const [filterHot, setFilterHot] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<HotIssuesResponse>({
    queryKey: ["/api/news/hot-issues"],
    queryFn: async () => {
      const res = await fetch("/api/news/hot-issues");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 20,
    retry: 1,
  });

  const allIssues = (data?.issues || []).filter((i) => !filterHot || i.isHot);
  const hotCount = (data?.issues || []).filter((i) => i.isHot).length;

  const initialIssues = allIssues.slice(0, INITIAL_COUNT);
  const moreIssues = allIssues.slice(INITIAL_COUNT);
  const hasMore = moreIssues.length > 0;

  const pageTitle = isKo ? "오늘의 이슈" : isJa ? "今日のニュース" : "Today's Issues";
  const pageSubtitle = isKo
    ? "AI가 선별한 오늘의 주요 기업 뉴스"
    : isJa
    ? "AIが選んだ今日の注目ニュース"
    : "AI-curated top corporate news today";

  function handleLoadMore() {
    setIsLoadingMore(true);
    setTimeout(() => {
      setShowMore(true);
      setIsLoadingMore(false);
    }, 400);
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-6"
      >
        <div className="flex items-start justify-between gap-4 mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary fill-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-hot-issues-title">
                {pageTitle}
              </h1>
              <p className="text-sm text-muted-foreground">{pageSubtitle}</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 shrink-0"
            data-testid="button-refresh-hot-issues"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            {isKo ? "새로고침" : isJa ? "更新" : "Refresh"}
          </button>
        </div>

        {/* Time + filter row */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {dataUpdatedAt ? formatFetchTime(dataUpdatedAt, lang) : "—"}
            {hotCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                <Flame className="w-2.5 h-2.5" />
                {hotCount} HOT
              </span>
            )}
          </div>
          {hotCount > 0 && (
            <button
              onClick={() => setFilterHot((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all",
                filterHot
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
              data-testid="button-filter-hot"
            >
              <Filter className="w-3 h-3" />
              {isKo ? "HOT만 보기" : isJa ? "HOTのみ" : "HOT only"}
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Issue List ── */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : allIssues.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 text-muted-foreground"
        >
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {isKo ? "현재 이슈가 없습니다" : isJa ? "現在ニュースがありません" : "No issues right now"}
          </p>
          <p className="text-xs mt-1">
            {isKo ? "잠시 후 다시 확인해 주세요" : isJa ? "しばらくしてから再度ご確認ください" : "Check back soon"}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {/* Initial items */}
          <AnimatePresence mode="popLayout">
            {initialIssues.map((issue, idx) => (
              <IssueCard key={`init-${idx}`} issue={issue} idx={idx} lang={lang} />
            ))}
          </AnimatePresence>

          {/* More items (revealed on Load More) */}
          <AnimatePresence>
            {showMore && moreIssues.map((issue, idx) => (
              <motion.div
                key={`more-${idx}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.06, ease: "easeOut" }}
              >
                <IssueCard issue={issue} idx={INITIAL_COUNT + idx} lang={lang} />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Load More button */}
          {hasMore && !showMore && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="pt-2"
            >
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed transition-all duration-200 text-sm font-semibold",
                  "border-primary/30 text-primary hover:border-primary hover:bg-primary/5 active:scale-[0.98]",
                  isLoadingMore && "opacity-60 cursor-not-allowed"
                )}
                data-testid="button-load-more-issues"
              >
                {isLoadingMore ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {isKo ? "불러오는 중..." : isJa ? "読み込み中..." : "Loading..."}
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    {isKo
                      ? `관련 뉴스 더보기 (${moreIssues.length}건)`
                      : isJa
                      ? `関連ニュースをもっと見る（${moreIssues.length}件）`
                      : `Load more news (${moreIssues.length} more)`}
                  </>
                )}
              </button>

              {/* Divider label */}
              <p className="text-center text-[11px] text-muted-foreground mt-2">
                {isKo
                  ? "최신순으로 추가 기사를 불러옵니다"
                  : isJa
                  ? "最新順に追加記事を読み込みます"
                  : "Additional articles sorted by recency"}
              </p>
            </motion.div>
          )}

          {/* "All loaded" message */}
          {showMore && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: moreIssues.length * 0.06 + 0.3 }}
              className="text-center text-[11px] text-muted-foreground pt-2"
            >
              {isKo ? "✓ 모든 이슈를 불러왔습니다" : isJa ? "✓ すべてのニュースを読み込みました" : "✓ All issues loaded"}
            </motion.p>
          )}
        </div>
      )}

      {/* Footer note */}
      {!isLoading && allIssues.length > 0 && (
        <p className="text-center text-xs text-muted-foreground mt-8">
          {isKo
            ? "* AI가 영문 뉴스를 한국어로 번역 요약합니다. 20분마다 자동 갱신됩니다."
            : isJa
            ? "* AIが英文ニュースを日本語に翻訳・要約します。20分ごとに自動更新されます。"
            : "* AI translates and summarizes news. Auto-refreshes every 20 min."}
        </p>
      )}
    </div>
  );
}
