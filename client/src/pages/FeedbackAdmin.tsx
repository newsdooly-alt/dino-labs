import { useState } from "react";
import { Eye, EyeOff, RefreshCw, MessageSquare, Lock } from "lucide-react";

interface FeedbackItem {
  id: number;
  message: string;
  emoji: string | null;
  createdAt: string;
}

export default function FeedbackAdmin() {
  const [key, setKey] = useState(() => sessionStorage.getItem("dlab_admin_key") || "");
  const [showKey, setShowKey] = useState(false);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!key.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/feedback/list", {
        headers: { Authorization: `Bearer ${key.trim()}` },
      });
      if (res.status === 403) {
        setError("🔐 잘못된 키예요. 다시 확인해주세요.");
        setItems([]);
      } else if (!res.ok) {
        setError("서버 오류가 발생했어요.");
      } else {
        const data = await res.json();
        setItems(data);
        sessionStorage.setItem("dlab_admin_key", key.trim());
      }
    } catch {
      setError("네트워크 오류.");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-bold flex items-center gap-2 mb-1">
          <span>📡</span> DinoLab Signal — Admin
        </h1>
        <p className="text-sm text-muted-foreground">사용자 피드백 모아보기</p>
      </div>

      {/* Key input */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type={showKey ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="FEEDBACK_ADMIN_KEY 입력"
            className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            data-testid="input-admin-key"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <button
          onClick={load}
          disabled={loading || !key.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40"
          data-testid="button-load-feedback"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          불러오기
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Feedback list */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <MessageSquare className="w-4 h-4" />
            총 <strong className="text-foreground">{items.length}개</strong>의 Signal
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors"
              data-testid={`card-feedback-${item.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {item.emoji && <span className="text-xl shrink-0 mt-0.5">{item.emoji}</span>}
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                    {item.message}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                  {fmt(item.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && !error && key && (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">아직 Signal이 없어요</p>
        </div>
      )}
    </div>
  );
}
