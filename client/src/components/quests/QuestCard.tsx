import { useState } from "react";
import { type Quest } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Check, X, HelpCircle, ChevronRight, BookOpen, LineChart, Newspaper, Search, Scale, Dumbbell } from "lucide-react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { useCompleteQuest } from "@/hooks/use-quests";
import { translations } from "@/lib/translations";
import { useUser } from "@/hooks/use-user";

interface QuestCardProps {
  quest: Quest;
}

export function QuestCard({ quest }: QuestCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const completeQuest = useCompleteQuest();
  const { data: user } = useUser();
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];
  
  const options = quest.options as string[];
  const isCorrect = selectedOption === quest.correctAnswer;

  const handleSubmit = () => {
    if (selectedOption === null) return;
    
    setIsSubmitted(true);
    completeQuest.mutate(
      { questId: quest.id, answerIndex: selectedOption },
      {
        onSuccess: (data) => {
          if (data.correct) {
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#22c55e', '#a855f7', '#0ea5e9']
            });
          }
        }
      }
    );
  };

  const getIcon = () => {
    switch(quest.type) {
      case 'term': return <BookOpen className="w-6 h-6 text-secondary" />;
      case 'pattern': return <LineChart className="w-6 h-6 text-primary" />;
      case 'news': return <Newspaper className="w-6 h-6 text-accent" />;
      case 'search': return <Search className="w-6 h-6 text-blue-500" />;
      case 'compare': return <Scale className="w-6 h-6 text-orange-500" />;
      case 'valuation': return <Scale className="w-6 h-6 text-green-500" />;
      case 'practice': return <Dumbbell className="w-6 h-6 text-purple-500" />;
      default: return <HelpCircle className="w-6 h-6 text-muted-foreground" />;
    }
  };

  const getTypeLabel = () => {
    switch(quest.type) {
      case 'term': return lang === "ko" ? "오늘의 용어" : "Term of the Day";
      case 'pattern': return lang === "ko" ? "패턴 인식" : "Pattern Recognition";
      case 'news': return lang === "ko" ? "시장 동향" : "Market Pulse";
      case 'search': return t.quest_search;
      case 'compare': return t.quest_compare;
      case 'valuation': return t.quest_valuation;
      case 'practice': return t.quest_practice;
      default: return lang === "ko" ? "일일 퀘스트" : "Daily Quest";
    }
  };

  // If already completed before this session
  if (quest.isCompleted && !isExpanded) {
    return (
      <div className="bg-card/50 border border-primary/20 p-6 rounded-3xl flex items-center justify-between opacity-75 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground line-through decoration-primary/50">{quest.question}</h3>
            <p className="text-primary font-medium text-sm">{t.completed} +{quest.xpReward} XP</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      layout
      className={cn(
        "bg-card border border-border rounded-3xl overflow-hidden transition-all duration-300 shadow-lg",
        isExpanded ? "ring-2 ring-primary/20" : "hover:border-primary/50 hover:shadow-primary/5 cursor-pointer"
      )}
      onClick={() => !isExpanded && setIsExpanded(true)}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
              quest.type === 'term' ? "bg-secondary/20" : 
              quest.type === 'pattern' ? "bg-primary/20" : "bg-accent/20"
            )}>
              {getIcon()}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{getTypeLabel()}</p>
              <h3 className="font-display font-bold text-xl leading-tight">{quest.question}</h3>
            </div>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-xs font-bold text-muted-foreground uppercase">{t.reward}</span>
             <span className="font-mono font-bold text-secondary text-lg">+{quest.xpReward} XP</span>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 space-y-3"
            >
              {options.map((option, idx) => (
                <button
                  key={idx}
                  disabled={isSubmitted || quest.isCompleted}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOption(idx);
                  }}
                  className={cn(
                    "w-full p-4 rounded-xl text-left font-medium transition-all duration-200 border-2 relative overflow-hidden",
                    selectedOption === idx 
                      ? "border-primary bg-primary/10 text-primary" 
                      : "border-border bg-background/50 hover:border-primary/50 text-foreground",
                    isSubmitted && idx === quest.correctAnswer && "border-green-500 bg-green-500/20 text-green-500",
                    isSubmitted && selectedOption === idx && idx !== quest.correctAnswer && "border-destructive bg-destructive/10 text-destructive"
                  )}
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

              {!isSubmitted && !quest.isCompleted ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubmit();
                  }}
                  disabled={selectedOption === null || completeQuest.isPending}
                  className="w-full mt-4 bg-primary text-primary-foreground font-bold py-4 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:translate-y-[-2px] active:translate-y-[0px] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  data-testid="button-check-answer"
                >
                  {completeQuest.isPending ? t.checking : t.check_answer}
                </button>
              ) : (
                <div className={cn(
                  "mt-4 p-4 rounded-xl border",
                  isCorrect || quest.isCompleted ? "bg-green-500/10 border-green-500/20" : "bg-destructive/10 border-destructive/20"
                )}>
                  <p className="font-bold mb-1">
                    {isCorrect || quest.isCompleted ? t.correct_answer : t.wrong_answer}
                  </p>
                  <p className="text-sm opacity-90">{quest.explanation}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {!isExpanded && (
           <div className="flex justify-end mt-2">
              <span className="text-sm font-semibold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                {t.start_quest} <ChevronRight className="w-4 h-4" />
              </span>
           </div>
        )}
      </div>
    </motion.div>
  );
}
