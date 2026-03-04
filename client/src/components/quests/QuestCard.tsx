import { useState } from "react";
import { type Quest } from "@shared/schema";
import { cn } from "@/lib/utils";
import {
  Check, X, HelpCircle, ChevronRight, BookOpen, LineChart, Newspaper,
  Search, Scale, Dumbbell, CheckCircle2, PieChart, DollarSign,
  BarChart2, Shield, UserCheck, TrendingUp, Activity, Globe, Zap
} from "lucide-react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { useCompleteQuest } from "@/hooks/use-quests";
import { translations } from "@/lib/translations";
import { useUser } from "@/hooks/use-user";
import { useEggs } from "@/hooks/use-eggs";
import { Badge } from "@/components/ui/badge";

interface QuestCardProps {
  quest: Quest;
  questNumber?: number;
}

const FINANCIAL_KEYWORDS = [
  /\b(P\/E|PER|EPS|RSI|MACD|ROE|ROA|EBITDA|DCF|WACC|EV\/EBIT|EV\/EBITDA|P\/S|P\/B|PBR|PEG)\b/gi,
  /\b(Bull Flag|Bear Flag|Head and Shoulders|Double Top|Double Bottom|Golden Cross|Death Cross)\b/gi,
  /\b(상승 깃발형|하락 깃발형|골든 크로스|데스 크로스|삼중 천정|이중 바닥)\b/g,
  /\b[A-Z]{2,5}\b(?=\s*[\(\)은는이가의를]|\s*\()/g,
  /\b\d+(\.\d+)?%/g,
  /\$\d[\d,]*(\.\d+)?/g,
  /₩[\d,]+/g,
  /\b(삼성전자|현대차|SK하이닉스|LG에너지솔루션|네이버|카카오|셀트리온|POSCO홀딩스|기아|LG화학)\b/g,
  /\b(Apple|Microsoft|Google|Amazon|NVIDIA|Tesla|Meta|Netflix|Disney|Coca-Cola)\b/gi,
  /\b(AAPL|MSFT|GOOGL|AMZN|NVDA|TSLA|META|NFLX|DIS|KO|JPM|BAC|WMT|V|MA)\b/g,
];

function autoBoldFinancialTerms(text: string): string {
  if (text.includes('**')) return text;
  let result = text;
  const boldRanges: [number, number][] = [];
  for (const pattern of FINANCIAL_KEYWORDS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      boldRanges.push([match.index, match.index + match[0].length]);
    }
  }
  if (boldRanges.length === 0) return text;
  boldRanges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of boldRanges) {
    if (merged.length > 0 && range[0] <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], range[1]);
    } else {
      merged.push([...range]);
    }
  }
  let output = '';
  let lastEnd = 0;
  for (const [start, end] of merged) {
    output += text.slice(lastEnd, start);
    output += `**${text.slice(start, end)}**`;
    lastEnd = end;
  }
  output += text.slice(lastEnd);
  return output;
}

function renderBoldText(text: string): (string | JSX.Element)[] {
  const processed = autoBoldFinancialTerms(text);
  const parts = processed.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <span key={i} className="font-bold text-foreground">{part.slice(2, -2)}</span>;
    }
    return part;
  });
}

type QuestType = 'term' | 'pattern' | 'news' | 'search' | 'compare' | 'valuation' | 'practice' | 'sector' | 'dividend' | 'earnings' | 'hedge' | 'insider' | 'rrg' | 'chart' | 'economic' | 'macro_action';

