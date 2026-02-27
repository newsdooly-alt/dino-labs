import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  ChevronUp, 
  Info, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Clock,
  Globe,
  ArrowRightLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { format, addHours, parseISO } from "date-fns";

interface EconomicEvent {
  id: string;
  time: string; // ISO string
  indicator: string;
  importance: "Low" | "Medium" | "High";
  previous: string | null;
  forecast: string | null;
  actual: string | null;
  unit: string | null;
  country: string;
  definitionEn: string;
  definitionKo: string;
  impactEn: string;
  impactKo: string;
  correlationEn: string;
  correlationKo: string;
  counterIndicatorEn: string;
  counterIndicatorKo: string;
}

// Mock data for demonstration - in a real app, this would come from an API
const MOCK_EVENTS: EconomicEvent[] = [
  {
    id: "1",
    time: "2026-02-27T13:30:00Z",
    indicator: "Core PCE Price Index (MoM)",
    importance: "High",
    previous: "0.2%",
    forecast: "0.3%",
    actual: "0.3%",
    unit: "%",
    country: "USA",
    definitionEn: "The Core Personal Consumption Expenditures (PCE) Price Index measures the changes in the price of goods and services purchased by consumers, excluding food and energy.",
    definitionKo: "근원 개인소비지출(PCE) 물가지수는 식품과 에너지를 제외한 소비자가 구매하는 상품 및 서비스의 가격 변동을 측정합니다.",
    impactEn: "High impact on Fed interest rate decisions. Higher than expected is hawkish (USD bullish, Stocks bearish).",
    impactKo: "연준의 금리 결정에 큰 영향을 미칩니다. 예상보다 높으면 매파적(달러 강세, 주식 약세)으로 해석됩니다.",
    correlationEn: "Closely watched alongside CPI. High PCE → Likely Rate Hike → Downward pressure on Tech stocks.",
    correlationKo: "CPI와 함께 면밀히 관찰됩니다. 높은 PCE → 금리 인상 가능성 → 기술주 하락 압력.",
    counterIndicatorEn: "Unemployment Rate",
    counterIndicatorKo: "실업률"
  },
  {
    id: "2",
    time: "2026-02-27T15:00:00Z",
    indicator: "Consumer Sentiment",
    importance: "Medium",
    previous: "79.0",
    forecast: "79.6",
    actual: null,
    unit: "index",
    country: "USA",
    definitionEn: "The University of Michigan Consumer Sentiment Index rates the relative level of current and future economic conditions.",
    definitionKo: "미시간대 소비자심리지수는 현재 및 미래 경제 상황의 상대적 수준을 평가합니다.",
    impactEn: "Moderate impact. Higher sentiment suggests stronger consumer spending.",
    impactKo: "중간 정도의 영향. 심리 지수가 높으면 소비자 지출이 강해질 것임을 시사합니다.",
    correlationEn: "Positive correlation with Retail Sales.",
    correlationKo: "소매 판매와 양의 상관관계가 있습니다.",
    counterIndicatorEn: "Savings Rate",
    counterIndicatorKo: "저축률"
  },
  {
    id: "3",
    time: "2026-03-06T13:30:00Z",
    indicator: "Non-Farm Payrolls (NFP)",
    importance: "High",
    previous: "216K",
    forecast: "185K",
    actual: null,
    unit: "K",
    country: "USA",
    definitionEn: "Non-farm Payrolls measures the change in the number of people employed during the previous month, excluding the farming industry.",
    definitionKo: "비농업 고용지수는 농업을 제외한 지난 한 달 동안 고용된 인원수의 변화를 측정합니다.",
    impactEn: "Critical for market direction. Strong NFP confirms economic strength but may lead to inflation concerns.",
    impactKo: "시장 방향성에 결정적입니다. 강한 NFP는 경제 성장을 확인시켜주지만 인플레이션 우려로 이어질 수 있습니다.",
    correlationEn: "Inversely correlated with Gold usually (Strong NFP -> Strong USD -> Weak Gold).",
    correlationKo: "일반적으로 금과 음의 상관관계가 있습니다 (강한 NFP -> 달러 강세 -> 금 약세).",
    counterIndicatorEn: "Weekly Initial Jobless Claims",
    counterIndicatorKo: "주간 신규 실업수당 청구 건수"
  }
];

