import { useQuery } from "@tanstack/react-query";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { TrendingUp, RefreshCw, Info, X } from "lucide-react";

interface RRGPoint {
  rsRatio: number;
  rsMomentum: number;
}

interface RRGSector {
  symbol: string;
  quadrant: "leading" | "weakening" | "lagging" | "improving";
  rsRatio: number;
  rsMomentum: number;
  tail: RRGPoint[];
}

interface RRGData {
  benchmark: string;
  sectors: RRGSector[];
  tailLength: number;
  fetchedAt: string;
}

const SECTOR_LABELS: Record<string, { en: string; ko: string }> = {
  XLK:  { en: "Tech",           ko: "기술" },
  XLF:  { en: "Financials",     ko: "금융" },
  XLV:  { en: "Healthcare",     ko: "헬스케어" },
  XLE:  { en: "Energy",         ko: "에너지" },
  XLY:  { en: "Cons. Disc.",    ko: "임의소비재" },
  XLP:  { en: "Cons. Staples",  ko: "필수소비재" },
  XLI:  { en: "Industrials",    ko: "산업재" },
  XLB:  { en: "Materials",      ko: "소재" },
  XLRE: { en: "Real Estate",    ko: "리츠" },
  XLU:  { en: "Utilities",      ko: "유틸리티" },
  XLC:  { en: "Comm. Svcs",     ko: "통신" },
};

const SECTOR_COLORS: Record<string, string> = {
  XLK:  "#6366f1",
  XLF:  "#f59e0b",
  XLV:  "#10b981",
  XLE:  "#ef4444",
  XLY:  "#8b5cf6",
  XLP:  "#06b6d4",
  XLI:  "#f97316",
  XLB:  "#84cc16",
  XLRE: "#ec4899",
  XLU:  "#14b8a6",
  XLC:  "#a855f7",
};

const QUADRANT_CONFIG = {
  leading:   { label: "Leading",   labelKo: "주도",  color: "#22c55e", bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.25)",  desc: "Outperforming & gaining momentum",     descKo: "강도와 모멘텀 모두 우수" },
  weakening: { label: "Weakening", labelKo: "약화",  color: "#eab308", bg: "rgba(234,179,8,0.10)",  border: "rgba(234,179,8,0.25)",  desc: "Outperforming but losing momentum",    descKo: "강도는 높으나 모멘텀 둔화" },
  lagging:   { label: "Lagging",   labelKo: "침체",  color: "#ef4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.25)",  desc: "Underperforming & losing momentum",    descKo: "강도와 모멘텀 모두 부진" },
  improving: { label: "Improving", labelKo: "회복",  color: "#3b82f6", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.25)", desc: "Underperforming but gaining momentum", descKo: "강도는 낮으나 모멘텀 회복" },
};

const FLOW_DESCRIPTION: Record<string, { en: string; ko: string }> = {
  leading:   { en: "Capital is strongly allocated here — this sector leads the market.",   ko: "자금이 집중되는 선도 섹터입니다." },
  weakening: { en: "Rotation starting — smart money may be moving out of this sector.",    ko: "수익 실현 구간 — 자금이 빠져나올 수 있습니다." },
  lagging:   { en: "Capital is leaving — this sector is underperforming the market.",      ko: "소외된 섹터 — 시장 대비 부진합니다." },
  improving: { en: "Opportunity zone — capital is beginning to rotate back in.",           ko: "기회 구간 — 자금이 돌아오기 시작합니다." },
};

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload || payload.isTail) return null;
  const color = SECTOR_COLORS[payload.symbol] || "#6366f1";
  return (
    <g style={{ cursor: "pointer" }}>
      <circle cx={cx} cy={cy} r={16} fill={color} opacity={0.12} />
      <circle cx={cx} cy={cy} r={9} fill={color} stroke="white" strokeWidth={2} opacity={0.95} />
    </g>
  );
}

function SectorLabel(props: any) {
  const { cx, cy, payload } = props;
  if (!payload || payload.isTail) return null;
  const label = SECTOR_LABELS[payload.symbol];
  const text = label?.en || payload.symbol;
  return (
    <g>
      <text
        x={cx}
        y={cy - 16}
        textAnchor="middle"
        fontSize={9}
        fontWeight={600}
        fill={SECTOR_COLORS[payload.symbol] || "#6366f1"}
        opacity={0.9}
      >
        {payload.symbol}
      </text>
    </g>
  );
}

