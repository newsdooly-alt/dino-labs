import { TrendingUp, BarChart3, Globe, GitBranch, Flag } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { LiveStockCard } from "@/components/LiveStockCard";
import { GlobalMacroDashboard } from "@/components/GlobalMacroDashboard";
import { RRGChart } from "@/components/RRGChart";

export default function MarketTrends() {
  const { data: user } = useUser();
  const lang = user?.language || "ko";
  const t = translations[lang as keyof typeof translations];

  return (
    <div className="p-4 md:p-10 max-w-6xl mx-auto w-full">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-display font-bold">{t.market_trends}</h1>
        <p className="text-muted-foreground mt-2">{t.market_pulse}</p>
      </div>

      {/* RRG Chart — multi-country */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold flex items-center gap-3 mb-2">
          <GitBranch className="w-6 h-6 text-indigo-500" />
          {lang === "ko" ? "글로벌 섹터 순환 (RRG)" : "Global Sector Rotation (RRG)"}
        </h2>
        <p className="text-muted-foreground text-sm mb-5">
          {lang === "ko"
            ? "미국·한국·일본·유럽 — 자금이 어느 섹터로 이동하는지 국가별로 추적하세요"
            : "US · Korea · Japan · Europe — track where capital rotates across markets worldwide"
          }
        </p>
        <RRGChart />
      </section>

      {/* US Indices + Trending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <section>
          <h2 className="text-2xl font-bold flex items-center gap-3 mb-6">
            <BarChart3 className="w-6 h-6 text-primary" />
            🇺🇸 {lang === "ko" ? "미국 주요 지수" : "US Major Indices"}
          </h2>
          <div className="bg-card border border-border rounded-3xl p-6 shadow-lg">
            <LiveStockCard symbols={["SPY", "QQQ", "DIA", "IWM"]} />
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-accent" />
            {lang === "ko" ? "🔥 미국 인기 종목" : "🔥 US Trending Stocks"}
          </h2>
          <div className="bg-card border border-border rounded-3xl p-6 shadow-lg">
            <LiveStockCard symbols={["NVDA", "TSLA", "AAPL", "MSFT", "AMZN"]} />
          </div>
        </section>
      </div>

      {/* Korean Market */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <section>
          <h2 className="text-xl font-bold flex items-center gap-3 mb-6">
            <Flag className="w-5 h-5 text-rose-500" />
            🇰🇷 {lang === "ko" ? "한국 주요 종목" : "Korea Top Stocks"}
          </h2>
          <div className="bg-card border border-border rounded-3xl p-6 shadow-lg">
            <LiveStockCard symbols={["005930.KS", "000660.KS", "005380.KS", "035420.KS", "068270.KS"]} />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold flex items-center gap-3 mb-6">
            <Flag className="w-5 h-5 text-red-600" />
            🇯🇵 {lang === "ko" ? "일본 주요 종목" : "Japan Top Stocks"}
          </h2>
          <div className="bg-card border border-border rounded-3xl p-6 shadow-lg">
            <LiveStockCard symbols={["7203.T", "6758.T", "9984.T", "8306.T", "4502.T"]} />
          </div>
        </section>
      </div>

      {/* European Market */}
      <section className="mb-8">
        <h2 className="text-xl font-bold flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-blue-500" />
          🇪🇺 {lang === "ko" ? "유럽 주요 종목 (ADR/US상장)" : "Europe Top Stocks (US-listed ADRs)"}
        </h2>
        <p className="text-muted-foreground text-sm mb-5">
          {lang === "ko"
            ? "미국 거래소에 상장된 유럽 대표 기업들 — ASML, SAP, NVO, BP, SHEL, AZN 등"
            : "Major European companies listed on US exchanges — ASML, SAP, NVO, BP, SHEL, AZN and more"
          }
        </p>
        <div className="bg-card border border-border rounded-3xl p-6 shadow-lg">
          <LiveStockCard symbols={["ASML", "SAP", "NVO", "BP", "SHEL", "AZN", "UL", "GSK"]} />
        </div>
      </section>

      {/* Global Macro Dashboard */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-3 mb-2">
          <Globe className="w-6 h-6 text-blue-500" />
          {lang === "ko" ? "글로벌 매크로 대시보드" : "Global Macro Dashboard"}
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          {lang === "ko"
            ? "선물, 원자재, 외환, 채권, 심리 지표를 한눈에 — 1분마다 자동 갱신"
            : "Futures, commodities, forex, bonds & sentiment — all in one view, updated every minute"
          }
        </p>
        <GlobalMacroDashboard />
      </section>

      <div className="mt-4 bg-card/50 border border-border rounded-3xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-lg mb-1">{t.dino_says}</p>
            <p className="text-muted-foreground">
              {lang === "ko"
                ? "이제 미국·한국·일본·유럽 시장을 한눈에! RRG 차트에서 국가를 바꿔가며 어느 섹터로 자금이 흐르는지 확인해보세요. 핀치(모바일)나 스크롤(PC)로 차트를 확대할 수 있어요."
                : "Now covering US, Korea, Japan & Europe all in one place! Switch countries on the RRG chart to see where capital is flowing. Pinch on mobile or scroll on PC to zoom into the chart."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
