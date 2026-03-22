import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  Percent,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Zap,
  RefreshCw,
  Globe,
} from "lucide-react";
import { useUser } from "@/hooks/use-user";

interface MacroAsset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  isMarketOpen: boolean;
  lastUpdated: string;
  isStale: boolean;
  sparkline: number[];
  correlations: { label: string; direction: "pressure" | "support" | "fear" | "neutral" }[];
}

interface MacroCategory {
  id: string;
  label: string;
  labelKo: string;
  symbols: string[];
  icon: string;
  invertedSignal?: boolean;
}

interface CryptoFearGreed {
  score: number;
  rating: string;
}

interface MacroDashboardData {
  assets: MacroAsset[];
  categories: MacroCategory[];
  fetchedAt: string;
  cryptoFearGreed: CryptoFearGreed | null;
}

const DISPLAY_NAMES: Record<string, { en: string; ko: string; ja?: string; flag?: string }> = {
  "ES=F":      { en: "S&P 500 Futures",   ko: "S&P500 선물",        flag: "🇺🇸" },
  "NQ=F":      { en: "Nasdaq Futures",     ko: "나스닥 선물",         flag: "🇺🇸" },
  "YM=F":      { en: "Dow Futures",        ko: "다우 선물",           flag: "🇺🇸" },
  "^N225":     { en: "Nikkei 225",         ko: "닛케이 225",          flag: "🇯🇵" },
  "^KS11":     { en: "KOSPI",              ko: "코스피",              flag: "🇰🇷" },
  "^KQ11":     { en: "KOSDAQ",             ko: "코스닥",              flag: "🇰🇷" },
  "^KS200":    { en: "KOSPI 200",          ko: "코스피 200",          flag: "🇰🇷" },
  "GC=F":      { en: "Gold",               ko: "금",                  flag: "🥇" },
  "CL=F":      { en: "Crude Oil (WTI)",    ko: "원유 (WTI)",          flag: "🛢️" },
  "BZ=F":      { en: "Brent Crude",        ko: "브렌트 원유",          flag: "🛢️" },
  "SI=F":      { en: "Silver",             ko: "은",                  flag: "🥈" },
  "HG=F":      { en: "Copper (Dr. Cu)",    ko: "구리 (닥터 구리)",     flag: "🔶" },
  "DX-Y.NYB":  { en: "US Dollar Index",    ko: "달러 인덱스",          flag: "💵" },
  "USDKRW=X":  { en: "USD/KRW",            ko: "달러/원화",            flag: "🇺🇸" },
  "USDJPY=X":  { en: "USD/JPY",            ko: "달러/엔화",            flag: "🇺🇸" },
  "JPYKRW":    { en: "JPY/KRW (¥100)",     ko: "엔/원화 (¥100)",      flag: "🇯🇵" },
  "^IRX":      { en: "US 2Y (Short-term)", ko: "미국 단기 금리 (2년)", flag: "📊" },
  "^TNX":      { en: "US 10Y Yield",       ko: "미국 10년 국채",       flag: "📊" },
  "^TYX":      { en: "US 30Y Yield",       ko: "미국 30년 국채",       flag: "📊" },
  "^VIX":      { en: "VIX Fear Index",     ko: "공포 지수 (VIX)",      flag: "📉" },
  "BTC-USD":   { en: "Bitcoin",            ko: "비트코인",             flag: "₿" },
  "ETH-USD":   { en: "Ethereum",           ko: "이더리움",             flag: "Ξ" },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "trending-up": <TrendingUp className="w-4 h-4" />,
  "package":     <Package className="w-4 h-4" />,
  "dollar-sign": <DollarSign className="w-4 h-4" />,
  "percent":     <Percent className="w-4 h-4" />,
  "activity":    <Activity className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  futures:    "text-blue-500 bg-blue-500/10 border-blue-500/20",
  commodities:"text-amber-500 bg-amber-500/10 border-amber-500/20",
  forex:      "text-purple-500 bg-purple-500/10 border-purple-500/20",
  bonds:      "text-orange-500 bg-orange-500/10 border-orange-500/20",
  sentiment:  "text-pink-500 bg-pink-500/10 border-pink-500/20",
};

