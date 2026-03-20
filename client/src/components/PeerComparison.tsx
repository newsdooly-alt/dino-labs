import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { Users, TrendingUp } from "lucide-react";
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
  revenueGrowth: number | null;
  sector: string | null;
  industry: string | null;
}

interface PeersResponse {
  symbol: string;
  peers: PeerData[];
  count: number;
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

// ── I18n ─────────────────────────────────────────────────────────────────────
const L = {
  title: { en: "Peer Comparison", ko: "동종업계 비교", ja: "同業比較" },
  subtitle: { en: "Key metrics vs. industry peers", ko: "동종업계 주요 지표 비교", ja: "同業他社との主要指標比較" },
  col_company: { en: "Company", ko: "기업", ja: "企業" },
  col_price: { en: "Price", ko: "현재가", ja: "株価" },
  col_per: { en: "PER", ko: "PER", ja: "PER" },
  col_pbr: { en: "PBR", ko: "PBR", ja: "PBR" },
  col_div: { en: "Div. Yield", ko: "배당수익률", ja: "配当利回り" },
  col_cap: { en: "Mkt Cap", ko: "시가총액", ja: "時価総額" },
  chart_title: { en: "Net Profit Margin (%)", ko: "순이익률 (%)", ja: "純利益率 (%)" },
  no_data: { en: "No peer data available for this stock.", ko: "이 종목의 동종업계 데이터가 없습니다.", ja: "この銘柄のピアデータはありません。" },
  loading: { en: "Loading peers…", ko: "비교 데이터 로딩 중…", ja: "比較データ読み込み中…" },
  selected: { en: "Selected", ko: "선택됨", ja: "選択中" },
};

function t(key: keyof typeof L, lang: string): string {
  const map = L[key] as Record<string, string>;
  return map[lang] ?? map["en"];
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
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
  if (peers.length === 0) {
    return null;
  }

  // Chart data: only peers with valid profit margin
  const chartData = peers
    .filter((p) => p.profitMargin != null)
    .map((p) => ({
      symbol: p.symbol,
      name: shortName(p.name, lang),
      value: p.profitMargin,
      isMain: p.symbol === symbol,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          {t("title", lang)}
        </CardTitle>
        <p className="text-xs text-muted-foreground -mt-1">{t("subtitle", lang)}</p>
      </CardHeader>
      <CardContent className="space-y-5 px-3 md:px-6">

        {/* ── Comparison Table ── */}
        <div className="overflow-x-auto -mx-1">
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

        {/* ── Bar Chart: Net Profit Margin ── */}
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
                        fill={entry.isMain ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.4)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1">
              {lang === "ko"
                ? "* 순이익률 = 순이익 ÷ 매출액 × 100"
                : lang === "ja"
                ? "* 純利益率 = 純利益 ÷ 売上高 × 100"
                : "* Net Profit Margin = Net Income ÷ Revenue × 100"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
