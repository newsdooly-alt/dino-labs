import { useState, useEffect } from "react";
import { useQuests } from "@/hooks/use-quests";
import { useUser } from "@/hooks/use-user";
import { QuestCard } from "@/components/quests/QuestCard";
import { PracticeMode } from "@/components/quests/PracticeMode";
import { DailyNews } from "@/components/quests/DailyNews";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Dumbbell, Newspaper, Egg, Gift, BookOpen, Sparkles,
  Trophy, TrendingUp, TrendingDown, Sunrise, Lock, Link2, Star, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { translations } from "@/lib/translations";
import { useEggs } from "@/hooks/use-eggs";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";

const DAILY_QUEST_COUNT = 6;
const EGG_REWARD_KEY = "dinolingo_egg_rewarded_date";
const QUEST_COMPLETE_KEY = "dinolingo_quest_complete_shown";
const PREDICTION_DATE_KEY = "dinolingo_prediction_date";
const PREDICTION_CHOICE_KEY = "dinolingo_prediction_choice";
const BRIEFING_XP_KEY = "dinolingo_briefing_xp_date";
const CALENDAR_VISITED_KEY = "dinolingo_calendar_visited";
const HIDDEN_QUEST_XP_KEY = "dinolingo_hidden_quest_xp_date";
const WEEKLY_PICK_KEY = "dinolingo_weekly_pick";
const WEEKLY_XP_KEY = "dinolingo_weekly_pick_xp";

const WEEKLY_STOCKS = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "GOOGL"];

const DINO_STAGES = [
  { emoji: "🥚", ko: "알",       en: "Egg",          color: "from-stone-400 to-stone-500",   minCompleted: 0 },
  { emoji: "🐣", ko: "부화 시작", en: "Hatching",     color: "from-lime-400 to-green-500",    minCompleted: 1 },
  { emoji: "🦕", ko: "아기 공룡", en: "Baby Dino",    color: "from-green-400 to-emerald-500", minCompleted: 2 },
  { emoji: "🦎", ko: "탐험가",   en: "Explorer",     color: "from-teal-400 to-cyan-500",     minCompleted: 3 },
  { emoji: "🦖", ko: "랩터 헌터", en: "Raptor Hunter",color: "from-blue-400 to-indigo-500",   minCompleted: 4 },
  { emoji: "🦴", ko: "T-Rex",    en: "T-Rex",        color: "from-orange-400 to-red-500",    minCompleted: 5 },
  { emoji: "👑", ko: "공룡 왕",   en: "Dino King",    color: "from-yellow-400 to-amber-500",  minCompleted: 6 },
];

const LEARN_MORE_CONTENT = {
  beginner: [
    { icon: "📘", en: "Read Today's Market Briefing", ko: "오늘의 시장 브리핑 읽기", en_desc: "Understand the day's top movers and macro themes", ko_desc: "오늘 시장의 주요 움직임과 거시 테마를 이해하세요", route: "/quests", tab: "news" },
    { icon: "🔍", en: "Search a Stock You're Curious About", ko: "궁금한 종목 검색하기", en_desc: "Find a stock in the Pro Dashboard and read its Key Metrics", ko_desc: "프로 대시보드에서 관심 종목의 핵심 지표를 확인하세요", route: "/pro" },
    { icon: "📈", en: "Check Today's Biggest Gainers", ko: "오늘의 상승률 TOP 종목 확인", en_desc: "See which stocks gained the most and why", ko_desc: "어떤 종목이 가장 많이 올랐는지, 이유는 무엇인지 확인하세요", route: "/pro" },
  ],
  intermediate: [
    { icon: "🔄", en: "Analyze the RRG Sector Rotation Chart", ko: "RRG 섹터 로테이션 분석", en_desc: "Find which sectors are in the Leading quadrant today", ko_desc: "오늘 Leading 구간에 있는 섹터를 RRG에서 확인하세요", route: "/pro" },
    { icon: "📊", en: "Compare P/E Ratios: Find a Stock Under 15", ko: "P/E 비율 비교: 15 이하 종목 찾기", en_desc: "Use the screener to find potentially undervalued stocks", ko_desc: "스크리너로 잠재적 저평가 종목을 찾아보세요", route: "/pro" },
    { icon: "🏦", en: "Check a Super Investor's Latest Portfolio", ko: "슈퍼인베스터 최신 포트폴리오 확인", en_desc: "See what top investors like Buffett are holding this quarter", ko_desc: "버핏 등 슈퍼인베스터가 이번 분기 보유한 종목을 확인하세요", route: "/investors" },
  ],
  advanced: [
    { icon: "📉", en: "Analyze Debt-to-Equity Trends in a Sector", ko: "섹터별 부채비율 트렌드 분석", en_desc: "Compare D/E ratios across financials, tech, and energy", ko_desc: "금융·기술·에너지 섹터의 부채비율을 비교 분석하세요", route: "/pro" },
    { icon: "🎯", en: "Build a Macro-Hedged Watch List", ko: "매크로 헤지 워치리스트 구성", en_desc: "Add 2 safe-haven + 2 growth stocks to your watchlist", ko_desc: "안전자산 2종목 + 성장주 2종목으로 워치리스트를 구성하세요", route: "/pro" },
    { icon: "🧮", en: "Evaluate an Upcoming Earnings Release", ko: "다음 실적 발표 종목 분석", en_desc: "Find a stock with earnings in 7 days and assess EPS expectations", ko_desc: "7일 내 실적 발표 종목을 찾아 EPS 예상치를 분석하세요", route: "/pro" },
  ],
};

