import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { apiRequest } from "@/lib/queryClient";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Brain, Sparkles, ChevronRight, ChevronLeft, RotateCcw,
  TrendingUp, Shield, Target, Globe, Zap, Leaf, DollarSign,
  Building2, BarChart3, CheckCircle2, AlertCircle, BookOpen, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getLocalizedCompanyName } from "@/lib/stockNames";

interface PortfolioStock {
  symbol: string;
  name: string;
  allocation: number;
  reason: string;
  sector: string;
  marketCap: string;
  riskLevel: "low" | "medium" | "high";
}

interface PortfolioResult {
  portfolio: PortfolioStock[];
  summary: string;
  expectedReturn: string;
  riskLevel: string;
  sectorBreakdown: { sector: string; percentage: number }[];
  investmentNote: string;
}

type QuestionType = "slider" | "choice" | "multiChoice";

interface Question {
  id: string;
  type: QuestionType;
  icon: React.ComponentType<{ className?: string }>;
  label: { ko: string; en: string; ja: string };
  question: { ko: string; en: string; ja: string };
  minLabel?: { ko: string; en: string; ja: string };
  maxLabel?: { ko: string; en: string; ja: string };
  options?: { value: string; label: { ko: string; en: string; ja: string } }[];
  multiple?: boolean;
}

interface Answers {
  riskTolerance: number;
  horizon: string;
  returnTarget: number;
  stockCount: number;
  regions: string[];
  sectors: string[];
  style: string;
  marketCap: string;
  esg: number;
  investmentAmount: string;
}

const DEFAULT_ANSWERS: Answers = {
  riskTolerance: 5,
  horizon: "",
  returnTarget: 5,
  stockCount: 5,
  regions: [],
  sectors: [],
  style: "",
  marketCap: "",
  esg: 3,
  investmentAmount: "",
};

const SECTOR_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#ec4899", "#84cc16", "#14b8a6",
];

