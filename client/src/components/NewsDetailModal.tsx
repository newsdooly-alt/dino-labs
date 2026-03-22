import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Loader2, BookOpen, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";

interface NewsItem {
  title: string;
  summary: string;
  link: string;
  publisher: string;
  publishedAt: number;
  symbol: string;
  isHot: boolean;
}

interface NewsDetail {
  bullets_ko: string[];
  bullets_en: string[];
  ko: string;
  en: string;
  ja: string;
}

interface Props {
  item: NewsItem | null;
  onClose: () => void;
}

type Lang = "ko" | "en" | "ja";

const LANG_TABS: { key: Lang; label: string }[] = [
  { key: "ko", label: "한국어" },
  { key: "en", label: "English" },
  { key: "ja", label: "日本語" },
];

const SYMBOL_NAMES: Record<string, string> = {
  "NVDA": "NVIDIA", "AAPL": "Apple", "TSLA": "Tesla", "MSFT": "Microsoft",
  "AMZN": "Amazon", "META": "Meta", "GOOGL": "Google",
  "005930.KS": "삼성전자", "000660.KS": "SK하이닉스", "035420.KS": "NAVER",
  "7203.T": "Toyota", "6758.T": "Sony",
};

function timeAgoFull(ts: number, lang: string): string {
  const diff = Math.floor((Date.now() - ts * 1000) / 60000);
  if (diff < 1) return lang === "ko" ? "방금 전" : lang === "ja" ? "たった今" : "just now";
  if (diff < 60) return lang === "ko" ? `${diff}분 전` : lang === "ja" ? `${diff}分前` : `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return lang === "ko" ? `${h}시간 전` : lang === "ja" ? `${h}時間前` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return lang === "ko" ? `${d}일 전` : lang === "ja" ? `${d}日前` : `${d}d ago`;
}

export function NewsDetailModal({ item, onClose }: Props) {
  const { data: user } = useUser();
  const userLang = (user?.language || "ko") as Lang;
  const [activeLang, setActiveLang] = useState<Lang>(userLang);
  const [detail, setDetail] = useState<NewsDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!item) {
      setDetail(null);
      setError(false);
      return;
    }
    setActiveLang(userLang);
    setDetail(null);
    setError(false);
    setLoading(true);

    fetch("/api/news/detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: item.title,
        summary: item.summary,
        publisher: item.publisher,
        symbol: item.symbol,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("failed");
        return r.json();
      })
      .then((d: NewsDetail) => {
        setDetail(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [item?.title]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  const bullets = activeLang === "ko"
    ? (detail?.bullets_ko || [])
    : (detail?.bullets_en || []);

  const bodyText = detail ? (detail[activeLang] || "") : "";

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
            data-testid="news-modal-backdrop"
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ opacity: 0, y: 48, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            className="fixed inset-x-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[680px] md:max-h-[85vh] z-50 flex flex-col bg-card border border-border rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[92vh] overflow-hidden"
            data-testid="news-detail-modal"
          >
            {/* Drag handle (mobile) */}
            <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-start gap-3 px-5 pt-3 pb-4 border-b border-border shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {item.isHot && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                      HOT
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {SYMBOL_NAMES[item.symbol] || item.symbol} · {timeAgoFull(item.publishedAt, userLang)}
                  </span>
                </div>
                <h2 className="text-base font-bold text-foreground leading-snug line-clamp-3" data-testid="news-modal-title">
                  {item.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 mt-0.5"
                data-testid="button-close-news-modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* AI Summary bullets */}
              <div className="px-5 py-4 border-b border-border/60 bg-primary/5">
                <div className="flex items-center gap-1.5 mb-3">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wide">
                    {userLang === "ko" ? "AI 핵심 요약" : userLang === "ja" ? "AIによる要約" : "AI Summary"}
                  </span>
                </div>

                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-4 rounded-lg bg-muted animate-pulse" style={{ width: `${80 + i * 5}%` }} />
                    ))}
                  </div>
                ) : error ? (
                  <p className="text-sm text-muted-foreground italic">
                    {userLang === "ko" ? "요약 생성 실패. 원문을 확인해 주세요." : userLang === "ja" ? "要約の生成に失敗しました。" : "Could not generate summary."}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="text-primary font-bold shrink-0 mt-0.5">▸</span>
                        <span className="leading-snug">{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Language tabs */}
              <div className="px-5 pt-4 pb-2 border-b border-border/40 shrink-0">
                <div className="flex gap-1.5">
                  {LANG_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveLang(tab.key)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                        activeLang === tab.key
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                      )}
                      data-testid={`tab-news-lang-${tab.key}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body text */}
              <div className="px-5 py-4">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {userLang === "ko" ? "AI가 분석 중입니다..." : userLang === "ja" ? "AIが分析中です..." : "AI is analyzing..."}
                    </p>
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <Globe className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      {userLang === "ko" ? "분석 생성 중 오류가 발생했습니다." : "Failed to load analysis."}
                    </p>
                  </div>
                ) : (
                  <div
                    className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line"
                    data-testid="news-modal-body"
                  >
                    {bodyText || (
                      <span className="text-muted-foreground italic">
                        {activeLang === "ko" ? "분석 내용이 없습니다." : activeLang === "ja" ? "分析内容がありません。" : "No analysis available."}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {userLang === "ko" ? "출처" : userLang === "ja" ? "情報源" : "Source"}: {item.publisher || "—"}
                </span>
              </div>
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline shrink-0"
                  data-testid="link-news-original"
                >
                  <ExternalLink className="w-3 h-3" />
                  {userLang === "ko" ? "원문 보기" : userLang === "ja" ? "原文を見る" : "View original"}
                </a>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
