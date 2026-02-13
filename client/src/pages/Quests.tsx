import { useState, useEffect } from "react";
import { useQuests } from "@/hooks/use-quests";
import { useUser } from "@/hooks/use-user";
import { QuestCard } from "@/components/quests/QuestCard";
import { PracticeMode } from "@/components/quests/PracticeMode";
import { DailyNews } from "@/components/quests/DailyNews";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Dumbbell, Newspaper, Egg, Gift, BookOpen, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translations } from "@/lib/translations";
import { useEggs } from "@/hooks/use-eggs";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import { Link } from "wouter";

const DAILY_QUEST_COUNT = 6;
const EGG_REWARD_KEY = "dinolingo_egg_rewarded_date";
const QUEST_COMPLETE_KEY = "dinolingo_quest_complete_shown";

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

function hasReceivedEggToday(): boolean {
  const storedDate = localStorage.getItem(EGG_REWARD_KEY);
  return storedDate === getTodayDateString();
}

function markEggReceivedToday(): void {
  localStorage.setItem(EGG_REWARD_KEY, getTodayDateString());
}

function hasShownCompleteToday(): boolean {
  const storedDate = localStorage.getItem(QUEST_COMPLETE_KEY);
  return storedDate === getTodayDateString();
}

function markCompleteShownToday(): void {
  localStorage.setItem(QUEST_COMPLETE_KEY, getTodayDateString());
}

