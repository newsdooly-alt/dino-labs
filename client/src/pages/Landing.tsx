import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Egg, Award, ChartLine, Users, Sparkles, Globe, Eye, EyeOff, User, Lock, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Language = "en" | "ko";
type SkillLevel = "beginner" | "intermediate" | "advanced";
type AuthMode = "login" | "register" | "guest";

const translations = {
  en: {
    title: "Learn Stocks the",
    titleHighlight: "Fun Way",
    subtitle: "Master the US stock market with daily quests, collect dinosaur eggs, and hatch unique dinos while learning to invest like a pro!",
    signIn: "Sign In",
    signUp: "Sign Up",
    getStarted: "Get Started Free",
    freeForever: "Free forever",
    joinLearners: "Join thousands of learners",
    whyLove: "Why You'll Love Learning With Dino",
    dailyQuests: "Daily Quests",
    dailyQuestsDesc: "Complete fun quizzes about financial terms, chart patterns, and market news. Learn something new every day!",
    collectEggs: "Collect Dino Eggs",
    collectEggsDesc: "Earn mystery eggs by completing quests. Watch them hatch into unique dinosaurs with fun trading-themed facts!",
    realData: "Real Market Data",
    realDataDesc: "Track real stocks, view live charts, and build your watchlist. Practice with actual market conditions!",
    readyStart: "Ready to Start Your Journey?",
    joinNow: "Join now and get your first mystery egg when you complete your daily quests!",
    joinFree: "Join Now - It's Free!",
    footer: "© 2026 US Stock Hero. Learn investing the fun way.",
    username: "Username",
    password: "Password",
    email: "Email (optional)",
    login: "Log In",
    register: "Create Account",
    continueAsGuest: "Continue as Guest",
    noAccount: "Don't have an account?",
    haveAccount: "Already have an account?",
    orContinueWith: "or continue with",
    selectLevel: "Select Your Level",
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
    beginnerDesc: "New to investing? Start here!",
    intermediateDesc: "Know the basics? Let's go deeper!",
    advancedDesc: "Ready for complex strategies?",
    guestNote: "Guest data is saved locally. Sign up to sync across devices!",
    usernameRequired: "Username must be at least 3 characters",
    passwordRequired: "Password must be at least 6 characters",
    loginFailed: "Login failed. Please check your credentials.",
    registerFailed: "Registration failed. Please try again.",
    socialLogin: "Sign in with Replit",
  },
  ko: {
    title: "주식을 배우는",
    titleHighlight: "재미있는 방법",
    subtitle: "미국 주식 시장을 데일리 퀘스트, 공룡 알 수집, 그리고 유니크한 다이노와 함께 마스터하세요!",
    signIn: "로그인",
    signUp: "회원가입",
    getStarted: "무료로 시작하기",
    freeForever: "영원히 무료",
    joinLearners: "수천 명의 학습자와 함께",
    whyLove: "Dino와 함께하는 이유",
    dailyQuests: "데일리 퀘스트",
    dailyQuestsDesc: "금융 용어, 차트 패턴, 시장 뉴스에 대한 재미있는 퀴즈를 완료하세요. 매일 새로운 것을 배우세요!",
    collectEggs: "다이노 알 수집",
    collectEggsDesc: "퀘스트를 완료하여 미스터리 알을 획득하세요. 트레이딩 테마의 재미있는 사실을 가진 유니크한 공룡으로 부화하는 것을 지켜보세요!",
    realData: "실시간 시장 데이터",
    realDataDesc: "실제 주식을 추적하고, 라이브 차트를 보고, 관심목록을 구축하세요. 실제 시장 조건으로 연습하세요!",
    readyStart: "여정을 시작할 준비가 되셨나요?",
    joinNow: "지금 가입하고 데일리 퀘스트를 완료하면 첫 번째 미스터리 알을 받으세요!",
    joinFree: "지금 가입 - 무료!",
    footer: "© 2026 US Stock Hero. 재미있게 투자를 배우세요.",
    username: "사용자 이름",
    password: "비밀번호",
    email: "이메일 (선택)",
    login: "로그인",
    register: "계정 만들기",
    continueAsGuest: "비회원으로 시작",
    noAccount: "계정이 없으신가요?",
    haveAccount: "이미 계정이 있으신가요?",
    orContinueWith: "또는",
    selectLevel: "레벨 선택",
    beginner: "초급",
    intermediate: "중급",
    advanced: "고급",
    beginnerDesc: "투자가 처음이신가요? 여기서 시작하세요!",
    intermediateDesc: "기본을 아시나요? 더 깊이 들어가봐요!",
    advancedDesc: "복잡한 전략을 준비하셨나요?",
    guestNote: "게스트 데이터는 로컬에 저장됩니다. 기기 간 동기화를 위해 회원가입하세요!",
    usernameRequired: "사용자 이름은 최소 3자 이상이어야 합니다",
    passwordRequired: "비밀번호는 최소 6자 이상이어야 합니다",
    loginFailed: "로그인 실패. 자격 증명을 확인하세요.",
    registerFailed: "회원가입 실패. 다시 시도해주세요.",
    socialLogin: "Replit으로 로그인",
  },
};