function getDinoStage(count: number) {
  let stage = DINO_STAGES[0];
  for (const s of DINO_STAGES) {
    if (count >= s.minCompleted) stage = s;
  }
  return stage;
}

function getTodayStr() { return new Date().toISOString().split("T")[0]; }

function getWeekStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split("T")[0];
}

export default function Quests() {
  const { data: quests, isLoading } = useQuests();
  const { data: user } = useUser();
  const [showPractice, setShowPractice] = useState(false);
  const [showLearnMore, setShowLearnMore] = useState(false);
  const [activeTab, setActiveTab] = useState<"quests" | "news">("quests");
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const [predictionMade, setPredictionMade] = useState<"up" | "down" | null>(null);
  const [briefingDone, setBriefingDone] = useState(false);
  const [calendarVisited, setCalendarVisited] = useState(false);
  const [hiddenQuestClaimed, setHiddenQuestClaimed] = useState(false);
  const [weeklyPick, setWeeklyPick] = useState<string | null>(null);

  const { addEgg, addXpToEggs, hasActiveEgg } = useEggs();
  const { toast } = useToast();

  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang] as Record<string, string>;

  useEffect(() => {
    const today = getTodayStr();
    const week = getWeekStr();

    const pred = localStorage.getItem(PREDICTION_DATE_KEY);
    if (pred === today) setPredictionMade(localStorage.getItem(PREDICTION_CHOICE_KEY) as "up" | "down");

    const briefDate = localStorage.getItem(BRIEFING_XP_KEY);
    setBriefingDone(briefDate === today);

    const visited = localStorage.getItem(CALENDAR_VISITED_KEY);
    setCalendarVisited(visited === "true");

    const hiddenClaimed = localStorage.getItem(HIDDEN_QUEST_XP_KEY);
    setHiddenQuestClaimed(hiddenClaimed === today);

    const savedPick = localStorage.getItem(WEEKLY_PICK_KEY);
    if (savedPick) {
      try {
        const data = JSON.parse(savedPick);
        if (data.week === week) setWeeklyPick(data.symbol);
      } catch {}
    }
  }, []);

  const newsComplete = localStorage.getItem("dinolingo_news_complete_shown") === getTodayStr();

  const completedCount = quests?.filter(q => q.isCompleted).length || 0;
  const progress = (completedCount / DAILY_QUEST_COUNT) * 100;
  const allCompleted = completedCount >= DAILY_QUEST_COUNT;
  const currentStage = getDinoStage(completedCount);
  const nextStage = DINO_STAGES.find(s => s.minCompleted > completedCount);

  useEffect(() => {
    if (allCompleted && !localStorage.getItem(QUEST_COMPLETE_KEY)) {
      localStorage.setItem(QUEST_COMPLETE_KEY, getTodayStr());
      setShowCompletionModal(true);
      if (!localStorage.getItem(EGG_REWARD_KEY) || localStorage.getItem(EGG_REWARD_KEY) !== getTodayStr()) {
        if (hasActiveEgg()) addXpToEggs(30);
        else addEgg("mystery");
        localStorage.setItem(EGG_REWARD_KEY, getTodayStr());
      }
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.4 }, colors: ["#22c55e", "#fbbf24", "#3b82f6", "#a855f7", "#ec4899"] });
      toast({ title: t.daily_quest_complete, description: t.daily_quest_complete_msg });
    }
  }, [allCompleted, addEgg, addXpToEggs, hasActiveEgg, toast, t]);

  useEffect(() => {
    if (newsComplete && !briefingDone) {
      setBriefingDone(true);
    }
  }, [newsComplete, briefingDone]);

  async function awardSpecialXp(amount: number) {
    try {
      await apiRequest("POST", "/api/quests/special/complete", { xpAmount: amount });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      addXpToEggs(amount);
    } catch {}
  }

  function handlePrediction(choice: "up" | "down") {
    const today = getTodayStr();
    localStorage.setItem(PREDICTION_DATE_KEY, today);
    localStorage.setItem(PREDICTION_CHOICE_KEY, choice);
    setPredictionMade(choice);
    awardSpecialXp(15);
    confetti({ particleCount: 60, spread: 60, origin: { y: 0.5 }, colors: ["#22c55e", "#3b82f6"] });
    toast({
      title: lang === "ko" ? "오늘의 예측 완료! 🔮" : "Daily Prediction Made! 🔮",
      description: lang === "ko" ? `S&P 500 ${choice === "up" ? "상승" : "하락"} 예측 완료. +15 XP 획득!` : `You predicted ${choice === "up" ? "Green" : "Red"}. +15 XP earned!`,
    });
  }

  function handleBriefingComplete() {
    const today = getTodayStr();
    localStorage.setItem(BRIEFING_XP_KEY, today);
    setBriefingDone(true);
    setActiveTab("news");
  }

  function claimHiddenQuest() {
    const today = getTodayStr();
    localStorage.setItem(HIDDEN_QUEST_XP_KEY, today);
    setHiddenQuestClaimed(true);
    awardSpecialXp(25);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 }, colors: ["#a855f7", "#fbbf24"] });
    toast({
      title: lang === "ko" ? "숨겨진 퀘스트 발견! 🔍" : "Hidden Quest Unlocked! 🔍",
      description: lang === "ko" ? "경제 캘린더 탐험가! +25 XP 획득!" : "Economic Calendar Explorer! +25 XP earned!",
    });
  }

  function handleWeeklyPick(symbol: string) {
    const week = getWeekStr();
    localStorage.setItem(WEEKLY_PICK_KEY, JSON.stringify({ symbol, week }));
    setWeeklyPick(symbol);
    const xpKey = localStorage.getItem(WEEKLY_XP_KEY);
    if (xpKey !== week) {
      localStorage.setItem(WEEKLY_XP_KEY, week);
      awardSpecialXp(30);
      toast({
        title: lang === "ko" ? "이번 주 Top Picker 선택 완료! 🏆" : "Weekly Top Picker Set! 🏆",
        description: lang === "ko" ? `${symbol} 선택 완료. +30 XP 획득!` : `You picked ${symbol}. +30 XP earned!`,
      });
    } else {
      toast({
        title: lang === "ko" ? "종목 변경됨" : "Pick Changed",
        description: lang === "ko" ? `${symbol}으로 이번 주 종목이 변경되었습니다.` : `Changed to ${symbol} for this week.`,
      });
    }
  }

  const firstIncompleteIdx = quests?.findIndex(q => !q.isCompleted) ?? -1;

  return (
    <div className="p-4 md:p-10 max-w-4xl mx-auto min-h-screen w-full">
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-5xl font-display font-bold mb-3">
          {lang === "ko" ? "🦕 오늘의 퀘스트" : "🦕 Daily Quests"}
        </h1>
        <p className="text-muted-foreground text-base max-w-lg mx-auto">
          {lang === "ko"
            ? "퀘스트를 완료하고 XP를 획득하여 공룡 왕이 되세요!"
            : "Complete quests, earn XP, and become the Dino King!"}
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
          {lang === "ko" ? "퀘스트" : "Quests"}
        </Button>
        <Button
          variant={activeTab === "news" ? "default" : "ghost"}
          onClick={() => setActiveTab("news")}
          className="flex-1"
          data-testid="tab-news"
        >
          <Newspaper className="w-4 h-4 mr-2" />
          {lang === "ko" ? "오늘의 뉴스" : "Daily News"}
        </Button>
      </div>

      {activeTab === "quests" ? (
        <>
          {/* Dino Journey Progress Bar */}
          <div className="mb-8 bg-card border border-border rounded-2xl p-6 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-lg">{lang === "ko" ? "공룡 여정" : "Dino Journey"}</h2>
                  <p className="text-sm text-muted-foreground">
                    {lang === "ko" ? `현재: ${currentStage.emoji} ${currentStage.ko}` : `Current: ${currentStage.emoji} ${currentStage.en}`}
                    {nextStage && (
                      <span className="ml-2 text-xs text-primary/70">
                        {lang === "ko" ? `→ ${nextStage.emoji} ${nextStage.ko} 까지 ${nextStage.minCompleted - completedCount}개` : `→ ${nextStage.minCompleted - completedCount} more to ${nextStage.en}`}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{completedCount}/{DAILY_QUEST_COUNT}</p>
                  <p className="text-xs text-muted-foreground">{lang === "ko" ? "완료" : "completed"}</p>
                </div>
              </div>

              {/* Stage nodes */}
              <div className="relative flex items-center justify-between mb-3">
                <div className="absolute inset-y-1/2 left-0 right-0 h-2 bg-muted rounded-full -translate-y-1/2 z-0" />
                <motion.div
                  className="absolute inset-y-1/2 left-0 h-2 rounded-full bg-gradient-to-r from-secondary via-primary to-yellow-400 -translate-y-1/2 z-0"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
                {DINO_STAGES.map((stage, i) => {
                  const isReached = completedCount >= stage.minCompleted;
                  const isCurrent = stage === currentStage;
                  return (
                    <div key={i} className="relative z-10 flex flex-col items-center gap-1">
                      <motion.div
                        animate={isCurrent && !allCompleted ? { scale: [1, 1.15, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-lg md:text-xl border-2 transition-all duration-500 ${
                          isReached
                            ? `bg-gradient-to-br ${stage.color} border-white shadow-lg`
                            : "bg-muted border-border opacity-40"
                        }`}
                      >
                        {stage.emoji}
                      </motion.div>
                      <p className={`text-[9px] md:text-[10px] font-bold text-center leading-tight max-w-[52px] ${isReached ? "text-foreground" : "text-muted-foreground opacity-50"}`}>
                        {lang === "ko" ? stage.ko : stage.en}
                      </p>
                    </div>
                  );
                })}
              </div>

              {allCompleted && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mt-2"
                >
                  <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-0 px-4 py-1">
                    {lang === "ko" ? "👑 오늘의 공룡 왕 달성!" : "👑 Dino King Achieved Today!"}
                  </Badge>
                </motion.div>
              )}
            </div>
            <div className="absolute -right-8 -top-8 w-40 h-40 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
          </div>

          {/* Weekly Challenge Banner */}
          <div className="mb-6 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 border border-purple-500/20 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-sm">{lang === "ko" ? "🏆 이번 주 챌린지" : "🏆 Weekly Challenge"}</p>
                  <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-500">
                    {lang === "ko" ? "주간" : "WEEKLY"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {lang === "ko"
                    ? "이번 주 가장 많이 오를 종목을 골라보세요! 가장 높은 수익률을 기록한 유저에게 골든 다이노 배지가 주어집니다."
                    : "Pick the stock you think will rise most this week! The user with the highest return wins the Golden Dino badge."}
                </p>
                {weeklyPick ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-purple-500 text-white border-0">
                      {lang === "ko" ? "내 선택:" : "My Pick:"} {weeklyPick}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{lang === "ko" ? "종목 변경:" : "Change pick:"}</p>
                    {WEEKLY_STOCKS.filter(s => s !== weeklyPick).slice(0, 4).map(s => (
                      <button
                        key={s}
                        onClick={() => handleWeeklyPick(s)}
                        className="text-[11px] px-2 py-0.5 rounded border border-border hover:border-purple-400 hover:bg-purple-500/10 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKLY_STOCKS.map(s => (
                      <button
                        key={s}
                        onClick={() => handleWeeklyPick(s)}
                        className="text-xs font-bold px-3 py-1 rounded-lg border border-border bg-background hover:border-purple-400 hover:bg-purple-500/10 transition-all"
                        data-testid={`button-weekly-pick-${s}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Special Daily Quests */}
          <div className="mb-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
              {lang === "ko" ? "⚡ 특별 일일 퀘스트" : "⚡ Special Daily Quests"}
            </p>

            {/* Morning Briefing */}
            <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${briefingDone || newsComplete ? "bg-green-500/5 border-green-500/20" : "bg-card border-border hover:border-primary/30"}`}>
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <Sunrise className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{lang === "ko" ? "🌅 아침 브리핑" : "🌅 Morning Briefing"}</p>
                <p className="text-xs text-muted-foreground">
                  {lang === "ko" ? "오늘의 시장 뉴스 3가지를 읽어보세요" : "Read 3 market news items today"}
                </p>
              </div>
              <div className="shrink-0">
                {briefingDone || newsComplete ? (
                  <Badge className="bg-green-500 text-white border-0">+20 XP ✓</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBriefingComplete}
                    className="text-xs"
                    data-testid="button-morning-briefing"
                  >
                    {lang === "ko" ? "뉴스 읽기" : "Read News"}
                  </Button>
                )}
              </div>
            </div>

            {/* Daily Prediction */}
            <div className={`p-4 rounded-xl border transition-all ${predictionMade ? "bg-blue-500/5 border-blue-500/20" : "bg-card border-border"}`}>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">{lang === "ko" ? "🔮 오늘의 예측" : "🔮 Daily Prediction"}</p>
                  <p className="text-xs text-muted-foreground">
                    {lang === "ko" ? "오늘 S&P 500이 상승할까요, 하락할까요?" : "Will S&P 500 close Green or Red today?"}
                  </p>
                </div>
                {predictionMade && <Badge className="bg-blue-500 text-white border-0 shrink-0">+15 XP ✓</Badge>}
              </div>
              {predictionMade ? (
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${predictionMade === "up" ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}>
                    {predictionMade === "up" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {predictionMade === "up"
                      ? (lang === "ko" ? "📈 상승 예측" : "📈 Predicted Green")
                      : (lang === "ko" ? "📉 하락 예측" : "📉 Predicted Red")}
                  </div>
                  <p className="text-xs text-muted-foreground">{lang === "ko" ? "장 마감 후 결과 확인!" : "Check result after market close!"}</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePrediction("up")}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 font-bold text-sm hover:bg-green-500/20 transition-all"
                    data-testid="button-predict-up"
                  >
                    <TrendingUp className="w-4 h-4" />
                    {lang === "ko" ? "📈 상승" : "📈 Green"}
                  </button>
                  <button
                    onClick={() => handlePrediction("down")}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-500/20 transition-all"
                    data-testid="button-predict-down"
                  >
                    <TrendingDown className="w-4 h-4" />
                    {lang === "ko" ? "📉 하락" : "📉 Red"}
                  </button>
                </div>
              )}
            </div>

            {/* Hidden Quest - only visible if calendar was visited */}
            {calendarVisited && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-4 p-4 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-transparent"
              >
                <div className="w-11 h-11 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-sm">{lang === "ko" ? "🔍 숨겨진 퀘스트 발견!" : "🔍 Hidden Quest Unlocked!"}</p>
                    <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-500">SECRET</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lang === "ko" ? "경제 캘린더를 탐험했습니다! 탐험가 배지를 획득하세요." : "You discovered the Economic Calendar! Claim your Explorer badge."}
                  </p>
                </div>
                <div className="shrink-0">
                  {hiddenQuestClaimed ? (
                    <Badge className="bg-purple-500 text-white border-0">+25 XP ✓</Badge>
                  ) : (
                    <Button size="sm" onClick={claimHiddenQuest} className="bg-purple-500 hover:bg-purple-600 text-white text-xs" data-testid="button-claim-hidden-quest">
                      {lang === "ko" ? "수령" : "Claim!"}
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Completion modal */}
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
                        <Button
                          variant="outline"
                          onClick={() => { setShowCompletionModal(false); setShowLearnMore(true); }}
                          className="gap-2"
                          data-testid="button-learn-more"
                        >
                          <BookOpen className="w-4 h-4" />
                          {t.learn_more}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => { setShowCompletionModal(false); setShowPractice(true); }}
                          className="gap-2"
                          data-testid="button-practice-from-modal"
                        >
                          <Dumbbell className="w-4 h-4" />
                          {t.practice_more}
                        </Button>
                        <Link href="/collection">
                          <Button variant="outline" className="gap-2" data-testid="button-go-to-collection">
                            <Egg className="w-4 h-4" />
                            {t.my_collection}
                          </Button>
                        </Link>
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
                    <h3 className="font-bold text-green-600 dark:text-green-400 mb-1">{t.daily_quest_complete}</h3>
                    <p className="text-sm text-foreground/80 mb-4">{t.learn_more_desc}</p>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => setShowPractice(true)} className="gap-2" data-testid="button-practice-more">
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

          {showLearnMore ? (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-primary" />
                  {lang === "ko" ? "맞춤 학습 추천" : "Personalized Next Steps"}
                </h2>
                <Button variant="ghost" onClick={() => setShowLearnMore(false)} data-testid="button-back-from-learn-more">
                  {lang === "ko" ? "퀘스트로 돌아가기" : "Back to Quests"}
                </Button>
              </div>
              <p className="text-muted-foreground mb-6">
                {lang === "ko"
                  ? `${user?.skillLevel === "advanced" ? "고급" : user?.skillLevel === "intermediate" ? "중급" : "입문"} 레벨에 맞는 심화 학습 과제입니다.`
                  : `Curated for your ${user?.skillLevel || "beginner"} level — these activities build real market intuition.`}
              </p>
              <div className="space-y-3">
                {(LEARN_MORE_CONTENT[(user?.skillLevel as keyof typeof LEARN_MORE_CONTENT) || "beginner"]).map((item, idx) => (
                  <Link href={item.route} key={idx}>
                    <div
                      className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group"
                      data-testid={`learn-more-item-${idx}`}
                    >
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0 group-hover:bg-primary/20 transition-colors">
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm mb-0.5">{lang === "ko" ? item.ko : item.en}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{lang === "ko" ? item.ko_desc : item.en_desc}</p>
                      </div>
                      <div className="shrink-0 flex items-center self-center">
                        <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">{lang === "ko" ? "이동 →" : "Go →"}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                <Button onClick={() => { setShowLearnMore(false); setShowPractice(true); }} className="gap-2" data-testid="button-switch-to-practice">
                  <Dumbbell className="w-4 h-4" />
                  {t.practice_more}
                </Button>
              </div>
            </div>
          ) : showPractice ? (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Dumbbell className="w-6 h-6 text-purple-500" />
                  {t.practice_mode}
                </h2>
                <Button variant="ghost" onClick={() => setShowPractice(false)} data-testid="button-back-to-quests">
                  {lang === "ko" ? "퀘스트로 돌아가기" : "Back to Quests"}
                </Button>
              </div>
              <p className="text-muted-foreground mb-6">{t.practice_description}</p>
              <PracticeMode />
            </div>
          ) : (
            <>
              {/* Main Quest Chain */}
              <div className="mb-4">
                <div className="flex items-center gap-2 px-1 mb-4">
                  <Link2 className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {lang === "ko" ? "오늘의 퀘스트 체인 (6개)" : "Quest Chain (6 Quests)"}
                  </p>
                </div>

                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="h-40 bg-card/50 rounded-3xl animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 md:space-y-4 max-w-3xl mx-auto">
                    {quests?.slice(0, DAILY_QUEST_COUNT).map((quest, idx) => {
                      const isLocked = !quest.isCompleted && idx > firstIncompleteIdx && idx !== firstIncompleteIdx;
                      return (
                        <div key={quest.id} className="relative">
                          {/* Chain connector */}
                          {idx > 0 && (
                            <div className="absolute -top-3 left-6 w-0.5 h-3 bg-border z-10" />
                          )}
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.07 }}
                          >
                            {isLocked ? (
                              <div className="bg-card/40 border border-border/50 rounded-xl p-4 flex items-center gap-3 opacity-50">
                                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                  <Lock className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-muted-foreground">
                                    {lang === "ko" ? `퀘스트 ${idx + 1} — 잠금됨` : `Quest ${idx + 1} — Locked`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {lang === "ko" ? "이전 퀘스트를 완료하면 잠금이 해제됩니다" : "Complete the previous quest to unlock"}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="relative">
                                <div className="absolute -left-0.5 top-4 bottom-4 w-0.5 bg-gradient-to-b from-primary/40 to-transparent rounded-full" />
                                <QuestCard quest={quest} questNumber={idx + 1} />
                              </div>
                            )}
                          </motion.div>
                        </div>
                      );
                    })}

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
              </div>

              {!allCompleted && (quests?.length || 0) > 0 && (
                <div className="mt-8 text-center">
                  <Button variant="outline" onClick={() => setShowPractice(true)} className="gap-2" data-testid="button-try-practice">
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
