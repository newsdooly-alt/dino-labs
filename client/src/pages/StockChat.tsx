import { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "@/hooks/use-user";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, Sparkles, RefreshCw, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTIONS: Record<string, string[]> = {
  ko: [
    "엔비디아(NVDA)가 왜 이렇게 비싼 건가요? 🤔",
    "PER(주가수익비율)이 뭔가요? 쉽게 설명해줘",
    "워런 버핏처럼 투자하려면 어떻게 해야 해요?",
    "삼성전자와 애플, 어떤 점이 다른가요?",
    "ETF가 뭔지, 왜 투자하면 좋은지 알려줘",
    "주식 시장에서 공매도란 무엇인가요?",
    "배당주 투자가 뭔지 쉽게 설명해줘",
    "S&P 500 지수가 뭔가요?",
  ],
  en: [
    "Why is NVDA stock so expensive? 🤔",
    "What is a P/E ratio? Explain simply",
    "How does Warren Buffett pick stocks?",
    "Compare Samsung vs Apple as investments",
    "What are ETFs and should I invest?",
    "What does 'short selling' mean?",
    "Explain dividend investing simply",
    "What is the S&P 500 index?",
  ],
  ja: [
    "NVDAの株はなぜこんなに高いの？ 🤔",
    "PER（株価収益率）を簡単に教えて",
    "ウォーレン・バフェットの投資法は？",
    "サムスンとアップル、どちらがいい？",
    "ETFって何？投資すべき？",
    "空売りとは何ですか？",
    "配当投資をわかりやすく説明して",
    "S&P500って何ですか？",
  ],
};

const LABELS: Record<string, Record<string, string>> = {
  ko: {
    title: "AI 주식 전문가",
    subtitle: "초보자도 이해하는 주식 설명",
    placeholder: "주식에 관해 무엇이든 물어보세요...",
    send: "전송",
    thinking: "분석 중...",
    clear: "대화 초기화",
    greeting: `안녕하세요! 저는 DinoBot 🦖이에요.\n\n주식 시장에 대한 모든 질문에 답해드릴게요. 복잡한 금융 개념도 **초등학생도 이해할 수 있게** 쉽게 설명해 드립니다!\n\n아무 질문이나 해보세요. 빠른 질문 버튼을 눌러도 좋아요! 👇`,
    disclaimer: "이 대화는 교육 목적이며 투자 조언이 아닙니다.",
    suggestions: "자주 묻는 질문",
  },
  en: {
    title: "AI Stock Expert",
    subtitle: "Stock explanations anyone can understand",
    placeholder: "Ask anything about stocks...",
    send: "Send",
    thinking: "Thinking...",
    clear: "Clear chat",
    greeting: `Hi there! I'm DinoBot 🦖.\n\nI can answer all your questions about the stock market. I'll explain even complex financial concepts in a way that **anyone can understand** — even a 10-year-old!\n\nFeel free to ask me anything, or pick a quick question below! 👇`,
    disclaimer: "This conversation is for educational purposes only, not financial advice.",
    suggestions: "Quick questions",
  },
  ja: {
    title: "AI株式エキスパート",
    subtitle: "誰でも理解できる株式解説",
    placeholder: "株式について何でも聞いてください...",
    send: "送信",
    thinking: "分析中...",
    clear: "会話をリセット",
    greeting: `こんにちは！DinoBot 🦖です。\n\n株式市場に関するすべての質問に答えます。複雑な金融概念も**小学生でも理解できるように**わかりやすく説明します！\n\n何でも質問してください！👇`,
    disclaimer: "この会話は教育目的であり、投資アドバイスではありません。",
    suggestions: "よくある質問",
  },
};

function renderContent(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold text-primary">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function MessageBubble({ msg, lang }: { msg: ChatMessage; lang: string }) {
  const isUser = msg.role === "user";
  const timeStr = msg.timestamp.toLocaleTimeString(
    lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US",
    { hour: "2-digit", minute: "2-digit" }
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={cn("flex gap-3 max-w-full", isUser && "flex-row-reverse")}
    >
      {!isUser && (
        <div className="w-9 h-9 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-base shrink-0 mt-1 shadow-sm">
          🦖
        </div>
      )}
      <div className={cn("flex flex-col gap-1 max-w-[82%]", isUser && "items-end")}>
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-card border border-border rounded-tl-sm"
          )}
        >
          {msg.content.split("\n").map((line, i) => (
            <p key={i} className={i > 0 ? "mt-1.5" : ""}>
              {renderContent(line)}
            </p>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground px-1">{timeStr}</span>
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex gap-3"
    >
      <div className="w-9 h-9 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-base shrink-0 shadow-sm">
        🦖
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-card border border-border shadow-sm flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-primary/60"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default function StockChat() {
  const { data: user } = useUser();
  const lang = ((user?.language || "ko") as string).startsWith("ja") ? "ja" : ((user?.language || "ko") as string) === "ko" ? "ko" : "en";
  const L = LABELS[lang] || LABELS.ko;
  const suggestions = SUGGESTIONS[lang] || SUGGESTIONS.ko;

  const greetingMsg: ChatMessage = {
    id: "greeting",
    role: "assistant",
    content: L.greeting,
    timestamp: new Date(),
  };

  const [messages, setMessages] = useState<ChatMessage[]>([greetingMsg]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== "greeting")
        .map(m => ({ role: m.role, content: m.content }));

      const res = await apiRequest("POST", "/api/chat/stock", {
        message: trimmed,
        history,
        lang,
      });
      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply || "죄송해요, 잠시 후 다시 시도해주세요.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: lang === "ko" ? "죄송해요, 오류가 발생했어요. 잠시 후 다시 시도해주세요! 🙏" :
                 lang === "ja" ? "申し訳ありません。しばらくしてからもう一度お試しください。🙏" :
                 "Sorry, something went wrong. Please try again! 🙏",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [isLoading, messages, lang]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([{ ...greetingMsg, timestamp: new Date() }]);
    setInput("");
  };

  const showSuggestions = messages.length <= 1;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen max-h-screen overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm px-4 md:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-xl shadow-sm">
            🦖
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              {L.title}
              <Badge className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border-primary/20 font-bold">AI</Badge>
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {L.subtitle}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearChat}
          className="text-muted-foreground hover:text-foreground gap-2 text-xs"
          data-testid="button-clear-chat"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{L.clear}</span>
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} lang={lang} />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {isLoading && <TypingIndicator />}
        </AnimatePresence>

        {/* Suggestion chips */}
        <AnimatePresence>
          {showSuggestions && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3 pt-2"
            >
              <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 px-1">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                {L.suggestions}
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => sendMessage(s)}
                    className="text-xs px-3 py-2 rounded-xl border-2 border-border bg-background hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all text-left font-medium"
                    data-testid={`suggestion-${i}`}
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Disclaimer */}
      <div className="shrink-0 px-4 md:px-6 py-1.5">
        <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
          <Bot className="w-3 h-3" />
          {L.disclaimer}
        </p>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur-sm px-4 md:px-6 py-4">
        <div className="flex gap-3 items-end max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={L.placeholder}
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-2xl border-2 border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors pr-4 min-h-[48px] max-h-32 overflow-y-auto placeholder:text-muted-foreground disabled:opacity-50"
              style={{ height: "auto" }}
              onInput={e => {
                const el = e.target as HTMLTextAreaElement;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 128) + "px";
              }}
              data-testid="input-chat-message"
            />
          </div>
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="rounded-2xl h-12 w-12 p-0 shrink-0 shadow-md"
            data-testid="button-send-chat"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <RefreshCw className="w-4 h-4" />
              </motion.div>
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          {lang === "ko" ? "Enter로 전송, Shift+Enter로 줄 바꿈" :
           lang === "ja" ? "Enterで送信、Shift+Enterで改行" :
           "Press Enter to send, Shift+Enter for new line"}
        </p>
      </div>
    </div>
  );
}
