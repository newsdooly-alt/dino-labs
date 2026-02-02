import { useState, useEffect } from "react";
import { useUser, useUpdateLanguage } from "@/hooks/use-user";
import { useTheme } from "@/contexts/ThemeContext";
import { translations } from "@/lib/translations";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Settings as SettingsIcon,
  User,
  Palette,
  Globe,
  Moon,
  Sun,
  RefreshCw,
  DollarSign,
  Target,
  Bell,
  Trash2,
  LogOut,
  Check,
  ChevronRight,
} from "lucide-react";

type DinoColor = "green" | "blue" | "pink";
type RefreshInterval = "manual" | "1min" | "5min";
type Currency = "usd" | "krw";

interface AppSettings {
  nickname: string;
  dinoColor: DinoColor;
  refreshInterval: RefreshInterval;
  currency: Currency;
  dailyGoal: number;
  marketAlerts: boolean;
}

const defaultSettings: AppSettings = {
  nickname: "",
  dinoColor: "green",
  refreshInterval: "1min",
  currency: "usd",
  dailyGoal: 50,
  marketAlerts: true,
};

const DINO_COLORS: { value: DinoColor; colorClass: string }[] = [
  { value: "green", colorClass: "bg-green-500" },
  { value: "blue", colorClass: "bg-blue-500" },
  { value: "pink", colorClass: "bg-pink-500" },
];

