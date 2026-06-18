import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications, type ScheduleOptions } from "@capacitor/local-notifications";

export interface NotificationPreferences {
  questReminderEnabled: boolean;
  questReminderHour: number;
  questReminderMinute: number;
  streakAlertEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  questReminderEnabled: true,
  questReminderHour: 9,
  questReminderMinute: 0,
  streakAlertEnabled: true,
};

const PREFS_KEY = "dino_notification_prefs";
const QUEST_REMINDER_ID = 1001;
const STREAK_ALERT_ID = 1002;

export function loadNotificationPrefs(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PREFS };
}

export function saveNotificationPrefs(prefs: NotificationPreferences): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

// ─── Push Notifications (Firebase/APNS) ───────────────────────────────────────
// Requires google-services.json (Android) and APNS cert (iOS) to be added
// to the native project before push notifications will work in production.

export async function initPushNotifications(
  onToken?: (token: string) => void
): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== "granted") {
      console.warn("[PushNotifications] Permission not granted");
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener("registration", (token) => {
      console.log("[PushNotifications] Token:", token.value);
      onToken?.(token.value);
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("[PushNotifications] Registration error:", err.error);
    });

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("[PushNotifications] Received:", notification);
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("[PushNotifications] Action performed:", action);
    });
  } catch (err) {
    console.warn("[PushNotifications] Init error:", err);
  }
}

// ─── Local Notifications ──────────────────────────────────────────────────────

export async function requestLocalNotificationPermission(): Promise<boolean> {
  if (!isNativePlatform()) return false;

  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === "prompt") {
      perm = await LocalNotifications.requestPermissions();
    }
    return perm.display === "granted";
  } catch {
    return false;
  }
}

export async function scheduleDailyQuestReminder(
  hour: number,
  minute: number,
  lang: "en" | "ko" | "ja" = "en"
): Promise<void> {
  if (!isNativePlatform()) return;

  const granted = await requestLocalNotificationPermission();
  if (!granted) return;

  await LocalNotifications.cancel({ notifications: [{ id: QUEST_REMINDER_ID }] });

  const titles: Record<string, string> = {
    en: "🦕 Daily Quests Ready!",
    ko: "🦕 오늘의 퀘스트가 기다려요!",
    ja: "🦕 デイリークエスト開始！",
  };
  const bodies: Record<string, string> = {
    en: "Complete your daily quests to keep your streak alive!",
    ko: "매일 퀘스트를 완료하고 스트릭을 유지하세요!",
    ja: "デイリークエストをクリアしてストリークを守ろう！",
  };

  const now = new Date();
  const scheduleAt = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
    0
  );
  if (scheduleAt <= now) {
    scheduleAt.setDate(scheduleAt.getDate() + 1);
  }

  const options: ScheduleOptions = {
    notifications: [
      {
        id: QUEST_REMINDER_ID,
        title: titles[lang] ?? titles.en,
        body: bodies[lang] ?? bodies.en,
        schedule: {
          at: scheduleAt,
          repeats: true,
          every: "day",
        },
        smallIcon: "ic_stat_dino",
        iconColor: "#22c55e",
        sound: "default",
      },
    ],
  };

  await LocalNotifications.schedule(options);
  console.log(`[LocalNotifications] Quest reminder scheduled at ${hour}:${String(minute).padStart(2, "0")}`);
}

export async function scheduleStreakAlert(lang: "en" | "ko" | "ja" = "en"): Promise<void> {
  if (!isNativePlatform()) return;

  const granted = await requestLocalNotificationPermission();
  if (!granted) return;

  await LocalNotifications.cancel({ notifications: [{ id: STREAK_ALERT_ID }] });

  const titles: Record<string, string> = {
    en: "🔥 Don't lose your streak!",
    ko: "🔥 스트릭이 끊길 위기예요!",
    ja: "🔥 ストリークが危ない！",
  };
  const bodies: Record<string, string> = {
    en: "You haven't done today's quests yet. Quick — Dino needs you!",
    ko: "오늘 퀘스트를 아직 안 했어요. 지금 바로 디노를 도와주세요!",
    ja: "今日のクエストがまだです。ダイノが待っています！",
  };

  const now = new Date();
  const scheduleAt = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    20,
    0,
    0
  );
  if (scheduleAt <= now) {
    scheduleAt.setDate(scheduleAt.getDate() + 1);
  }

  const options: ScheduleOptions = {
    notifications: [
      {
        id: STREAK_ALERT_ID,
        title: titles[lang] ?? titles.en,
        body: bodies[lang] ?? bodies.en,
        schedule: {
          at: scheduleAt,
          repeats: true,
          every: "day",
        },
        smallIcon: "ic_stat_dino",
        iconColor: "#f97316",
        sound: "default",
      },
    ],
  };

  await LocalNotifications.schedule(options);
  console.log("[LocalNotifications] Streak alert scheduled at 20:00");
}

export async function cancelAllLocalNotifications(): Promise<void> {
  if (!isNativePlatform()) return;
  await LocalNotifications.cancel({
    notifications: [{ id: QUEST_REMINDER_ID }, { id: STREAK_ALERT_ID }],
  });
}

export async function applyNotificationPreferences(
  prefs: NotificationPreferences,
  lang: "en" | "ko" | "ja" = "en"
): Promise<void> {
  if (!isNativePlatform()) return;

  if (prefs.questReminderEnabled) {
    await scheduleDailyQuestReminder(prefs.questReminderHour, prefs.questReminderMinute, lang);
  } else {
    await LocalNotifications.cancel({ notifications: [{ id: QUEST_REMINDER_ID }] });
  }

  if (prefs.streakAlertEnabled) {
    await scheduleStreakAlert(lang);
  } else {
    await LocalNotifications.cancel({ notifications: [{ id: STREAK_ALERT_ID }] });
  }
}

// ─── Service Worker Registration (web/PWA) ────────────────────────────────────

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (isNativePlatform()) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[SW] Registered:", reg.scope);
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
  });
}
