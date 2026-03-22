import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Cell, ReferenceLine, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3, RefreshCw } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { cn } from "@/lib/utils";

type Country = "us" | "kr" | "jp" | "eu";
type Period  = "1d" | "1w" | "1m";

interface SectorPerf {
  symbol: string;
  "1d": number | null;
  "1w": number | null;
  "1m": number | null;
}

// ── Sector label maps ─────────────────────────────────────────────────────────
const SECTOR_LABELS: Record<string, { en: string; ko: string; ja: string }> = {
  XLK:  { en: "Technology",     ko: "기술",       ja: "テクノロジー" },
  XLF:  { en: "Financials",     ko: "금융",        ja: "金融" },
  XLV:  { en: "Healthcare",     ko: "헬스케어",    ja: "ヘルスケア" },
  XLE:  { en: "Energy",         ko: "에너지",      ja: "エネルギー" },
  XLY:  { en: "Cons. Disc.",    ko: "임의소비재",   ja: "一般消費財" },
  XLP:  { en: "Cons. Staples",  ko: "필수소비재",   ja: "生活必需品" },
  XLI:  { en: "Industrials",   ko: "산업재",       ja: "資本財" },
  XLB:  { en: "Materials",     ko: "소재",         ja: "素材" },
  XLRE: { en: "Real Estate",   ko: "리츠",         ja: "不動産" },
  XLU:  { en: "Utilities",     ko: "유틸리티",      ja: "公益事業" },
  XLC:  { en: "Comm. Svcs",    ko: "통신",         ja: "通信" },
  KR_SEMI:  { en: "Semiconductors", ko: "반도체",      ja: "半導体" },
  KR_AUTO:  { en: "Automotive",    ko: "자동차",      ja: "自動車" },
  KR_BIO:   { en: "Bio/Pharma",   ko: "바이오/제약",  ja: "バイオ/製薬" },
  KR_FIN:   { en: "Finance",      ko: "금융",         ja: "金融" },
  KR_CHEM:  { en: "Chem/Battery", ko: "화학/배터리",  ja: "化学/バッテリー" },
  KR_NET:   { en: "Internet",     ko: "인터넷",       ja: "インターネット" },
  KR_STEEL: { en: "Steel/Mat.",   ko: "철강/소재",    ja: "鉄鋼/素材" },
  KR_TELE:  { en: "Telecom",      ko: "통신",         ja: "通信" },
  JP_AUTO:   { en: "Automotive",  ko: "자동차",       ja: "自動車" },
  JP_ELEC:   { en: "Electronics", ko: "전자/기술",    ja: "電子機器" },
  JP_FIN:    { en: "Finance",     ko: "금융",         ja: "金融" },
  JP_PHARM:  { en: "Pharma",      ko: "제약",         ja: "製薬" },
  JP_IT:     { en: "IT/Tech",     ko: "IT/기술",      ja: "IT/ソフト" },
  JP_RETAIL: { en: "Retail",      ko: "유통",         ja: "小売" },
  JP_RE:     { en: "Real Estate", ko: "부동산",       ja: "不動産" },
  JP_UTIL:   { en: "Utilities",   ko: "유틸/레저",    ja: "公益/レジャー" },
  EWG:  { en: "Germany",      ko: "독일",       ja: "ドイツ" },
  EWQ:  { en: "France",       ko: "프랑스",     ja: "フランス" },
  EWI:  { en: "Italy",        ko: "이탈리아",   ja: "イタリア" },
  EWP:  { en: "Spain",        ko: "스페인",     ja: "スペイン" },
  EWN:  { en: "Netherlands",  ko: "네덜란드",   ja: "オランダ" },
  EWL:  { en: "Switzerland",  ko: "스위스",     ja: "スイス" },
  EWU:  { en: "UK",           ko: "영국",       ja: "イギリス" },
  EWD:  { en: "Sweden",       ko: "스웨덴",     ja: "スウェーデン" },
  EWO:  { en: "Austria",      ko: "오스트리아", ja: "オーストリア" },
  ENOR: { en: "Norway",       ko: "노르웨이",   ja: "ノルウェー" },
};

