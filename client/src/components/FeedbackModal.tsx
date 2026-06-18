import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, CheckCircle2 } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMOJIS = [
  { icon: "💡", label: "아이디어" },
  { icon: "✨", label: "좋아요" },
  { icon: "🐛", label: "버그" },
  { icon: "💬", label: "기타" },
];

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [emoji, setEmoji] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), emoji: emoji || null }),
      });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setMessage("");
        setEmoji("");
        onClose();
      }, 1800);
    } catch {
      // silent fail
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (sending) return;
    setMessage("");
    setEmoji("");
    setSent(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={handleClose}
          >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="w-full max-w-[420px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {sent ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
                <CheckCircle2 className="w-12 h-12 text-primary" />
                <p className="text-base font-semibold text-foreground">Dino에게 전달됐어요 🦖</p>
                <p className="text-xs text-muted-foreground">소중한 의견 감사해요!</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <div>
                    <h2 className="text-[15px] font-bold text-foreground tracking-tight">📡 DinoLab Signal</h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">어떤 의견이든 Dino에게 직접 닿아요</p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-close-feedback"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-5 pb-5 space-y-4">
                  {/* Emoji picker */}
                  <div className="flex gap-2">
                    {EMOJIS.map((e) => (
                      <button
                        key={e.icon}
                        onClick={() => setEmoji(emoji === e.icon ? "" : e.icon)}
                        className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border text-xs transition-all ${
                          emoji === e.icon
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40"
                        }`}
                        data-testid={`button-emoji-${e.icon}`}
                      >
                        <span className="text-lg">{e.icon}</span>
                        <span className="text-[10px]">{e.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Text area */}
                  <div className="relative">
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                      placeholder="좋은 점, 불편한 점, 원하는 기능... 자유롭게 남겨주세요 🦕"
                      rows={4}
                      className="w-full resize-none rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                      data-testid="input-feedback-message"
                    />
                    <span className="absolute bottom-2.5 right-3 text-[10px] text-muted-foreground tabular-nums">
                      {message.length}/500
                    </span>
                  </div>

                  {/* Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={!message.trim() || sending}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    data-testid="button-submit-feedback"
                  >
                    {sending ? (
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {sending ? "전송 중..." : "Signal 보내기"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
