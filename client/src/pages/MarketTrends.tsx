import { TrendingUp, BarChart3, Globe, GitBranch, Flag, Bitcoin, Landmark, Flame, DollarSign, BarChart } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { LiveStockCard } from "@/components/LiveStockCard";
import { GlobalMacroDashboard } from "@/components/GlobalMacroDashboard";
import { RRGChart } from "@/components/RRGChart";
import { useQuery } from "@tanstack/react-query";

function MarketMoodBadge({ lang }: { lang: string }) {
  const { data } = useQuery<any>({
    queryKey: ["/api/market/mood"],
    staleTime: 5 * 60 * 1000,
  });

  if (!data) return null;

  const idx = data.index ?? 50;
  const emoji = idx <= 25 ? "😱" : idx <= 40 ? "😰" : idx <= 60 ? "😐" : idx <= 75 ? "😊" : "🤑";
  const color = idx <= 25 ? "text-red-500 bg-red-500/10 border-red-500/30"
    : idx <= 40 ? "text-orange-500 bg-orange-500/10 border-orange-500/30"
    : idx <= 60 ? "text-yellow-500 bg-yellow-500/10 border-yellow-500/30"
    : idx <= 75 ? "text-green-500 bg-green-500/10 border-green-500/30"
    : "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";

  const barW = `${idx}%`;
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
        <div className="h-full rounded-full transition-all" style={{ width: barW, background: barColor }} />
      </div>
      <p className="text-xs mt-2.5 opacity-80 leading-relaxed">{data.dinoAdvice || ""}</p>
    </div>
  );
}

const BOND_INFO: Record<string, { ko: string; en: string; desc_ko: string; desc_en: string }> = {
  "^TNX": {
    ko: "미국 10년물 국채금리",
    en: "US 10Y Treasury Yield",
    desc_ko: "가장 중요한 기준 금리. 오르면 주식·부동산 압박, 내리면 성장주에 유리",
    desc_en: "The most watched rate. Rising = pressure on stocks & real estate",
  },
  "^FVX": {
    ko: "미국 5년물 국채금리",
    en: "US 5Y Treasury Yield",
    desc_ko: "중기 경기·인플레이션 기대를 반영. 10년물과 비교해 경기 방향 파악",
    desc_en: "Reflects medium-term inflation expectations vs 10Y",
  },
  "^IRX": {
    ko: "미국 3개월 단기금리",
    en: "US 3M T-Bill Yield",
    desc_ko: "연준 기준금리에 가장 민감. 10년물보다 높으면 '장단기 역전' = 경기침체 신호",
    desc_en: "Fed-sensitive. Higher than 10Y = inverted yield curve = recession signal",
  },
  "TLT": {
    ko: "장기국채 ETF (20년+)",
    en: "20+ Year Treasury ETF",
    desc_ko: "금리가 내리면 가격 오름. 안전자산 대피처로 활용, 금리와 반대로 움직임",
    desc_en: "Price rises when rates fall. Safe haven; moves opposite to yields",
  },
  "IEF": {
    ko: "중기국채 ETF (7-10년)",
    en: "7-10 Year Treasury ETF",
    desc_ko: "중기 채권 ETF. TLT보다 변동성 낮고 금리 변화에 덜 민감",
    desc_en: "Medium-term bonds. Less volatile than TLT",
  },
  "SHY": {
    ko: "단기국채 ETF (1-3년)",
    en: "1-3 Year Treasury ETF",
    desc_ko: "가장 안전한 채권 ETF. 금리 변화 영향 거의 없고 현금 대체 수단으로 사용",
    desc_en: "Safest bond ETF. Minimal rate sensitivity, used as cash alternative",
  },
};