function EventItem({ event, lang }: { event: EconomicEvent; lang: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Convert UTC to KST (UTC+9)
  const kstTime = format(addHours(parseISO(event.time), 9), "HH:mm");

  const importanceColor = {
    Low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    Medium: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    High: "bg-red-500/10 text-red-500 border-red-500/20",
  }[event.importance];

  return (
    <div 
      className="border-b border-border last:border-0"
      data-testid={`event-item-${event.id}`}
    >
      <div 
        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        data-testid={`button-expand-event-${event.id}`}
      >
        <div className="flex flex-col items-center min-w-[50px]">
          <span className="text-sm font-mono font-medium">{kstTime}</span>
          <span className="text-[10px] text-muted-foreground uppercase">KST</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", importanceColor)}>
              {event.importance}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{event.country}</span>
          </div>
          <h4 className="text-sm font-semibold truncate">{event.indicator}</h4>
          
          <div className="flex gap-4 mt-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase">Actual</span>
              <span className={cn("text-xs font-mono", event.actual ? "text-foreground font-bold" : "text-muted-foreground")}>
                {event.actual || "—"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase">Forecast</span>
              <span className="text-xs font-mono">{event.forecast || "—"}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase">Prev</span>
              <span className="text-xs font-mono">{event.previous || "—"}</span>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-muted-foreground">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 bg-muted/20 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="pt-2 space-y-3">
            <section>
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-1">
                <Info className="w-3.5 h-3.5" />
                {lang === "ko" ? "정의" : "Definition"}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "ko" ? event.definitionKo : event.definitionEn}
              </p>
            </section>

            <section>
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-1">
                <Activity className="w-3.5 h-3.5" />
                {lang === "ko" ? "시장 영향" : "Market Impact"}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang === "ko" ? event.impactKo : event.impactEn}
              </p>
            </section>

            <section className="p-3 bg-primary/5 rounded-xl border border-primary/10">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-1">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {lang === "ko" ? "상관관계 인사이트" : "Correlation Insight"}
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                {lang === "ko" ? event.correlationKo : event.correlationEn}
              </p>
              <div className="mt-2 pt-2 border-t border-primary/10 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {lang === "ko" ? "연계 지표:" : "Linked Indicator:"}
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-none">
                  {lang === "ko" ? event.counterIndicatorKo : event.counterIndicatorEn}
                </Badge>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EconomicCalendar() {
  const { data: user } = useUser();
  const lang = user?.language || "en";
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Filter events for selected date
  const filteredEvents = useMemo(() => {
    return MOCK_EVENTS.filter(event => {
      const eventDate = parseISO(event.time);
      return (
        eventDate.getDate() === selectedDate.getDate() &&
        eventDate.getMonth() === selectedDate.getMonth() &&
        eventDate.getFullYear() === selectedDate.getFullYear()
      );
    });
  }, [selectedDate]);

  // Mark days with events
  const eventDays = useMemo(() => {
    return MOCK_EVENTS.map(e => parseISO(e.time));
  }, []);

  const isEventDay = (day: Date) => {
    return eventDays.some(eventDay => 
      eventDay.getDate() === day.getDate() &&
      eventDay.getMonth() === day.getMonth() &&
      eventDay.getFullYear() === day.getFullYear()
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24" data-testid="economic-calendar-page">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {lang === "ko" ? "경제 캘린더" : "Economic Calendar"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {lang === "ko" ? "주요 경제 지표와 시장 영향력을 확인하세요" : "Track major economic indicators and market impact"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Section: Calendar View */}
        <div className="lg:col-span-5">
          <Card className="border-border rounded-2xl overflow-hidden shadow-sm">
            <CardHeader className="bg-muted/30 pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                {lang === "ko" ? "날짜 선택" : "Select Date"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex justify-center py-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border-none"
                modifiers={{ hasEvent: (date) => isEventDay(date) }}
                modifiersStyles={{
                  hasEvent: { 
                    fontWeight: "bold", 
                    textDecoration: "underline",
                    textDecorationColor: "var(--primary)",
                    textUnderlineOffset: "4px"
                  }
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Middle/Bottom Section: Event List & Details */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg flex items-center gap-2">
              {format(selectedDate, "PPP")}
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none">
                {filteredEvents.length} {lang === "ko" ? "일정" : "Events"}
              </Badge>
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
              <Globe className="w-3 h-3" />
              {lang === "ko" ? "모든 시간은 한국 시간(KST) 기준입니다" : "All times in KST (UTC+9)"}
            </div>
          </div>

          <Card className="border-border rounded-2xl overflow-hidden shadow-sm min-h-[400px]">
            <div className="divide-y divide-border">
              {filteredEvents.length > 0 ? (
                filteredEvents.map(event => (
                  <EventItem key={event.id} event={event} lang={lang} />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <h4 className="font-semibold text-muted-foreground">
                    {lang === "ko" ? "선택한 날짜에 일정이 없습니다" : "No events for this date"}
                  </h4>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {lang === "ko" ? "다른 날짜를 선택하여 경제 지표를 확인해보세요" : "Try selecting another date to view economic indicators"}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="bg-card/40 border border-border/50 rounded-2xl p-4 mt-8">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
            <Info className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm mb-1">
              {lang === "ko" ? "디노의 팁: 경제 지표 읽기" : "Dino's Tip: Reading Indicators"}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "ko"
                ? "고용 지표가 예상보다 좋으면 금리 인상 가능성이 높아져 주식 시장에는 부정적일 수 있어요. 반대로 소비자 물가(CPI)가 낮아지면 금리 인하 기대감으로 시장이 상승할 수 있답니다! 지표 간의 연결고리를 이해하는 것이 중요해요."
                : "Stronger employment data often leads to rate hike fears, which can be negative for stocks. Conversely, lower CPI might spark rate cut hopes, driving the market up! Understanding the links between indicators is key to smart investing."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
