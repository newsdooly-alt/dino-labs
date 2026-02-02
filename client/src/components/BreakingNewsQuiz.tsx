import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";

interface NewsQuizData {
  id: string;
  headline: string;
  symbol: string;
  companyName: string;
  correctAnswer: "bullish" | "bearish";
  explanation: string;
}

export function BreakingNewsQuiz() {
  const [answered, setAnswered] = useState(false);
  const [userAnswer, setUserAnswer] = useState<"bullish" | "bearish" | null>(null);
  const queryClient = useQueryClient();

  const { data: user } = useUser();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];

  const { data: quiz, isLoading, refetch } = useQuery<NewsQuizData>({
    queryKey: ["/api/news/quiz", lang],
    queryFn: async () => {
      const res = await fetch(`/api/news/quiz?lang=${lang}`);
      if (!res.ok) throw new Error("Failed to fetch quiz");
      return res.json();
    },
    staleTime: 0, // Always fetch fresh quiz
  });

  const handleAnswer = (answer: "bullish" | "bearish") => {
    setUserAnswer(answer);
    setAnswered(true);
  };

  const handleNext = () => {
    setAnswered(false);
    setUserAnswer(null);
    refetch();
  };

  const isCorrect = userAnswer === quiz?.correctAnswer;

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 animate-pulse" data-testid="news-quiz-loading">
        <div className="h-6 bg-muted rounded w-2/3 mb-4" />
        <div className="h-20 bg-muted rounded mb-4" />
        <div className="flex gap-3">
          <div className="h-12 bg-muted rounded flex-1" />
          <div className="h-12 bg-muted rounded flex-1" />
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-card border border-border rounded-3xl p-6 shadow-lg"
      data-testid="news-quiz-card"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          {t.breaking_news_quiz}
        </h3>
        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-bold">
          +15 {t.xp}
        </span>
      </div>

      <div className="mb-4">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider" data-testid="text-stock-info">
          {quiz?.symbol} - {quiz?.companyName}
        </span>
      </div>

      <p className="text-base font-medium leading-relaxed mb-6 min-h-[60px]" data-testid="text-headline">
        "{quiz?.headline}"
      </p>

      <AnimatePresence mode="wait">
        {!answered ? (
          <motion.div 
            key="buttons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex gap-3"
          >
            <Button 
              onClick={() => handleAnswer("bullish")}
              className="flex-1 rounded-2xl"
              variant="outline"
              size="lg"
              data-testid="button-bullish"
            >
              <TrendingUp className="w-5 h-5 mr-2 text-primary" />
              {t.bullish}
            </Button>
            <Button 
              onClick={() => handleAnswer("bearish")}
              className="flex-1 rounded-2xl"
              variant="outline"
              size="lg"
              data-testid="button-bearish"
            >
              <TrendingDown className="w-5 h-5 mr-2 text-destructive" />
              {t.bearish}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className={cn(
              "p-4 rounded-2xl border",
              isCorrect 
                ? "bg-primary/10 border-primary/20 text-primary" 
                : "bg-destructive/10 border-destructive/20 text-destructive"
            )} data-testid="quiz-result">
              <div className="font-bold mb-1">
                {isCorrect ? `${t.correct} +15 ${t.xp}` : t.not_quite}
              </div>
              <p className="text-sm opacity-80">
                {t.dino_says}: "{quiz?.explanation}"
              </p>
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