const COMM_INFO: Record<string, { ko: string; en: string; desc_ko: string; desc_en: string }> = {
  "GC=F": {
    ko: "금 선물",
    en: "Gold Futures",
    desc_ko: "대표 안전자산. 달러 약세·인플레 우려 시 상승, 금리 오르면 하락 압박",
    desc_en: "Safe haven. Rises on weak dollar/inflation; falls when rates rise",
  },
  "SI=F": {
    ko: "은 선물",
    en: "Silver Futures",
    desc_ko: "금보다 변동성 큼. 산업재 수요(태양광·전자)도 반영해 경기 민감",
    desc_en: "More volatile than gold. Also tracks industrial demand (solar, electronics)",
  },
  "CL=F": {
    ko: "WTI 원유 선물",
    en: "WTI Crude Oil Futures",
    desc_ko: "미국 기준 원유. 오르면 인플레 압력, 소비재·항공·운송 업종 비용 상승",
    desc_en: "US benchmark oil. Rising = inflation pressure on airlines, transport",
  },
  "NG=F": {
    ko: "천연가스 선물",
    en: "Natural Gas Futures",
    desc_ko: "난방·발전용 에너지. 계절성 변동 크고 유럽 에너지 위기 때 급등한 바 있음",
    desc_en: "Heating & power fuel. Highly seasonal, surged during EU energy crisis",
  },
  "HG=F": {
    ko: "구리 선물 (닥터 코퍼)",
    en: "Copper Futures (Dr. Copper)",
    desc_ko: "'경기의사' 별명. 건설·전기·제조 핵심 소재로 경기 선행지표 역할",
    desc_en: "'Dr. Copper' — industrial bellwether. Leads global economic activity",
  },
  "EURUSD=X": {
    ko: "유로/달러 환율",
    en: "EUR/USD Exchange Rate",
    desc_ko: "세계 최대 거래쌍. 오르면 달러 약세(수출기업 유리), 내리면 달러 강세",
    desc_en: "World's most traded pair. Rising = weak dollar; falling = strong dollar",
  },
};

