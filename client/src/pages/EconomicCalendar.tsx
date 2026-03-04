import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronUp,
  Info,
  Clock,
  Globe,
  ArrowRightLeft,
  TrendingUp,
  AlertCircle,
  Activity,
  ChevronLeft,
  ChevronRight,
  Zap,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  isSameDay,
  isSameMonth,
} from "date-fns";

interface EconomicEvent {
  id: string;
  time: string;
  indicator: string;
  indicatorKo?: string;
  importance: "Low" | "Medium" | "High";
  previous: string | null;
  forecast: string | null;
  actual: string | null;
  unit: string | null;
  country: string;
  category: string;
  definitionEn: string;
  definitionKo: string;
  impactEn: string;
  impactKo: string;
  correlationEn: string;
  correlationKo: string;
  counterIndicatorEn: string;
  counterIndicatorKo: string;
}

type Timezone = "KST" | "ET";

const INDICATOR_KO_MAP: Record<string, string> = {
  "ISM Manufacturing PMI": "미국 ISM 제조업 구매관리자지수",
  "ISM Services PMI": "미국 ISM 서비스업 구매관리자지수",
  "Non-Farm Payrolls (NFP)": "미국 비농업 고용지수(NFP)",
  "Unemployment Rate": "미국 실업률",
  "Consumer Price Index (CPI) (MoM)": "소비자물가지수(CPI) (전월비)",
  "Core CPI (YoY)": "근원 소비자물가지수(CPI) (전년비)",
  "Producer Price Index (PPI) (MoM)": "생산자물가지수(PPI) (전월비)",
  "Retail Sales (MoM)": "소매 판매 (전월비)",
  "Core PCE Price Index (MoM)": "근원 개인소비지출(PCE) 물가지수 (전월비)",
  "UMich Consumer Sentiment (Final)": "미시간대 소비자심리지수 (최종)",
  "Conference Board Consumer Confidence": "컨퍼런스보드 소비자신뢰지수",
  "FOMC Meeting (Day 1)": "연방공개시장위원회(FOMC) 회의 (1일차)",
  "FOMC Rate Decision & Press Conference": "연준 금리 결정 및 기자회견",
  "GDP Growth Rate (Q1 2026 Advance)": "미국 GDP 성장률 (2026년 1분기 속보치)",
  "GDP Growth Rate (Q2 2026 Advance)": "미국 GDP 성장률 (2026년 2분기 속보치)",
};

const CATEGORY_KO_MAP: Record<string, string> = {
  "Central Bank": "중앙은행",
  "Inflation": "물가",
  "Employment": "고용",
  "Consumer": "소비",
  "Growth": "경제성장",
  "Manufacturing": "제조업",
  "Services": "서비스업",
  "Housing": "부동산",
};

const COUNTRY_FLAGS: Record<string, string> = {
  "USA": "🇺🇸",
  "KOR": "🇰🇷",
  "JPN": "🇯🇵",
  "EU": "🇪🇺",
};

const COUNTRY_LABELS: Record<string, { en: string; ko: string }> = {
  "USA": { en: "US", ko: "미국" },
  "KOR": { en: "Korea", ko: "한국" },
  "JPN": { en: "Japan", ko: "일본" },
  "EU": { en: "EU", ko: "유럽" },
};

function getIndicatorKo(event: EconomicEvent): string {
  if (event.indicatorKo) return event.indicatorKo;
  return INDICATOR_KO_MAP[event.indicator] || event.indicator;
}

function getETOffset(date: Date): number {
  const year = date.getUTCFullYear();
  const dstStart = new Date(Date.UTC(year, 2, 8, 7, 0, 0));
  const dstEnd = new Date(Date.UTC(year, 10, 1, 6, 0, 0));
  return date >= dstStart && date < dstEnd ? -4 : -5;
}

function getTimezoneOffset(tz: Timezone, date: Date): number {
  if (tz === "KST") return 9;
  return getETOffset(date);
}

