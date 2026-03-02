import { useQuery } from "@tanstack/react-query";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { useState, useCallback } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { getLocalizedCompanyName } from "@/lib/stockNames";
import { TrendingUp, RefreshCw, Info, X, ZoomIn, ZoomOut, Minimize2, TrendingDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Country = "us" | "kr" | "jp" | "eu";

interface RRGPoint  { rsRatio: number; rsMomentum: number; }
interface RRGSector {
  symbol: string;
  quadrant: "leading" | "weakening" | "lagging" | "improving";
  rsRatio: number;
  rsMomentum: number;
  tail: RRGPoint[];
}
interface RRGData {
  benchmark: string;
  country: string;
  sectors: RRGSector[];
  tailLength: number;
  fetchedAt: string;
}
interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

// ─── Country Configurations ───────────────────────────────────────────────────
interface SectorGroup {
  id: string;
  members: string[];
}

const COUNTRY_CONFIGS: Record<Country, {
  nameEn: string; nameKo: string; flag: string;
  descEn: string; descKo: string;
  sectorLabels: Record<string, { en: string; ko: string }>;
  sectorColors: Record<string, string>;
  top10: Record<string, string[]>;
  sectorGroups?: SectorGroup[];
}> = {
  us: {
    nameEn: "US (S&P 500)", nameKo: "미국 (S&P 500)", flag: "🇺🇸",
    descEn: "11 SPDR sector ETFs vs SPY benchmark",
    descKo: "11개 SPDR 섹터 ETF vs SPY 벤치마크",
    sectorLabels: {
      XLK:  { en: "Technology",      ko: "기술" },
      XLF:  { en: "Financials",      ko: "금융" },
      XLV:  { en: "Healthcare",      ko: "헬스케어" },
      XLE:  { en: "Energy",          ko: "에너지" },
      XLY:  { en: "Cons. Disc.",     ko: "임의소비재" },
      XLP:  { en: "Cons. Staples",   ko: "필수소비재" },
      XLI:  { en: "Industrials",     ko: "산업재" },
      XLB:  { en: "Materials",       ko: "소재" },
      XLRE: { en: "Real Estate",     ko: "리츠" },
      XLU:  { en: "Utilities",       ko: "유틸리티" },
      XLC:  { en: "Comm. Svcs",      ko: "통신" },
    },
    sectorColors: {
      XLK: "#6366f1", XLF: "#f59e0b", XLV: "#10b981", XLE: "#ef4444",
      XLY: "#8b5cf6", XLP: "#06b6d4", XLI: "#f97316", XLB: "#84cc16",
      XLRE: "#ec4899", XLU: "#14b8a6", XLC: "#a855f7",
    },
    top10: {
      XLK:  ["AAPL","MSFT","NVDA","AVGO","ORCL","CRM","AMD","QCOM","TXN","INTC"],
      XLF:  ["JPM","BAC","WFC","GS","MS","BLK","AXP","V","MA","COF"],
      XLV:  ["LLY","UNH","JNJ","ABT","TMO","ISRG","AMGN","PFE","MRK","DHR"],
      XLE:  ["XOM","CVX","COP","SLB","EOG","OXY","MPC","VLO","PSX","FANG"],
      XLY:  ["AMZN","TSLA","HD","MCD","NKE","LOW","SBUX","TJX","BKNG","CMG"],
      XLP:  ["WMT","KO","PG","COST","PM","CL","GIS","MDLZ","KHC","STZ"],
      XLI:  ["RTX","HON","UPS","DE","CAT","BA","GE","LMT","ITW","ETN"],
      XLB:  ["LIN","APD","FCX","ECL","SHW","NEM","PPG","NUE","VMC","MLM"],
      XLRE: ["AMT","PLD","CCI","EQIX","PSA","O","DLR","SPG","SBAC","WELL"],
      XLU:  ["NEE","DUK","SO","D","AEP","EXC","SRE","XEL","WEC","PCG"],
      XLC:  ["GOOGL","META","NFLX","DIS","CMCSA","T","VZ","CHTR","EA","TTWO"],
    },
  },
  kr: {
    nameEn: "Korea (KOSPI)", nameKo: "한국 (코스피)", flag: "🇰🇷",
    descEn: "8 KOSPI sectors vs KOSPI Index — sector rotation",
    descKo: "8개 코스피 섹터 vs 코스피 지수 — 섹터 순환",
    sectorGroups: [
      { id: "KR_SEMI",  members: ["005930.KS","000660.KS"] },
      { id: "KR_AUTO",  members: ["005380.KS"] },
      { id: "KR_BIO",   members: ["068270.KS"] },
      { id: "KR_FIN",   members: ["105560.KS"] },
      { id: "KR_CHEM",  members: ["051910.KS","373220.KS"] },
      { id: "KR_NET",   members: ["035420.KS"] },
      { id: "KR_STEEL", members: ["003670.KS"] },
      { id: "KR_TELE",  members: ["017670.KS"] },
    ],
    sectorLabels: {
      KR_SEMI:  { en: "Semiconductors",  ko: "반도체" },
      KR_AUTO:  { en: "Automotive",      ko: "자동차" },
      KR_BIO:   { en: "Bio/Pharma",      ko: "바이오/제약" },
      KR_FIN:   { en: "Finance",         ko: "금융" },
      KR_CHEM:  { en: "Chem/Battery",    ko: "화학/배터리" },
      KR_NET:   { en: "Internet",        ko: "인터넷" },
      KR_STEEL: { en: "Steel/Materials", ko: "철강/소재" },
      KR_TELE:  { en: "Telecom",         ko: "통신" },
    },
    sectorColors: {
      KR_SEMI:  "#6366f1", KR_AUTO:  "#f59e0b", KR_BIO:   "#10b981",
      KR_FIN:   "#f97316", KR_CHEM:  "#8b5cf6", KR_NET:   "#06b6d4",
      KR_STEEL: "#ef4444", KR_TELE:  "#a855f7",
    },
    top10: {
      KR_SEMI:  ["005930.KS","000660.KS","009150.KS","018260.KS","066570.KS","034730.KS","293490.KQ","086520.KS","247540.KS","006400.KS"],
      KR_AUTO:  ["005380.KS","000270.KS","012330.KS","004170.KS","096770.KS","007070.KS","011390.KS","003620.KS","006490.KS","094280.KS"],
      KR_BIO:   ["068270.KS","207940.KS","128940.KS","302440.KS","326030.KS","105940.KS","145020.KS","131970.KS","009290.KS","000100.KS"],
      KR_FIN:   ["105560.KS","055550.KS","086790.KS","138930.KS","003550.KS","316140.KS","032830.KS","029780.KS","023360.KS","006860.KS"],
      KR_CHEM:  ["051910.KS","373220.KS","006400.KS","247540.KS","086520.KS","011170.KS","010950.KS","011790.KS","003670.KS","004020.KS"],
      KR_NET:   ["035420.KS","035720.KS","259960.KS","036570.KS","293490.KQ","041510.KQ","122870.KQ","263750.KQ","352820.KS","018260.KS"],
      KR_STEEL: ["003670.KS","004020.KS","010120.KS","001040.KS","006120.KS","047050.KS","003490.KS","011780.KS","020560.KS","000660.KS"],
      KR_TELE:  ["017670.KS","030200.KS","066570.KS","018260.KS","034730.KS","003550.KS","009150.KS","005930.KS","035420.KS","032640.KS"],
    },
  },
  jp: {
    nameEn: "Japan (Nikkei 225)", nameKo: "일본 (닛케이 225)", flag: "🇯🇵",
    descEn: "8 Nikkei sectors vs N225 benchmark — sector rotation",
    descKo: "8개 닛케이 섹터 vs N225 지수 — 섹터 순환",
    sectorGroups: [
      { id: "JP_AUTO",   members: ["7203.T"] },
      { id: "JP_ELEC",   members: ["6758.T","6501.T"] },
      { id: "JP_FIN",    members: ["8306.T"] },
      { id: "JP_PHARM",  members: ["4502.T"] },
      { id: "JP_IT",     members: ["9984.T"] },
      { id: "JP_RETAIL", members: ["3382.T"] },
      { id: "JP_RE",     members: ["8802.T"] },
      { id: "JP_UTIL",   members: ["9501.T","4661.T"] },
    ],
    sectorLabels: {
      JP_AUTO:   { en: "Automotive",     ko: "자동차" },
      JP_ELEC:   { en: "Electronics",    ko: "전자/기술" },
      JP_FIN:    { en: "Finance",        ko: "금융" },
      JP_PHARM:  { en: "Pharma",         ko: "제약" },
      JP_IT:     { en: "IT/Tech",        ko: "IT/기술" },
      JP_RETAIL: { en: "Retail",         ko: "유통" },
      JP_RE:     { en: "Real Estate",    ko: "부동산" },
      JP_UTIL:   { en: "Utility/Leisure",ko: "유틸/레저" },
    },
    sectorColors: {
      JP_AUTO:   "#ef4444", JP_ELEC:   "#6366f1", JP_FIN:    "#f59e0b",
      JP_PHARM:  "#10b981", JP_IT:     "#8b5cf6", JP_RETAIL: "#06b6d4",
      JP_RE:     "#84cc16", JP_UTIL:   "#14b8a6",
    },
    top10: {
      JP_AUTO:   ["7203.T","7267.T","7270.T","7201.T","7211.T","7269.T","6902.T","7261.T","7272.T","6954.T"],
      JP_ELEC:   ["6758.T","6501.T","6752.T","7751.T","6701.T","6702.T","6764.T","6762.T","6861.T","6971.T"],
      JP_FIN:    ["8306.T","8316.T","8411.T","8354.T","8601.T","8604.T","8766.T","8630.T","8750.T","8795.T"],
      JP_PHARM:  ["4502.T","4503.T","4568.T","4519.T","4523.T","4507.T","4506.T","4516.T","4151.T","4204.T"],
      JP_IT:     ["9984.T","4689.T","3659.T","4755.T","3632.T","7974.T","9602.T","4765.T","4307.T","9613.T"],
      JP_RETAIL: ["3382.T","8267.T","8028.T","8200.T","3099.T","3086.T","3048.T","2651.T","2689.T","8233.T"],
      JP_RE:     ["8802.T","8801.T","8804.T","8830.T","1925.T","1928.T","5214.T","1801.T","1812.T","3003.T"],
      JP_UTIL:   ["9501.T","4661.T","9502.T","9503.T","9513.T","9531.T","9022.T","9020.T","9021.T","9044.T"],
    },
  },
  eu: {
    nameEn: "Europe (STOXX 600)", nameKo: "유럽 (STOXX 600)", flag: "🇪🇺",
    descEn: "Country ETFs vs VGK (Vanguard Europe ETF) — country rotation",
    descKo: "유럽 국가별 ETF vs VGK 벤치마크 — 국가 순환",
    sectorLabels: {
      EWG:  { en: "Germany",     ko: "독일" },
      EWQ:  { en: "France",      ko: "프랑스" },
      EWI:  { en: "Italy",       ko: "이탈리아" },
      EWP:  { en: "Spain",       ko: "스페인" },
      EWN:  { en: "Netherlands", ko: "네덜란드" },
      EWL:  { en: "Switzerland", ko: "스위스" },
      EWU:  { en: "UK",          ko: "영국" },
      EWD:  { en: "Sweden",      ko: "스웨덴" },
      EWO:  { en: "Austria",     ko: "오스트리아" },
      ENOR: { en: "Norway",      ko: "노르웨이" },
    },
    sectorColors: {
      EWG: "#ef4444", EWQ: "#6366f1", EWI: "#10b981", EWP: "#f59e0b",
      EWN: "#f97316", EWL: "#8b5cf6", EWU: "#06b6d4", EWD: "#84cc16",
      EWO: "#ec4899", ENOR: "#14b8a6",
    },
    top10: {
      EWG:  ["SAP","SIE.DE","ALV.DE","BAS.DE","MBG.DE","BMW.DE","IFX.DE","DTE.DE","DHL.DE","ADS.DE"],
      EWQ:  ["MC.PA","TTE.PA","SAN.PA","BNP.PA","AI.PA","ACA.PA","ORA.PA","EL.PA","KER.PA","CS.PA"],
      EWI:  ["ENI.MI","ENEL.MI","ISP.MI","UCG.MI","LDO.MI","PRY.MI","A2A.MI","TIT.MI","AMP.MI","ATL.MI"],
      EWP:  ["SAN.MC","BBVA.MC","IBE.MC","REP.MC","AMS.MC","ITX.MC","FER.MC","TEF.MC","MEL.MC","GRF.MC"],
      EWN:  ["ASML","NN.AS","PHIA.AS","HEIA.AS","ING.AS","RAND.AS","ABN.AS","WKL.AS","KPN.AS","MT.AS"],
      EWL:  ["NESN.SW","ROG.SW","NOVN.SW","UHR.SW","ABBN.SW","ZURN.SW","SREN.SW","LONN.SW","CFR.SW","GIVN.SW"],
      EWU:  ["SHEL","AZN","HSBA.L","BP","RIO","GSK","LLOY.L","VOD.L","DGE.L","ULVR.L"],
      EWD:  ["ERIC-B.ST","VOLV-B.ST","SAND.ST","ABB.ST","AZN.ST","HM-B.ST","SWMA.ST","NIBE-B.ST","ALIV-SDB.ST","INVE-B.ST"],
      EWO:  ["VER.VI","OMV.VI","ERST.VI","RHI.VI","ANDR.VI","VAS.VI","BRU.VI","EVN.VI","ATS.VI","ATX.VI"],
      ENOR: ["EQNR.OL","DNB.OL","TEL.OL","MOWI.OL","DNO.OL","AKER.OL","SALM.OL","STB.OL","NRC.OL","SUBC.OL"],
    },
  },
};

// ─── Shared Constants ─────────────────────────────────────────────────────────
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

// ─── Sector Aggregation ────────────────────────────────────────────────────────
function getQuadrant(rsRatio: number, rsMomentum: number): RRGSector["quadrant"] {
  if (rsRatio >= 100 && rsMomentum >= 100) return "leading";
  if (rsRatio >= 100 && rsMomentum < 100)  return "weakening";
  if (rsRatio < 100  && rsMomentum < 100)  return "lagging";
  return "improving";
}

function aggregateSectors(rawSectors: RRGSector[], sectorGroups: SectorGroup[]): RRGSector[] {
  const result: RRGSector[] = [];
  for (const group of sectorGroups) {
    const members = rawSectors.filter(s => group.members.includes(s.symbol));
    if (members.length === 0) continue;
    const avgRsRatio = members.reduce((sum, m) => sum + m.rsRatio, 0) / members.length;
    const avgRsMomentum = members.reduce((sum, m) => sum + m.rsMomentum, 0) / members.length;
    const minTailLen = Math.min(...members.map(m => m.tail?.length ?? 0));
    const avgTail: RRGPoint[] = Array.from({ length: minTailLen }, (_, i) => ({
      rsRatio:    members.reduce((s, m) => s + (m.tail[i]?.rsRatio ?? 100), 0) / members.length,
      rsMomentum: members.reduce((s, m) => s + (m.tail[i]?.rsMomentum ?? 100), 0) / members.length,
    }));
    result.push({
      symbol:     group.id,
      rsRatio:    avgRsRatio,
      rsMomentum: avgRsMomentum,
      quadrant:   getQuadrant(avgRsRatio, avgRsMomentum),
      tail:       avgTail,
    });
  }
  return result;
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload || payload.isTail) return null;
  const color = payload._color || "#6366f1";
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
  return (
    <g>
      <text x={cx} y={cy - 16} textAnchor="middle" fontSize={9} fontWeight={600}
        fill={payload._color || "#6366f1"} opacity={0.9}
      >
        {payload._shortLabel || payload.symbol}
      </text>
    </g>
  );
}