export default function Landing() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("dinolingo_language");
    return (saved === "ko" || saved === "en") ? saved : "en";
  });
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<SkillLevel>("beginner");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
  });

  const t = translations[language];

  useEffect(() => {
    localStorage.setItem("dinolingo_language", language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === "en" ? "ko" : "en");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.username.length < 3) {
      toast({ title: t.usernameRequired, variant: "destructive" });
      return;
    }
    if (formData.password.length < 6) {
      toast({ title: t.passwordRequired, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        username: formData.username,
        password: formData.password,
      });
      if (response.success) {
        navigate("/");
        window.location.reload();
      }
    } catch (error: any) {
      toast({ title: error.message || t.loginFailed, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.username.length < 3) {
      toast({ title: t.usernameRequired, variant: "destructive" });
      return;
    }
    if (formData.password.length < 6) {
      toast({ title: t.passwordRequired, variant: "destructive" });
      return;
    }

    setShowLevelSelect(true);
  };

  const completeRegistration = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/register", {
        username: formData.username,
        password: formData.password,
        email: formData.email || undefined,
        language,
        level: selectedLevel,
      });
      if (response.success) {
        navigate("/");
        window.location.reload();
      }
    } catch (error: any) {
      toast({ title: error.message || t.registerFailed, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = () => {
    setShowLevelSelect(true);
    setAuthMode("guest");
  };

  const completeGuestLogin = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/guest", {
        language,
        level: selectedLevel,
      });
      if (response.success) {
        localStorage.setItem("dinolingo_guest_data", JSON.stringify({
          isGuest: true,
          language,
          level: selectedLevel,
          xp: 0,
          hearts: 5,
          streak: 0,
          watchlist: [],
        }));
        navigate("/");
        window.location.reload();
      }
    } catch (error: any) {
      toast({ title: "Failed to start guest session", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmLevelSelection = () => {
    if (authMode === "guest") {
      completeGuestLogin();
    } else {
      completeRegistration();
    }
  };

  if (showLevelSelect) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="text-center space-y-2">
            <Egg className="w-16 h-16 text-primary mx-auto" />
            <h2 className="text-2xl font-bold">{t.selectLevel}</h2>
          </div>
          
          <div className="space-y-3">
            {(["beginner", "intermediate", "advanced"] as SkillLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  selectedLevel === level
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
                data-testid={`button-level-${level}`}
              >
                <div className="font-semibold">
                  {t[level]}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t[`${level}Desc` as keyof typeof t]}
                </div>
              </button>
            ))}
          </div>

          {authMode === "guest" && (
            <p className="text-sm text-muted-foreground text-center">
              {t.guestNote}
            </p>
          )}

          <Button 
            className="w-full" 
            size="lg" 
            onClick={confirmLevelSelection}
            disabled={isLoading}
            data-testid="button-confirm-level"
          >
            {isLoading ? "..." : t.getStarted}
          </Button>

          <Button 
            variant="ghost" 
            className="w-full"
            onClick={() => setShowLevelSelect(false)}
          >
            Back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Egg className="w-6 h-6 text-primary" />
            </div>
            <span className="font-bold text-xl">US Stock Hero</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="gap-1"
              data-testid="button-language-toggle"
            >
              <Globe className="w-4 h-4" />
              {language === "en" ? "EN" : "한국어"}
            </Button>
          </div>
        </div>
      </nav>

      <main className="pt-20">
        <section className="max-w-6xl mx-auto px-4 py-12 md:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight">
                {t.title}
                <span className="text-primary block">{t.titleHighlight}</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-md">
                {t.subtitle}
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Award className="w-4 h-4 text-primary" />
                  {t.freeForever}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-primary" />
                  {t.joinLearners}
                </span>
              </div>

              <div className="relative hidden lg:flex items-center justify-center mt-8">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-3xl blur-3xl" />
                <div className="relative w-48 h-48 rounded-full bg-primary/10 flex items-center justify-center border-4 border-primary/20">
                  <div className="text-center space-y-2">
                    <Egg className="w-16 h-16 text-primary mx-auto" />
                    <div className="flex items-center justify-center gap-1">
                      <Sparkles className="w-4 h-4 text-yellow-500" />
                      <span className="font-bold">Dino</span>
                      <Sparkles className="w-4 h-4 text-yellow-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Card className="p-6 md:p-8 space-y-6">
              <div className="flex gap-2">
                <Button
                  variant={authMode === "login" ? "default" : "ghost"}
                  className="flex-1"
                  onClick={() => setAuthMode("login")}
                  data-testid="button-login-tab"
                >
                  {t.signIn}
                </Button>
                <Button
                  variant={authMode === "register" ? "default" : "ghost"}
                  className="flex-1"
                  onClick={() => setAuthMode("register")}
                  data-testid="button-register-tab"
                >
                  {t.signUp}
                </Button>
              </div>

              <form onSubmit={authMode === "login" ? handleLogin : handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">{t.username}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      className="pl-10"
                      placeholder={t.username}
                      data-testid="input-username"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t.password}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="pl-10 pr-10"
                      placeholder={t.password}
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {authMode === "register" && (
                  <div className="space-y-2">
                    <Label htmlFor="email">{t.email}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="pl-10"
                        placeholder={t.email}
                        data-testid="input-email"
                      />
                    </div>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={isLoading}
                  data-testid="button-submit-auth"
                >
                  {isLoading ? "..." : (authMode === "login" ? t.login : t.register)}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    {t.orContinueWith}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full" 
                  asChild
                  data-testid="button-social-login"
                >
                  <a href="/api/login">
                    {t.socialLogin}
                  </a>
                </Button>

                <Button 
                  variant="ghost" 
                  className="w-full text-muted-foreground"
                  onClick={handleGuest}
                  data-testid="button-guest"
                >
                  {t.continueAsGuest}
                </Button>
              </div>

              <p className="text-center text-sm text-muted-foreground">
                {authMode === "login" ? t.noAccount : t.haveAccount}{" "}
                <button
                  onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                  className="text-primary hover:underline"
                >
                  {authMode === "login" ? t.signUp : t.signIn}
                </button>
              </p>
            </Card>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="font-serif text-3xl font-bold text-center mb-12">
            {t.whyLove}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 bg-background/50 hover:bg-background transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{t.dailyQuests}</h3>
              <p className="text-muted-foreground">{t.dailyQuestsDesc}</p>
            </Card>

            <Card className="p-6 bg-background/50 hover:bg-background transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                <Egg className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{t.collectEggs}</h3>
              <p className="text-muted-foreground">{t.collectEggsDesc}</p>
            </Card>

            <Card className="p-6 bg-background/50 hover:bg-background transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4">
                <ChartLine className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{t.realData}</h3>
              <p className="text-muted-foreground">{t.realDataDesc}</p>
            </Card>
          </div>
        </section>

        <footer className="border-t border-border/50 py-8 mt-16">
          <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>{t.footer}</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