const QUESTIONS: Question[] = [
  {
    id: "riskTolerance",
    type: "slider",
    icon: Shield,
    label: { ko: "위험 성향", en: "Risk Tolerance", ja: "リスク許容度" },
    question: { ko: "시장이 갑자기 -30% 폭락한다면 어떻게 하시겠어요?", en: "If the market suddenly drops -30%, what would you do?", ja: "市場が突然-30%暴落したらどうしますか？" },
    minLabel: { ko: "즉시 전량 매도 😰", en: "Sell everything 😰", ja: "全て売却 😰" },
    maxLabel: { ko: "전부 추가 매수 💪", en: "Buy the dip 💪", ja: "全て買い増し 💪" },
  },
  {
    id: "horizon",
    type: "choice",
    icon: TrendingUp,
    label: { ko: "투자 기간", en: "Investment Horizon", ja: "投資期間" },
    question: { ko: "이 포트폴리오를 얼마나 오래 보유할 계획인가요?", en: "How long do you plan to hold this portfolio?", ja: "このポートフォリオをどのくらい保有しますか？" },
    options: [
      { value: "short", label: { ko: "⚡ 3개월 미만", en: "⚡ Under 3 months", ja: "⚡ 3ヶ月未満" } },
      { value: "mid_short", label: { ko: "📅 6개월~1년", en: "📅 6 months~1 year", ja: "📅 6ヶ月~1年" } },
      { value: "medium", label: { ko: "🌱 1~3년", en: "🌱 1~3 years", ja: "🌱 1~3年" } },
      { value: "long", label: { ko: "🏔️ 3~10년", en: "🏔️ 3~10 years", ja: "🏔️ 3~10年" } },
      { value: "ultra", label: { ko: "🏆 10년 이상", en: "🏆 10+ years", ja: "🏆 10年以上" } },
    ],
  },
  {
    id: "returnTarget",
    type: "slider",
    icon: Target,
    label: { ko: "수익 목표", en: "Return Target", ja: "リターン目標" },
    question: { ko: "연간 기대 수익률은 얼마나 되나요?", en: "What annual return do you expect?", ja: "年間どのくらいのリターンを期待しますか？" },
    minLabel: { ko: "안전 위주 (~3%) 🛡️", en: "Safety first (~3%) 🛡️", ja: "安全重視 (~3%) 🛡️" },
    maxLabel: { ko: "고수익 목표 (30%+) 🚀", en: "High return (30%+) 🚀", ja: "高収益 (30%+) 🚀" },
  },
  {
    id: "stockCount",
    type: "slider",
    icon: BarChart3,
    label: { ko: "종목 집중도", en: "Concentration", ja: "集中度" },
    question: { ko: "몇 개 종목으로 포트폴리오를 구성할까요?", en: "How many stocks in your portfolio?", ja: "何銘柄でポートフォリオを構成しますか？" },
    minLabel: { ko: "5개 집중형 🎯", en: "5 stocks (focused) 🎯", ja: "5銘柄 (集中型) 🎯" },
    maxLabel: { ko: "25개 분산형 🌐", en: "25 stocks (diversified) 🌐", ja: "25銘柄 (分散型) 🌐" },
  },
  {
    id: "regions",
    type: "multiChoice",
    icon: Globe,
    label: { ko: "투자 지역", en: "Regions", ja: "投資地域" },
    question: { ko: "어느 시장에 투자하고 싶으신가요? (복수 선택 가능)", en: "Which markets? (Multiple OK)", ja: "どの市場に投資しますか？（複数選択可）" },
    options: [
      { value: "us", label: { ko: "🇺🇸 미국", en: "🇺🇸 United States", ja: "🇺🇸 アメリカ" } },
      { value: "kr", label: { ko: "🇰🇷 한국", en: "🇰🇷 Korea", ja: "🇰🇷 韓国" } },
      { value: "jp", label: { ko: "🇯🇵 일본", en: "🇯🇵 Japan", ja: "🇯🇵 日本" } },
      { value: "cn", label: { ko: "🇨🇳 중국", en: "🇨🇳 China", ja: "🇨🇳 中国" } },
      { value: "eu", label: { ko: "🇪🇺 유럽", en: "🇪🇺 Europe", ja: "🇪🇺 欧州" } },
    ],
    multiple: true,
  },
  {
    id: "sectors",
    type: "multiChoice",
    icon: Building2,
    label: { ko: "관심 섹터", en: "Sectors of Interest", ja: "関心セクター" },
    question: { ko: "관심 있는 섹터를 모두 선택하세요", en: "Select all sectors you're interested in", ja: "興味のあるセクターを全て選択してください" },
    options: [
      { value: "tech", label: { ko: "💻 기술·AI", en: "💻 Tech & AI", ja: "💻 テクノロジー・AI" } },
      { value: "finance", label: { ko: "🏦 금융", en: "🏦 Finance", ja: "🏦 金融" } },
      { value: "healthcare", label: { ko: "⚕️ 헬스케어", en: "⚕️ Healthcare", ja: "⚕️ ヘルスケア" } },
      { value: "energy", label: { ko: "⚡ 에너지", en: "⚡ Energy", ja: "⚡ エネルギー" } },
      { value: "consumer", label: { ko: "🛒 소비재", en: "🛒 Consumer", ja: "🛒 消費財" } },
      { value: "industrial", label: { ko: "🏭 산업재", en: "🏭 Industrial", ja: "🏭 産業" } },
      { value: "materials", label: { ko: "⚗️ 소재", en: "⚗️ Materials", ja: "⚗️ 素材" } },
      { value: "real_estate", label: { ko: "🏘️ 부동산", en: "🏘️ Real Estate", ja: "🏘️ 不動産" } },
      { value: "utilities", label: { ko: "💡 유틸리티", en: "💡 Utilities", ja: "💡 公益" } },
    ],
    multiple: true,
  },
  {
    id: "style",
    type: "choice",
    icon: Zap,
    label: { ko: "투자 스타일", en: "Investment Style", ja: "投資スタイル" },
    question: { ko: "어떤 투자 스타일을 선호하시나요?", en: "Which investment style do you prefer?", ja: "どの投資スタイルを好みますか？" },
    options: [
      { value: "growth", label: { ko: "📈 성장주 — 빠른 성장, 높은 변동성", en: "📈 Growth — Fast growth, high volatility", ja: "📈 グロース — 高成長・高変動" } },
      { value: "value", label: { ko: "💎 가치주 — 저평가 우량주 발굴", en: "💎 Value — Undervalued quality stocks", ja: "💎 バリュー — 割安優良株" } },
      { value: "dividend", label: { ko: "🎁 배당주 — 안정적 현금흐름", en: "🎁 Dividend — Stable cash flow", ja: "🎁 配当 — 安定キャッシュフロー" } },
      { value: "momentum", label: { ko: "⚡ 모멘텀 — 상승세 종목 추종", en: "⚡ Momentum — Follow the trend", ja: "⚡ モメンタム — トレンド追随" } },
      { value: "blend", label: { ko: "🔀 혼합형 — 균형 잡힌 접근", en: "🔀 Blend — Balanced approach", ja: "🔀 ブレンド — バランス型" } },
    ],
  },
  {
    id: "marketCap",
    type: "choice",
    icon: DollarSign,
    label: { ko: "기업 규모", en: "Market Cap", ja: "時価総額" },
    question: { ko: "선호하는 기업 규모는 무엇인가요?", en: "What company size do you prefer?", ja: "好みの企業規模は？" },
    options: [
      { value: "large", label: { ko: "🏛️ 대형주 — 삼성·애플 같은 검증된 기업", en: "🏛️ Large Cap — Proven giants like Apple, Samsung", ja: "🏛️ 大型株 — アップル・サムスンのような実績企業" } },
      { value: "mid", label: { ko: "🏢 중형주 — 성장 여력과 안정성 균형", en: "🏢 Mid Cap — Balance of growth & stability", ja: "🏢 中型株 — 成長と安定のバランス" } },
      { value: "small", label: { ko: "🚀 소형주 — 고위험 고수익 성장 기업", en: "🚀 Small Cap — High risk, high reward", ja: "🚀 小型株 — ハイリスク・ハイリターン" } },
      { value: "mixed", label: { ko: "🔀 혼합 — 규모 상관없이 최적 종목", en: "🔀 Mixed — Best picks regardless of size", ja: "🔀 混合 — 規模を問わず最適銘柄" } },
    ],
  },
  {
    id: "esg",
    type: "slider",
    icon: Leaf,
    label: { ko: "ESG 중요도", en: "ESG Priority", ja: "ESG重要度" },
    question: { ko: "친환경·사회책임 투자(ESG)를 얼마나 중시하나요?", en: "How important is sustainable investing (ESG) to you?", ja: "ESG（サステナブル投資）の重要度は？" },
    minLabel: { ko: "관심 없음 💰", en: "Not important 💰", ja: "重要でない 💰" },
    maxLabel: { ko: "ESG 최우선 🌿", en: "ESG first 🌿", ja: "ESG最優先 🌿" },
  },
  {
    id: "investmentAmount",
    type: "choice",
    icon: DollarSign,
    label: { ko: "투자 금액", en: "Investment Amount", ja: "投資金額" },
    question: { ko: "대략 어느 정도 금액을 투자할 계획인가요?", en: "How much are you planning to invest?", ja: "どのくらいの金額を投資しますか？" },
    options: [
      { value: "under1m", label: { ko: "💳 100만원 미만 / $1,000 미만", en: "💳 Under $1,000", ja: "💳 10万円未満" } },
      { value: "1m_10m", label: { ko: "💵 100만~1,000만원 / $1K~$10K", en: "💵 $1,000 ~ $10,000", ja: "💵 10万~100万円" } },
      { value: "10m_100m", label: { ko: "💰 1,000만원~1억 / $10K~$100K", en: "💰 $10,000 ~ $100,000", ja: "💰 100万~1000万円" } },
      { value: "over100m", label: { ko: "🏦 1억 이상 / $100K 이상", en: "🏦 Over $100,000", ja: "🏦 1000万円以上" } },
    ],
  },
];

