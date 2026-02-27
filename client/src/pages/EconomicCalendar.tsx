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
  parseISO,
} from "date-fns";

interface EconomicEvent {
  id: string;
  time: string;
  indicator: string;
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

function toKSTTime(utcIsoString: string): string {
  const date = new Date(utcIsoString);
  return date.toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toKSTDate(utcIsoString: string): Date {
  const date = new Date(utcIsoString);
  const kstStr = date.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  return new Date(kstStr + "T00:00:00");
}

const IMPORTANCE_CONFIG = {
  High: {
    label: "High",
    labelKo: "높음",
    badgeClass: "bg-red-500/10 text-red-500 border-red-500/30",
    dotClass: "bg-red-500",
    barClass: "bg-red-500",
    bars: 3,
    icon: "🔴",
  },
  Medium: {
    label: "Medium",
    labelKo: "중간",
    badgeClass: "bg-orange-500/10 text-orange-500 border-orange-500/30",
    dotClass: "bg-orange-400",
    barClass: "bg-orange-400",
    bars: 2,
    icon: "🟡",
  },
  Low: {
    label: "Low",
    labelKo: "낮음",
    badgeClass: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    dotClass: "bg-blue-400",
    barClass: "bg-blue-400",
    bars: 1,
    icon: "🟢",
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
};

function ImportanceBars({ level }: { level: "Low" | "Medium" | "High" }) {
  const cfg = IMPORTANCE_CONFIG[level];
  return (
    <div className="flex items-end gap-[2px]">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            "rounded-sm w-1",
            i <= cfg.bars ? cfg.barClass : "bg-muted"
          )}
          style={{ height: i === 1 ? 6 : i === 2 ? 9 : 12 }}
        />
      ))}
    </div>
  );
}

function ActualValueDisplay({ actual, forecast, unit }: { actual: string | null; forecast: string | null; unit: string | null }) {
  if (!actual) {
    return <span className="text-muted-foreground font-mono text-xs">—</span>;
  }
  const actualNum = parseFloat(actual);
  const forecastNum = parseFloat(forecast || "");
  let color = "text-foreground";
  if (!isNaN(actualNum) && !isNaN(forecastNum)) {
    color = actualNum > forecastNum ? "text-red-500" : actualNum < forecastNum ? "text-green-500" : "text-foreground";
  }
  return <span className={cn("font-mono font-bold text-xs", color)}>{actual}{unit === "%" ? "" : ""}</span>;
}

function EventItem({ event, lang, autoExpand }: { event: EconomicEvent; lang: string; autoExpand?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoExpand) setIsExpanded(true);
  }, [autoExpand]);

  const cfg = IMPORTANCE_CONFIG[event.importance];
  const kstTime = toKSTTime(event.time);
  const catColor = CATEGORY_COLORS[event.category] || "text-muted-foreground";

  const definition = lang === "ko" ? event.definitionKo : event.definitionEn;
  const impact = lang === "ko" ? event.impactKo : event.impactEn;
  const correlation = lang === "ko" ? event.correlationKo : event.correlationEn;
  const counterIndicator = lang === "ko" ? event.counterIndicatorKo : event.counterIndicatorEn;

  return (
    <div
      ref={ref}
      className="border-b border-border/60 last:border-0"
      data-testid={`event-item-${event.id}`}
    >
      <button
        className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/30 active:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        data-testid={`button-expand-event-${event.id}`}
        aria-expanded={isExpanded}
      >
        <div className="flex flex-col items-center min-w-[46px] shrink-0">
          <span className="text-sm font-mono font-semibold tabular-nums">{kstTime}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">KST</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <ImportanceBars level={event.importance} />
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", cfg.badgeClass)}>
              {lang === "ko" ? cfg.labelKo : cfg.label}
            </Badge>
            <span className={cn("text-[10px] font-medium uppercase tracking-wide", catColor)}>
              {event.category}
            </span>
          </div>
          <h4 className="text-sm font-semibold leading-tight">{event.indicator}</h4>

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
                <Badge
                  variant="outline"
                  className={cn("ml-1 text-[10px] px-1.5 py-0 h-4", cfg.badgeClass)}
                >
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
  const hasHigh = events.some(e => e.importance === "High");
  const hasMedium = events.some(e => e.importance === "Medium");
  const dotColor = hasHigh ? "bg-red-500" : hasMedium ? "bg-orange-400" : "bg-blue-400";
  return (
    <div className="flex justify-center mt-0.5">
      <div className={cn("w-1 h-1 rounded-full", dotColor)} />
    </div>
  );
}

