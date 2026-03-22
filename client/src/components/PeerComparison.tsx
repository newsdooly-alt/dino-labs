import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { Users, TrendingUp, BarChart2, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cleanCompanyName } from "@/lib/stockUtils";
import { getLocalizedCompanyName } from "@/lib/stockNames";

interface PeerData {
  symbol: string;
  name: string;
  price: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  profitMargin: number | null;
  operatingMargin: number | null;
  revenueGrowth: number | null;
  sector: string | null;
  industry: string | null;
}

interface PeersResponse {
  symbol: string;
  peers: PeerData[];
  count: number;
  isSectorFallback?: boolean;
}

interface PeerComparisonProps {
  symbol: string;
  lang: string;
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtCap(v: number | null, lang: string): string {
  if (v == null) return "--";
  if (lang === "ko") {
    if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
    if (v >= 1e8)  return `${(v / 1e8).toFixed(0)}억`;
    return `${v.toLocaleString()}`;
  }
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

function fmtNum(v: number | null, decimals = 1): string {
  if (v == null || !isFinite(v)) return "--";
  return v.toFixed(decimals);
}

function fmtPct(v: number | null): string {
  if (v == null || !isFinite(v)) return "--";
  return `${(v * 100).toFixed(2)}%`;
}

function fmtPrice(v: number | null, sym: string): string {
  if (v == null || v === 0) return "--";
  const isKr = sym.endsWith(".KS") || sym.endsWith(".KQ");
  const isJp = sym.endsWith(".T");
  if (isKr) return `₩${v.toLocaleString("ko-KR")}`;
  if (isJp) return `¥${v.toLocaleString("ja-JP")}`;
  return `$${v.toFixed(2)}`;
}

function shortName(name: string, lang: string): string {
  const localized = getLocalizedCompanyName(cleanCompanyName(name), lang);
  return localized.length > 16 ? localized.slice(0, 15) + "…" : localized;
}

function avg(vals: (number | null)[]): number | null {
  const valid = vals.filter((v): v is number => v != null && isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// ── Sector evaluation labels ──────────────────────────────────────────────────
type Direction = "lower-better" | "higher-better";

interface EvalResult {
  label: string;
  color: "green" | "red" | "neutral";
  icon: "up" | "down" | "eq";
}

function evaluate(
  mine: number | null,
  sectorAvg: number | null,
  direction: Direction,
  lang: string
): EvalResult {
  if (mine == null || sectorAvg == null || sectorAvg === 0) {
    return { label: "--", color: "neutral", icon: "eq" };
  }
  const ratio = mine / sectorAvg;
  const isBetter = direction === "lower-better" ? ratio < 0.95 : ratio > 1.05;
  const isWorse  = direction === "lower-better" ? ratio > 1.05 : ratio < 0.95;

  if (isBetter) {
    const label = lang === "ko"
      ? direction === "lower-better" ? "저평가" : "우수"
      : lang === "ja"
      ? direction === "lower-better" ? "割安" : "優秀"
      : direction === "lower-better" ? "Undervalued" : "Above Avg";
    return { label, color: "green", icon: direction === "lower-better" ? "down" : "up" };
  }
  if (isWorse) {
    const label = lang === "ko"
      ? direction === "lower-better" ? "고평가" : "평균 이하"
      : lang === "ja"
      ? direction === "lower-better" ? "割高" : "平均以下"
      : direction === "lower-better" ? "Overvalued" : "Below Avg";
    return { label, color: "red", icon: direction === "lower-better" ? "up" : "down" };
  }
  const label = lang === "ko" ? "평균 수준" : lang === "ja" ? "平均的" : "In line";
  return { label, color: "neutral", icon: "eq" };
}

// ── I18n ─────────────────────────────────────────────────────────────────────
const L = {
  title:           { en: "Peer Comparison",          ko: "동종업계 비교",      ja: "同業比較" },
  subtitle:        { en: "Key metrics vs. industry peers", ko: "동종업계 주요 지표 비교", ja: "同業他社との主要指標比較" },
  sector_title:    { en: "Sector Comparison",         ko: "동종 섹터 비교",     ja: "セクター比較" },
  sector_sub:      { en: "vs. peer group average",    ko: "동종 그룹 평균 대비", ja: "同業グループ平均比" },
  col_metric:      { en: "Metric",                    ko: "지표",              ja: "指標" },
  col_mine:        { en: "This Stock",                ko: "현재 종목",          ja: "現在銘柄" },
  col_avg:         { en: "Peer Avg",                  ko: "섹터 평균",          ja: "セクター平均" },
  col_eval:        { en: "Assessment",                ko: "평가",              ja: "評価" },
  col_company:     { en: "Company",                   ko: "기업",              ja: "企業" },
  col_price:       { en: "Price",                     ko: "현재가",             ja: "株価" },
  col_per:         { en: "PER",                       ko: "PER",               ja: "PER" },
  col_pbr:         { en: "PBR",                       ko: "PBR",               ja: "PBR" },
  col_div:         { en: "Div. Yield",                ko: "배당수익률",          ja: "配当利回り" },
  col_cap:         { en: "Mkt Cap",                   ko: "시가총액",            ja: "時価総額" },
  chart_title:     { en: "Operating Margin (%)",      ko: "영업이익률 (%)",      ja: "営業利益率 (%)" },
  metric_per:      { en: "PER",                       ko: "PER (주가수익비율)", ja: "PER" },
  metric_pbr:      { en: "PBR",                       ko: "PBR (주가순자산비율)", ja: "PBR" },
  metric_div:      { en: "Dividend Yield",            ko: "배당수익률",          ja: "配当利回り" },
  metric_opm:      { en: "Operating Margin",          ko: "영업이익률",          ja: "営業利益率" },
};

function t(key: keyof typeof L, lang: string): string {
  const map = L[key] as Record<string, string>;
  return map[lang] ?? map["en"];
}

// ── Eval Badge ────────────────────────────────────────────────────────────────
function EvalBadge({ result }: { result: EvalResult }) {
  const Icon = result.icon === "up" ? ArrowUp : result.icon === "down" ? ArrowDown : Minus;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full",
      result.color === "green" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
      result.color === "red"   && "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
      result.color === "neutral" && "bg-muted text-muted-foreground",
    )}>
      <Icon className="w-2.5 h-2.5" />
      {result.label}
    </span>
  );
}

// ── Custom Chart Tooltip ──────────────────────────────────────────────────────
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="font-bold text-foreground mb-0.5">{d.name}</p>
      <p className="text-muted-foreground">{d.value != null ? `${(d.value * 100).toFixed(1)}%` : "--"}</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function PeerComparison({ symbol, lang }: PeerComparisonProps) {
  const { data, isLoading } = useQuery<PeersResponse>({
    queryKey: ["/api/stocks/peers", symbol],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/peers/${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error("Failed to fetch peers");
      return res.json();
    },
    enabled: !!symbol,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {t("title", lang)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const peers = data?.peers ?? [];
  if (peers.length === 0) return null;

  const isSectorFallback = data?.isSectorFallback ?? false;
  const mainStock  = peers.find((p) => p.symbol === symbol);
  const otherPeers = peers.filter((p) => p.symbol !== symbol);

  // Sector averages (from peer group, excluding main stock)
  const sectorPer = avg(otherPeers.map((p) => p.peRatio));
  const sectorPbr = avg(otherPeers.map((p) => p.pbRatio));
  const sectorDiv = avg(otherPeers.map((p) => p.dividendYield));
  const sectorOpm = avg(otherPeers.map((p) => p.operatingMargin));

  const evalPer = evaluate(mainStock?.peRatio ?? null, sectorPer, "lower-better", lang);
  const evalPbr = evaluate(mainStock?.pbRatio ?? null, sectorPbr, "lower-better", lang);
  const evalDiv = evaluate(mainStock?.dividendYield ?? null, sectorDiv, "higher-better", lang);
  const evalOpm = evaluate(mainStock?.operatingMargin ?? null, sectorOpm, "higher-better", lang);

  const sectorRows = [
    {
      metric: t("metric_per", lang),
      mine: fmtNum(mainStock?.peRatio ?? null) + (mainStock?.peRatio != null ? "x" : ""),
      avg: fmtNum(sectorPer) + (sectorPer != null ? "x" : ""),
      eval: evalPer,
    },
    {
      metric: t("metric_pbr", lang),
      mine: fmtNum(mainStock?.pbRatio ?? null) + (mainStock?.pbRatio != null ? "x" : ""),
      avg: fmtNum(sectorPbr) + (sectorPbr != null ? "x" : ""),
      eval: evalPbr,
    },
    {
      metric: t("metric_div", lang),
      mine: fmtPct(mainStock?.dividendYield ?? null),
      avg: fmtPct(sectorDiv),
      eval: evalDiv,
    },
    {
      metric: t("metric_opm", lang),
      mine: fmtPct(mainStock?.operatingMargin ?? null),
      avg: fmtPct(sectorOpm),
      eval: evalOpm,
    },
  ];

  // Chart data: operating margin for each peer
  const chartData = peers
    .filter((p) => p.operatingMargin != null)
    .map((p) => ({
      symbol: p.symbol,
      name: shortName(p.name, lang),
      value: p.operatingMargin,
      isMain: p.symbol === symbol,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          {t("title", lang)}
        </CardTitle>
        <p className="text-xs text-muted-foreground -mt-1">
          {isSectorFallback
            ? (lang === "ko" ? "섹터 평균 기준 비교 (직접 피어 없음)"
               : lang === "ja" ? "セクター平均基準比較（直接ピアなし）"
               : "Sector average comparison (no direct peers found)")
            : t("subtitle", lang)}
        </p>
      </CardHeader>
      <CardContent className="space-y-6 px-3 md:px-6">

        {/* ── 동종 섹터 비교 ── */}
        {mainStock && otherPeers.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="w-4 h-4 text-primary" />
              <div>
                <h4 className="text-sm font-bold text-foreground">{t("sector_title", lang)}</h4>
                <p className="text-[10px] text-muted-foreground">{t("sector_sub", lang)}</p>
              </div>
            </div>

            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[340px] text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">
                      {t("col_metric", lang)}
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-primary">
                      {t("col_mine", lang)}
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">
                      {t("col_avg", lang)}
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">
                      {t("col_eval", lang)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sectorRows.map((row, i) => (
                    <tr
                      key={row.metric}
                      className={cn(
                        "border-b border-border/40",
                        i % 2 === 0 ? "bg-transparent" : "bg-muted/20"
                      )}
                      data-testid={`sector-row-${i}`}
                    >
                      <td className="py-2.5 px-3 text-xs font-medium text-foreground/80">
                        {row.metric}
                      </td>
                      <td className="py-2.5 px-3 text-xs tabular-nums text-right font-bold text-foreground">
                        {row.mine}
                      </td>
                      <td className="py-2.5 px-3 text-xs tabular-nums text-right text-muted-foreground">
                        {row.avg}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <EvalBadge result={row.eval} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
              {isSectorFallback
                ? (lang === "ko"
                    ? `* 섹터 대표 ${otherPeers.length}개 기업 평균 (소형주 섹터 비교)`
                    : lang === "ja"
                    ? `* セクター代表${otherPeers.length}社平均（小型株セクター比較）`
                    : `* Sector representative avg (${otherPeers.length} companies, small-cap fallback)`)
                : (lang === "ko"
                    ? `* 섹터 평균은 ${otherPeers.length}개 동종 기업 기준`
                    : lang === "ja"
                    ? `* セクター平均は${otherPeers.length}社の同業他社ベース`
                    : `* Sector average based on ${otherPeers.length} peer companies`)}
            </p>
          </div>
        )}

        {/* ── Peer Table ── */}
        <div className="overflow-x-auto -mx-1">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-bold text-foreground">
              {lang === "ko" ? "개별 종목 비교" : lang === "ja" ? "個別銘柄比較" : "Individual Comparison"}
            </h4>
          </div>
          <table className="w-full min-w-[540px] text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground w-[30%]">
                  {t("col_company", lang)}
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">
                  {t("col_price", lang)}
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">
                  {t("col_per", lang)}
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">
                  {t("col_pbr", lang)}
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">
                  {t("col_div", lang)}
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">
                  {t("col_cap", lang)}
                </th>
              </tr>
            </thead>
            <tbody>
              {peers.map((peer, idx) => {
                const isMain = peer.symbol === symbol;
                return (
                  <tr
                    key={peer.symbol}
                    className={cn(
                      "border-b border-border/50 transition-colors",
                      isMain ? "bg-primary/10" : idx % 2 === 0 ? "bg-transparent" : "bg-muted/20"
                    )}
                    data-testid={`peer-row-${peer.symbol}`}
                  >
                    <td className={cn(
                      "py-2.5 px-3",
                      isMain && "border-l-2 border-l-primary"
                    )}>
                      <div className="flex items-center gap-2">
                        {isMain && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className={cn(
                            "font-semibold truncate text-xs",
                            isMain ? "text-primary" : "text-foreground"
                          )}>
                            {peer.symbol}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                            {shortName(peer.name, lang)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={cn(
                      "text-right py-2.5 px-3 font-mono text-xs tabular-nums",
                      isMain ? "font-bold text-foreground" : "text-foreground/80"
                    )}>
                      {fmtPrice(peer.price, peer.symbol)}
                    </td>
                    <td className="text-right py-2.5 px-3 text-xs tabular-nums text-foreground/80">
                      {fmtNum(peer.peRatio)}
                    </td>
                    <td className="text-right py-2.5 px-3 text-xs tabular-nums text-foreground/80">
                      {fmtNum(peer.pbRatio)}
                    </td>
                    <td className="text-right py-2.5 px-3 text-xs tabular-nums text-foreground/80">
                      {fmtPct(peer.dividendYield)}
                    </td>
                    <td className="text-right py-2.5 px-3 text-xs tabular-nums text-foreground/80">
                      {fmtCap(peer.marketCap, lang)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Bar Chart: Operating Margin ── */}
        {chartData.length > 1 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">{t("chart_title", lang)}</h4>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={chartData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                  barCategoryGap="25%"
                >
                  <XAxis
                    dataKey="symbol"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.symbol}
                        fill={entry.isMain ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.35)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1">
              {lang === "ko"
                ? "* 영업이익률 = 영업이익 ÷ 매출액 × 100"
                : lang === "ja"
                ? "* 営業利益率 = 営業利益 ÷ 売上高 × 100"
                : "* Operating Margin = Operating Income ÷ Revenue × 100"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