const COUNTRY_TABS = [
  { id: "us" as Country, flag: "🇺🇸", en: "US",     ko: "미국", ja: "米国" },
  { id: "kr" as Country, flag: "🇰🇷", en: "Korea",  ko: "한국", ja: "韓国" },
  { id: "jp" as Country, flag: "🇯🇵", en: "Japan",  ko: "일본", ja: "日本" },
  { id: "eu" as Country, flag: "🇪🇺", en: "Europe", ko: "유럽", ja: "欧州" },
];

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value as number;
  const isPos = v >= 0;
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="font-bold text-foreground">{payload[0]?.payload?.label}</p>
      <p className={cn("font-bold text-lg", isPos ? "text-emerald-500" : "text-red-500")}>
        {isPos ? "+" : ""}{v.toFixed(2)}%
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function SectorPerformanceChart() {
  const { data: user } = useUser();
  const lang = user?.language || "ko";
  const L = (ko: string, en: string, ja?: string) =>
    lang === "ko" ? ko : lang === "ja" ? (ja ?? en) : en;

  const [country, setCountry] = useState<Country>("us");
  const [period, setPeriod]   = useState<Period>("1d");

  const { data, isLoading, refetch, isRefetching } = useQuery<{
    country: string;
    sectors: SectorPerf[];
  }>({
    queryKey: ["/api/sector-performance", country],
    queryFn: async () => {
      const res = await fetch(`/api/sector-performance?country=${country}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sector performance");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    retry: 2,
  });

  const getLbl = (sym: string) => {
    const entry = SECTOR_LABELS[sym];
    if (!entry) return sym.replace(/^(KR|JP)_/, "");
    return lang === "ko" ? entry.ko : lang === "ja" ? entry.ja : entry.en;
  };

  // Build chart data — sorted by selected period, best → worst
  const chartData = (data?.sectors ?? [])
    .map(s => ({
      ...s,
      value: s[period] ?? 0,
      label: getLbl(s.symbol),
    }))
    .filter(s => s[period] !== null)
    .sort((a, b) => (b[period] ?? 0) - (a[period] ?? 0));

  // Dynamic domain with padding
  const vals = chartData.map(d => d.value);
  const minV = Math.min(...vals, 0);
  const maxV = Math.max(...vals, 0);
  const pad = Math.max(Math.abs(minV), Math.abs(maxV)) * 0.15 + 0.3;
  const domain: [number, number] = [
    Math.floor((minV - pad) * 10) / 10,
    Math.ceil((maxV + pad) * 10) / 10,
  ];

  const PERIODS: { id: Period; label: string; ko: string; ja: string }[] = [
    { id: "1d", label: "1 Day",  ko: "1일",  ja: "1日" },
    { id: "1w", label: "1 Week", ko: "1주",  ja: "1週" },
    { id: "1m", label: "1 Month",ko: "1개월",ja: "1ヶ月" },
  ];

  const chartHeight = Math.max(220, chartData.length * 30);

  return (
    <div className="bg-card border border-border rounded-3xl overflow-hidden" data-testid="sector-performance-chart">

      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-border/60">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                <BarChart3 className="w-3.5 h-3.5 text-white" />
              </span>
              {L("섹터 성과 (기간별)", "Sector Performance by Period", "セクターパフォーマンス")}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {L("1일·1주·1개월 누적 등락률 — 섹터별 비교", "Cumulative sector returns: 1D · 1W · 1M", "1日・1週・1ヶ月の累積リターン比較")}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 shrink-0"
            data-testid="button-sector-perf-refresh"
          >
            <RefreshCw className={cn("w-4 h-4", isRefetching && "animate-spin")} />
          </button>
        </div>

        {/* Country tabs */}
        <div className="flex gap-1.5 flex-wrap mb-3">
          {COUNTRY_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setCountry(tab.id)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                country === tab.id
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/50 text-muted-foreground border-border hover:border-foreground/20 hover:bg-muted"
              )}
              data-testid={`sector-perf-country-${tab.id}`}
            >
              <span>{tab.flag}</span>
              <span>{lang === "ko" ? tab.ko : lang === "ja" ? tab.ja : tab.en}</span>
            </button>
          ))}
        </div>

        {/* Period tabs */}
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
                period === p.id
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                  : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
              )}
              data-testid={`sector-perf-period-${p.id}`}
            >
              {lang === "ko" ? p.ko : lang === "ja" ? p.ja : p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart body */}
      <div className="p-5">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="h-6 flex-1 bg-muted rounded animate-pulse" style={{ opacity: 1 - i * 0.08 }} />
              </div>
            ))}
          </div>
        ) : chartData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {L("데이터를 불러오는 중 오류가 발생했습니다.", "Failed to load sector data.", "データの読み込みに失敗しました。")}
          </div>
        ) : (
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 50, bottom: 0, left: 8 }}
                barSize={18}
              >
                <XAxis
                  type="number"
                  domain={domain}
                  tickFormatter={v => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={88}
                  tick={{ fontSize: 11, fill: "var(--foreground)", fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(128,128,128,0.06)" }} />
                <ReferenceLine x={0} stroke="var(--border)" strokeWidth={1.5} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.symbol}
                      fill={entry.value >= 0 ? "#10b981" : "#ef4444"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Summary stats row */}
        {!isLoading && chartData.length > 0 && (() => {
          const pos = chartData.filter(d => d.value > 0).length;
          const neg = chartData.filter(d => d.value < 0).length;
          const avg = chartData.reduce((s, d) => s + d.value, 0) / chartData.length;
          return (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground">
              <span>
                <span className="font-bold text-emerald-500">{pos}</span>{" "}
                {L("섹터 상승", "sectors ↑", "セクター上昇")}
              </span>
              <span>
                <span className="font-bold text-red-500">{neg}</span>{" "}
                {L("섹터 하락", "sectors ↓", "セクター下落")}
              </span>
              <span className="ml-auto">
                {L("평균:", "Avg:", "平均:")}
                {" "}
                <span className={cn("font-bold", avg >= 0 ? "text-emerald-500" : "text-red-500")}>
                  {avg >= 0 ? "+" : ""}{avg.toFixed(2)}%
                </span>
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
