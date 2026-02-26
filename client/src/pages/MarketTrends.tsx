import { TrendingUp, BarChart3, Globe, GitBranch } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";
import { LiveStockCard } from "@/components/LiveStockCard";
import { GlobalMacroDashboard } from "@/components/GlobalMacroDashboard";
import { RRGChart } from "@/components/RRGChart";

export default function MarketTrends() {
  const { data: user } = useUser();
  const lang = user?.language || "en";
  const t = translations[lang as keyof typeof translations];

  return (
    <div className="p-4 md:p-10 max-w-6xl mx-auto w-full">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-display font-bold">{t.market_trends}</h1>
        <p className="text-muted-foreground mt-2">{t.market_pulse}</p>
      </div>

      {/* RRG Chart — Energy Flow Summary */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold flex items-center gap-3 mb-2">
          <GitBranch className="w-6 h-6 text-indigo-500" />
          {lang === "ko" ? "섹터 에너지 흐름" : "Sector Energy Flow"}
        </h2>
        <p className="text-muted-foreground text-sm mb-5">
          {lang === "ko"
            ? "자금이 어떤 섹터에서 빠져나와 어디로 이동하는지 — 순환매 타이밍 포착"
            : "Where capital is rotating in and out — catch the rotation before it happens"
          }
        </p>
        <RRGChart />
      </section>

      {/* Major Indices + Trending Stocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <section>
          <h2 className="text-2xl font-bold flex items-center gap-3 mb-6">
            <BarChart3 className="w-6 h-6 text-primary" />
            {t.major_indices}
          </h2>
          <div className="bg-card border border-border rounded-3xl p-6 shadow-lg">
            <LiveStockCard symbols={["SPY", "QQQ", "DIA"]} />
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-accent" />
            {t.trending_stocks}
          </h2>
          <div className="bg-card border border-border rounded-3xl p-6 shadow-lg">
            <LiveStockCard symbols={["NVDA", "TSLA", "AAPL", "MSFT", "AMZN"]} />
          </div>
        </section>
      </div>

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
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-lg mb-1">{t.dino_says}</p>
            <p className="text-muted-foreground">
              {lang === "ko"
                ? "시장 지수는 전체 시장의 건강 상태를 보여줍니다. SPY는 S&P 500을, QQQ는 나스닥을, DIA는 다우존스를 추적합니다!"
                : "Market indices show the overall health of the market. SPY tracks the S&P 500, QQQ tracks Nasdaq, and DIA tracks the Dow Jones!"
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