export default function Quests() {
  const { data: quests, isLoading } = useQuests();
  const { data: user } = useUser();
  const [showPractice, setShowPractice] = useState(false);
  const [activeTab, setActiveTab] = useState<"quests" | "news">("quests");
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const { addEgg, addXpToEggs, hasActiveEgg } = useEggs();
  const { toast } = useToast();

  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang] as Record<string, string>;

  const completedCount = quests?.filter(q => q.isCompleted).length || 0;
  const progress = (completedCount / DAILY_QUEST_COUNT) * 100;
  const allCompleted = completedCount >= DAILY_QUEST_COUNT;

  useEffect(() => {
    if (allCompleted && !hasShownCompleteToday()) {
      markCompleteShownToday();
      setShowCompletionModal(true);

      if (!hasReceivedEggToday()) {
        if (hasActiveEgg()) {
          addXpToEggs(30);
        } else {
          addEgg("mystery");
        }
        markEggReceivedToday();
      }

      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.4 },
        colors: ["#22c55e", "#fbbf24", "#3b82f6", "#a855f7", "#ec4899"],
      });

      toast({
        title: t.daily_quest_complete,
        description: t.daily_quest_complete_msg,
      });
    }
  }, [allCompleted, addEgg, addXpToEggs, hasActiveEgg, toast, t]);

  return (
    <div className="p-4 md:p-10 max-w-4xl mx-auto min-h-screen w-full">
      <div className="mb-10 text-center">
        <h1 className="text-3xl md:text-5xl font-display font-bold mb-4">{t.daily_quests}</h1>
        <p className="text-muted-foreground text-lg max-w-lg mx-auto">
          {lang === "ko"
            ? "오늘의 시장 도전과제를 완료하고 XP를 획득하세요."
            : "Sharpen your skills and earn XP by completing today's market challenges."}
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === "quests" ? "default" : "ghost"}
          onClick={() => setActiveTab("quests")}
          className="flex-1"
          data-testid="tab-quests"
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          {t.quests}
        </Button>
        <Button
          variant={activeTab === "news" ? "default" : "ghost"}
          onClick={() => setActiveTab("news")}
          className="flex-1"
          data-testid="tab-news"
        >
          <Newspaper className="w-4 h-4 mr-2" />
          {t.daily_news}
        </Button>
      </div>

      {activeTab === "quests" ? (
        <>
          <div className="mb-12 bg-card border border-border rounded-3xl p-8 relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center text-secondary">
                  {allCompleted ? (
                    <Trophy className="w-8 h-8 text-yellow-500" />
                  ) : (
                    <CheckCircle2 className="w-8 h-8" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{t.daily_progress}</h2>
                  <p className="text-muted-foreground">
                    {Math.min(completedCount, DAILY_QUEST_COUNT)} {t.of} {DAILY_QUEST_COUNT} {t.completed}
                  </p>
                </div>
              </div>

              <div className="w-full md:w-64">
                <div className="h-4 bg-background rounded-full overflow-hidden shadow-inner">
                  <motion.div
                    className={`h-full ${allCompleted ? "bg-gradient-to-r from-yellow-400 to-green-500" : "bg-gradient-to-r from-secondary to-purple-500"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(progress, 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right mt-1">
                  {Math.min(Math.round(progress), 100)}%
                </p>
              </div>
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
          </div>

          <AnimatePresence>
            {showCompletionModal && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="mb-8"
              >
                <Card className="border-green-500/30 bg-gradient-to-r from-green-500/10 via-yellow-500/10 to-purple-500/10">
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center gap-4">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-green-500 flex items-center justify-center"
                      >
                        <Trophy className="w-10 h-10 text-white" />
                      </motion.div>

                      <div>
                        <h3 className="font-bold text-2xl mb-2" data-testid="text-quest-complete-title">
                          {t.daily_quest_complete}
                        </h3>
                        <p className="text-foreground/80 mb-1" data-testid="text-quest-complete-msg">
                          {t.daily_quest_complete_msg}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3 justify-center">
                        <Link href="/collection">
                          <Button className="gap-2" data-testid="button-go-to-collection">
                            <Egg className="w-4 h-4" />
                            {t.my_collection}
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowCompletionModal(false);
                            setShowPractice(true);
                          }}
                          className="gap-2"
                          data-testid="button-learn-more"
                        >
                          <BookOpen className="w-4 h-4" />
                          {t.learn_more}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setShowCompletionModal(false)}
                          data-testid="button-dismiss-complete"
                        >
                          {lang === "ko" ? "닫기" : "Dismiss"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {allCompleted && !showPractice && !showCompletionModal && (
            <Card className="mb-8 border-primary/30 bg-primary/5 dark:bg-primary/10">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-6 h-6 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-green-600 dark:text-green-400 mb-1">
                      {t.daily_quest_complete}
                    </h3>
                    <p className="text-sm text-foreground/80 mb-4">
                      {t.learn_more_desc}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => setShowPractice(true)}
                        className="gap-2"
                        data-testid="button-practice-more"
                      >
                        <Dumbbell className="w-4 h-4" />
                        {t.practice_more}
                      </Button>
                      <Link href="/collection">
                        <Button variant="outline" className="gap-2" data-testid="button-view-collection-link">
                          <Egg className="w-4 h-4" />
                          {t.my_collection}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {showPractice ? (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Dumbbell className="w-6 h-6 text-purple-500" />
                  {t.practice_mode}
                </h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowPractice(false)}
                  data-testid="button-back-to-quests"
                >
                  {lang === "ko" ? "퀘스트로 돌아가기" : "Back to Quests"}
                </Button>
              </div>
              <p className="text-muted-foreground mb-6">{t.practice_description}</p>
              <PracticeMode />
            </div>
          ) : (
            <>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-40 bg-card/50 rounded-3xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-5 md:space-y-6 max-w-3xl mx-auto">
                  {quests?.slice(0, DAILY_QUEST_COUNT).map((quest, idx) => (
                    <motion.div
                      key={quest.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <QuestCard quest={quest} />
                    </motion.div>
                  ))}

                  {quests?.length === 0 && (
                    <div className="text-center py-20">
                      <p className="text-2xl font-bold text-muted-foreground">
                        {lang === "ko" ? "퀘스트가 없습니다." : "No quests available."}
                      </p>
                      <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90"
                        data-testid="button-refresh"
                      >
                        {lang === "ko" ? "새로고침" : "Refresh"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!allCompleted && (quests?.length || 0) > 0 && (
                <div className="mt-8 text-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowPractice(true)}
                    className="gap-2"
                    data-testid="button-try-practice"
                  >
                    <Dumbbell className="w-4 h-4" />
                    {t.practice_more}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <DailyNews />
      )}
    </div>
  );
}