export default function Settings() {
  const { data: user } = useUser();
  const updateLanguage = useUpdateLanguage();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const lang = (user?.language || "en") as keyof typeof translations;
  const t = translations[lang];

  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("dinolingo_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (e) {
        console.error("Failed to parse settings:", e);
      }
    }
    if (user?.username) {
      setSettings(prev => ({ ...prev, nickname: prev.nickname || user.username }));
    }
  }, [user?.username]);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveSettings = () => {
    localStorage.setItem("dinolingo_settings", JSON.stringify(settings));
    localStorage.setItem("dinolingo_refresh_interval", settings.refreshInterval);
    localStorage.setItem("dinolingo_currency", settings.currency);
    localStorage.setItem("dinolingo_daily_goal", String(settings.dailyGoal));
    localStorage.setItem("dinolingo_dino_color", settings.dinoColor);
    setHasChanges(false);
    toast({
      title: t.changes_saved,
      duration: 2000,
    });
  };

  const handleLanguageChange = (newLang: "en" | "ko") => {
    updateLanguage.mutate(newLang);
  };

  const handleResetData = () => {
    localStorage.removeItem("dinolingo_settings");
    localStorage.removeItem("onboarding_complete");
    localStorage.removeItem("dinolingo_refresh_interval");
    localStorage.removeItem("dinolingo_currency");
    localStorage.removeItem("dinolingo_daily_goal");
    localStorage.removeItem("dinolingo_dino_color");
    localStorage.removeItem("news_read_count");
    queryClient.clear();
    toast({
      title: t.data_reset_success,
      duration: 2000,
    });
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
    window.location.reload();
  };

  const colorLabel = (color: DinoColor) => {
    switch (color) {
      case "green": return t.color_green;
      case "blue": return t.color_blue;
      case "pink": return t.color_pink;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 mx-auto mb-4 bg-green-600/10 rounded-2xl flex items-center justify-center">
          <SettingsIcon className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-3xl font-display font-bold">{t.settings_title}</h1>
        <p className="text-muted-foreground mt-2">{t.settings_subtitle}</p>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-3">
          <User className="w-5 h-5 text-green-600" />
          <h2 className="font-semibold">{t.profile_avatar}</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname" className="text-sm font-medium">{t.nickname}</Label>
            <Input
              id="nickname"
              value={settings.nickname}
              onChange={(e) => updateSetting("nickname", e.target.value)}
              placeholder={t.nickname_placeholder}
              className="h-11"
              data-testid="input-nickname"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t.dino_color}</Label>
            <div className="flex gap-3">
              {DINO_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateSetting("dinoColor", color.value)}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2",
                    settings.dinoColor === color.value
                      ? "border-green-600 bg-green-600/10"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                  data-testid={`button-color-${color.value}`}
                >
                  <span className={cn("w-5 h-5 rounded-full", color.colorClass)} />
                  <span className="text-sm font-medium">{colorLabel(color.value)}</span>
                  {settings.dinoColor === color.value && (
                    <Check className="w-4 h-4 text-green-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-3">
          <Palette className="w-5 h-5 text-green-600" />
          <h2 className="font-semibold">{t.app_preferences}</h2>
        </div>
        <div className="divide-y divide-border">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Sun className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">{t.theme}</p>
                <p className="text-sm text-muted-foreground">{theme === "dark" ? t.dark : t.light}</p>
              </div>
            </div>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={toggleTheme}
              data-testid="switch-theme"
            />
          </div>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{t.language}</p>
                <p className="text-sm text-muted-foreground">{user?.language === "ko" ? "한국어" : "English"}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant={user?.language === "en" ? "default" : "outline"}
                size="sm"
                onClick={() => handleLanguageChange("en")}
                className="h-9"
                data-testid="button-lang-en"
              >
                EN
              </Button>
              <Button
                variant={user?.language === "ko" ? "default" : "outline"}
                size="sm"
                onClick={() => handleLanguageChange("ko")}
                className="h-9"
                data-testid="button-lang-ko"
              >
                한국어
              </Button>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-green-600" />
          <h2 className="font-semibold">{t.stock_data_management}</h2>
        </div>
        <div className="divide-y divide-border">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-muted-foreground" />
              <p className="font-medium">{t.refresh_interval}</p>
            </div>
            <Select
              value={settings.refreshInterval}
              onValueChange={(value: RefreshInterval) => updateSetting("refreshInterval", value)}
            >
              <SelectTrigger className="w-40 h-10" data-testid="select-refresh-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">{t.refresh_manual}</SelectItem>
                <SelectItem value="1min">{t.refresh_1min}</SelectItem>
                <SelectItem value="5min">{t.refresh_5min}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{t.currency}</p>
                <p className="text-sm text-muted-foreground">
                  {settings.currency === "usd" ? "1 USD = ₩1,350" : "₩1,350 = 1 USD"}
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant={settings.currency === "usd" ? "default" : "outline"}
                size="sm"
                onClick={() => updateSetting("currency", "usd")}
                className="h-9"
                data-testid="button-currency-usd"
              >
                {t.currency_usd}
              </Button>
              <Button
                variant={settings.currency === "krw" ? "default" : "outline"}
                size="sm"
                onClick={() => updateSetting("currency", "krw")}
                className="h-9"
                data-testid="button-currency-krw"
              >
                {t.currency_krw}
              </Button>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-3">
          <Target className="w-5 h-5 text-green-600" />
          <h2 className="font-semibold">{t.learning_notifications}</h2>
        </div>
        <div className="divide-y divide-border">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-muted-foreground" />
                <p className="font-medium">{t.daily_goal}</p>
              </div>
              <span className="text-lg font-bold text-green-600">{settings.dailyGoal} XP</span>
            </div>
            <Slider
              value={[settings.dailyGoal]}
              onValueChange={([value]) => updateSetting("dailyGoal", value)}
              min={10}
              max={200}
              step={10}
              className="w-full"
              data-testid="slider-daily-goal"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10 XP</span>
              <span>100 XP</span>
              <span>200 XP</span>
            </div>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{t.market_alerts}</p>
                <p className="text-sm text-muted-foreground">{t.market_open} / {t.market_closed}</p>
              </div>
            </div>
            <Switch
              checked={settings.marketAlerts}
              onCheckedChange={(checked) => updateSetting("marketAlerts", checked)}
              data-testid="switch-market-alerts"
            />
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-3">
          <User className="w-5 h-5 text-green-600" />
          <h2 className="font-semibold">{t.account_actions}</h2>
        </div>
        <div className="divide-y divide-border">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="w-full p-4 flex items-center justify-between text-left hover-elevate transition-colors"
                data-testid="button-reset-data"
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="font-medium text-red-500">{t.reset_data}</p>
                    <p className="text-sm text-muted-foreground">{t.reset_data_desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.reset_confirm_title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t.reset_confirm_message}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-reset-cancel">{t.reset_confirm_no}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetData}
                  className="bg-red-500 hover:bg-red-600 text-white"
                  data-testid="button-reset-confirm"
                >
                  {t.reset_confirm_yes}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <button
            onClick={handleLogout}
            className="w-full p-4 flex items-center justify-between text-left hover-elevate transition-colors"
            data-testid="button-logout"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-muted-foreground" />
              <p className="font-medium">{t.logout}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </motion.section>

      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border md:left-64"
        >
          <div className="max-w-3xl mx-auto">
            <Button
              onClick={saveSettings}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold"
              data-testid="button-save-settings"
            >
              <Check className="w-5 h-5 mr-2" />
              {t.save_changes}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
