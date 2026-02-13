import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useEggs } from "@/hooks/use-eggs";
import { translations } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { Check, X, RefreshCw, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import confetti from "canvas-confetti";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface PracticeQuest {
  userId: string;
  type: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  xpReward: number;
}

export function PracticeMode() {
  const { data: user } = useUser();
  const { addXpToEggs } = useEggs();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [questCount, setQuestCount] = useState(0);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];

  const { data: quest, isLoading, refetch } = useQuery<PracticeQuest>({
    queryKey: ["/api/quests/practice", questCount],
    queryFn: async () => {
      const res = await fetch("/api/quests/practice", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch practice quest");
      return res.json();
    },
    staleTime: 0,
  });

  const completeMutation = useMutation({
    mutationFn: async (answerIndex: number) => {
      return apiRequest("POST", "/api/quests/practice/complete", {
        answerIndex,
        correctAnswer: quest?.correctAnswer
      });
    },
    onSuccess: (data) => {
      if (data.correct) {
        setTotalXpEarned(prev => prev + 5);
        addXpToEggs(5);
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#a855f7', '#22c55e']
        });
        queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      }
    }
  });

  const handleSubmit = () => {
    if (selectedOption === null || !quest) return;
    setIsSubmitted(true);
    completeMutation.mutate(selectedOption);
  };

  const handleNext = () => {
    setSelectedOption(null);
    setIsSubmitted(false);
    setQuestCount(prev => prev + 1);
    refetch();
  };

  const isCorrect = selectedOption === quest?.correctAnswer;

  if (isLoading || !quest) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <Dumbbell className="w-4 h-4" />
          {lang === "ko" ? `문제 ${questCount + 1}` : `Question ${questCount + 1}`}
        </span>
        <span className="font-mono font-bold text-purple-500">
          +{totalXpEarned} XP {lang === "ko" ? "획득" : "earned"}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{quest.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quest.options.map((option, idx) => (
            <button
              key={idx}
              disabled={isSubmitted}
              onClick={() => setSelectedOption(idx)}
              className={cn(
                "w-full p-4 rounded-xl text-left font-medium transition-all duration-200 border-2 relative overflow-hidden",
                selectedOption === idx 
                  ? "border-primary bg-primary/10 text-primary" 
                  : "border-border bg-background/50 hover:border-primary/50 text-foreground",
                isSubmitted && idx === quest.correctAnswer && "border-green-500 bg-green-500/20 text-green-500",
                isSubmitted && selectedOption === idx && idx !== quest.correctAnswer && "border-destructive bg-destructive/10 text-destructive"
              )}
              data-testid={`option-${idx}`}
            >
              <span className="relative z-10">{option}</span>
              {isSubmitted && idx === quest.correctAnswer && (
                <Check className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
              )}
              {isSubmitted && selectedOption === idx && idx !== quest.correctAnswer && (
                <X className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-destructive" />
              )}
            </button>
          ))}

          {!isSubmitted ? (
            <Button
              onClick={handleSubmit}
              disabled={selectedOption === null || completeMutation.isPending}
              className="w-full mt-4"
              data-testid="button-check-practice"
            >
              {completeMutation.isPending ? t.checking : t.check_answer}
            </Button>
          ) : (
            <>
              <div className={cn(
                "mt-4 p-4 rounded-xl border",
                isCorrect ? "bg-green-500/10 border-green-500/20" : "bg-destructive/10 border-destructive/20"
              )}>
                <p className="font-bold mb-1">
                  {isCorrect ? t.correct_answer : t.wrong_answer}
                </p>
                <p className="text-sm opacity-90">{quest.explanation}</p>
                {isCorrect && (
                  <p className="text-sm font-bold text-purple-500 mt-2">+5 XP</p>
                )}
              </div>
              <Button
                onClick={handleNext}
                className="w-full mt-4"
                data-testid="button-next-practice"
              >
                {lang === "ko" ? "다음 문제" : "Next Question"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