function toTzTime(utcIso: string, tz: Timezone): string {
  const date = new Date(utcIso);
  const offset = getTimezoneOffset(tz, date);
  const shifted = new Date(date.getTime() + offset * 3600000);
  const h = shifted.getUTCHours().toString().padStart(2, "0");
  const m = shifted.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function toTzDate(utcIso: string, tz: Timezone): Date {
  const date = new Date(utcIso);
  const offset = getTimezoneOffset(tz, date);
  const shifted = new Date(date.getTime() + offset * 3600000);
  return new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

function getTzLabel(tz: Timezone, date: Date): string {
  if (tz === "KST") return "KST";
  const offset = getETOffset(date);
  return offset === -4 ? "EDT" : "EST";
}

const IMPORTANCE_CONFIG = {
  High: {
    label: "High",
    labelKo: "높음",
    badgeClass: "bg-red-500/10 text-red-500 border-red-500/30",
    dotClass: "bg-red-500",
    barClass: "bg-red-500",
    bars: 3,
  },
  Medium: {
    label: "Medium",
    labelKo: "중간",
    badgeClass: "bg-orange-500/10 text-orange-500 border-orange-500/30",
    dotClass: "bg-orange-400",
    barClass: "bg-orange-400",
    bars: 2,
  },
  Low: {
    label: "Low",
    labelKo: "낮음",
    badgeClass: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    dotClass: "bg-blue-400",
    barClass: "bg-blue-400",
    bars: 1,
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  "Central Bank": "text-purple-500",
  "Inflation": "text-red-500",
  "Employment": "text-green-500",
  "Consumer": "text-blue-500",
  "Growth": "text-emerald-500",
  "Manufacturing": "text-orange-500",
  "Services": "text-cyan-500",
  "Housing": "text-yellow-500",
};

function ImportanceBars({ level }: { level: "Low" | "Medium" | "High" }) {
  const cfg = IMPORTANCE_CONFIG[level];
  return (
    <div className="flex items-end gap-[2px]">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn("rounded-sm w-1", i <= cfg.bars ? cfg.barClass : "bg-muted")}
          style={{ height: i === 1 ? 6 : i === 2 ? 9 : 12 }}
        />
      ))}
    </div>
  );
}

function ActualValueDisplay({ actual, forecast, unit }: { actual: string | null; forecast: string | null; unit: string | null }) {
  if (!actual) return <span className="text-muted-foreground font-mono text-xs">—</span>;
  const actualNum = parseFloat(actual);
  const forecastNum = parseFloat(forecast || "");
  let color = "text-foreground";
  if (!isNaN(actualNum) && !isNaN(forecastNum)) {
    color = actualNum > forecastNum ? "text-red-500" : actualNum < forecastNum ? "text-green-500" : "text-foreground";
  }
  return <span className={cn("font-mono font-bold text-xs", color)}>{actual}</span>;
}

