import { TrendingUp, BarChart3, Globe, GitBranch, Flag, Bitcoin, Landmark, Flame, DollarSign } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { LiveStockCard } from "@/components/LiveStockCard";
import { GlobalMacroDashboard } from "@/components/GlobalMacroDashboard";
import { RRGChart } from "@/components/RRGChart";
import { useQuery } from "@tanstack/react-query";

function MarketMoodBadge({ lang }: { lang: string }) {
  const { data } = useQuery<any>({ queryKey: ["/api/market/mood"], staleTime: 5 * 60 * 1000 });
  if (!data) return null;
  const idx = data.index ?? 50;
  const emoji = idx <= 25 ? "😱" : idx <= 40 ? "😰" : idx <= 60 ? "😐" : idx <= 75 ? "😊" : "🤑";
  const color = idx <= 25 ? "text-red-500 bg-red-500/10 border-red-500/30"
    : idx <= 40 ? "text-orange-500 bg-orange-500/10 border-orange-500/30"
    : idx <= 60 ? "text-yellow-500 bg-yellow-500/10 border-yellow-500/30"
    : idx <= 75 ? "text-green-500 bg-green-500/10 border-green-500/30"
    : "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
  const barColor = idx <= 25 ? "#ef4444" : idx <= 40 ? "#f97316" : idx <= 60 ? "#eab308" : idx <= 75 ? "#22c55e" : "#10b981";
  return (
    <div className={`rounded-2xl border p-5 ${color}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{emoji}</span>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider opacity-70">
            {lang === "ko" ? "공포/탐욕 지수" : "Fear & Greed Index"}
          </div>
          <div className="text-2xl font-black">{idx}</div>
          <div className="text-sm font-semibold">{data.label || ""}</div>
        </div>
      </div>
      <div className="w-full h-2 rounded-full bg-black/10 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width:`${idx}%`, background: barColor }} />
      </div>
      <p className="text-xs mt-2 opacity-80">{data.dinoAdvice || ""}</p>
    </div>
  );
}

const BOND_LABELS: Record<string, string> = {
  "^TNX": "10년금리", "^FVX": "5년금리", "^IRX": "3개월금리",
  "TLT": "장기채ETF(20Y+)", "IEF": "중기채ETF(7-10Y)", "SHY": "단기채ETF(1-3Y)",
};
const COMM_LABELS: Record<string, string> = {
  "GC=F": "금", "SI=F": "은", "CL=F": "WTI원유",
  "NG=F": "천연가스", "HG=F": "구리(닥터코퍼)", "EURUSD=X": "유로/달러",
};

function TaggedStockCard({ symbols, labelMap }: {
  symbols: string[];
  labelMap: Record<string, string>;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <LiveStockCard symbols={symbols} />
      <div className="px-4 py-2.5 border-t border-border flex flex-wrap gap-x-5 gap-y-1">
        {symbols.map(sym => {
          const label = labelMap[sym];
          if (!label) return null;
          const code = sym.replace("^","").replace("=F","").replace("=X","").replace("-USD","");
          return (
            <span key={sym} className="text-[11px] text-muted-foreground">
              <span className="font-mono font-bold text-foreground/80">{code}</span>
              <span className="mx-1 opacity-40">—</span>
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function MarketTrends() {
  const { data: user } = useUser();
  const lang = user?.language || "ko";
  const t = translations[lang as keyof typeof translations];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full space-y-10">
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold">{t.market_trends}</h1>
        <p className="text-muted-foreground mt-2">{t.market_pulse}</p>
      </div>

      {/* RRG Chart — 최상단 */}
      <section>
        <h2 className="text-xl font-bold flex items-center gap-3 mb-2">
          <GitBranch className="w-6 h-6 text-indigo-500" />
          {lang === "ko" ? "글로벌 섹터 순환 (RRG)" : "Global Sector Rotation (RRG)"}
        </h2>
        <p className="text-muted-foreground text-sm mb-5">
          {lang === "ko"
            ? "미국·한국·일본·유럽 — 자금이 어느 섹터로 이동하는지 추적하세요"
            : "Track capital rotation across US, Korea, Japan & Europe"}
        </p>
        <RRGChart />
      </section>

      {/* Fear & Greed + US Indices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-orange-500" />
            {lang === "ko" ? "시장 심리" : "Market Sentiment"}
          </h2>
          <MarketMoodBadge lang={lang} />
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            🇺🇸 {lang === "ko" ? "미국 주요 지수" : "US Major Indices"}
          </h2>
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <LiveStockCard symbols={["SPY", "QQQ", "DIA", "IWM", "^VIX"]} />
          </div>
        </div>
      </div>

      {/* US Trending + KR + JP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-accent" />
            {lang === "ko" ? "🔥 미국 인기 종목" : "🔥 US Trending"}
          </h2>
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <LiveStockCard symbols={["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META"]} />
          </div>
        </section>
        <section>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <Flag className="w-5 h-5 text-rose-500" />
            🇰🇷 {lang === "ko" ? "한국 주요 종목" : "Korea"}
          </h2>
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <LiveStockCard symbols={["005930.KS", "000660.KS", "005380.KS", "035420.KS", "068270.KS"]} />
          </div>
        </section>
        <section>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <Flag className="w-5 h-5 text-red-600" />
            🇯🇵 {lang === "ko" ? "일본 주요 종목" : "Japan"}
          </h2>
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <LiveStockCard symbols={["7203.T", "6758.T", "9984.T", "8306.T", "4502.T"]} />
          </div>
        </section>
      </div>

      {/* Crypto */}
      <section>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
          <Bitcoin className="w-5 h-5 text-orange-400" />
          {lang === "ko" ? "₿ 암호화폐" : "₿ Cryptocurrencies"}
        </h2>
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <LiveStockCard symbols={["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD", "DOGE-USD"]} />
        </div>
      </section>

      {/* Bonds + Commodities side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <Landmark className="w-5 h-5 text-blue-500" />
            {lang === "ko" ? "📊 채권 & 금리" : "📊 Bonds & Rates"}
          </h2>
          <TaggedStockCard symbols={["^TNX","^FVX","^IRX","TLT","IEF","SHY"]} labelMap={BOND_LABELS} />
        </section>
        <section>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-yellow-500" />
            {lang === "ko" ? "🛢️ 원자재 & 외환" : "🛢️ Commodities & FX"}
          </h2>
          <TaggedStockCard symbols={["GC=F","SI=F","CL=F","NG=F","HG=F","EURUSD=X"]} labelMap={COMM_LABELS} />
        </section>
      </div>

      {/* European ADRs */}
      <section>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
          <Globe className="w-5 h-5 text-blue-500" />
          🇪🇺 {lang === "ko" ? "유럽 주요 종목 (ADR)" : "Europe (ADRs)"}
        </h2>
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <LiveStockCard symbols={["ASML", "SAP", "NVO", "BP", "SHEL", "AZN", "UL", "GSK"]} />
        </div>
      </section>

      {/* Global Macro Dashboard */}
      <section>
        <h2 className="text-xl font-bold flex items-center gap-3 mb-2">
          <Globe className="w-6 h-6 text-blue-500" />
          {lang === "ko" ? "글로벌 매크로 대시보드" : "Global Macro Dashboard"}
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          {lang === "ko"
            ? "선물, 원자재, 외환, 채권, 심리 지표 — 1분마다 갱신"
            : "Futures, commodities, forex, bonds & sentiment — updated every minute"}
        </p>
        <GlobalMacroDashboard />
      </section>

      <div className="bg-card/50 border border-border rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-lg mb-1">{t.dino_says}</p>
            <p className="text-muted-foreground">
              {lang === "ko"
                ? "각 자산의 의미를 알면 시장의 흐름이 보여요. 궁금한 건 챗봇에게 물어보세요 🦖"
                : "Understanding each asset unlocks market flows. Ask Dino anything 🦖"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
