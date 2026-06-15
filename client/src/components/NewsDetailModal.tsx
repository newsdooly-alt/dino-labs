import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ExternalLink, Loader2, Sparkles, Clock, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";

export interface NewsItem {
  title: string;
  summary: string;
  link: string;
  publisher: string;
  publishedAt: number;
  symbol: string;
  isHot: boolean;
  isMarketImpact?: boolean;
}

interface NewsDetail {
  bullets_ko: string[];
  bullets_en: string[];
  bullets_ja: string[];
  ko: string;
  en: string;
  ja: string;
}

interface Props {
  item: NewsItem | null;
  onClose: () => void;
}

type Lang = "ko" | "en" | "ja";

interface TabDef { key: Lang; label: string; short: string }
const LANG_TABS: TabDef[] = [
  { key: "ko", label: "한국어", short: "KR" },
  { key: "en", label: "English", short: "EN" },
  { key: "ja", label: "日本語",  short: "JP" },
];

const SYMBOL_NAMES: Record<string, { ko: string; en: string; ja: string }> = {
  "NVDA":      { ko: "엔비디아",        en: "NVIDIA",              ja: "エヌビディア" },
  "AAPL":      { ko: "애플",           en: "Apple",               ja: "アップル" },
  "TSLA":      { ko: "테슬라",         en: "Tesla",               ja: "テスラ" },
  "MSFT":      { ko: "마이크로소프트",   en: "Microsoft",           ja: "マイクロソフト" },
  "AMZN":      { ko: "아마존",         en: "Amazon",              ja: "アマゾン" },
  "META":      { ko: "메타",           en: "Meta",                ja: "メタ" },
  "GOOGL":     { ko: "구글",           en: "Google",              ja: "グーグル" },
  "JPM":       { ko: "JP모건",         en: "JPMorgan",            ja: "JPモルガン" },
  "GS":        { ko: "골드만삭스",      en: "Goldman Sachs",       ja: "ゴールドマン・サックス" },
  "V":         { ko: "비자",           en: "Visa",                ja: "ビザ" },
  "XOM":       { ko: "엑슨모빌",       en: "ExxonMobil",          ja: "エクソンモービル" },
  "CVX":       { ko: "쉐브론",         en: "Chevron",             ja: "シェブロン" },
  "JNJ":       { ko: "존슨앤존슨",      en: "Johnson & Johnson",   ja: "ジョンソン・エンド・ジョンソン" },
  "UNH":       { ko: "유나이티드헬스",   en: "UnitedHealth",        ja: "ユナイテッドヘルス" },
  "WMT":       { ko: "월마트",         en: "Walmart",             ja: "ウォルマート" },
  "BA":        { ko: "보잉",           en: "Boeing",              ja: "ボーイング" },
  "005930.KS": { ko: "삼성전자",        en: "Samsung Electronics", ja: "サムスン電子" },
  "000660.KS": { ko: "SK하이닉스",     en: "SK Hynix",            ja: "SKハイニックス" },
  "035420.KS": { ko: "네이버",         en: "NAVER",               ja: "ネイバー" },
  "7203.T":    { ko: "도요타",         en: "Toyota",              ja: "トヨタ" },
  "6758.T":    { ko: "소니",           en: "Sony",                ja: "ソニー" },
  // Macro assets
  "CL=F":      { ko: "WTI 원유",       en: "WTI Crude Oil",       ja: "WTI原油" },
  "GC=F":      { ko: "금 (Gold)",      en: "Gold Futures",        ja: "金先物" },
  "^TNX":      { ko: "미국채 10년",     en: "10-Yr Treasury Yield",ja: "米国債10年" },
  "SPY":       { ko: "S&P 500 ETF",   en: "S&P 500 ETF",         ja: "S&P500 ETF" },
  "TLT":       { ko: "미국장기채 ETF",  en: "US Long Bond ETF",    ja: "米国長期債ETF" },
};

const PUBLISHER_COLORS: Record<string, string> = {
  "reuters":        "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  "bloomberg":      "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "yahoo finance":  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "cnbc":           "bg-red-500/15 text-red-600 dark:text-red-400",
  "marketwatch":    "bg-green-500/15 text-green-600 dark:text-green-400",
  "seekingalpha":   "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "wsj":            "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  "ft":             "bg-pink-500/15 text-pink-600 dark:text-pink-400",
};