function DescribedStockCard({ symbols, infoMap, lang }: {
  symbols: string[];
  infoMap: Record<string, { ko: string; en: string; desc_ko: string; desc_en: string }>;
  lang: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <LiveStockCard symbols={symbols} />
      <div className="divide-y divide-border">
        {symbols.map(sym => {
          const info = infoMap[sym];
          if (!info) return null;
          return (
            <div key={sym} className="px-4 py-2.5 flex items-start gap-3">
              <span className="font-mono text-[11px] font-bold text-muted-foreground w-16 shrink-0 mt-0.5">
                {sym.replace("^", "").replace("=F", "").replace("=X", "")}
              </span>
              <div>
                <div className="text-[12px] font-semibold text-foreground">
                  {lang === "ko" ? info.ko : info.en}
                </div>
                <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  {lang === "ko" ? info.desc_ko : info.desc_en}
                </div>
              </div>
            </div>
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
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-display font-bold">{t.market_trends}</h1>
        <p className="text-muted-foreground mt-2">{t.market_pulse}</p>
      </div>

      {/* ── Fear & Greed + US Indices ── */}
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

      {/* ── US Trending + Sector ETFs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-accent" />
            {lang === "ko" ? "🔥 미국 인기 종목" : "🔥 US Trending Stocks"}
          </h2>
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <LiveStockCard symbols={["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META"]} />
          </div>
        </section>
        <section>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <BarChart className="w-5 h-5 text-indigo-500" />
            {lang === "ko" ? "🏭 미국 섹터 ETF" : "🏭 US Sector ETFs"}
          </h2>
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <LiveStockCard symbols={["XLK", "XLF", "XLE", "XLV", "XLI", "XLC"]} />
          </div>
        </section>
      </div>

      {/* ── Korean + Japanese ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <Flag className="w-5 h-5 text-rose-500" />
            🇰🇷 {lang === "ko" ? "한국 주요 종목" : "Korea Top Stocks"}
          </h2>
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <LiveStockCard symbols={["005930.KS", "000660.KS", "005380.KS", "035420.KS", "068270.KS"]} />
          </div>
        </section>
        <section>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <Flag className="w-5 h-5 text-red-600" />
            🇯🇵 {lang === "ko" ? "일본 주요 종목" : "Japan Top Stocks"}
          </h2>
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <LiveStockCard symbols={["7203.T", "6758.T", "9984.T", "8306.T", "4502.T"]} />
          </div>
        </section>
      </div>

      {/* ── Crypto ── */}
      <section>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
          <Bitcoin className="w-5 h-5 text-orange-400" />
          {lang === "ko" ? "₿ 암호화폐" : "₿ Cryptocurrencies"}
        </h2>
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <LiveStockCard symbols={["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD", "DOGE-USD"]} />
        </div>
      </section>

      {/* ── Bonds / Rates — WITH descriptions ── */}
      <section>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
          <Landmark className="w-5 h-5 text-blue-500" />
          {lang === "ko" ? "📊 채권 & 금리" : "📊 Bonds & Rates"}
        </h2>
        <p className="text-muted-foreground text-sm mb-4">
          {lang === "ko"
            ? "금리 방향이 주식·부동산·달러 모든 자산에 영향을 줍니다. 10년물이 가장 중요해요."
            : "Rate direction affects stocks, real estate, and the dollar. The 10Y yield is most critical."}
        </p>
        <DescribedStockCard
          symbols={["^TNX", "^FVX", "^IRX", "TLT", "IEF", "SHY"]}
          infoMap={BOND_INFO}
          lang={lang}
        />
      </section>

      {/* ── Commodities & FX — WITH descriptions ── */}
      <section>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
          <DollarSign className="w-5 h-5 text-yellow-500" />
          {lang === "ko" ? "🛢️ 원자재 & 외환" : "🛢️ Commodities & FX"}
        </h2>
        <p className="text-muted-foreground text-sm mb-4">
          {lang === "ko"
            ? "원자재 가격은 인플레이션과 경기 사이클의 핵심 신호입니다."
            : "Commodity prices are key signals for inflation and the economic cycle."}
        </p>
        <DescribedStockCard
          symbols={["GC=F", "SI=F", "CL=F", "NG=F", "HG=F", "EURUSD=X"]}
          infoMap={COMM_INFO}
          lang={lang}
        />
      </section>

      {/* ── European ADRs ── */}
      <section>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
          <Globe className="w-5 h-5 text-blue-500" />
          🇪🇺 {lang === "ko" ? "유럽 주요 종목 (미국상장 ADR)" : "Europe Top Stocks (US-listed ADRs)"}
        </h2>
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <LiveStockCard symbols={["ASML", "SAP", "NVO", "BP", "SHEL", "AZN", "UL", "GSK"]} />
        </div>
      </section>

      {/* ── RRG Chart ── */}
      <section>
        <h2 className="text-xl font-bold flex items-center gap-3 mb-2">
          <GitBranch className="w-6 h-6 text-indigo-500" />
          {lang === "ko" ? "글로벌 섹터 순환 (RRG)" : "Global Sector Rotation (RRG)"}
        </h2>
        <p className="text-muted-foreground text-sm mb-5">
          {lang === "ko"
            ? "미국·한국·일본·유럽 — 자금이 어느 섹터로 이동하는지 국가별로 추적하세요"
            : "US · Korea · Japan · Europe — track where capital rotates across markets worldwide"}
        </p>
        <RRGChart />
      </section>

      {/* ── Global Macro Dashboard ── */}
      <section>
        <h2 className="text-xl font-bold flex items-center gap-3 mb-2">
          <Globe className="w-6 h-6 text-blue-500" />
          {lang === "ko" ? "글로벌 매크로 대시보드" : "Global Macro Dashboard"}
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          {lang === "ko"
            ? "선물, 원자재, 외환, 채권, 심리 지표를 한눈에 — 1분마다 자동 갱신"
            : "Futures, commodities, forex, bonds & sentiment — all in one view, updated every minute"}
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
                ? "미국·한국·일본·유럽 시장을 한눈에! 채권금리·원자재·암호화폐까지 각 자산의 의미를 알면 시장의 흐름이 보여요. 공부하다 궁금한 건 챗봇에게 물어보세요 🦖"
                : "All markets in one place — know what each asset means and you'll start reading market flows. Ask Dino anything you're curious about 🦖"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