const TOTAL_STEPS = QUESTIONS.length;

export default function AIPortfolio() {
  const { data: user } = useUser();
  const lang = (user?.language || "ko") as "en" | "ko" | "ja";

  const L = {
    title: lang === "ko" ? "AI 포트폴리오 빌더" : lang === "ja" ? "AIポートフォリオビルダー" : "AI Portfolio Builder",
    subtitle: lang === "ko" ? "10가지 맞춤 질문으로 나만의 포트폴리오를 구성해드립니다" : lang === "ja" ? "10の質問でカスタムポートフォリオを作成します" : "Answer 10 questions and get your personalized portfolio",
    start: lang === "ko" ? "포트폴리오 만들기" : lang === "ja" ? "ポートフォリオを作成" : "Build My Portfolio",
    next: lang === "ko" ? "다음" : lang === "ja" ? "次へ" : "Next",
    back: lang === "ko" ? "이전" : lang === "ja" ? "前へ" : "Back",
    generate: lang === "ko" ? "✨ 포트폴리오 생성!" : lang === "ja" ? "✨ ポートフォリオを作成！" : "✨ Generate Portfolio!",
    generating: lang === "ko" ? "AI가 포트폴리오를 분석 중..." : lang === "ja" ? "AIがポートフォリオを分析中..." : "AI is analyzing your portfolio...",
    result_title: lang === "ko" ? "나만의 맞춤 포트폴리오" : lang === "ja" ? "カスタムポートフォリオ" : "Your Custom Portfolio",
    rebuild: lang === "ko" ? "다시 만들기" : lang === "ja" ? "再作成" : "Rebuild",
    allocation: lang === "ko" ? "배분" : lang === "ja" ? "配分" : "Allocation",
    reason: lang === "ko" ? "선정 이유" : lang === "ja" ? "選定理由" : "Why This Stock",
    expected_return: lang === "ko" ? "기대 수익률" : lang === "ja" ? "期待リターン" : "Expected Return",
    risk_level: lang === "ko" ? "리스크 수준" : lang === "ja" ? "リ스크 수준" : "Risk Level",
    sector_breakdown: lang === "ko" ? "섹터 배분" : lang === "ja" ? "セクター配分" : "Sector Breakdown",
    stocks_selected: (n: number) => lang === "ko" ? `📊 선정 종목 (${n}개)` : lang === "ja" ? `📊 選定銘柄 (${n}銘柄)` : `📊 Selected Stocks (${n})`,
    disclaimer: lang === "ko" ? "이 포트폴리오는 교육 목적의 AI 생성 결과로, 실제 투자 권유가 아닙니다. 투자 전 전문가 상담을 권장합니다." : lang === "ja" ? "このポートフォリオは教育目的のAI生成結果であり、実際の投資アドバイスではありません。" : "This portfolio is AI-generated for educational purposes only and is not investment advice.",
    step_label: lang === "ko" ? "단계" : lang === "ja" ? "ステップ" : "Step",
    select_multi: lang === "ko" ? "해당하는 것을 모두 선택하세요" : lang === "ja" ? "該当するものを全て選択" : "Select all that apply",
    low: lang === "ko" ? "낮음" : "Low",
    medium: lang === "ko" ? "중간" : "Medium",
    high: lang === "ko" ? "높음" : "High",
    error: lang === "ko" ? "생성 중 오류가 발생했습니다. 다시 시도해주세요." : "Generation failed. Please try again.",
    retry: lang === "ko" ? "다시 시도" : "Retry",
    gen_step1: lang === "ko" ? "답변 분석 중..." : "Analyzing your answers...",
    gen_step2: lang === "ko" ? "최적 종목 선정 중..." : "Selecting optimal stocks...",
    gen_step3: lang === "ko" ? "포트폴리오 최적화 중..." : "Optimizing portfolio...",
  };

  const [step, setStep] = useState<number>(-1);
  const [answers, setAnswers] = useState<Answers>({ ...DEFAULT_ANSWERS });
  const [result, setResult] = useState<PortfolioResult | null>(null);
  const [expandedStocks, setExpandedStocks] = useState<Set<string>>(new Set());
  const [genError, setGenError] = useState(false);

  const portfolioMutation = useMutation({
    mutationFn: async (payload: object) => {
      const res = await apiRequest("POST", "/api/portfolio/generate", payload);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PortfolioResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setGenError(false);
      setStep(TOTAL_STEPS + 1);
    },
    onError: () => {
      setGenError(true);
      setStep(TOTAL_STEPS);
    },
  });

  const currentQuestion = step >= 0 && step < TOTAL_STEPS ? QUESTIONS[step] : null;

  const canProceed = useCallback(() => {
    if (!currentQuestion) return true;
    const val = answers[currentQuestion.id as keyof Answers];
    if (currentQuestion.type === "slider") return true;
    if (currentQuestion.type === "choice") return typeof val === "string" && val !== "";
    if (currentQuestion.type === "multiChoice") return Array.isArray(val) && val.length > 0;
    return false;
  }, [currentQuestion, answers]);

  const handleSlider = (id: string, val: number) =>
    setAnswers(prev => ({ ...prev, [id]: val }));

  const handleChoice = (id: string, value: string) =>
    setAnswers(prev => ({ ...prev, [id]: value }));

  const handleMultiChoice = (id: string, value: string) => {
    setAnswers(prev => {
      const current = (prev[id as keyof Answers] as string[]) || [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [id]: next };
    });
  };

  const handleNext = () => {
    if (step === TOTAL_STEPS - 1) {
      setGenError(false);
      setStep(TOTAL_STEPS);
      portfolioMutation.mutate({ ...answers, lang });
    } else {
      setStep(s => s + 1);
    }
  };

  const handleBack = () => setStep(s => Math.max(-1, s - 1));

  const handleReset = () => {
    setStep(-1);
    setAnswers({ ...DEFAULT_ANSWERS });
    setResult(null);
    setExpandedStocks(new Set());
    setGenError(false);
  };

  const toggleExpand = (symbol: string) => {
    setExpandedStocks(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol); else next.add(symbol);
      return next;
    });
  };

  const riskColor = (level: string) => {
    if (level === "low") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (level === "high") return "text-red-400 bg-red-500/10 border-red-500/30";
    return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  };
  const riskLabel = (level: string) => {
    if (level === "low") return L.low;
    if (level === "high") return L.high;
    return L.medium;
  };

  const getFlagEmoji = (symbol: string) => {
    if (symbol.endsWith(".KS") || symbol.endsWith(".KQ")) return "🇰🇷";
    if (symbol.endsWith(".T")) return "🇯🇵";
    if (["BABA", "JD", "PDD", "BIDU", "NIO", "XPEV", "LI"].includes(symbol)) return "🇨🇳";
    if (["ASML", "SAP", "NVO", "AZN", "LVMH", "MC"].includes(symbol)) return "🇪🇺";
    return "🇺🇸";
  };

  const cleanSymbol = (s: string) => s.replace(/\.(KS|KQ|T)$/, "");

  const SliderInput = ({ q }: { q: Question }) => {
    const val = answers[q.id as keyof Answers] as number;
    return (
      <div className="space-y-5">
        <div className="flex items-end gap-2">
          <span className="text-5xl font-bold text-primary tabular-nums">{val}</span>
          <span className="text-muted-foreground text-lg mb-1">/ 10</span>
        </div>
        <div className="relative">
          <input
            type="range" min={1} max={10} step={1}
            value={val}
            onChange={e => handleSlider(q.id, parseInt(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer accent-primary bg-muted/60"
            data-testid={`slider-${q.id}`}
          />
        </div>
        <div className="flex justify-between">
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button
              key={n} type="button"
              onClick={() => handleSlider(q.id, n)}
              className={cn(
                "flex flex-col items-center gap-1 transition-all",
                val === n ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn("w-1 h-3 rounded-full transition-all", val === n ? "bg-primary scale-125" : "bg-border")} />
              <span className="text-[9px] font-medium">{n}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          <span>{q.minLabel![lang]}</span>
          <span>{q.maxLabel![lang]}</span>
        </div>
      </div>
    );
  };

  const ChoiceInput = ({ q }: { q: Question }) => {
    const val = answers[q.id as keyof Answers];
    return (
      <div className="space-y-2">
        {q.options!.map(opt => (
          <button
            key={opt.value} type="button"
            onClick={() => handleChoice(q.id, opt.value)}
            data-testid={`choice-${q.id}-${opt.value}`}
            className={cn(
              "w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all duration-150 text-sm font-medium flex items-center gap-3",
              val === opt.value
                ? "border-primary bg-primary/10 text-primary shadow-[0_0_16px_rgba(34,197,94,0.12)]"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/40 text-foreground"
            )}
          >
            {val === opt.value && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{opt.label[lang]}</span>
          </button>
        ))}
      </div>
    );
  };

  const MultiChoiceInput = ({ q }: { q: Question }) => {
    const vals = (answers[q.id as keyof Answers] as string[]) || [];
    return (
      <div className="grid grid-cols-2 gap-2">
        {q.options!.map(opt => {
          const selected = vals.includes(opt.value);
          return (
            <button
              key={opt.value} type="button"
              onClick={() => handleMultiChoice(q.id, opt.value)}
              data-testid={`multi-${q.id}-${opt.value}`}
              className={cn(
                "px-3 py-3.5 rounded-xl border-2 transition-all duration-150 text-xs font-semibold text-center relative",
                selected
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-border bg-card hover:border-primary/30 hover:bg-muted/40 text-muted-foreground"
              )}
            >
              {selected && (
                <CheckCircle2 className="w-3 h-3 absolute top-1.5 right-1.5 text-primary" />
              )}
              {opt.label[lang]}
            </button>
          );
        })}
      </div>
    );
  };

  const isIntro = step === -1;
  const isQuestion = step >= 0 && step < TOTAL_STEPS;
  const isLoading = step === TOTAL_STEPS;
  const isResult = step === TOTAL_STEPS + 1;
  const progress = isQuestion ? ((step + 1) / TOTAL_STEPS) * 100 : 0;

  return (
    <div className="min-h-screen bg-background md:pl-64">
      <div className="max-w-2xl mx-auto min-h-screen flex flex-col">

        {/* Sticky header */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-8 py-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm text-foreground leading-none">{L.title}</h1>
            {isQuestion && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {L.step_label} {step + 1} / {TOTAL_STEPS}
              </p>
            )}
          </div>
          {!isIntro && (
            <button
              onClick={handleReset}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              data-testid="btn-reset-portfolio"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress bar (questions only) */}
        {isQuestion && (
          <div className="h-1 bg-muted/50">
            <motion.div
              className="h-full bg-primary"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        )}

        {/* ── INTRO ── */}
        {isIntro && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-6 py-10 space-y-6"
          >
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-lg shadow-primary/10">
              <Brain className="w-12 h-12 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">{L.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{L.subtitle}</p>
            </div>

            <div className="w-full max-w-sm space-y-2">
              {[
                lang === "ko" ? "✅ 10가지 맞춤형 질문" : "✅ 10 personalized questions",
                lang === "ko" ? "✅ AI가 종목 선정 이유 상세 설명" : "✅ AI explains every stock pick in detail",
                lang === "ko" ? "✅ 섹터·지역별 배분 시각화" : "✅ Visual sector & region allocation chart",
                lang === "ko" ? "✅ 위험도 & 기대수익 분석" : "✅ Risk & expected return analysis",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-foreground/80 bg-muted/30 rounded-xl px-4 py-2.5 border border-border/50">
                  {item}
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(0)}
              data-testid="btn-start-portfolio"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:scale-105 active:scale-95"
            >
              <Sparkles className="w-5 h-5" />
              {L.start}
            </button>
          </motion.div>
        )}

        {/* ── QUESTIONS ── */}
        {isQuestion && currentQuestion && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ x: 40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -40, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="space-y-6"
                >
                  {/* Question header */}
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <currentQuestion.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] text-primary font-bold uppercase tracking-widest">
                        {currentQuestion.label[lang]}
                      </p>
                      <h2 className="text-base font-bold text-foreground leading-snug mt-1">
                        {currentQuestion.question[lang]}
                      </h2>
                      {currentQuestion.type === "multiChoice" && (
                        <p className="text-[10px] text-muted-foreground mt-1">{L.select_multi}</p>
                      )}
                    </div>
                  </div>

                  {/* Input */}
                  {currentQuestion.type === "slider" && <SliderInput q={currentQuestion} />}
                  {currentQuestion.type === "choice" && <ChoiceInput q={currentQuestion} />}
                  {currentQuestion.type === "multiChoice" && <MultiChoiceInput q={currentQuestion} />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Nav buttons */}
            <div className="px-4 md:px-8 pb-5 pt-3 border-t border-border/50 flex gap-2 bg-background">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm font-medium"
                data-testid="btn-question-back"
              >
                <ChevronLeft className="w-4 h-4" />{L.back}
              </button>
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                data-testid="btn-question-next"
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all",
                  canProceed()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {step === TOTAL_STEPS - 1
                  ? L.generate
                  : <>{L.next}<ChevronRight className="w-4 h-4" /></>
                }
              </button>
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center py-16 space-y-6 px-6"
          >
            {genError ? (
              <div className="text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                <p className="text-sm text-foreground">{L.error}</p>
                <button
                  onClick={() => { setGenError(false); portfolioMutation.mutate({ ...answers, lang }); }}
                  className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
                  data-testid="btn-retry-portfolio"
                >
                  {L.retry}
                </button>
              </div>
            ) : (
              <>
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/15" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                  <Brain className="absolute inset-0 m-auto w-10 h-10 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-base font-semibold text-foreground">{L.generating}</p>
                  {[L.gen_step1, L.gen_step2, L.gen_step3].map((msg, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 1.5 }}
                      className="text-xs text-muted-foreground"
                    >
                      {msg}
                    </motion.p>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ── RESULT ── */}
        {isResult && result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pb-10"
          >
            {/* Result header */}
            <div className="px-4 md:px-8 py-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">{L.result_title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed max-w-xs">{result.summary}</p>
              </div>
              <button
                onClick={handleReset}
                data-testid="btn-rebuild-portfolio"
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/60 border border-border text-xs font-medium transition-colors"
              >
                <RefreshCw className="w-3 h-3" />{L.rebuild}
              </button>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-2 gap-3 px-4 md:px-8 mb-4">
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{L.expected_return}</p>
                <p className="text-lg font-bold text-emerald-400">{result.expectedReturn}</p>
              </div>
              <div className="bg-card rounded-2xl border border-border p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{L.risk_level}</p>
                <p className="text-lg font-bold text-amber-400">{result.riskLevel}</p>
              </div>
            </div>

            {/* Sector donut chart */}
            {result.sectorBreakdown && result.sectorBreakdown.length > 0 && (
              <div className="mx-4 md:mx-8 mb-4 bg-card rounded-2xl border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">{L.sector_breakdown}</h3>
                <div className="flex gap-4 items-center">
                  <div className="w-36 h-36 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={result.sectorBreakdown.map((s, i) => ({
                            name: s.sector,
                            value: s.percentage,
                            color: SECTOR_COLORS[i % SECTOR_COLORS.length],
                          }))}
                          cx="50%" cy="50%"
                          innerRadius={32} outerRadius={60}
                          dataKey="value"
                          strokeWidth={2}
                          stroke="hsl(var(--background))"
                        >
                          {result.sectorBreakdown.map((_, i) => (
                            <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: number) => [`${val}%`, ""]}
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "11px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {result.sectorBreakdown.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                        <span className="text-[11px] text-muted-foreground truncate flex-1">{d.sector}</span>
                        <span className="text-[11px] font-bold text-foreground">{d.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Stock cards */}
            <div className="px-4 md:px-8 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {L.stocks_selected(result.portfolio.length)}
              </h3>
              {result.portfolio.map((stock, idx) => {
                const isExpanded = expandedStocks.has(stock.symbol);
                const localName = getLocalizedCompanyName(stock.name, lang) || stock.name;
                const barColor = SECTOR_COLORS[idx % SECTOR_COLORS.length];
                const flag = getFlagEmoji(stock.symbol);

                return (
                  <div
                    key={stock.symbol}
                    className="bg-card rounded-2xl border border-border overflow-hidden"
                    data-testid={`stock-card-${stock.symbol}`}
                  >
                    {/* Color accent bar */}
                    <div className="h-1" style={{ background: barColor }} />

                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Rank + flag */}
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                            {idx + 1}
                          </div>
                          <span className="text-base leading-none">{flag}</span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm font-mono text-foreground">
                              {cleanSymbol(stock.symbol)}
                            </span>
                            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", riskColor(stock.riskLevel))}>
                              {riskLabel(stock.riskLevel)}
                            </span>
                            <span className="text-[9px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted/50 border border-border">
                              {stock.sector}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{localName}</p>
                        </div>

                        {/* Allocation */}
                        <div className="text-right shrink-0">
                          <p className="text-xl font-bold text-primary">{stock.allocation}%</p>
                          <p className="text-[9px] text-muted-foreground">{L.allocation}</p>
                        </div>
                      </div>

                      {/* Allocation bar */}
                      <div className="mt-3 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(stock.allocation * 3, 100)}%` }}
                          transition={{ duration: 0.6, delay: idx * 0.08 }}
                          style={{ background: barColor }}
                        />
                      </div>

                      {/* Expandable reason */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(stock.symbol)}
                        className="mt-3 w-full text-left group"
                        data-testid={`btn-expand-${stock.symbol}`}
                      >
                        <div className="flex items-center gap-1.5 text-[11px] text-primary font-semibold">
                          <BookOpen className="w-3 h-3" />
                          {L.reason}
                          <ChevronRight className={cn("w-3 h-3 ml-auto transition-transform duration-200", isExpanded && "rotate-90")} />
                        </div>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.p
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-xs text-foreground/80 leading-relaxed mt-2 overflow-hidden"
                            >
                              {stock.reason}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Investment note */}
            {result.investmentNote && (
              <div className="mx-4 md:mx-8 mt-4 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                <p className="text-xs text-blue-300/80 leading-relaxed">{result.investmentNote}</p>
              </div>
            )}

            {/* Disclaimer */}
            <div className="mx-4 md:mx-8 mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-300/80 leading-relaxed">{L.disclaimer}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