function publisherColor(pub: string): string {
  const key = pub.toLowerCase().replace(/\s+/g, " ");
  for (const [k, v] of Object.entries(PUBLISHER_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "bg-muted text-muted-foreground";
}

function formatTimestamp(ts: number, lang: string): string {
  const d = new Date(ts * 1000);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  if (lang === "ko") return `${Y}. ${M}. ${D}. ${h}:${m}`;
  if (lang === "ja") return `${Y}年${M}月${D}日 ${h}:${m}`;
  return `${Y}-${M}-${D} ${h}:${m}`;
}

function timeAgoShort(ts: number, lang: string): string {
  const diff = Math.floor((Date.now() - ts * 1000) / 60000);
  if (diff < 1)  return lang === "ko" ? "방금" : lang === "ja" ? "たった今" : "just now";
  if (diff < 60) return lang === "ko" ? `${diff}분 전` : lang === "ja" ? `${diff}分前` : `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24)    return lang === "ko" ? `${h}시간 전` : lang === "ja" ? `${h}時間前` : `${h}h ago`;
  return formatTimestamp(ts, lang);
}

export function NewsDetailModal({ item, onClose }: Props) {
  const { data: user } = useUser();
  const userLang = (user?.language || "ko") as Lang;
  const [activeLang, setActiveLang] = useState<Lang>(userLang);
  const [detail, setDetail] = useState<NewsDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!item) { setDetail(null); setError(false); return; }
    setActiveLang(userLang);
    setDetail(null);
    setError(false);
    setLoading(true);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;

    fetch("/api/news/detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: item.title,
        summary: item.summary,
        publisher: item.publisher,
        symbol: item.symbol,
        isMarketImpact: item.isMarketImpact || false,
      }),
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: NewsDetail) => { setDetail(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [item?.title]);

  useEffect(() => {
    if (!item) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [item, onClose]);

  const bullets =
    activeLang === "ko" ? (detail?.bullets_ko ?? []) :
    activeLang === "ja" ? (detail?.bullets_ja ?? []) :
    (detail?.bullets_en ?? []);

  const bodyText = detail ? (detail[activeLang] || "") : "";
  const symNames = item ? (SYMBOL_NAMES[item.symbol] || null) : null;
  const companyName = symNames ? (symNames[activeLang] || item?.symbol) : item?.symbol;

  const sourceLabel = {
    ko: "출처", en: "Source", ja: "情報源",
  }[activeLang];

  const viewOriginalLabel = {
    ko: "원문 보기", en: "View original", ja: "原文を見る",
  }[activeLang];

  const aiSummaryLabel = item?.isMarketImpact
    ? ({ ko: "AI 시장 영향 분석", en: "AI Market Impact Analysis", ja: "AI市場影響分析" }[activeLang])
    : ({ ko: "AI 요약", en: "AI Summary", ja: "AI要約" }[activeLang]);

  const readingLabel = {
    ko: "읽는 중", en: "Reading", ja: "閲覧中",
  }[activeLang];

  const analyzingLabel = {
    ko: "AI가 분석 중입니다...", en: "AI is analyzing...", ja: "AIが分析中です...",
  }[activeLang];

  const errorLabel = {
    ko: "분석을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    en: "Could not load analysis. Please try again later.",
    ja: "分析を読み込めませんでした。後でもう一度お試しください。",
  }[activeLang];

  const noBodyLabel = {
    ko: "분석 내용이 없습니다.",
    en: "No analysis available.",
    ja: "分析内容がありません。",
  }[activeLang];

  return createPortal(
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/55 backdrop-blur-[2px] z-50"
            onClick={onClose}
            data-testid="news-modal-backdrop"
          />

          {/* Panel centering wrapper — bottom on mobile, center on desktop */}
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6 pointer-events-none">
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="pointer-events-auto w-full md:max-w-[640px] max-h-[calc(100dvh-48px)] md:max-h-[88vh] flex flex-col bg-background rounded-t-[28px] md:rounded-2xl shadow-2xl overflow-hidden"
            data-testid="news-detail-modal"
          >
            {/* Drag pill (mobile) */}
            <div className="md:hidden flex justify-center pt-3 shrink-0">
              <div className="w-9 h-1 rounded-full bg-border/70" />
            </div>

            {/* ── Top bar ── */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-3 shrink-0">
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                data-testid="button-close-news-modal"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-foreground flex-1">
                {activeLang === "ko" ? "뉴스 상세" : activeLang === "ja" ? "ニュース詳細" : "Article Detail"}
              </span>
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                  data-testid="link-news-topbar-original"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* ── Meta row: source badge + timestamp ── */}
            <div className="flex items-center gap-2.5 px-5 pb-2 shrink-0">
              {item.publisher && (
                <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full", publisherColor(item.publisher))}>
                  {item.publisher}
                </span>
              )}
              {item.isMarketImpact && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white flex items-center gap-0.5">
                  <Globe2 className="w-2.5 h-2.5" />
                  {activeLang === "ko" ? "시장 영향" : activeLang === "ja" ? "市場影響" : "Market Impact"}
                </span>
              )}
              {item.isHot && !item.isMarketImpact && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                  HOT
                </span>
              )}
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
                <Clock className="w-3 h-3" />
                {item.publishedAt
                  ? timeAgoShort(item.publishedAt, activeLang)
                  : "—"}
              </div>
            </div>

            {/* ── Title ── */}
            <div className="px-5 pb-4 shrink-0">
              <h1 className="text-[17px] font-bold leading-snug text-foreground tracking-tight" data-testid="news-modal-title">
                {item.title}
              </h1>
              {companyName && (
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                  <Globe2 className="w-3 h-3" />
                  {companyName} · {item.symbol}
                </p>
              )}
            </div>

            {/* ── Language tabs ── */}
            <div className="px-5 pb-3 shrink-0">
              <div className="flex gap-1.5 p-1 bg-muted rounded-xl w-fit">
                {LANG_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveLang(tab.key)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
                      activeLang === tab.key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    data-testid={`tab-news-lang-${tab.key}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 space-y-5">

              {/* Instant preview: show existing Korean summary while AI loads */}
              {loading && item.summary && (
                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {activeLang === "ko" ? "기사 요약" : activeLang === "ja" ? "記事概要" : "Article Summary"}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{item.summary}</p>
                </div>
              )}

              {/* AI Summary card */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">
                    {aiSummaryLabel}
                  </span>
                  {loading && (
                    <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {activeLang === "ko" ? "AI 분석 중..." : activeLang === "ja" ? "AI分析中..." : "Analyzing..."}
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="space-y-2.5">
                    {[90, 80, 70].map((w, i) => (
                      <div
                        key={i}
                        className="h-3.5 rounded-md bg-primary/10 animate-pulse"
                        style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                  </div>
                ) : error ? (
                  <p className="text-xs text-muted-foreground italic">{errorLabel}</p>
                ) : bullets.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">{noBodyLabel}</p>
                ) : (
                  <ul className="space-y-2">
                    {bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                        <span className="text-primary font-bold shrink-0 mt-0.5 text-base leading-none">✦</span>
                        <span className="leading-snug">{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Divider + full analysis — only show once loaded */}
              {!loading && !error && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                      {activeLang === "ko" ? "전문 분석" : activeLang === "ja" ? "詳細分析" : "Full Analysis"}
                    </span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>

                  <div
                    className="text-[15px] leading-[1.85] text-foreground/85 whitespace-pre-line font-serif-var tracking-[0.01em]"
                    data-testid="news-modal-body"
                  >
                    {bodyText || (
                      <span className="text-muted-foreground italic text-sm">{noBodyLabel}</span>
                    )}
                  </div>
                </>
              )}

              {error && (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe2 className="w-10 h-10 mx-auto mb-3 opacity-25" />
                  <p className="text-sm">{errorLabel}</p>
                </div>
              )}

              {/* Footer: source + original link */}
              <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-semibold">{sourceLabel}:</span>
                  <span>{item.publisher || "—"}</span>
                </div>
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline underline-offset-2"
                    data-testid="link-news-original"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {viewOriginalLabel}
                  </a>
                )}
              </div>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
