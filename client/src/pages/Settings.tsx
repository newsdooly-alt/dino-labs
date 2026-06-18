import { useState, useEffect } from "react";
import { useUser, useUpdateLanguage } from "@/hooks/use-user";
import { useAuth } from "@/hooks/use-auth";
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
  GraduationCap,
  UserPlus,
  Loader2,
  Clock,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useCurrency, type CurrencyType } from "@/contexts/CurrencyContext";
import { useThemeColor } from "@/contexts/ThemeColorContext";
import { useTimezone, TZ_OPTIONS, type TimezoneKey } from "@/contexts/TimezoneContext";
import {
  isNativePlatform,
  loadNotificationPrefs,
  saveNotificationPrefs,
  applyNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications";
import { BellRing, WifiOff } from "lucide-react";

type ThemeColor = "green" | "blue" | "pink" | "dark";
type RefreshInterval = "manual" | "1min" | "5min";
type SkillLevel = "beginner" | "intermediate" | "advanced";

interface AppSettings {
  nickname: string;
  themeColor: ThemeColor;
  refreshInterval: RefreshInterval;
  currency: CurrencyType;
  dailyGoal: number;
  marketAlerts: boolean;
}

const defaultSettings: AppSettings = {
  nickname: "",
  themeColor: "green",
  refreshInterval: "1min",
  currency: "usd",
  dailyGoal: 50,
  marketAlerts: true,
};

const THEME_COLORS: { value: ThemeColor; colorClass: string }[] = [
  { value: "green", colorClass: "bg-green-500" },
  { value: "blue",  colorClass: "bg-blue-500"  },
  { value: "pink",  colorClass: "bg-pink-500"  },
  { value: "dark",  colorClass: "bg-slate-800" },
];

export default function Settings() {
  const { data: user } = useUser();
  const { logout } = useAuth();
  const updateLanguage = useUpdateLanguage();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const lang = (user?.language || "ko") as keyof typeof translations;
  const t = translations[lang];
  const { currency: activeCurrency, setCurrency: setGlobalCurrency, exchangeRate, exchangeRateJPY } = useCurrency();
  const { timezone, setTimezone } = useTimezone();

  const { themeColor: activeThemeColor, setThemeColor: setGlobalThemeColor } = useThemeColor();

  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("beginner");
  const [isUpdatingSkillLevel, setIsUpdatingSkillLevel] = useState(false);
  const [upgradeUsername, setUpgradeUsername] = useState("");
  const [upgradePassword, setUpgradePassword] = useState("");
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(loadNotificationPrefs);
  const [isSavingNotif, setIsSavingNotif] = useState(false);
  const isNative = isNativePlatform();
  const idbActive = typeof window !== "undefined" && "indexedDB" in window;

  const isGuest = (user as any)?.authType === "guest";

  useEffect(() => {
    const saved = localStorage.getItem("dinolingo_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed, themeColor: activeThemeColor });
      } catch (e) {
        console.error("Failed to parse settings:", e);
      }
    }
    if (user?.nickname) {
      setSettings(prev => ({ ...prev, nickname: prev.nickname || user.nickname || "" }));
    }
    if (user?.skillLevel) {
      setSkillLevel(user.skillLevel as SkillLevel);
    }
    setSettings(prev => ({ ...prev, themeColor: activeThemeColor }));
  }, [user?.nickname, user?.skillLevel, activeThemeColor]);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await apiRequest("PATCH", "/api/profiles/settings", {
        nickname: settings.nickname,
        themeColor: settings.themeColor,
      });
      setGlobalThemeColor(settings.themeColor);
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
    } catch (e) {
      console.error("Failed to save profile settings:", e);
    }
    localStorage.setItem("dinolingo_settings", JSON.stringify(settings));
    localStorage.setItem("dinolingo_refresh_interval", settings.refreshInterval);
    localStorage.setItem("dinolingo_currency", settings.currency);
    localStorage.setItem("dinolingo_daily_goal", String(settings.dailyGoal));
    localStorage.setItem("dinolingo_theme_color", settings.themeColor);
    setHasChanges(false);
    setIsSaving(false);
    toast({
      title: t.changes_saved,
      duration: 2000,
    });
  };

  const handleLanguageChange = (newLang: "en" | "ko" | "ja") => {
    updateLanguage.mutate(newLang);
  };

  const handleSkillLevelChange = async (level: SkillLevel) => {
    setIsUpdatingSkillLevel(true);
    try {
      await apiRequest("PATCH", "/api/profiles/skill-level", { skillLevel: level });
      setSkillLevel(level);
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quests"] });
      toast({
        title: t.skill_level_changed,
        duration: 2000,
      });
    } catch (error) {
      console.error("Failed to update skill level:", error);
    } finally {
      setIsUpdatingSkillLevel(false);
    }
  };

  const handleGuestUpgrade = async () => {
    if (!upgradeUsername.trim() || !upgradePassword.trim()) return;
    setIsUpgrading(true);
    try {
      await apiRequest("POST", "/api/auth/upgrade", {
        username: upgradeUsername.trim(),
        password: upgradePassword,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quests"] });
      toast({
        title: t.upgrade_success,
        duration: 3000,
      });
      setUpgradeUsername("");
      setUpgradePassword("");
    } catch (error: any) {
      toast({
        title: error.message || "Failed to upgrade account",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsUpgrading(false);
    }
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
    logout();
  };

  const handleSaveNotifPrefs = async () => {
    setIsSavingNotif(true);
    try {
      saveNotificationPrefs(notifPrefs);
      const langKey = (user?.language || "en") as "en" | "ko" | "ja";
      await applyNotificationPreferences(notifPrefs, langKey);
      toast({ title: lang === "ko" ? "알림 설정이 저장되었어요" : lang === "ja" ? "通知設定を保存しました" : "Notification settings saved", duration: 2000 });
    } catch (err) {
      console.error("Failed to save notification prefs:", err);
    } finally {
      setIsSavingNotif(false);
    }
  };

  const colorLabel = (color: ThemeColor) => {
    switch (color) {
      case "green": return t.color_green;
      case "blue":  return t.color_blue;
      case "pink":  return t.color_pink;
      case "dark":  return t.color_dark;
    }
  };

  const langDisplayName = () => {
    const l = user?.language;
    if (l === "ko") return "한국어";
    if (l === "ja") return "日本語";
    return "English";
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6 pb-24 w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center">
          <SettingsIcon className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-display font-bold" data-testid="text-settings-title">{t.settings_title}</h1>
        <p className="text-muted-foreground mt-2" data-testid="text-settings-subtitle">{t.settings_subtitle}</p>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-3" data-testid="section-profile-avatar">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">{t.profile_avatar}</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname" className="text-sm font-medium" data-testid="label-nickname">{t.nickname}</Label>
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
            <Label className="text-sm font-medium" data-testid="label-theme-color">{t.theme_color}</Label>
            <div className="flex gap-3">
              {THEME_COLORS.map((color) => (
                <Button
                  key={color.value}
                  variant={settings.themeColor === color.value ? "default" : "outline"}
                  onClick={() => {
                    updateSetting("themeColor", color.value);
                    setGlobalThemeColor(color.value);
                  }}
                  className="flex-1 h-12 gap-2"
                  data-testid={`button-color-${color.value}`}
                >
                  <span className={cn("w-5 h-5 rounded-full", color.colorClass)} />
                  <span className="text-sm font-medium">{colorLabel(color.value)}</span>
                  {settings.themeColor === color.value && (
                    <Check className="w-4 h-4" />
                  )}
                </Button>
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
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-3" data-testid="section-app-preferences">
          <Palette className="w-5 h-5 text-primary" />
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
                <p className="font-medium" data-testid="label-theme">{t.theme}</p>
                <p className="text-sm text-muted-foreground" data-testid="text-theme-value">{theme === "dark" ? t.dark : t.light}</p>
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
                <p className="font-medium" data-testid="label-language">{t.language}</p>
                <p className="text-sm text-muted-foreground" data-testid="text-language-value">{langDisplayName()}</p>
              </div>
            </div>
            <div className="flex gap-1 flex-wrap">
              <Button
                variant={user?.language === "ko" ? "default" : "outline"}
                size="sm"
                onClick={() => handleLanguageChange("ko")}
                className="h-9"
                data-testid="button-lang-ko"
              >
                KR
              </Button>
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
                variant={user?.language === "ja" ? "default" : "outline"}
                size="sm"
                onClick={() => handleLanguageChange("ja")}
                className="h-9"
                data-testid="button-lang-ja"
              >
                JP
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
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-3" data-testid="section-stock-data">
          <RefreshCw className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">{t.stock_data_management}</h2>
        </div>
        <div className="divide-y divide-border">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-muted-foreground" />
              <p className="font-medium" data-testid="label-refresh-interval">{t.refresh_interval}</p>
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
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium" data-testid="label-currency">{t.currency}</p>
                <p className="text-sm text-muted-foreground" data-testid="text-exchange-rate">
                  {`1 USD = ₩${Math.round(exchangeRate).toLocaleString()} / ¥${Math.round(exchangeRateJPY)}`}
                </p>
              </div>
            </div>
            <div className="flex gap-1 flex-wrap">
              <Button
                variant={activeCurrency === "usd" ? "default" : "outline"}
                size="sm"
                onClick={() => { setGlobalCurrency("usd"); updateSetting("currency", "usd"); }}
                className="h-9"
                data-testid="button-currency-usd"
              >
                {t.currency_usd}
              </Button>
              <Button
                variant={activeCurrency === "krw" ? "default" : "outline"}
                size="sm"
                onClick={() => { setGlobalCurrency("krw"); updateSetting("currency", "krw"); }}
                className="h-9"
                data-testid="button-currency-krw"
              >
                {t.currency_krw}
              </Button>
              <Button
                variant={activeCurrency === "jpy" ? "default" : "outline"}
                size="sm"
                onClick={() => { setGlobalCurrency("jpy"); updateSetting("currency", "jpy"); }}
                className="h-9"
                data-testid="button-currency-jpy"
              >
                {t.currency_jpy}
              </Button>
            </div>
          </div>
          <div className="p-4 space-y-3 border-t border-border">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium" data-testid="label-timezone">{t.timezone_settings}</p>
                <p className="text-sm text-muted-foreground">
                  {TZ_OPTIONS.find(o => o.value === timezone)?.[lang === "ko" ? "labelKo" : "labelEn"] ?? timezone.toUpperCase()}
                </p>
              </div>
            </div>
            <div className="flex gap-1 flex-wrap">
              {TZ_OPTIONS.map(opt => (
                <Button
                  key={opt.value}
                  variant={timezone === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimezone(opt.value)}
                  className="h-9 text-xs"
                  data-testid={`button-timezone-${opt.value}`}
                >
                  {opt.value.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-3" data-testid="section-skill-level">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">{t.skill_level}</h2>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">{t.skill_level_desc}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              variant={skillLevel === "beginner" ? "default" : "outline"}
              onClick={() => handleSkillLevelChange("beginner")}
              disabled={isUpdatingSkillLevel}
              className="flex flex-col h-auto py-3 gap-1 min-w-0"
              data-testid="button-skill-beginner"
            >
              <span className="font-medium truncate">{t.skill_beginner}</span>
              <span className="text-xs opacity-70 text-center line-clamp-2">{t.skill_beginner_desc}</span>
            </Button>
            <Button
              variant={skillLevel === "intermediate" ? "default" : "outline"}
              onClick={() => handleSkillLevelChange("intermediate")}
              disabled={isUpdatingSkillLevel}
              className="flex flex-col h-auto py-3 gap-1 min-w-0"
              data-testid="button-skill-intermediate"
            >
              <span className="font-medium truncate">{t.skill_intermediate}</span>
              <span className="text-xs opacity-70 text-center line-clamp-2">{t.skill_intermediate_desc}</span>
            </Button>
            <Button
              variant={skillLevel === "advanced" ? "default" : "outline"}
              onClick={() => handleSkillLevelChange("advanced")}
              disabled={isUpdatingSkillLevel}
              className="flex flex-col h-auto py-3 gap-1 min-w-0"
              data-testid="button-skill-advanced"
            >
              <span className="font-medium truncate">{t.skill_advanced}</span>
              <span className="text-xs opacity-70 text-center line-clamp-2">{t.skill_advanced_desc}</span>
            </Button>
          </div>
        </div>
      </motion.section>

      {isGuest && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="bg-card border border-border rounded-2xl overflow-hidden border-amber-500/50"
        >
          <div className="px-4 py-3 bg-amber-500/10 border-b border-border flex items-center gap-3" data-testid="section-guest-upgrade">
            <UserPlus className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold">{t.guest_account}</h2>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">{t.guest_account_desc}</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="upgrade-username" className="text-sm font-medium">{t.create_username}</Label>
                <Input
                  id="upgrade-username"
                  value={upgradeUsername}
                  onChange={(e) => setUpgradeUsername(e.target.value)}
                  placeholder="username"
                  className="h-11"
                  data-testid="input-upgrade-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upgrade-password" className="text-sm font-medium">{t.create_password}</Label>
                <Input
                  id="upgrade-password"
                  type="password"
                  value={upgradePassword}
                  onChange={(e) => setUpgradePassword(e.target.value)}
                  placeholder="password"
                  className="h-11"
                  data-testid="input-upgrade-password"
                />
              </div>
              <Button
                onClick={handleGuestUpgrade}
                disabled={isUpgrading || !upgradeUsername.trim() || !upgradePassword.trim()}
                className="w-full h-11 bg-amber-600 hover:bg-amber-700"
                data-testid="button-upgrade-account"
              >
                {isUpgrading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                {t.upgrade_to_member}
              </Button>
            </div>
          </div>
        </motion.section>
      )}

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-3" data-testid="section-learning-notifications">
          <Target className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">{t.learning_notifications}</h2>
        </div>
        <div className="divide-y divide-border">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-muted-foreground" />
                <p className="font-medium" data-testid="label-daily-goal">{t.daily_goal}</p>
              </div>
              <span className="text-lg font-bold text-primary" data-testid="text-daily-goal">{settings.dailyGoal} XP</span>
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
                <p className="font-medium" data-testid="label-market-alerts">{t.market_alerts}</p>
                <p className="text-sm text-muted-foreground" data-testid="text-market-alerts-desc">{t.market_open} / {t.market_closed}</p>
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

      {/* ── Native Notifications & Offline Cache ──────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.27 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-3" data-testid="section-notifications">
          <BellRing className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">{t.notifications_section}</h2>
        </div>
        <div className="divide-y divide-border">
          {/* Quest Reminder */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium" data-testid="label-quest-reminder">{t.quest_reminder}</p>
                  <p className="text-sm text-muted-foreground">{t.quest_reminder_desc}</p>
                </div>
              </div>
              <Switch
                checked={notifPrefs.questReminderEnabled}
                onCheckedChange={(v) => setNotifPrefs(p => ({ ...p, questReminderEnabled: v }))}
                disabled={!isNative}
                data-testid="switch-quest-reminder"
              />
            </div>
            {notifPrefs.questReminderEnabled && (
              <div className="flex items-center gap-3 pl-8">
                <Label className="text-sm shrink-0">{t.reminder_time}</Label>
                <div className="flex gap-2 items-center">
                  <Select
                    value={String(notifPrefs.questReminderHour)}
                    onValueChange={(v) => setNotifPrefs(p => ({ ...p, questReminderHour: Number(v) }))}
                    disabled={!isNative}
                  >
                    <SelectTrigger className="w-20 h-9" data-testid="select-reminder-hour">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">:</span>
                  <Select
                    value={String(notifPrefs.questReminderMinute)}
                    onValueChange={(v) => setNotifPrefs(p => ({ ...p, questReminderMinute: Number(v) }))}
                    disabled={!isNative}
                  >
                    <SelectTrigger className="w-20 h-9" data-testid="select-reminder-minute">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 15, 30, 45].map(m => (
                        <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          {/* Streak Alert */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium" data-testid="label-streak-alert">{t.streak_alert}</p>
                <p className="text-sm text-muted-foreground">{t.streak_alert_desc}</p>
              </div>
            </div>
            <Switch
              checked={notifPrefs.streakAlertEnabled}
              onCheckedChange={(v) => setNotifPrefs(p => ({ ...p, streakAlertEnabled: v }))}
              disabled={!isNative}
              data-testid="switch-streak-alert"
            />
          </div>
          {/* Native-only note or Apply button */}
          {isNative ? (
            <div className="p-4">
              <Button
                onClick={handleSaveNotifPrefs}
                disabled={isSavingNotif}
                className="w-full h-10"
                data-testid="button-save-notifications"
              >
                {isSavingNotif ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                {t.notifications_save}
              </Button>
            </div>
          ) : (
            <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
              <BellRing className="w-4 h-4 shrink-0" />
              <span data-testid="text-notifications-native-only">{t.notifications_native_only}</span>
            </div>
          )}
          {/* Offline cache status */}
          <div className="p-4 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <p className="font-medium" data-testid="label-offline-cache">{t.offline_cache}</p>
              <p className="text-sm text-muted-foreground" data-testid="text-offline-status">
                {idbActive ? t.offline_status_active : t.offline_status_inactive}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.offline_cache_desc}</p>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-3" data-testid="section-account">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">{t.account_actions}</h2>
        </div>
        <div className="divide-y divide-border">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="w-full h-auto p-4 flex items-center justify-between text-left"
                data-testid="button-reset-data"
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="font-medium text-red-500" data-testid="text-reset-title">{t.reset_data}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-reset-desc">{t.reset_data_desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle data-testid="text-confirm-title">{t.reset_confirm_title}</AlertDialogTitle>
                <AlertDialogDescription data-testid="text-confirm-message">
                  {t.reset_confirm_message}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-reset-cancel">{t.reset_confirm_no}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetData}
                  className="bg-destructive text-destructive-foreground"
                  data-testid="button-reset-confirm"
                >
                  {t.reset_confirm_yes}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full h-auto p-4 flex items-center justify-between text-left"
            data-testid="button-logout"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-muted-foreground" />
              <p className="font-medium" data-testid="text-logout">{t.logout}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Button>
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
              className="w-full h-12 font-semibold"
              disabled={isSaving}
              data-testid="button-save-settings"
            >
              {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
              {t.save_changes}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