function EventItem({
  event,
  lang,
  tz,
  autoExpand,
}: {
  event: EconomicEvent;
  lang: string;
  tz: Timezone;
  autoExpand?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(autoExpand ?? false);
  const cfg = IMPORTANCE_CONFIG[event.importance];
  const tzTime = toTzTime(event.time, tz);
  const tzLabel = getTzLabel(tz, new Date(event.time));
  const catColor = CATEGORY_COLORS[event.category] || "text-muted-foreground";
  const flag = COUNTRY_FLAGS[event.country] || "🌐";

  const definition = lang === "ko" ? event.definitionKo : event.definitionEn;
  const impact = lang === "ko" ? event.impactKo : event.impactEn;
  const correlation = lang === "ko" ? event.correlationKo : event.correlationEn;
  const counterIndicator = lang === "ko" ? event.counterIndicatorKo : event.counterIndicatorEn;

  const primaryName = lang === "ko" ? getIndicatorKo(event) : event.indicator;
  const secondaryName = lang === "ko" && getIndicatorKo(event) !== event.indicator ? event.indicator : null;
  const categoryLabel = lang === "ko" ? (CATEGORY_KO_MAP[event.category] || event.category) : event.category;

  return (
    <div className="border-b border-border/60 last:border-0" data-testid={`event-item-${event.id}`}>
      <button
        className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/30 active:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        data-testid={`button-expand-event-${event.id}`}
        aria-expanded={isExpanded}
      >
        <div className="flex flex-col items-center min-w-[46px] shrink-0">
          <span className="text-sm font-mono font-semibold tabular-nums">{tzTime}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{tzLabel}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-base leading-none">{flag}</span>
            <ImportanceBars level={event.importance} />
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", cfg.badgeClass)}>
              {lang === "ko" ? cfg.labelKo : cfg.label}
            </Badge>
            <span className={cn("text-[10px] font-medium uppercase tracking-wide", catColor)}>
              {categoryLabel}
            </span>
          </div>
          <h4 className="text-sm font-semibold leading-tight">{primaryName}</h4>
          {secondaryName && (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{secondaryName}</p>
          )}

          <div className="flex gap-4 mt-2">
            <div className="flex flex-col">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                {lang === "ko" ? "실제" : "Actual"}
              </span>
              <ActualValueDisplay actual={event.actual} forecast={event.forecast} unit={event.unit} />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                {lang === "ko" ? "예상" : "Forecast"}
              </span>
              <span className="font-mono text-xs text-foreground/80">{event.forecast || "—"}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                {lang === "ko" ? "이전" : "Previous"}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{event.previous || "—"}</span>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-muted-foreground ml-1">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-5 bg-muted/20 border-t border-border/40 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="pt-4 space-y-4">
            <section>
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-1.5">
                <Info className="w-3.5 h-3.5" />
                {lang === "ko" ? "지표 정의" : "Definition"}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{definition}</p>
            </section>

            <section>
              <div className="flex items-center gap-1.5 text-xs font-bold mb-1.5">
                <Activity className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-orange-500">
                  {lang === "ko" ? "시장 영향" : "Market Impact"}
                </span>
                <Badge variant="outline" className={cn("ml-1 text-[10px] px-1.5 py-0 h-4", cfg.badgeClass)}>
                  {lang === "ko" ? cfg.labelKo : cfg.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{impact}</p>
            </section>

            <section className="p-3.5 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/15">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-2">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {lang === "ko" ? "상관관계 인사이트" : "Correlation Insight"}
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed">{correlation}</p>
              <div className="mt-3 pt-2.5 border-t border-primary/15 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {lang === "ko" ? "연계 지표" : "Linked Indicators"}
                </span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {counterIndicator.split(",").map((ind, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-4 bg-primary/15 text-primary border-none"
                    >
                      {ind.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarDayDot({ events }: { events: EconomicEvent[] }) {
  if (events.length === 0) return null;
  const hasHigh = events.some((e) => e.importance === "High");
  const hasMedium = events.some((e) => e.importance === "Medium");
  const dotColor = hasHigh ? "bg-red-500" : hasMedium ? "bg-orange-400" : "bg-blue-400";
  return (
    <div className="flex justify-center mt-0.5">
      <div className={cn("w-1 h-1 rounded-full", dotColor)} />
    </div>
  );
}

const ALL_COUNTRIES = ["USA", "KOR", "JPN", "EU"] as const;
type CountryFilter = "ALL" | typeof ALL_COUNTRIES[number];

export default function EconomicCalendar() {
  const { data: user } = useUser();
  const lang = user?.language || "en";

  useEffect(() => {
    localStorage.setItem("dinolingo_calendar_visited", "true");
  }, []);

  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timezone, setTimezone] = useState<Timezone>("KST");
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("ALL");
  const eventListRef = useRef<HTMLDivElement>(null);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth() + 1;

  const { data, isLoading } = useQuery<{ events: EconomicEvent[] }>({
    queryKey: ["/api/economic-calendar", year, month],
    queryFn: () =>
      fetch(`/api/economic-calendar?year=${year}&month=${month}`).then((r) => r.json()),
    refetchInterval: 5 * 60 * 1000,
  });

  const prevMonthDate = subMonths(viewMonth, 1);
  const { data: prevData } = useQuery<{ events: EconomicEvent[] }>({
    queryKey: ["/api/economic-calendar", prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1],
    queryFn: () =>
      fetch(
        `/api/economic-calendar?year=${prevMonthDate.getFullYear()}&month=${prevMonthDate.getMonth() + 1}`
      ).then((r) => r.json()),
    refetchInterval: 5 * 60 * 1000,
  });

  const nextMonthDate = addMonths(viewMonth, 1);
  const { data: nextData } = useQuery<{ events: EconomicEvent[] }>({
    queryKey: ["/api/economic-calendar", nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1],
    queryFn: () =>
      fetch(
        `/api/economic-calendar?year=${nextMonthDate.getFullYear()}&month=${nextMonthDate.getMonth() + 1}`
      ).then((r) => r.json()),
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: actualsData, dataUpdatedAt: actualsUpdatedAt } = useQuery<{
    actuals: Record<string, string>;
    fetchedAt: number;
  }>({
    queryKey: ["/api/economic-actuals"],
    queryFn: () => fetch("/api/economic-actuals").then((r) => r.json()),
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });

  const lastUpdatedLabel = useMemo(() => {
    if (!actualsUpdatedAt) return null;
    const diff = Math.floor((Date.now() - actualsUpdatedAt) / 1000);
    if (diff < 60) return lang === "ko" ? `${diff}초 전 업데이트` : `Updated ${diff}s ago`;
    const mins = Math.floor(diff / 60);
    return lang === "ko" ? `${mins}분 전 업데이트` : `Updated ${mins}m ago`;
  }, [actualsUpdatedAt, lang]);

  const mergeActuals = useMemo(() => {
    const overrides = actualsData?.actuals || {};
    return (event: EconomicEvent): EconomicEvent => {
      const fetched = overrides[event.id];
      if (fetched != null && event.actual == null) {
        return { ...event, actual: fetched };
      }
      return event;
    };
  }, [actualsData]);

  const allVisibleEvents = useMemo(() => {
    const raw = [
      ...(prevData?.events || []),
      ...(data?.events || []),
      ...(nextData?.events || []),
    ];
    return raw.map(mergeActuals);
  }, [data, prevData, nextData, mergeActuals]);

  const eventsByTzDate = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>();
    allVisibleEvents.forEach((evt) => {
      const tzDate = toTzDate(evt.time, timezone);
      const key = format(tzDate, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(evt);
    });
    return map;
  }, [allVisibleEvents, timezone]);

  const selectedDateEvents = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    const events = eventsByTzDate.get(key) || [];
    const filtered =
      countryFilter === "ALL" ? events : events.filter((e) => e.country === countryFilter);
    return filtered.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [selectedDate, eventsByTzDate, countryFilter]);

  const getEventsForDay = (day: Date): EconomicEvent[] => {
    const key = format(day, "yyyy-MM-dd");
    return eventsByTzDate.get(key) || [];
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setTimeout(() => {
      eventListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleMonthChange = (date: Date) => {
    setViewMonth(startOfMonth(date));
  };

  const goToPrevMonth = () => setViewMonth(subMonths(viewMonth, 1));
  const goToNextMonth = () => setViewMonth(addMonths(viewMonth, 1));

  const highCount = selectedDateEvents.filter((e) => e.importance === "High").length;
  const mediumCount = selectedDateEvents.filter((e) => e.importance === "Medium").length;

  const currentTzLabel = getTzLabel(timezone, new Date());
  const tzToggleLabel =
    timezone === "KST"
      ? lang === "ko"
        ? "ET로 보기"
        : "Switch to ET"
      : lang === "ko"
      ? "KST로 보기"
      : "Switch to KST";

  const tzInfoText =
    timezone === "KST"
      ? lang === "ko"
        ? "모든 시간은 한국 표준시(KST, UTC+9)로 표시됩니다. 한국은 서머타임을 적용하지 않습니다."
        : "All times shown in Korean Standard Time (KST, UTC+9). Korea does not observe Daylight Saving Time."
      : lang === "ko"
      ? "모든 시간은 미국 동부 시간(ET)으로 표시됩니다. EDT(UTC-4)와 EST(UTC-5) 서머타임이 자동 반영됩니다."
      : "All times shown in US Eastern Time (ET). Daylight Saving Time (EDT/EST) is applied automatically.";

  return (
    <div className="p-4 md:p-6 space-y-5 pb-28" data-testid="economic-calendar-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            <span>{lang === "ko" ? "경제 캘린더" : "Economic Calendar"}</span>
            <Badge
              variant="secondary"
              className="text-xs bg-primary/10 text-primary border-none font-medium"
              data-testid="badge-timezone-label"
            >
              {currentTzLabel}
            </Badge>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
              data-testid="badge-live-indicator"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              LIVE
            </span>
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-muted-foreground text-sm">
              {lang === "ko"
                ? "미국·한국·일본·유럽 주요 경제 지표와 시장 영향력을 확인하세요"
                : "Track major US, Korean, Japanese & European economic indicators and their market impact"}
            </p>
            {lastUpdatedLabel && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" data-testid="text-last-updated">
                <RefreshCw className="w-2.5 h-2.5" />
                {lastUpdatedLabel}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setTimezone((tz) => (tz === "KST" ? "ET" : "KST"))}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-sm font-medium shrink-0"
          data-testid="button-timezone-toggle"
        >
          <Globe className="w-4 h-4 text-primary" />
          <span>{tzToggleLabel}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5">
          <Card className="border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <button
                onClick={goToPrevMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors"
                data-testid="button-prev-month"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-sm font-semibold">{format(viewMonth, "MMMM yyyy")}</h2>
              <button
                onClick={goToNextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors"
                data-testid="button-next-month"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <CardContent className="p-0 flex justify-center pb-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                month={viewMonth}
                onMonthChange={handleMonthChange}
                className="rounded-md border-none"
                showOutsideDays
                classNames={{
                  nav: "hidden",
                  caption: "hidden",
                  head_cell: "text-muted-foreground font-medium text-[11px] w-9",
                  cell: "relative h-9 w-9 text-center text-sm focus-within:relative focus-within:z-20",
                  day: cn(
                    "h-9 w-9 p-0 font-normal rounded-xl transition-colors",
                    "hover:bg-muted/60 aria-selected:opacity-100"
                  ),
                  day_selected:
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-xl font-bold",
                  day_today: "font-bold text-primary",
                  day_outside: "text-muted-foreground/40 opacity-50",
                }}
                components={{
                  DayContent: ({ date }) => {
                    const dayEvents = getEventsForDay(date);
                    const isSelected = isSameDay(date, selectedDate);
                    return (
                      <div className="flex flex-col items-center justify-center w-full h-full">
                        <span
                          className={cn(
                            "text-sm leading-none",
                            !isSameMonth(date, viewMonth) && "opacity-40"
                          )}
                        >
                          {format(date, "d")}
                        </span>
                        {!isSelected && <CalendarDayDot events={dayEvents} />}
                        {isSelected && dayEvents.length > 0 && (
                          <div className="flex justify-center mt-0.5">
                            <div className="w-1 h-1 rounded-full bg-primary-foreground/70" />
                          </div>
                        )}
                      </div>
                    );
                  },
                }}
              />
            </CardContent>

            <div className="px-4 pb-4 flex items-center justify-center gap-5 text-[11px] text-muted-foreground border-t border-border/40 pt-3">
              {[
                { color: "bg-red-500", label: lang === "ko" ? "높음" : "High" },
                { color: "bg-orange-400", label: lang === "ko" ? "중간" : "Medium" },
                { color: "bg-blue-400", label: lang === "ko" ? "낮음" : "Low" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={cn("w-2 h-2 rounded-full", color)} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="mt-3 bg-card/40 border border-border/50 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">
                  {lang === "ko" ? "디노의 인사이트" : "Dino's Insight"}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {lang === "ko"
                    ? "한국·일본·ECB 중앙은행 결정은 글로벌 시장에 큰 영향을 줍니다. 특히 BOJ 금리 인상은 엔 캐리트레이드 청산을 촉발해 코스피와 미국 기술주까지 흔들 수 있습니다!"
                    : "Central bank decisions from Korea, Japan, and the ECB ripple across global markets. Watch for BOJ rate hikes — they can trigger yen carry trade unwinding, shaking KOSPI and US tech stocks!"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-3" ref={eventListRef}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-bold text-base">
                {format(selectedDate, lang === "ko" ? "yyyy년 M월 d일" : "PPP")}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {selectedDateEvents.length > 0 ? (
                  <>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-4 bg-muted/60 text-muted-foreground border-none"
                    >
                      {selectedDateEvents.length} {lang === "ko" ? "건" : "events"}
                    </Badge>
                    {highCount > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 bg-red-500/10 text-red-500 border-red-500/20"
                      >
                        {highCount} High
                      </Badge>
                    )}
                    {mediumCount > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 bg-orange-500/10 text-orange-500 border-orange-500/20"
                      >
                        {mediumCount} Medium
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {lang === "ko" ? "이벤트 없음" : "No events"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5" data-testid="country-filter-bar">
            {(["ALL", ...ALL_COUNTRIES] as const).map((c) => {
              const isActive = countryFilter === c;
              return (
                <button
                  key={c}
                  onClick={() => setCountryFilter(c)}
                  data-testid={`button-filter-${c.toLowerCase()}`}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {c === "ALL" ? (
                    <span>{lang === "ko" ? "전체" : "All"}</span>
                  ) : (
                    <>
                      <span>{COUNTRY_FLAGS[c]}</span>
                      <span>
                        {lang === "ko" ? COUNTRY_LABELS[c].ko : COUNTRY_LABELS[c].en}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <Card className="border-border rounded-2xl shadow-sm overflow-hidden min-h-[420px]">
            {isLoading ? (
              <div className="divide-y divide-border">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 flex items-center gap-3">
                    <div className="flex flex-col items-center min-w-[46px] gap-1">
                      <Skeleton className="h-4 w-10" />
                      <Skeleton className="h-2 w-6" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <Skeleton className="h-4 w-14" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <Skeleton className="h-4 w-3/4" />
                      <div className="flex gap-4">
                        <Skeleton className="h-6 w-10" />
                        <Skeleton className="h-6 w-10" />
                        <Skeleton className="h-6 w-10" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : selectedDateEvents.length > 0 ? (
              <div className="divide-y divide-border/60">
                {selectedDateEvents.map((event) => (
                  <EventItem key={event.id} event={event} lang={lang} tz={timezone} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                <div className="w-16 h-16 bg-muted/60 rounded-2xl flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <h4 className="font-semibold text-muted-foreground mb-1">
                  {lang === "ko" ? "이 날짜에는 일정이 없습니다" : "No events on this date"}
                </h4>
                <p className="text-xs text-muted-foreground/60 max-w-[220px] leading-relaxed">
                  {lang === "ko"
                    ? "캘린더에서 점이 표시된 날짜를 선택하면 주요 경제 지표를 확인할 수 있습니다"
                    : "Select a marked date on the calendar to view scheduled economic indicators"}
                </p>
              </div>
            )}
          </Card>

          <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/30 rounded-xl px-3.5 py-3 border border-border/30">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/60" />
            <span>{tzInfoText}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {Object.entries(COUNTRY_FLAGS).map(([country, flag]) => (
          <div
            key={country}
            className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2.5 border border-border/30"
            data-testid={`country-legend-${country.toLowerCase()}`}
          >
            <span className="text-base">{flag}</span>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">
                {lang === "ko" ? COUNTRY_LABELS[country].ko : COUNTRY_LABELS[country].en}
              </span>
              <span className="text-[10px] text-muted-foreground">{country}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <div
            key={cat}
            className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2 border border-border/30"
            data-testid={`category-legend-${cat.toLowerCase().replace(/\s/g, "-")}`}
          >
            <TrendingUp className={cn("w-3.5 h-3.5 shrink-0", color)} />
            <span className="text-xs text-muted-foreground truncate">
              {lang === "ko" ? (CATEGORY_KO_MAP[cat] || cat) : cat}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
