import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, RefreshCw, Zap, BarChart3, Newspaper, Activity, ArrowUpDown, DollarSign, Globe, LineChart, Factory } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { useEggs } from "@/hooks/use-eggs";
import { translations } from "@/lib/translations";

type QuizCategory = 'valuation' | 'impact' | 'technical' | 'movement';

interface NewsQuizData {
  id: string;
  headline: string;
  symbol: string;
  companyName: string;
  category: QuizCategory;
  options: [string, string];
  correctAnswerIndex: number;
  explanation: string;
  source?: string;
}

const categoryIcons: Record<QuizCategory, { first: typeof TrendingUp; second: typeof TrendingDown }> = {
  valuation: { first: TrendingUp, second: TrendingDown },
  impact:    { first: Newspaper, second: Newspaper },
  technical: { first: Activity, second: Activity },
  movement:  { first: TrendingUp, second: TrendingDown },
};

const categoryColors: Record<QuizCategory, { first: string; second: string }> = {
  valuation: { first: 'text-destructive', second: 'text-primary' },
  impact:    { first: 'text-primary', second: 'text-destructive' },
  technical: { first: 'text-destructive', second: 'text-primary' },
  movement:  { first: 'text-primary', second: 'text-destructive' },
};

const sourceLabels: Record<string, { en: string; ko: string; icon: typeof Zap }> = {
  live_news:        { en: 'News', ko: '뉴스', icon: Newspaper },
  pe_ratios:        { en: 'Valuation', ko: '밸류에이션', icon: BarChart3 },
  dividend_yield:   { en: 'Dividend', ko: '배당', icon: DollarSign },
  technical_rsi:    { en: 'RSI', ko: 'RSI', icon: Activity },
  fear_greed:       { en: 'Sentiment', ko: '심리', icon: ArrowUpDown },
  earnings:         { en: 'Earnings', ko: '실적', icon: BarChart3 },
  macro_events:     { en: 'Macro', ko: '매크로', icon: Globe },
  moving_average:   { en: 'MA Signal', ko: 'MA 신호', icon: LineChart },
  industry_trends:  { en: 'Industry', ko: '산업', icon: Factory },
  kospi_news:       { en: 'KOSPI', ko: 'KOSPI', icon: Globe },
};

function renderHighlightedText(text: string): (string | JSX.Element)[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const keyword = part.slice(2, -2);
      return (
        <span key={i} className="font-bold text-primary">
          {keyword}
        </span>
      );
    }
    return part;
  });
}

export function BreakingNewsQuiz() {
  const [answered, setAnswered] = useState(false);
  const [userAnswer, setUserAnswer] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: user } = useUser();
  const { addXpToEggs } = useEggs();
  const lang = (user?.language || "ko") as keyof typeof translations;
  const level = user?.skillLevel || "beginner";
  const t = translations[lang];

  const { data: quiz, isLoading, refetch } = useQuery<NewsQuizData>({
    queryKey: ["/api/news/quiz", lang, level],
    queryFn: async () => {
      const res = await fetch(`/api/news/quiz?lang=${lang}&level=${level}`);
      if (!res.ok) throw new Error("Failed to fetch quiz");
      return res.json();
    },
    staleTime: 0,
  });

  const handleAnswer = (answerIndex: number) => {
    setUserAnswer(answerIndex);
    setAnswered(true);
    if (answerIndex === quiz?.correctAnswerIndex) {
      addXpToEggs(15);
    }
  };

  const handleNext = () => {
    setAnswered(false);
    setUserAnswer(null);
    refetch();
  };

  const isCorrect = userAnswer === quiz?.correctAnswerIndex;
  const category = quiz?.category || 'impact';
  const icons = categoryIcons[category];
  const colors = categoryColors[category];
  const FirstIcon = icons.first;
  const SecondIcon = icons.second;

  const sourceInfo = sourceLabels[quiz?.source || 'live_news'] || sourceLabels.live_news;
  const SourceIcon = sourceInfo.icon;

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-3xl p-5 md:p-6 animate-pulse" data-testid="news-quiz-loading">
        <div className="h-6 bg-muted rounded w-2/3 mb-4" />
        <div className="h-24 bg-muted rounded mb-4" />
        <div className="flex flex-col gap-3">
          <div className="h-12 bg-muted rounded" />
          <div className="h-12 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-card border border-border rounded-3xl p-5 md:p-6 shadow-lg"
      data-testid="news-quiz-card"
    >
      <div className="flex items-center justify-between gap-2 mb-3 md:mb-4">
        <h3 className="font-display font-bold text-base md:text-lg flex items-center gap-2">
          <Zap className="w-4 h-4 md:w-5 md:h-5 text-yellow-500 shrink-0" />
          {t.breaking_news_quiz}
        </h3>
        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-bold shrink-0">
          +15 {t.xp}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3 md:mb-4 flex-wrap">
        <Badge variant="outline" className="text-xs gap-1">
          <SourceIcon className="w-3 h-3" />
          {lang === 'ko' ? sourceInfo.ko : sourceInfo.en}
        </Badge>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider" data-testid="text-stock-info">
          {quiz?.symbol} - {quiz?.companyName}
        </span>
      </div>

      <div className="text-sm md:text-base font-medium leading-relaxed md:leading-relaxed mb-5 md:mb-6 min-h-[60px]" data-testid="text-headline">
        {renderHighlightedText(quiz?.headline || '')}
      </div>

      <AnimatePresence mode="wait">
        {!answered ? (
          <motion.div 
            key="buttons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3"
          >
            <Button 
              onClick={() => handleAnswer(0)}
              className="w-full rounded-2xl"
              variant="outline"
              size="lg"
              data-testid="button-option-0"
            >
              <FirstIcon className={cn("w-5 h-5 mr-2 shrink-0", colors.first)} />
              <span>{quiz?.options?.[0] || 'Option A'}</span>
            </Button>
            <Button 
              onClick={() => handleAnswer(1)}
              className="w-full rounded-2xl"
              variant="outline"
              size="lg"
              data-testid="button-option-1"
            >
              <SecondIcon className={cn("w-5 h-5 mr-2 shrink-0", colors.second)} />
              <span>{quiz?.options?.[1] || 'Option B'}</span>
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 md:space-y-4"
          >
            <div className={cn(
              "p-4 rounded-2xl border",
              isCorrect 
                ? "bg-primary/10 border-primary/20 text-primary" 
                : "bg-destructive/10 border-destructive/20 text-destructive"
            )} data-testid="quiz-result">
              <div className="font-bold mb-1 text-sm md:text-base">
                {isCorrect ? `${t.correct} +15 ${t.xp}` : t.not_quite}
              </div>
              <div className="text-xs md:text-sm opacity-80 leading-relaxed">
                {t.dino_says}: {renderHighlightedText(quiz?.explanation || '')}
              </div>
            </div>

            <Button 
              onClick={handleNext}
              className="w-full rounded-2xl"
              size="lg"
              data-testid="button-next-quiz"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {t.next_question}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