const TYPE_CONFIG: Record<string, { icon: JSX.Element; bgClass: string; ko: string; en: string }> = {
  term:        { icon: <BookOpen className="w-6 h-6 text-secondary" />,      bgClass: "bg-secondary/20",   ko: "용어 마스터",    en: "Term Master" },
  pattern:     { icon: <LineChart className="w-6 h-6 text-primary" />,       bgClass: "bg-primary/20",     ko: "패턴 분석",      en: "Pattern Analysis" },
  news:        { icon: <Newspaper className="w-6 h-6 text-accent" />,        bgClass: "bg-accent/20",      ko: "시장 동향",      en: "Market Pulse" },
  search:      { icon: <Search className="w-6 h-6 text-blue-500" />,         bgClass: "bg-blue-500/15",    ko: "종목 탐색",      en: "Stock Search" },
  compare:     { icon: <Scale className="w-6 h-6 text-orange-500" />,        bgClass: "bg-orange-500/15",  ko: "종목 비교",      en: "Stock Compare" },
  valuation:   { icon: <BarChart2 className="w-6 h-6 text-green-500" />,     bgClass: "bg-green-500/15",   ko: "가치평가",       en: "Valuation" },
  practice:    { icon: <Dumbbell className="w-6 h-6 text-purple-500" />,     bgClass: "bg-purple-500/15",  ko: "연습",           en: "Practice" },
  sector:      { icon: <PieChart className="w-6 h-6 text-teal-500" />,       bgClass: "bg-teal-500/15",    ko: "섹터 분석",      en: "Sector Rotation" },
  dividend:    { icon: <DollarSign className="w-6 h-6 text-emerald-500" />,  bgClass: "bg-emerald-500/15", ko: "배당 수집",      en: "Dividend Collector" },
  earnings:    { icon: <TrendingUp className="w-6 h-6 text-cyan-500" />,     bgClass: "bg-cyan-500/15",    ko: "실적 분석",      en: "Earnings Season" },
  hedge:       { icon: <Shield className="w-6 h-6 text-red-500" />,          bgClass: "bg-red-500/15",     ko: "헤지 전략",      en: "Hedge Strategy" },
  insider:     { icon: <UserCheck className="w-6 h-6 text-violet-500" />,    bgClass: "bg-violet-500/15",  ko: "인사이더 추적",  en: "Insider Follow" },
  rrg:         { icon: <Activity className="w-6 h-6 text-indigo-500" />,     bgClass: "bg-indigo-500/15",  ko: "RRG 섹터 분석",  en: "RRG Sector" },
  chart:       { icon: <LineChart className="w-6 h-6 text-pink-500" />,      bgClass: "bg-pink-500/15",    ko: "프로 차트 분석", en: "Chart Pro" },
  economic:    { icon: <Globe className="w-6 h-6 text-amber-500" />,         bgClass: "bg-amber-500/15",   ko: "경제 지표 읽기", en: "Economic Data" },
  macro_action:{ icon: <Zap className="w-6 h-6 text-yellow-500" />,          bgClass: "bg-yellow-500/15",  ko: "오늘의 실전 과제",en: "Daily Mission" },
};

const TIER_CONFIG = {
  beginner:     { emoji: "🥚", ko: "아기 공룡",    en: "Baby Dino",     color: "border-green-500/40 text-green-600 dark:text-green-400 bg-green-500/5" },
  intermediate: { emoji: "🦕", ko: "랩터 헌터",   en: "Raptor Hunter", color: "border-teal-500/40 text-teal-600 dark:text-teal-400 bg-teal-500/5" },
  advanced:     { emoji: "🦖", ko: "T-Rex 투자자", en: "T-Rex Investor",color: "border-orange-500/40 text-orange-600 dark:text-orange-400 bg-orange-500/5" },
};

