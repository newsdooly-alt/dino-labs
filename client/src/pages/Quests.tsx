import { useState } from "react";
import { useQuests } from "@/hooks/use-quests";
import { useUser } from "@/hooks/use-user";
import { QuestCard } from "@/components/quests/QuestCard";
import { PracticeMode } from "@/components/quests/PracticeMode";
import { DailyNews } from "@/components/quests/DailyNews";
import { motion } from "framer-motion";
import { CheckCircle2, Dumbbell, Lightbulb, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { translations } from "@/lib/translations";

export default function Quests() {
  const { data: quests, isLoading } = useQuests();
  const { data: user } = useUser();
  const [showPractice, setShowPractice] = useState(false);
  const [activeTab, setActiveTab] = useState<"quests" | "news">("quests");
  
  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];
  
  const completedCount = quests?.filter(q => q.isCompleted).length || 0;
  const totalCount = quests?.length || 0;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allCompleted = completedCount === totalCount && totalCount > 0;

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto min-h-screen">
      <div className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">{t.daily_quests}</h1>
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
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{t.daily_progress}</h2>
                  <p className="text-muted-foreground">
                    {completedCount} {t.of} {totalCount} {t.completed}
                  </p>
                </div>
              </div>
              
              <div className="w-full md:w-64">
                <div className="h-4 bg-background rounded-full overflow-hidden shadow-inner">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-secondary to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right mt-1">
                  {Math.round(progress)}%
                </p>
              </div>
            </div>
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
          </div>

          {allCompleted && !showPractice && (
            <Card className="mb-8 border-primary/30 bg-primary/5 dark:bg-primary/10">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-primary mb-1">
                      {lang === "ko" ? "축하해요!" : "Congratulations!"}
                    </h3>
                    <p className="text-sm text-foreground/80 mb-4">
                      {t.dino_congrats}
                    </p>
                    <Button 
                      onClick={() => setShowPractice(true)}
                      className="gap-2"
                      data-testid="button-practice-more"
                    >
                      <Dumbbell className="w-4 h-4" />
                      {t.practice_more}
                    </Button>
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
                <div className="space-y-6">
                  {quests?.map((quest, idx) => (
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

              {!allCompleted && totalCount > 0 && (
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