function CustomTooltip({ active, payload, lang, onSelect }: {
  active?: boolean;
  payload?: any[];
  lang: string;
  onSelect: (d: RRGSector) => void;
}) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  if (!d || d.isTail) return null;
  const q = QUADRANT_CONFIG[d.quadrant as keyof typeof QUADRANT_CONFIG];
  if (!q) return null;
  const label = SECTOR_LABELS[d.symbol];
  const flow = FLOW_DESCRIPTION[d.quadrant as keyof typeof FLOW_DESCRIPTION];
  if (!flow) return null;

  return (
    <div
      className="bg-popover border border-border rounded-2xl shadow-2xl p-4 max-w-[230px] cursor-pointer select-none"
      onClick={() => onSelect(d)}
      data-testid={`rrg-tooltip-${d.symbol}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: SECTOR_COLORS[d.symbol] }} />
        <span className="font-bold text-sm">{d.symbol}</span>
        <span className="text-xs text-muted-foreground">{label ? (lang === "ko" ? label.ko : label.en) : ""}</span>
      </div>
      <div
        className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full mb-2"
        style={{ background: q.bg, color: q.color, border: `1px solid ${q.border}` }}
      >
        {lang === "ko" ? `현재 상태: ${q.labelKo}` : `Current Status: ${q.label}`}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-2">
        {lang === "ko" ? flow.ko : flow.en}
      </p>
      <div className="grid grid-cols-2 gap-1 text-xs">
        <div className="text-muted-foreground">RS-Ratio</div>
        <div className="font-mono font-semibold text-right">{d.rsRatio?.toFixed(2)}</div>
        <div className="text-muted-foreground">RS-Momentum</div>
        <div className="font-mono font-semibold text-right">{d.rsMomentum?.toFixed(2)}</div>
      </div>
      <p className="text-[10px] text-primary mt-2 text-center opacity-70">
        {lang === "ko" ? "탭하여 자세히 보기" : "Tap to see details"}
      </p>
    </div>
  );
}

export function RRGChart() {
  const { data: user } = useUser();
  const lang = user?.language || "en";
  const [selected, setSelected] = useState<RRGSector | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const { data, isLoading, error, refetch, isRefetching } = useQuery<RRGData>({
    queryKey: ["/api/rrg/data"],
    staleTime: 1000 * 60 * 4,
    refetchInterval: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 animate-pulse" data-testid="rrg-loading">
        <div className="h-6 bg-muted rounded w-48 mb-4" />
        <div className="h-80 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (error || !data || data.sectors.length === 0) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 text-center space-y-3" data-testid="rrg-error">
        <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground text-sm">
          {lang === "ko"
            ? "RRG 데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도하세요."
            : "Could not load RRG data. This uses daily data and may take a moment."}
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          data-testid="button-retry-rrg"
        >
          <RefreshCw className="w-3 h-3" />
          {lang === "ko" ? "다시 시도" : "Retry"}
        </button>
      </div>
    );
  }

  const scatterData = data.sectors.map(s => ({
    ...s,
    x: s.rsRatio,
    y: s.rsMomentum,
  }));

  const allX = data.sectors.map(s => s.rsRatio);
  const allY = data.sectors.map(s => s.rsMomentum);
  const xPad = Math.max(Math.abs(Math.min(...allX) - 100), Math.abs(Math.max(...allX) - 100), 1.5) + 1;
  const yPad = Math.max(Math.abs(Math.min(...allY) - 100), Math.abs(Math.max(...allY) - 100), 1.5) + 1;
  const xMin = Math.round((100 - xPad) * 10) / 10;
  const xMax = Math.round((100 + xPad) * 10) / 10;
  const yMin = Math.round((100 - yPad) * 10) / 10;
  const yMax = Math.round((100 + yPad) * 10) / 10;

  const quadrantCounts = { leading: 0, weakening: 0, lagging: 0, improving: 0 };
  for (const s of data.sectors) quadrantCounts[s.quadrant]++;

  return (
    <div className="bg-card border border-border rounded-3xl overflow-hidden" data-testid="rrg-chart">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-white" />
              </span>
              {lang === "ko" ? "섹터 순환 그래프 (RRG)" : "Relative Rotation Graph (RRG)"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {lang === "ko"
                ? `벤치마크: ${data.benchmark} | 자금이 어디서 빠져나와 어디로 흐르는지 한눈에`
                : `Benchmark: ${data.benchmark} | See where capital is flowing across US sectors`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              data-testid="button-rrg-info"
              aria-label="Show info"
            >
              <Info className="w-4 h-4" />
            </button>
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              data-testid="button-rrg-refresh"
              aria-label="Refresh"
            >
              <RefreshCw className={cn("w-4 h-4", isRefetching && "animate-spin")} />
            </button>
          </div>
        </div>

        {showInfo && (
          <div className="mt-3 bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed">
            {lang === "ko"
              ? "RRG는 각 섹터의 상대적 강도(RS-Ratio)와 모멘텀(RS-Momentum)을 시각화합니다. 우상단(Leading) 섹터가 현재 시장을 주도하며, 꼬리(Trail)는 최근 10일간의 이동 경로를 나타냅니다. 시계 방향 순환: 회복 → 주도 → 약화 → 침체."
              : "RRG plots each sector's RS-Ratio (outperformance vs benchmark) on X-axis, and RS-Momentum (rate of change of RS-Ratio) on Y-axis. Tails show the last 10 days of movement. Sectors typically rotate clockwise: Improving → Leading → Weakening → Lagging."}
          </div>
        )}
      </div>

      {/* Quadrant legend pills */}
      <div className="flex gap-2 px-6 py-3 flex-wrap border-b border-border/40">
        {(Object.entries(QUADRANT_CONFIG) as [string, typeof QUADRANT_CONFIG["leading"]][]).map(([key, cfg]) => (
          <div
            key={key}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
            {lang === "ko" ? cfg.labelKo : cfg.label}
            <span className="opacity-60 font-normal">({quadrantCounts[key as keyof typeof quadrantCounts]})</span>
          </div>
        ))}
        <div className="ml-auto text-[10px] text-muted-foreground self-center hidden sm:block">
          {lang === "ko" ? `최근 업데이트: ${data.fetchedAt.slice(11, 16)}` : `Updated: ${data.fetchedAt.slice(11, 16)}`}
        </div>
      </div>

      {/* Chart */}
      <div className="relative px-2 pt-4 pb-2" style={{ height: 400 }}>
        {/* Quadrant background labels */}
        <div className="absolute inset-0 pointer-events-none z-10" style={{ top: 20, left: 42, right: 24, bottom: 32 }}>
          <div className="relative w-full h-full">
            <span className="absolute top-2 left-4 text-[10px] font-bold text-blue-400 opacity-40 uppercase tracking-wider">
              {lang === "ko" ? "회복" : "Improving"}
            </span>
            <span className="absolute top-2 right-4 text-[10px] font-bold text-green-400 opacity-40 uppercase tracking-wider">
              {lang === "ko" ? "주도" : "Leading"}
            </span>
            <span className="absolute bottom-2 left-4 text-[10px] font-bold text-red-400 opacity-40 uppercase tracking-wider">
              {lang === "ko" ? "침체" : "Lagging"}
            </span>
            <span className="absolute bottom-2 right-4 text-[10px] font-bold text-yellow-400 opacity-40 uppercase tracking-wider">
              {lang === "ko" ? "약화" : "Weakening"}
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 24, bottom: 20, left: 18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />

            <ReferenceLine x={100} stroke="rgba(128,128,128,0.35)" strokeWidth={1.5} strokeDasharray="6 4" />
            <ReferenceLine y={100} stroke="rgba(128,128,128,0.35)" strokeWidth={1.5} strokeDasharray="6 4" />

            <XAxis
              type="number"
              dataKey="x"
              domain={[xMin, xMax]}
              tickCount={7}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              label={{
                value: lang === "ko" ? "← RS-비율 →" : "← RS-Ratio →",
                position: "insideBottom",
                offset: -8,
                fontSize: 10,
                fill: "hsl(var(--muted-foreground))",
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[yMin, yMax]}
              tickCount={7}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              label={{
                value: lang === "ko" ? "RS-모멘텀" : "RS-Momentum",
                angle: -90,
                position: "insideLeft",
                offset: 12,
                fontSize: 10,
                fill: "hsl(var(--muted-foreground))",
              }}
            />

            <Tooltip
              content={(props) => (
                <CustomTooltip
                  active={props.active}
                  payload={props.payload}
                  lang={lang}
                  onSelect={setSelected}
                />
              )}
              cursor={{ strokeDasharray: "3 3", stroke: "rgba(128,128,128,0.25)" }}
            />

            {/* Tail trail lines for each sector */}
            {data.sectors.map(sector => {
              if (!sector.tail || sector.tail.length < 2) return null;
              const color = SECTOR_COLORS[sector.symbol] || "#6366f1";
              const tailPoints = sector.tail.slice(0, -1).map((p, i, arr) => ({
                x: p.rsRatio,
                y: p.rsMomentum,
                opacity: 0.15 + (i / arr.length) * 0.55,
                symbol: sector.symbol,
                isTail: true,
              }));
              return (
                <Scatter
                  key={`tail-${sector.symbol}`}
                  data={tailPoints}
                  fill={color}
                  line={{ stroke: color, strokeWidth: 1.5, strokeOpacity: 0.35, strokeDasharray: "2 2" }}
                  lineType="joint"
                  shape={(shapeProps: any) => {
                    const { cx, cy, payload } = shapeProps;
                    if (!payload) return null;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={2.5}
                        fill={color}
                        opacity={payload.opacity ?? 0.3}
                        style={{ pointerEvents: "none" }}
                      />
                    );
                  }}
                  isAnimationActive={false}
                />
              );
            })}

            {/* Current position dots */}
            <Scatter
              data={scatterData}
              shape={<CustomDot />}
              label={<SectorLabel />}
              onClick={(d: any) => setSelected(d)}
              style={{ cursor: "pointer" }}
            >
              {scatterData.map((entry) => (
                <Cell key={entry.symbol} fill={SECTOR_COLORS[entry.symbol] || "#6366f1"} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Sector legend chips */}
      <div className="px-6 pb-4 flex flex-wrap gap-2">
        {data.sectors.map(s => {
          const label = SECTOR_LABELS[s.symbol];
          const color = SECTOR_COLORS[s.symbol] || "#6366f1";
          const q = QUADRANT_CONFIG[s.quadrant];
          const isSelected = selected?.symbol === s.symbol;
          return (
            <button
              key={s.symbol}
              onClick={() => setSelected(isSelected ? null : s)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all",
                isSelected
                  ? "border-foreground/40 bg-muted shadow-sm scale-105"
                  : "border-border bg-card hover:border-foreground/20 hover:bg-muted/50"
              )}
              data-testid={`rrg-sector-${s.symbol}`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="font-semibold">{s.symbol}</span>
              <span className="text-muted-foreground hidden sm:inline">{label ? (lang === "ko" ? label.ko : label.en) : ""}</span>
              <span className="font-bold" style={{ color: q.color }}>·</span>
            </button>
          );
        })}
      </div>

      {/* Selected sector detail panel */}
      {selected && (() => {
        const q = QUADRANT_CONFIG[selected.quadrant];
        const flow = FLOW_DESCRIPTION[selected.quadrant];
        const label = SECTOR_LABELS[selected.symbol];
        return (
          <div
            className="mx-6 mb-6 rounded-2xl border p-4"
            style={{ background: q.bg, borderColor: q.border }}
            data-testid={`rrg-detail-${selected.symbol}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: SECTOR_COLORS[selected.symbol] }} />
                  <span className="font-bold">{selected.symbol}</span>
                  {label && (
                    <span className="text-xs text-muted-foreground">{lang === "ko" ? label.ko : label.en}</span>
                  )}
                </div>
                <div
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full mb-2"
                  style={{ background: "white", color: q.color, border: `1px solid ${q.border}` }}
                >
                  {lang === "ko" ? `현재 상태: ${q.labelKo}` : `Current Status: ${q.label}`}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: q.color }}>
                  {lang === "ko" ? flow.ko : flow.en}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors shrink-0"
                data-testid="button-rrg-close-detail"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="bg-background/70 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">RS-Ratio</p>
                <p className="font-mono font-bold text-lg">{selected.rsRatio.toFixed(3)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {selected.rsRatio >= 100
                    ? (lang === "ko" ? "▲ 벤치마크 상회" : "▲ Outperforming")
                    : (lang === "ko" ? "▼ 벤치마크 하회" : "▼ Underperforming")}
                </p>
              </div>
              <div className="bg-background/70 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">RS-Momentum</p>
                <p className="font-mono font-bold text-lg">{selected.rsMomentum.toFixed(3)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {selected.rsMomentum >= 100
                    ? (lang === "ko" ? "▲ 모멘텀 상승 중" : "▲ Momentum rising")
                    : (lang === "ko" ? "▼ 모멘텀 둔화 중" : "▼ Momentum falling")}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 text-center">
              {lang === "ko"
                ? `꼬리(Trail)는 최근 ${data.tailLength}일간의 이동 경로를 나타냅니다`
                : `Trail shows the last ${data.tailLength} days of rotation`}
            </p>
          </div>
        );
      })()}
    </div>
  );
}
