import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type TimezoneKey = "kst" | "et" | "jst" | "utc" | "local";

interface TimezoneContextType {
  timezone: TimezoneKey;
  setTimezone: (tz: TimezoneKey) => void;
  formatTime: (utcMs: number) => string;
  formatTimeShort: (utcMs: number) => string;
  timezoneLabel: string;
  tzOptions: { value: TimezoneKey; labelEn: string; labelKo: string }[];
}

export const TZ_ZONES: Record<TimezoneKey, string | undefined> = {
  kst: "Asia/Seoul",
  et: "America/New_York",
  jst: "Asia/Tokyo",
  utc: "UTC",
  local: undefined,
};

export const TZ_LABELS: Record<TimezoneKey, string> = {
  kst: "KST",
  et: "ET",
  jst: "JST",
  utc: "UTC",
  local: "Local",
};

export const TZ_OPTIONS: { value: TimezoneKey; labelEn: string; labelKo: string }[] = [
  { value: "kst", labelEn: "KST (Korea Standard Time)", labelKo: "KST (한국 표준시)" },
  { value: "et",  labelEn: "ET (US Eastern Time)",       labelKo: "ET (미국 동부시)" },
  { value: "jst", labelEn: "JST (Japan Standard Time)",  labelKo: "JST (일본 표준시)" },
  { value: "utc", labelEn: "UTC",                        labelKo: "UTC" },
  { value: "local", labelEn: "Local Time",               labelKo: "현지 시간" },
];

const TimezoneContext = createContext<TimezoneContextType | null>(null);

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState<TimezoneKey>(() => {
    const saved = localStorage.getItem("dinolingo_timezone");
    return (saved as TimezoneKey) || "kst";
  });

  const setTimezone = useCallback((tz: TimezoneKey) => {
    setTimezoneState(tz);
    localStorage.setItem("dinolingo_timezone", tz);
  }, []);

  const formatTime = useCallback((utcMs: number): string => {
    if (!utcMs) return "--";
    const zone = TZ_ZONES[timezone];
    const label = TZ_LABELS[timezone];
    const opts: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };
    if (zone) opts.timeZone = zone;
    const formatted = new Intl.DateTimeFormat("en-US", opts).format(new Date(utcMs));
    return `${formatted} ${label}`;
  }, [timezone]);

  const formatTimeShort = useCallback((utcMs: number): string => {
    if (!utcMs) return "--";
    const zone = TZ_ZONES[timezone];
    const opts: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };
    if (zone) opts.timeZone = zone;
    return new Intl.DateTimeFormat("en-US", opts).format(new Date(utcMs));
  }, [timezone]);

  const timezoneLabel = TZ_LABELS[timezone];

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone, formatTime, formatTimeShort, timezoneLabel, tzOptions: TZ_OPTIONS }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (!context) throw new Error("useTimezone must be used within a TimezoneProvider");
  return context;
}