function CustomTooltip({ active, payload, lang, country, onSelect }: {
  active?: boolean; payload?: any[]; lang: string; country: Country;
  onSelect: (d: RRGSector) => void;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d || d.isTail) return null;
  const q = QUADRANT_CONFIG[d.quadrant as keyof typeof QUADRANT_CONFIG];
  if (!q) return null;
  const cfg = COUNTRY_CONFIGS[country];
  const label = cfg.sectorLabels[d.symbol];
  const flow = FLOW_DESCRIPTION[d.quadrant];
  return (
    <div className="bg-popover border border-border rounded-2xl shadow-2xl p-4 max-w-[240px] cursor-pointer select-none"
      onClick={() => onSelect(d)} data-testid={`rrg-tooltip-${d.symbol}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d._color }} />
        <span className="font-bold text-sm">{d.symbol}</span>
        {label && <span className="text-xs text-muted-foreground">{lang === "ko" ? label.ko : label.en}</span>}
      </div>
      <div className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full mb-2"
        style={{ background: q.bg, color: q.color, border: `1px solid ${q.border}` }}
      >
        {lang === "ko" ? `현재: ${q.labelKo}` : `Status: ${q.label}`}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-2">
        {lang === "ko" ? flow?.ko : flow?.en}
      </p>
      <div className="grid grid-cols-2 gap-1 text-xs">
        <div className="text-muted-foreground">RS-Ratio</div>
        <div className="font-mono font-semibold text-right">{d.rsRatio?.toFixed(2)}</div>
        <div className="text-muted-foreground">RS-Momentum</div>
        <div className="font-mono font-semibold text-right">{d.rsMomentum?.toFixed(2)}</div>
      </div>
      <p className="text-[10px] text-primary mt-2 text-center opacity-70">
        {lang === "ko" ? "탭하여 자세히 보기" : "Tap for details"}
      </p>
    </div>
  );
}

// Top 10 companies sub-component with live prices
function SectorTop10({ tickers, lang, sectorName }: { tickers: string[]; lang: string; sectorName: string }) {
  const symbolsStr = tickers.join(",");

  const { data, isLoading } = useQuery<{ quotes: StockQuote[] }>({
    queryKey: ["/api/stocks/live", symbolsStr],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/live?symbols=${encodeURIComponent(symbolsStr)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    },
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="space-y-1.5 mt-2">
        {tickers.slice(0, 5).map((_, i) => (
          <div key={i} className="h-8 bg-background/40 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  const quotes = data?.quotes ?? [];

  return (
    <div className="mt-2 space-y-0.5">
      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-2">
        {lang === "ko" ? `${sectorName} 주요 종목` : `Top ${sectorName} Holdings`}
      </p>
      {tickers.map((ticker, i) => {
        const q = quotes.find(x => x.symbol === ticker);
        return (
          <div key={ticker}
            className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-background/60 hover:bg-background/90 transition-colors"
            data-testid={`rrg-top10-${ticker}-${i}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-muted-foreground font-mono w-4 shrink-0">{i + 1}</span>
              <span className="font-mono text-xs font-bold truncate">{ticker}</span>
              {q?.name && (
                <span className="text-[10px] text-muted-foreground truncate hidden sm:block max-w-[120px]">
                  {getLocalizedCompanyName(
                    q.name.replace(/ (Inc\.|Corp\.|plc|Ltd\.?|Co\.|Holdings|Group|AG|SA|SE).*$/i, ""),
                    lang
                  )}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {q && q.price > 0 ? (
                <>
                  <span className="font-mono text-xs font-semibold">${q.price.toFixed(2)}</span>
                  <span className={cn("text-[10px] font-bold flex items-center gap-0.5",
                    q.changePercent >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {q.changePercent >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {Math.abs(q.changePercent).toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="text-[10px] text-muted-foreground">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function RRGChart() {
  const { data: user } = useUser();
  const lang = user?.language || "en";
  const [country, setCountry] = useState<Country>("us");
  const [selected, setSelected] = useState<RRGSector | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showTop10, setShowTop10] = useState(false);

  const { data, isLoading, error, refetch, isRefetching } = useQuery<RRGData>({
    queryKey: ["/api/rrg/data", country],
    queryFn: async () => {
      const res = await fetch(`/api/rrg/data?country=${country}`, { credentials: "include" });
      if (!res.ok) throw new Error("RRG fetch failed");
      return res.json();
    },
    staleTime: 1000 * 60 * 4,
    refetchInterval: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: 2,
  });

  const handleCountryChange = useCallback((c: Country) => {
    setCountry(c);
    setSelected(null);
    setShowTop10(false);
  }, []);

  const handleSectorSelect = useCallback((d: RRGSector) => {
    setSelected(d);
    setShowTop10(false);
  }, []);

  const cfg = COUNTRY_CONFIGS[country];

  // ── Loading / Error states ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6 animate-pulse" data-testid="rrg-loading">
        <div className="flex gap-2 mb-4">
          {(["us","kr","jp","eu"] as Country[]).map(c => (
            <div key={c} className="h-8 w-20 bg-muted rounded-full" />
          ))}
        </div>
        <div className="h-6 bg-muted rounded w-48 mb-4" />
        <div className="h-80 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (error || !data || data.sectors.length === 0) {
    return (
      <div className="bg-card border border-border rounded-3xl p-6" data-testid="rrg-error">
        {/* Country tabs still visible on error */}
        <CountryTabs country={country} onChange={handleCountryChange} lang={lang} />
        <div className="text-center space-y-3 mt-6">
          <TrendingUp className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">
            {lang === "ko"
              ? "RRG 데이터를 불러오는 중 오류가 발생했습니다. 해외 시장 데이터는 시간이 걸릴 수 있습니다."
              : "Could not load RRG data. Cross-market data may take a moment to compute."}
          </p>
          <button onClick={() => refetch()}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            data-testid="button-retry-rrg"
          >
            <RefreshCw className="w-3 h-3" />
            {lang === "ko" ? "다시 시도" : "Retry"}
          </button>
        </div>
      </div>
    );
  }

  // ── Data preparation ─────────────────────────────────────────────────────
  const displaySectors: RRGSector[] = cfg.sectorGroups
    ? aggregateSectors(data.sectors, cfg.sectorGroups)
    : data.sectors;

  const scatterData = displaySectors.map(s => ({
    ...s,
    x: s.rsRatio,
    y: s.rsMomentum,
    _color: cfg.sectorColors[s.symbol] || "#6366f1",
    _shortLabel: s.symbol.replace(/^(KR|JP)_/, ""),
  }));

  const allX = displaySectors.map(s => s.rsRatio);
  const allY = displaySectors.map(s => s.rsMomentum);
  const xPad = Math.max(Math.abs(Math.min(...allX) - 100), Math.abs(Math.max(...allX) - 100), 1.5) + 1;
  const yPad = Math.max(Math.abs(Math.min(...allY) - 100), Math.abs(Math.max(...allY) - 100), 1.5) + 1;
  const xMin = Math.round((100 - xPad) * 10) / 10;
  const xMax = Math.round((100 + xPad) * 10) / 10;
  const yMin = Math.round((100 - yPad) * 10) / 10;
  const yMax = Math.round((100 + yPad) * 10) / 10;

  const quadrantCounts = { leading: 0, weakening: 0, lagging: 0, improving: 0 };
  for (const s of displaySectors) quadrantCounts[s.quadrant]++;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-card border border-border rounded-3xl overflow-hidden" data-testid="rrg-chart">

      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-border/60">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-white" />
              </span>
              {lang === "ko" ? "섹터 순환 그래프 (RRG)" : "Relative Rotation Graph (RRG)"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lang === "ko" ? cfg.descKo : cfg.descEn}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setShowInfo(!showInfo)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              data-testid="button-rrg-info" aria-label="Info"
            >
              <Info className="w-4 h-4" />
            </button>
            <button onClick={() => refetch()} disabled={isRefetching}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              data-testid="button-rrg-refresh" aria-label="Refresh"
            >
              <RefreshCw className={cn("w-4 h-4", isRefetching && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Country tabs */}
        <CountryTabs country={country} onChange={handleCountryChange} lang={lang} />

        {showInfo && (
          <div className="mt-3 bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed">
            {lang === "ko"
              ? "RRG는 각 섹터의 상대적 강도(RS-Ratio)와 모멘텀(RS-Momentum)을 시각화합니다. 우상단(Leading) 섹터가 현재 시장을 주도하며, 꼬리(Trail)는 최근 이동 경로입니다. 시계 방향 순환: 회복 → 주도 → 약화 → 침체. 핀치/휠로 확대하거나 드래그해서 이동하세요."
              : "RRG plots RS-Ratio (outperformance) on X and RS-Momentum (rate of change) on Y. Tails show recent movement. Sectors typically rotate clockwise: Improving → Leading → Weakening → Lagging. Pinch/scroll to zoom, drag to pan."}
          </div>
        )}
      </div>

      {/* Quadrant legend pills */}
      <div className="flex gap-2 px-5 py-2.5 flex-wrap border-b border-border/40">
        {(Object.entries(QUADRANT_CONFIG) as [string, typeof QUADRANT_CONFIG["leading"]][]).map(([key, q]) => (
          <div key={key}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: q.bg, color: q.color, border: `1px solid ${q.border}` }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: q.color }} />
            {lang === "ko" ? q.labelKo : q.label}
            <span className="opacity-60 font-normal">({quadrantCounts[key as keyof typeof quadrantCounts]})</span>
          </div>
        ))}
        <div className="ml-auto text-[10px] text-muted-foreground self-center hidden sm:block">
          {lang === "ko" ? `업데이트: ${data.fetchedAt.slice(11, 16)}` : `Updated: ${data.fetchedAt.slice(11, 16)}`}
        </div>
      </div>

      {/* Chart with Zoom/Pan */}
      <div className="relative" style={{ height: 420 }}>
        <TransformWrapper
          initialScale={1}
          minScale={0.6}
          maxScale={4}
          wheel={{ step: 0.08 }}
          pinch={{ step: 5 }}
          doubleClick={{ disabled: false }}
          centerOnInit
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* Zoom controls */}
              <div className="absolute top-2 right-2 z-30 flex flex-col gap-1">
                <button onClick={() => zoomIn()}
                  className="w-7 h-7 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  data-testid="button-rrg-zoom-in" aria-label="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => zoomOut()}
                  className="w-7 h-7 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  data-testid="button-rrg-zoom-out" aria-label="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => resetTransform()}
                  className="w-7 h-7 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  data-testid="button-rrg-reset-zoom" aria-label="Reset zoom"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Hint for zoom */}
              <div className="absolute bottom-2 right-2 z-20 text-[9px] text-muted-foreground/50 pointer-events-none hidden sm:block">
                {lang === "ko" ? "스크롤/핀치로 확대" : "Scroll or pinch to zoom"}
              </div>

              <TransformComponent
                wrapperStyle={{ width: "100%", height: "420px", overflow: "hidden" }}
                contentStyle={{ width: "100%", height: "420px" }}
              >
                <div style={{ width: "100%", height: 420, position: "relative" }}>
                  {/* Quadrant bg labels */}
                  <div className="absolute inset-0 pointer-events-none z-10" style={{ top: 20, left: 42, right: 50, bottom: 32 }}>
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
                    <ScatterChart margin={{ top: 20, right: 50, bottom: 20, left: 18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                      <ReferenceLine x={100} stroke="rgba(128,128,128,0.35)" strokeWidth={1.5} strokeDasharray="6 4" />
                      <ReferenceLine y={100} stroke="rgba(128,128,128,0.35)" strokeWidth={1.5} strokeDasharray="6 4" />

                      <XAxis type="number" dataKey="x" domain={[xMin, xMax]} tickCount={7}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false} axisLine={false}
                        label={{ value: lang === "ko" ? "← RS-비율 →" : "← RS-Ratio →", position: "insideBottom", offset: -8, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis type="number" dataKey="y" domain={[yMin, yMax]} tickCount={7}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false} axisLine={false}
                        label={{ value: lang === "ko" ? "RS-모멘텀" : "RS-Momentum", angle: -90, position: "insideLeft", offset: 12, fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      />

                      <Tooltip
                        content={(props) => (
                          <CustomTooltip active={props.active} payload={props.payload}
                            lang={lang} country={country} onSelect={handleSectorSelect}
                          />
                        )}
                        cursor={{ strokeDasharray: "3 3", stroke: "rgba(128,128,128,0.25)" }}
                      />

                      {/* Tail lines */}
                      {displaySectors.map(sector => {
                        if (!sector.tail || sector.tail.length < 2) return null;
                        const color = cfg.sectorColors[sector.symbol] || "#6366f1";
                        const tailPoints = sector.tail.slice(0, -1).map((p, i, arr) => ({
                          x: p.rsRatio, y: p.rsMomentum,
                          opacity: 0.15 + (i / arr.length) * 0.55,
                          symbol: sector.symbol, isTail: true,
                          _color: color,
                        }));
                        return (
                          <Scatter key={`tail-${sector.symbol}`} data={tailPoints} fill={color}
                            line={{ stroke: color, strokeWidth: 1.5, strokeOpacity: 0.35, strokeDasharray: "2 2" }}
                            lineType="joint"
                            shape={((shapeProps: any) => {
                              const { cx, cy, payload } = shapeProps;
                              if (!payload) return null;
                              return <circle cx={cx} cy={cy} r={2.5} fill={color} opacity={payload.opacity ?? 0.3} style={{ pointerEvents: "none" }} />;
                            }) as any}
                            isAnimationActive={false}
                          />
                        );
                      })}

                      {/* Current position dots */}
                      <Scatter data={scatterData} shape={<CustomDot />} label={<SectorLabel />}
                        onClick={(d: any) => handleSectorSelect(d)} style={{ cursor: "pointer" }}
                      >
                        {scatterData.map(entry => (
                          <Cell key={entry.symbol} fill={cfg.sectorColors[entry.symbol] || "#6366f1"} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>

      {/* Sector legend chips */}
      <div className="px-5 pb-4 pt-2 flex flex-wrap gap-2">
        {displaySectors.map(s => {
          const label = cfg.sectorLabels[s.symbol];
          const color = cfg.sectorColors[s.symbol] || "#6366f1";
          const q = QUADRANT_CONFIG[s.quadrant];
          const isSelected = selected?.symbol === s.symbol;
          const shortId = s.symbol.replace(/^(KR|JP)_/, "");
          return (
            <button key={s.symbol} onClick={() => setSelected(isSelected ? null : s)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all",
                isSelected ? "border-foreground/40 bg-muted shadow-sm scale-105" : "border-border bg-card hover:border-foreground/20 hover:bg-muted/50"
              )}
              data-testid={`rrg-sector-${s.symbol}`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="font-semibold">{s.symbol.includes(".") ? s.symbol.split(".")[0] : shortId}</span>
              {label && <span className="text-muted-foreground hidden sm:inline">{lang === "ko" ? label.ko : label.en}</span>}
              <span className="font-bold" style={{ color: q.color }}>·</span>
            </button>
          );
        })}
      </div>

      {/* Selected sector detail panel */}
      {selected && (() => {
        const q = QUADRANT_CONFIG[selected.quadrant];
        const flow = FLOW_DESCRIPTION[selected.quadrant];
        const label = cfg.sectorLabels[selected.symbol];
        const top10Tickers = cfg.top10[selected.symbol] ?? [];
        const sectorName = label ? (lang === "ko" ? label.ko : label.en) : selected.symbol;

        return (
          <div className="mx-5 mb-5 rounded-2xl border overflow-hidden"
            style={{ background: q.bg, borderColor: q.border }}
            data-testid={`rrg-detail-${selected.symbol}`}
          >
            {/* Panel header */}
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: cfg.sectorColors[selected.symbol] }} />
                  <span className="font-bold">
                    {label ? (lang === "ko" ? label.ko : label.en) : selected.symbol.replace(/^(KR|JP)_/, "")}
                  </span>
                  {label && <span className="text-xs text-muted-foreground">{selected.symbol.replace(/^(KR|JP)_/, "")}</span>}
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full mb-2"
                  style={{ background: "white", color: q.color, border: `1px solid ${q.border}` }}
                >
                  {lang === "ko" ? `현재 상태: ${q.labelKo}` : `Current Status: ${q.label}`}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: q.color }}>
                  {lang === "ko" ? flow.ko : flow.en}
                </p>
              </div>
              {/* CLOSE BUTTON — large and visible on mobile */}
              <button
                onClick={() => { setSelected(null); setShowTop10(false); }}
                className="flex items-center justify-center w-9 h-9 rounded-xl border-2 bg-background/80 text-foreground hover:bg-background shadow-sm transition-all shrink-0 touch-manipulation"
                style={{ borderColor: q.border }}
                data-testid="button-rrg-close-detail"
                aria-label={lang === "ko" ? "닫기" : "Close"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* RS stats grid */}
            <div className="grid grid-cols-2 gap-3 px-4 pb-3">
              <div className="bg-background/70 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">RS-Ratio</p>
                <p className="font-mono font-bold text-lg">{selected.rsRatio.toFixed(3)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {selected.rsRatio >= 100 ? (lang === "ko" ? "▲ 벤치마크 상회" : "▲ Outperforming") : (lang === "ko" ? "▼ 벤치마크 하회" : "▼ Underperforming")}
                </p>
              </div>
              <div className="bg-background/70 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">RS-Momentum</p>
                <p className="font-mono font-bold text-lg">{selected.rsMomentum.toFixed(3)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {selected.rsMomentum >= 100 ? (lang === "ko" ? "▲ 모멘텀 상승" : "▲ Momentum rising") : (lang === "ko" ? "▼ 모멘텀 둔화" : "▼ Momentum falling")}
                </p>
              </div>
            </div>

            {/* Top 10 companies toggle */}
            {top10Tickers.length > 0 && (
              <div className="px-4 pb-4">
                <button
                  onClick={() => setShowTop10(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-background/60 hover:bg-background/90 border border-border/50 transition-all text-sm font-semibold"
                  data-testid="button-rrg-toggle-top10"
                >
                  <span>
                    {lang === "ko"
                      ? `${sectorName} 주요 기업 TOP 10`
                      : `Top 10 Companies in ${sectorName}`}
                  </span>
                  <span className="text-muted-foreground text-xs">{showTop10 ? "▲" : "▼"}</span>
                </button>
                {showTop10 && (
                  <div className="mt-2">
                    <SectorTop10 tickers={top10Tickers} lang={lang} sectorName={sectorName} />
                  </div>
                )}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground text-center pb-3">
              {lang === "ko"
                ? `꼬리(Trail)는 최근 ${data.tailLength}일간의 이동 경로`
                : `Trail shows the last ${data.tailLength} days of rotation`}
            </p>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Country Tabs sub-component ───────────────────────────────────────────────
function CountryTabs({ country, onChange, lang }: {
  country: Country; onChange: (c: Country) => void; lang: string;
}) {
  const tabs: { id: Country; flag: string; en: string; ko: string }[] = [
    { id: "us", flag: "🇺🇸", en: "US",      ko: "미국" },
    { id: "kr", flag: "🇰🇷", en: "Korea",   ko: "한국" },
    { id: "jp", flag: "🇯🇵", en: "Japan",   ko: "일본" },
    { id: "eu", flag: "🇪🇺", en: "Europe",  ko: "유럽" },
  ];
  return (
    <div className="flex gap-1.5 flex-wrap" role="tablist" aria-label="Country selector">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={country === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
            country === tab.id
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-muted/50 text-muted-foreground border-border hover:border-foreground/20 hover:bg-muted"
          )}
          data-testid={`rrg-tab-${tab.id}`}
        >
          <span>{tab.flag}</span>
          <span>{lang === "ko" ? tab.ko : tab.en}</span>
        </button>
      ))}
    </div>
  );
}