export default function EconomicCalendar() {
  const { data: user } = useUser();
  const lang = user?.language || "en";

  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const eventListRef = useRef<HTMLDivElement>(null);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth() + 1;

  const { data, isLoading } = useQuery<{ events: EconomicEvent[] }>({
    queryKey: ["/api/economic-calendar", year, month],
    queryFn: () =>
      fetch(`/api/economic-calendar?year=${year}&month=${month}`).then(r => r.json()),
  });

  const prevMonthDate = subMonths(viewMonth, 1);
  const { data: prevData } = useQuery<{ events: EconomicEvent[] }>({
    queryKey: ["/api/economic-calendar", prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1],
    queryFn: () =>
      fetch(`/api/economic-calendar?year=${prevMonthDate.getFullYear()}&month=${prevMonthDate.getMonth() + 1}`).then(r => r.json()),
  });

  const nextMonthDate = addMonths(viewMonth, 1);
  const { data: nextData } = useQuery<{ events: EconomicEvent[] }>({
    queryKey: ["/api/economic-calendar", nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1],
    queryFn: () =>
      fetch(`/api/economic-calendar?year=${nextMonthDate.getFullYear()}&month=${nextMonthDate.getMonth() + 1}`).then(r => r.json()),
  });

  const allVisibleEvents = useMemo(() => {
    return [
      ...(prevData?.events || []),
      ...(data?.events || []),
      ...(nextData?.events || []),
    ];
  }, [data, prevData, nextData]);

  const eventsByKSTDate = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>();
    allVisibleEvents.forEach(evt => {
      const kstDate = toKSTDate(evt.time);
      const key = format(kstDate, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(evt);
    });
    return map;
  }, [allVisibleEvents]);

  const selectedDateEvents = useMemo(() => {
    const key = format(selectedDate, "yyyy-MM-dd");
    const events = eventsByKSTDate.get(key) || [];
    return events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [selectedDate, eventsByKSTDate]);

  const getEventsForDay = (day: Date): EconomicEvent[] => {
    const key = format(day, "yyyy-MM-dd");
    return eventsByKSTDate.get(key) || [];
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

  const goToPrevMonth = () => {
    const prev = subMonths(viewMonth, 1);
    setViewMonth(prev);
  };

  const goToNextMonth = () => {
    const next = addMonths(viewMonth, 1);
    setViewMonth(next);
  };

  const highCount = selectedDateEvents.filter(e => e.importance === "High").length;
  const mediumCount = selectedDateEvents.filter(e => e.importance === "Medium").length;

  return (
    <div className="p-4 md:p-6 space-y-5 pb-28" data-testid="economic-calendar-page">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <span>
            {lang === "ko" ? "경제 캘린더" : "Economic Calendar"}
          </span>
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-none font-medium">
            KST
          </Badge>
        </h1>
        <p className="text-muted-foreground text-sm">
          {lang === "ko"
            ? "주요 경제 지표와 시장 영향력을 한눈에 확인하세요"
            : "Track major economic indicators and market impact in Korean Standard Time"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ── Calendar Section ── */}
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
              <h2 className="text-sm font-semibold">
                {format(viewMonth, "MMMM yyyy")}
              </h2>
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
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-xl font-bold",
                  day_today: "font-bold text-primary",
                  day_outside: "text-muted-foreground/40 opacity-50",
                }}
                components={{
                  DayContent: ({ date }) => {
                    const dayEvents = getEventsForDay(date);
                    const isSelected = isSameDay(date, selectedDate);
                    return (
                      <div className="flex flex-col items-center justify-center w-full h-full">
                        <span className={cn(
                          "text-sm leading-none",
                          !isSameMonth(date, viewMonth) && "opacity-40"
                        )}>
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
                    ? "고용 지표가 예상보다 강하면 금리 인하 기대가 줄어들고 주식 시장이 단기적으로 조정될 수 있습니다. CPI와 PCE가 동시에 하락하면 연준의 금리 인하 신호입니다!"
                    : "Strong employment beats rate cut expectations and can briefly pressure stocks. When both CPI and PCE cool simultaneously, that's the Fed's green light for cutting rates!"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Event List Section ── */}
        <div className="lg:col-span-7 space-y-3" ref={eventListRef}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                {format(selectedDate, lang === "ko" ? "yyyy년 M월 d일" : "PPP")}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {selectedDateEvents.length > 0 ? (
                  <>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-muted/60 text-muted-foreground border-none">
                      {selectedDateEvents.length} {lang === "ko" ? "건" : "events"}
                    </Badge>
                    {highCount > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-red-500/10 text-red-500 border-red-500/20">
                        {highCount} {lang === "ko" ? "High" : "High"}
                      </Badge>
                    )}
                    {mediumCount > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-orange-500/10 text-orange-500 border-orange-500/20">
                        {mediumCount} {lang === "ko" ? "Medium" : "Medium"}
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
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-full border border-border/40">
              <Globe className="w-3 h-3" />
              <span>{lang === "ko" ? "한국 시간(KST)" : "KST (UTC+9)"}</span>
            </div>
          </div>

          <Card className="border-border rounded-2xl shadow-sm overflow-hidden min-h-[420px]">
            {isLoading ? (
              <div className="divide-y divide-border">
                {[1, 2, 3].map(i => (
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
                {selectedDateEvents.map(event => (
                  <EventItem key={event.id} event={event} lang={lang} />
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

          {/* KST timezone explanation */}
          <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/30 rounded-xl px-3.5 py-3 border border-border/30">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/60" />
            <span>
              {lang === "ko"
                ? "모든 시간은 자동으로 한국 표준시(KST, UTC+9)로 변환됩니다. 한국은 서머타임을 적용하지 않습니다. 미국 여름시간(DST) 변경 사항은 자동으로 반영됩니다."
                : "All times are automatically converted to Korean Standard Time (KST, UTC+9). Korea does not observe Daylight Saving Time. US DST changes are automatically accounted for."}
            </span>
          </div>
        </div>
      </div>

      {/* ── Category Legend ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <div
            key={cat}
            className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2 border border-border/30"
            data-testid={`category-legend-${cat.toLowerCase().replace(/\s/g, '-')}`}
          >
            <TrendingUp className={cn("w-3.5 h-3.5 shrink-0", color)} />
            <span className="text-xs text-muted-foreground truncate">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