export function QuestCard({ quest, questNumber }: QuestCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const completeQuest = useCompleteQuest();
  const { data: user } = useUser();
  const { addXpToEggs } = useEggs();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];

  const skillLevel = (user?.skillLevel || "beginner") as keyof typeof TIER_CONFIG;
  const tier = TIER_CONFIG[skillLevel] || TIER_CONFIG.beginner;

  const options = quest.options as string[];
  const isCorrect = selectedOption === quest.correctAnswer;
  const typeKey = quest.type as string;
  const typeConf = TYPE_CONFIG[typeKey] || TYPE_CONFIG.term;

  const handleSubmit = () => {
    if (selectedOption === null) return;
    setIsSubmitted(true);
    completeQuest.mutate(
      { questId: quest.id, answerIndex: selectedOption },
      {
        onSuccess: (data) => {
          if (data.correct) {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#a855f7', '#0ea5e9'] });
            addXpToEggs(quest.xpReward);
          }
        }
      }
    );
  };

  if (quest.isCompleted && !isExpanded) {
    return (
      <div
        className="bg-card/50 border border-primary/20 p-4 md:p-5 rounded-xl flex items-center justify-between gap-3"
        data-testid={`quest-completed-${quest.id}`}
      >
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
            <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            {questNumber && (
              <p className="text-[10px] font-bold text-muted-foreground mb-0.5">
                {lang === "ko" ? `퀘스트 ${questNumber}` : `Quest ${questNumber}`}
              </p>
            )}
            <h3 className="font-bold text-[0.8rem] md:text-sm text-foreground/60 line-through decoration-primary/40 leading-snug">
              {renderBoldText(quest.question)}
            </h3>
            <p className="text-primary font-semibold text-xs mt-0.5">
              {t.completed} +{quest.xpReward} XP
            </p>
          </div>
        </div>
        <Badge variant="outline" className={`shrink-0 text-[10px] ${tier.color}`}>
          {tier.emoji} {lang === "ko" ? tier.ko : tier.en}
        </Badge>
      </div>
    );
  }

  return (
    <motion.div
      layout
      className={cn(
        "bg-card border border-border rounded-xl transition-all duration-300 shadow-md",
        isExpanded ? "ring-2 ring-primary/20" : "hover:border-primary/50 hover:shadow-lg cursor-pointer"
      )}
      onClick={() => !isExpanded && setIsExpanded(true)}
      data-testid={`quest-card-${quest.id}`}
    >
      <div className="p-4 md:p-6">
        <div className="flex items-start justify-between gap-3 mb-3 md:mb-4">
          <div className="flex items-start gap-3 md:gap-4 min-w-0 flex-1">
            <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shadow-inner shrink-0 mt-0.5", typeConf.bgClass)}>
              {typeConf.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {lang === "ko" ? typeConf.ko : typeConf.en}
                  {questNumber && <span className="ml-1 text-muted-foreground/50">#{questNumber}</span>}
                </p>
                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${tier.color}`}>
                  {tier.emoji} {lang === "ko" ? tier.ko : tier.en}
                </Badge>
              </div>
              <h3 className="font-display font-bold text-[0.9rem] md:text-[1.05rem] leading-[1.5]">
                {renderBoldText(quest.question)}
              </h3>
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase">{t.reward}</span>
            <span className="font-mono font-bold text-secondary text-base md:text-lg">+{quest.xpReward} XP</span>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 md:mt-5 space-y-3"
            >
              {options.map((option, idx) => (
                <button
                  key={idx}
                  disabled={isSubmitted || quest.isCompleted}
                  onClick={(e) => { e.stopPropagation(); setSelectedOption(idx); }}
                  className={cn(
                    "w-full p-4 md:p-5 rounded-xl text-left font-medium transition-all duration-200 border-2 relative",
                    "text-[0.95rem] md:text-base leading-[1.6]",
                    selectedOption === idx
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background/50 hover:border-primary/50 text-foreground",
                    isSubmitted && idx === quest.correctAnswer && "border-green-500 bg-green-500/20 text-green-600 dark:text-green-400",
                    isSubmitted && selectedOption === idx && idx !== quest.correctAnswer && "border-destructive bg-destructive/10 text-destructive"
                  )}
                  data-testid={`option-${quest.id}-${idx}`}
                >
                  <span className="relative z-10">{renderBoldText(option)}</span>
                  {isSubmitted && idx === quest.correctAnswer && (
                    <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                  )}
                  {isSubmitted && selectedOption === idx && idx !== quest.correctAnswer && (
                    <X className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-destructive" />
                  )}
                </button>
              ))}

              {!isSubmitted && !quest.isCompleted ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
                  disabled={selectedOption === null || completeQuest.isPending}
                  className="w-full mt-4 bg-primary text-primary-foreground font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:translate-y-[-2px] active:translate-y-[0px] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base"
                  data-testid="button-check-answer"
                >
                  {completeQuest.isPending ? t.checking : t.check_answer}
                </button>
              ) : (
                <div className={cn(
                  "mt-4 p-4 md:p-5 rounded-xl border",
                  isCorrect || quest.isCompleted ? "bg-green-500/10 border-green-500/20" : "bg-destructive/10 border-destructive/20"
                )}>
                  <p className="font-bold mb-1.5 text-sm md:text-base">
                    {isCorrect || quest.isCompleted ? t.correct_answer : t.wrong_answer}
                  </p>
                  <p className="text-sm md:text-[0.95rem] opacity-90 leading-[1.6]">
                    {renderBoldText(quest.explanation || '')}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!isExpanded && (
          <div className="flex justify-end mt-3">
            <span className="text-sm font-semibold text-primary flex items-center gap-1">
              {t.start_quest} <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