function Sparkline({ data, isPositive, isInverted }: { data: number[]; isPositive: boolean; isInverted: boolean }) {
  if (!data || data.length < 2) {
    return <div className="w-16 h-8 flex items-center justify-center text-muted-foreground/40 text-xs">—</div>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 64;
  const height = 32;
  const padding = 2;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + ((max - val) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  const fillPoints = `${padding},${height} ` + points + ` ${width - padding},${height}`;

  const effectivePositive = isInverted ? !isPositive : isPositive;
  const strokeColor = effectivePositive ? "#22c55e" : "#ef4444";
  const fillColor = effectivePositive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";

  return (
    <svg width={width} height={height} className="shrink-0">
      <polygon points={fillPoints} fill={fillColor} />
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.length > 0 && (() => {
        const lastIdx = data.length - 1;
        const lx = padding + (lastIdx / (data.length - 1)) * (width - padding * 2);
        const ly = padding + ((max - data[lastIdx]) / range) * (height - padding * 2);
        return <circle cx={lx} cy={ly} r="2" fill={strokeColor} />;
      })()}
    </svg>
  );
}

function CorrelationBadge({ label, direction }: { label: string; direction: string }) {
  if (direction === "pressure") {
    return (
      <span
        data-testid={`correlation-pressure-${label}`}
        className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20"
      >
        <TrendingDown className="w-2.5 h-2.5" />
        {label}
      </span>
    );
  }
  if (direction === "support") {
    return (
      <span
        data-testid={`correlation-support-${label}`}
        className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20"
      >
        <ShieldCheck className="w-2.5 h-2.5" />
        {label}
      </span>
    );
  }
  if (direction === "fear") {
    return (
      <span
        data-testid={`correlation-fear-${label}`}
        className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20"
      >
        <AlertTriangle className="w-2.5 h-2.5" />
        {label}
      </span>
    );
  }
  return null;
}

function formatMacroPrice(symbol: string, price: number): string {
  if (price === 0) return "—";
  if (symbol === "USDKRW=X" || symbol === "JPYKRW") {
    return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (symbol === "USDJPY=X") {
    return price.toFixed(2);
  }
  if (symbol === "BTC-USD" || symbol === "ETH-USD") {
    return "$" + price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (symbol === "^TNX" || symbol === "^IRX" || symbol === "^TYX" || symbol === "^FVX") {
    return price.toFixed(3) + "%";
  }
  if (symbol === "^VIX") {
    return price.toFixed(2);
  }
  if (symbol === "GC=F") {
    return "$" + price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (symbol === "SI=F") {
    return "$" + price.toFixed(3);
  }
  if (symbol === "CL=F" || symbol === "BZ=F") {
    return "$" + price.toFixed(2);
  }
  if (["ES=F", "NQ=F", "YM=F", "NK=F", "^N225"].includes(symbol)) {
    return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (["^KS11", "^KQ11", "^KS200"].includes(symbol)) {
    return price.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  }
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function VixGauge({ price }: { price: number }) {
  if (!price) return null;
  let label: string;
  let colorClass: string;
  if (price < 15) { label = "Calm"; colorClass = "text-green-500"; }
  else if (price < 20) { label = "Normal"; colorClass = "text-yellow-500"; }
  else if (price < 30) { label = "Elevated"; colorClass = "text-orange-500"; }
  else { label = "Extreme Fear"; colorClass = "text-red-500"; }

  return (
    <span className={cn("text-[10px] font-bold ml-1", colorClass)} data-testid="vix-gauge-label">
      {label}
    </span>
  );
}

function CryptoFearGreedRow({ fg, lang }: { fg: { score: number; rating: string }; lang: string }) {
  const score = fg.score;
  let colorClass: string;
  let emoji: string;
  let labelKo: string;

  if (score <= 24)      { colorClass = "text-red-600 dark:text-red-400";     emoji = "😱"; labelKo = "극도 공포"; }
  else if (score <= 44) { colorClass = "text-orange-500";                    emoji = "😨"; labelKo = "공포"; }
  else if (score <= 54) { colorClass = "text-yellow-500";                    emoji = "😐"; labelKo = "중립"; }
  else if (score <= 74) { colorClass = "text-lime-500";                      emoji = "😊"; labelKo = "탐욕"; }
  else                  { colorClass = "text-green-600 dark:text-green-400"; emoji = "🤑"; labelKo = "극도 탐욕"; }

  const label = lang === "ko" ? labelKo : fg.rating;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-t border-border/40"
      data-testid="crypto-fear-greed-row"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm shrink-0">🧠</span>
          <span className="font-semibold text-sm truncate">
            {lang === "ko" ? "크립토 공포·탐욕" : "Crypto Fear & Greed"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-muted-foreground font-mono">alternative.me</span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className={cn("font-mono font-semibold text-sm tabular-nums flex items-center gap-1.5 justify-end", colorClass)}>
          <span>{emoji}</span>
          <span>{score} / 100</span>
        </div>
        <div className={cn("text-xs font-bold tabular-nums", colorClass)}>
          {label}
        </div>
      </div>
    </div>
  );
}

export function GlobalMacroDashboard() {
  const { data: user } = useUser();
  const lang = user?.language || "ko";

  const { data, isLoading, error, refetch, isRefetching } = useQuery<MacroDashboardData>({
    queryKey: ["/api/macro/dashboard"],
    staleTime: 1000 * 55,
    refetchInterval: 1000 * 60,
    gcTime: 1000 * 120,
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="macro-dashboard-loading">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4 animate-pulse">
            <div className="h-5 bg-muted rounded w-32 mb-3" />
            <div className="space-y-3">
              {[1, 2].map(j => (
                <div key={j} className="flex items-center justify-between">
                  <div className="h-4 bg-muted rounded w-28" />
                  <div className="h-8 bg-muted rounded w-16" />
                  <div className="h-4 bg-muted rounded w-14" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3" data-testid="macro-dashboard-error">
        <Globe className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground text-sm">
          {lang === "ko" ? "글로벌 매크로 데이터를 불러오는 중 오류가 발생했습니다." : "Unable to load global macro data right now."}
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          data-testid="button-retry-macro"
        >
          <RefreshCw className="w-3 h-3" />
          {lang === "ko" ? "다시 시도" : "Retry"}
        </button>
      </div>
    );
  }

  const assetMap: Record<string, MacroAsset> = {};
  for (const a of data.assets) {
    assetMap[a.symbol] = a;
  }

  return (
    <div className="space-y-4" data-testid="macro-dashboard">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("w-2 h-2 rounded-full", isRefetching ? "bg-yellow-400 animate-pulse" : "bg-green-500 animate-pulse")} />
          {lang === "ko" ? "1분마다 자동 갱신" : "Auto-refresh every 1 min"}
          {data.fetchedAt && (
            <span className="ml-1 opacity-60" data-testid="macro-last-updated">· {data.fetchedAt}</span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-refresh-macro"
        >
          <RefreshCw className={cn("w-3 h-3", isRefetching && "animate-spin")} />
          {lang === "ko" ? "새로고침" : "Refresh"}
        </button>
      </div>

      {data.categories.map(category => {
        const colorClass = CATEGORY_COLORS[category.id] || "text-primary bg-primary/10 border-primary/20";
        const categoryAssets = category.symbols
          .map(sym => assetMap[sym])
          .filter(Boolean);

        return (
          <div
            key={category.id}
            className="bg-card border border-border rounded-2xl overflow-hidden"
            data-testid={`macro-category-${category.id}`}
          >
            <div className={cn("flex items-center gap-2 px-4 py-2.5 border-b border-border/60 text-sm font-semibold", colorClass.split(" ")[0])}>
              <span className={cn("p-1 rounded-lg border", colorClass)}>
                {CATEGORY_ICONS[category.icon]}
              </span>
              {lang === "ko" ? category.labelKo : category.label}
            </div>

            {/* Crypto Fear & Greed shown at bottom of sentiment section as a clean row */}

            <div className="divide-y divide-border/40">
              {categoryAssets.map(asset => {
                const displayName = DISPLAY_NAMES[asset.symbol];
                const name = displayName ? (lang === "ko" ? displayName.ko : displayName.en) : (asset.name || asset.symbol);
                const flag = displayName?.flag ?? null;
                const isPositive = asset.changePercent >= 0;
                const isVix = asset.symbol === "^VIX";
                const isInverted = category.invertedSignal || false;
                const isKrIndex = ["^KS11", "^KQ11", "^KS200"].includes(asset.symbol);

                const effectivePositive = isInverted ? !isPositive : isPositive;

                return (
                  <div
                    key={asset.symbol}
                    className={cn("flex items-center gap-3 px-4 py-3", isKrIndex && "bg-rose-500/3")}
                    data-testid={`macro-asset-${asset.symbol.replace(/[^a-zA-Z0-9]/g, "-")}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {flag && <span className="text-sm shrink-0">{flag}</span>}
                        <span className="font-semibold text-sm truncate">{name}</span>
                        {isVix && asset.price > 0 && <VixGauge price={asset.price} />}
                        {asset.isStale && (
                          <span className="text-[10px] text-muted-foreground/60 font-normal">*stale</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground font-mono">{asset.symbol}</span>
                        {asset.correlations.map((c, i) => (
                          <CorrelationBadge key={i} label={c.label} direction={c.direction} />
                        ))}
                      </div>
                    </div>

                    <Sparkline
                      data={asset.sparkline}
                      isPositive={isPositive}
                      isInverted={isInverted}
                    />

                    <div className="text-right shrink-0 min-w-[80px]">
                      <div
                        className="font-mono font-semibold text-sm tabular-nums"
                        data-testid={`macro-price-${asset.symbol.replace(/[^a-zA-Z0-9]/g, "-")}`}
                      >
                        {formatMacroPrice(asset.symbol, asset.price)}
                      </div>
                      <div
                        className={cn(
                          "text-xs font-bold tabular-nums",
                          effectivePositive
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                        data-testid={`macro-change-${asset.symbol.replace(/[^a-zA-Z0-9]/g, "-")}`}
                      >
                        {asset.changePercent >= 0 ? "+" : ""}{asset.changePercent.toFixed(2)}%
                        {effectivePositive
                          ? <TrendingUp className="inline w-3 h-3 ml-0.5" />
                          : <TrendingDown className="inline w-3 h-3 ml-0.5" />
                        }
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {category.id === "sentiment" && data.cryptoFearGreed && (
              <CryptoFearGreedRow fg={data.cryptoFearGreed} lang={lang} />
            )}
          </div>
        );
      })}

      <div className="bg-card/40 border border-border/50 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm mb-1">
              {lang === "ko" ? "글로벌 매크로 읽는 법" : "How to Read Global Macro"}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "ko"
                ? "채권 금리 상승 → 나스닥 하락 압력 (성장주 할인율↑). VIX > 25 → 시장 공포 신호. 달러 강세 → 금·은·원유 하락 압력. WTI·브렌트 동시 상승 → 인플레이션 위험. 구리 상승은 글로벌 경기 회복 신호 ('닥터 구리'). 크립토 공포·탐욕 지수: 0=극도 공포, 100=극도 탐욕."
                : "Rising bond yields → pressure on Nasdaq. VIX > 25 → market fear. Strong dollar → pressure on Gold, Silver & Oil. WTI + Brent rising together → inflation risk. Copper up = global recovery ('Dr. Copper'). Crypto F&G: 0 = Extreme Fear, 100 = Extreme Greed."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
