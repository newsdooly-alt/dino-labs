import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";

interface OnboardingProps {
  onComplete: () => void;
}

const cardsData = {
  en: [
    {
      title: "Hi! I'm Dino",
      description: "Your US stock investing buddy!",
    },
    {
      title: "Learn & Play",
      description: "Learn about the US stock market through fun daily quizzes.",
    },
    {
      title: "Earn Rewards",
      description: "Complete quests to earn XP and build your Daily Streak!",
    },
    {
      title: "Ready to Start?",
      description: "Let's start your journey to becoming a Stock Hero!",
    },
  ],
  ko: [
    {
      title: "안녕! 나는 디노야",
      description: "미국 주식 투자 친구가 되어줄게!",
    },
    {
      title: "배우고 놀자",
      description: "재미있는 일일 퀴즈로 미국 주식시장을 배워보세요.",
    },
    {
      title: "보상을 받자",
      description: "퀘스트를 완료하고 XP를 획득하고 연속 기록을 세워보세요!",
    },
    {
      title: "시작할 준비됐나요?",
      description: "주식 히어로가 되는 여정을 시작해봐요!",
    },
  ],
};

const icons = [
  (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-24 h-24 text-primary animate-bounce-slow">
      <path d="M16 16c0-4.4-3.6-8-8-8s-8 3.6-8 8" />
      <path d="M2 16h12" />
      <path d="M7 8V5a3 3 0 0 1 6 0v3" />
      <path d="M12 8c4.4 0 8 3.6 8 8" />
      <path d="M22 16h-2" />
      <path d="M17 13l3-3 3 3" />
    </svg>
  ),
  <Sparkles className="w-24 h-24 text-yellow-400" />,
  (
    <div className="relative">
      <div className="w-24 h-24 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-500">
        <span className="text-4xl font-bold">7</span>
      </div>
    </div>
  ),
  (
    <div className="w-24 h-24 bg-primary rounded-3xl flex items-center justify-center text-primary-foreground shadow-xl shadow-primary/20">
      <ChevronRight className="w-12 h-12" />
    </div>
  ),
];

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [current, setCurrent] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const { data: user } = useUser();
  const lang = (user?.language || "ko") as keyof typeof translations;
  const cards = cardsData[lang] || cardsData.en;

  const handleNext = () => {
    if (current === cards.length - 1) {
      setIsExiting(true);
      setTimeout(() => {
        onComplete();
      }, 300);
    } else {
      setCurrent(c => c + 1);
    }
  };

  const nextLabel = lang === "ko" ? "다음" : "Next";
  const startLabel = lang === "ko" ? "여정 시작하기" : "Start Journey";

  return (
    <motion.div 
      className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-6 overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[100px]" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary rounded-full blur-[100px]" />
      </div>

      <Card className="w-full max-w-lg overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-card relative z-10">
        <div className="p-8 md:p-12 text-center min-h-[500px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex-1 flex flex-col items-center justify-center"
            >
              <div className="mb-8">
                {icons[current]}
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4" data-testid="text-onboarding-title">
                {cards[current].title}
              </h2>
              <p className="text-lg text-muted-foreground max-w-xs mx-auto" data-testid="text-onboarding-desc">
                {cards[current].description}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 space-y-6">
            <div className="flex justify-center gap-2">
              {cards.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === current ? "w-8 bg-primary" : "w-2 bg-muted"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-4">
              {current > 0 && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-2xl h-14 w-14"
                  onClick={() => setCurrent(c => c - 1)}
                  data-testid="button-onboarding-back"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
              )}
              <Button 
                className={`flex-1 rounded-2xl h-14 text-lg font-bold ${current === cards.length - 1 ? "bg-primary hover:bg-primary/90" : ""}`}
                onClick={handleNext}
                data-testid={current === cards.length - 1 ? "button-start-journey" : "button-next"}
              >
                {current === cards.length - 1 ? startLabel : nextLabel}
                {current < cards.length - 1 && <ChevronRight className="ml-2 w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
