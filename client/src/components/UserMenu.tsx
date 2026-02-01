import { useState, useEffect } from "react";
import { useUser, useUpdateLanguage } from "@/hooks/use-user";
import { useLocation } from "wouter";
import { translations } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Zap,
  Star,
  Eye,
  BookOpen,
  Settings,
  LogOut,
  Globe,
  Moon,
  Sun,
  ChevronRight,
  X,
  Egg,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UserMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserMenu({ isOpen, onClose }: UserMenuProps) {
  const { data: user } = useUser();
  const updateLanguage = useUpdateLanguage();
  const [, navigate] = useLocation();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "dark";
  });

  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, [isOpen]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleLanguageChange = (newLang: "en" | "ko") => {
    updateLanguage.mutate(newLang);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  const level = Math.floor((user?.xp || 0) / 100) + 1;
  const xpProgress = ((user?.xp || 0) % 100);
  const eggsHatched = Math.floor((user?.xp || 0) / 1000);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 md:bg-transparent"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed z-50 bg-card border border-border shadow-2xl overflow-hidden",
              "md:right-4 md:top-16 md:w-80 md:rounded-2xl",
              "bottom-0 left-0 right-0 md:bottom-auto md:left-auto rounded-t-3xl md:rounded-2xl"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="md:hidden flex items-center justify-between p-4 border-b border-border">
              <span className="font-bold">{lang === "en" ? "Menu" : "메뉴"}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                data-testid="button-close-menu"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 bg-primary/10 border-b border-border">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/30">
                  <User className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">
                    {lang === "en" ? "Stock Explorer" : "주식 탐험가"}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {t.level} {level}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {user?.xp || 0} {t.xp}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {xpProgress}/100 {lang === "en" ? "to next level" : "다음 레벨까지"}
              </p>
            </div>

            <div className="p-4 border-b border-border">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {lang === "en" ? "Stats" : "통계"}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
                  <div>
                    <p className="font-bold text-orange-500">{user?.streak || 0}</p>
                    <p className="text-xs text-muted-foreground">
                      {lang === "en" ? "Day Streak" : "일 연속"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <Egg className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-bold text-primary">{eggsHatched}</p>
                    <p className="text-xs text-muted-foreground">
                      {lang === "en" ? "Eggs Hatched" : "부화한 알"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 border-b border-border">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-2">
                {lang === "en" ? "Navigation" : "내비게이션"}
              </h4>
              
              <button
                onClick={() => handleNavigation("/watchlist")}
                className="w-full flex items-center justify-between p-3 rounded-xl hover-elevate transition-colors"
                data-testid="menu-link-watchlist"
              >
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-primary" />
                  <span className="font-medium">{t.watchlist}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
              
              <button
                onClick={() => handleNavigation("/quests")}
                className="w-full flex items-center justify-between p-3 rounded-xl hover-elevate transition-colors"
                data-testid="menu-link-history"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <span className="font-medium">
                    {lang === "en" ? "Learning History" : "학습 기록"}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-2 border-b border-border">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-2">
                {t.settings}
              </h4>
              
              <div className="flex items-center justify-between p-3 rounded-xl">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-primary" />
                  <span className="font-medium">
                    {lang === "en" ? "Language" : "언어"}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={user?.language === "en" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleLanguageChange("en")}
                    className="text-xs h-8"
                    data-testid="button-lang-en"
                  >
                    EN
                  </Button>
                  <Button
                    variant={user?.language === "ko" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleLanguageChange("ko")}
                    className="text-xs h-8"
                    data-testid="button-lang-ko"
                  >
                    한국어
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-xl">
                <div className="flex items-center gap-3">
                  {theme === "dark" ? (
                    <Moon className="w-5 h-5 text-primary" />
                  ) : (
                    <Sun className="w-5 h-5 text-primary" />
                  )}
                  <span className="font-medium">
                    {lang === "en" ? "Theme" : "테마"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  className="text-xs h-8 gap-2"
                  data-testid="button-theme-toggle"
                >
                  {theme === "dark" ? (
                    <>
                      <Moon className="w-4 h-4" />
                      {lang === "en" ? "Dark" : "다크"}
                    </>
                  ) : (
                    <>
                      <Sun className="w-4 h-4" />
                      {lang === "en" ? "Light" : "라이트"}
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="p-4">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-destructive"
                data-testid="button-menu-logout"
              >
                <LogOut className="w-5 h-5" />
                {t.logout}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
