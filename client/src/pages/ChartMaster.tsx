import { useState } from "react";
import { X, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronRight } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { translations } from "@/lib/translations";

type Lang = "en" | "ko" | "ja";
type PatternType = "bullish" | "bearish" | "neutral";

interface PatternText {
  title: string;
  shortDesc: string;
  definition: string;
  why: string;
  strategy: string;
}

interface Pattern {
  id: string;
  type: PatternType;
  svg: React.ReactNode;
  en: PatternText;
  ko: PatternText;
  ja: PatternText;
}

// ─── Mini SVG icons ────────────────────────────────────────────────────────────
function HeadShouldersSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <polyline points="0,52 18,22 28,40 58,6 88,40 102,26 120,52" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="24" y1="40" x2="94" y2="40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/>
      <circle cx="58" cy="6" r="3" fill="currentColor" opacity="0.7"/>
    </svg>
  );
}
function InverseHSSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <polyline points="0,12 18,42 28,24 58,58 88,24 102,38 120,12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="24" y1="24" x2="94" y2="24" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/>
      <circle cx="58" cy="58" r="3" fill="currentColor" opacity="0.7"/>
    </svg>
  );
}
function DoubleTopSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <polyline points="0,54 28,10 56,36 84,10 120,54" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="10" y1="10" x2="110" y2="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/>
    </svg>
  );
}
function DoubleBottomSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <polyline points="0,10 28,54 56,28 84,54 120,10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="10" y1="54" x2="110" y2="54" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/>
    </svg>
  );
}
function CupHandleSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <path d="M0,14 Q30,58 60,58 Q90,58 90,14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <polyline points="90,14 100,22 108,16 120,8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="0" y1="14" x2="90" y2="14" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.4"/>
    </svg>
  );
}
function BullFlagSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <polyline points="4,58 36,10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <polyline points="36,10 56,18 76,26 96,18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="36,22 56,30 76,38 96,30" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
      <polyline points="96,18 120,4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}
function BearFlagSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <polyline points="4,6 36,54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <polyline points="36,54 56,46 76,38 96,46" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="36,42 56,34 76,26 96,34" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
      <polyline points="96,46 120,60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}
function AscendingTriangleSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <line x1="0" y1="14" x2="104" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <polyline points="0,54 24,44 48,34 72,24 96,14 120,4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3"/>
      <polyline points="0,54 104,14 120,4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"/>
    </svg>
  );
}
function DescendingTriangleSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <line x1="0" y1="50" x2="104" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <polyline points="0,10 24,20 48,30 72,40 96,50 120,60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3"/>
      <polyline points="0,10 104,50 120,60" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"/>
    </svg>
  );
}
function GoldenCrossSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <polyline points="0,46 40,42 70,20 120,8" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="0,54 40,50 70,36 120,16" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3"/>
      <circle cx="62" cy="30" r="4" fill="#22c55e" opacity="0.9"/>
      <text x="68" y="26" fontSize="8" fill="#22c55e" fontWeight="bold">✕</text>
    </svg>
  );
}
function DeathCrossSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <polyline points="0,18 40,22 70,44 120,56" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="0,10 40,14 70,28 120,46" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3"/>
      <circle cx="62" cy="34" r="4" fill="#ef4444" opacity="0.9"/>
    </svg>
  );
}
function BollingerSqueezeSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <polyline points="0,8 30,18 55,28 65,32 75,28 90,18 120,6" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 2"/>
      <polyline points="0,56 30,46 55,36 65,32 75,36 90,46 120,58" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 2"/>
      <polyline points="0,32 30,32 55,32 65,32 75,32 90,30 108,14 120,6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function RisingWedgeSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <polyline points="0,50 30,32 60,22 90,16 108,14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <polyline points="0,58 30,46 60,38 90,32 108,30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 3"/>
      <polyline points="108,22 120,54" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="108" cy="22" r="3" fill="currentColor" opacity="0.6"/>
    </svg>
  );
}
function FallingWedgeSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <polyline points="0,14 30,28 60,36 90,44 108,48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <polyline points="0,6 30,16 60,22 90,28 108,32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 3"/>
      <polyline points="108,40 120,10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="108" cy="40" r="3" fill="currentColor" opacity="0.6"/>
    </svg>
  );
}
function RoundingBottomSVG() {
  return (
    <svg viewBox="0 0 120 64" className="w-full h-full">
      <path d="M0,12 Q60,62 120,12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <polyline points="104,26 120,12 120,10" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.3"/>
    </svg>
  );
}

// ─── Pattern data ──────────────────────────────────────────────────────────────
const PATTERNS: Pattern[] = [
  {
    id: "head-shoulders",
    type: "bearish",
    svg: <HeadShouldersSVG />,
    en: {
      title: "Head & Shoulders",
      shortDesc: "A three-peak reversal pattern signaling the end of an uptrend.",
      definition: "The Head & Shoulders pattern consists of three peaks: a higher middle peak (the 'Head') flanked by two lower peaks (the 'Shoulders'). A 'neckline' connects the two troughs between the peaks. A confirmed break below the neckline signals a trend reversal from bullish to bearish.",
      why: "The left shoulder forms as optimistic buyers push prices up, but selling pressure emerges. The head forms when bulls make one final attempt at a new high—but sellers absorb every bid. The right shoulder reveals exhaustion: bulls can no longer reach even the previous high, signaling that institutional 'smart money' has rotated out. The neckline break triggers algorithmic stop-losses and confirms distribution is complete.",
      strategy: "**Entry**: Short (sell) on a confirmed close below the neckline, or on a retest of the neckline from below.\n**Target**: Measure the distance from the head to the neckline and project that distance downward from the break point.\n**Stop-Loss**: Place just above the right shoulder. If price reclaims the right shoulder, the pattern is invalidated.",
    },
    ko: {
      title: "헤드앤숄더 (Head & Shoulders)",
      shortDesc: "상승 추세의 끝을 알리는 세 개의 봉우리로 구성된 반전 패턴.",
      definition: "헤드앤숄더 패턴은 세 개의 고점으로 구성됩니다. 가운데 더 높은 고점(헤드)과 양쪽의 낮은 두 고점(숄더). 두 저점을 연결하는 선이 '넥라인'이며, 넥라인 하방 이탈이 확인되면 상승→하락 추세 전환을 의미합니다.",
      why: "왼쪽 숄더는 낙관적인 매수세가 밀어올리지만 매도 압력이 등장합니다. 헤드는 강세론자들의 마지막 시도로 새로운 고점을 만들지만 매도 물량에 막힙니다. 오른쪽 숄더에서는 강세론자들이 이전 고점도 넘지 못하며 '스마트머니(기관)의 매도 완료'를 시사합니다. 넥라인 이탈 시 알고리즘 손절매가 연쇄 실행되어 하락을 가속합니다.",
      strategy: "**진입**: 넥라인 하방 종가 이탈 확인 후 공매도, 또는 넥라인 재테스트(아래에서 반등 실패) 시.\n**목표가**: 헤드에서 넥라인까지의 거리를 이탈 지점에서 하방으로 같은 크기만큼 설정.\n**손절(Stop-Loss)**: 오른쪽 숄더 고점 바로 위. 가격이 숄더를 회복하면 패턴 무효.",
    },
    ja: {
      title: "ヘッドアンドショルダー",
      shortDesc: "上昇トレンドの終焉を示す3つの山で構成される反転パターン。",
      definition: "ヘッドアンドショルダーパターンは3つのピークで構成されます。中央の高いピーク（ヘッド）と両側の低い2つのピーク（ショルダー）。2つの谷を結ぶ線がネックラインで、これを下抜けると上昇から下降へのトレンド転換を示します。",
      why: "左肩は楽観的な買い圧力で形成されますが売りが出現します。頭部は強気筋の最後の試みで新高値を付けますが売りに阻まれます。右肩では強気筋が前の高値にも届かず、機関投資家の売り抜け完了を示唆します。ネックライン割れで連鎖的な損切りが発動し下落が加速します。",
      strategy: "**エントリー**: ネックライン下抜け確認後の売り、またはネックラインの再テスト時。\n**目標**: ヘッドからネックラインまでの距離を下方に投影。\n**損切り**: 右肩の高値のすぐ上。",
    },
  },
  {
    id: "inverse-head-shoulders",
    type: "bullish",
    svg: <InverseHSSVG />,
    en: {
      title: "Inverse Head & Shoulders",
      shortDesc: "A three-trough reversal pattern marking the end of a downtrend.",
      definition: "The mirror image of Head & Shoulders, formed at the bottom of a downtrend. Three troughs appear: a lower middle trough (Head) and two higher troughs on each side (Shoulders). A break above the neckline confirms the bullish reversal.",
      why: "As prices fall, sellers become increasingly exhausted. The head forms when panic selling reaches a climax and smart money begins accumulating quietly. The right shoulder's higher low signals that sellers are no longer dominant—each wave of selling attracts more buyers. The neckline breakout triggers momentum algorithms and signals the shift from accumulation to markup phase.",
      strategy: "**Entry**: Buy on a confirmed close above the neckline, or on a pullback to the neckline after the break.\n**Target**: Project the distance from the head to the neckline upward from the breakout point.\n**Stop-Loss**: Below the right shoulder low. A break below invalidates the pattern.",
    },
    ko: {
      title: "역 헤드앤숄더 (Inverse H&S)",
      shortDesc: "하락 추세의 끝을 알리는 세 개의 저점으로 구성된 반전 패턴.",
      definition: "헤드앤숄더의 역형태로 하락 추세 말미에 형성됩니다. 세 개의 저점: 가운데 더 낮은 저점(헤드)과 양쪽의 높은 저점(숄더). 넥라인 상방 돌파가 확인되면 하락→상승 전환을 의미합니다.",
      why: "하락이 지속되며 매도세가 소진됩니다. 헤드에서 패닉 셀링이 절정에 달하고 스마트머니가 조용히 매수를 시작합니다. 오른쪽 숄더의 더 높은 저점은 매도세가 더 이상 지배적이지 않음을 보여줍니다. 넥라인 돌파는 누적(Accumulation) 단계에서 상승(Markup) 단계로의 전환을 선언합니다.",
      strategy: "**진입**: 넥라인 상방 종가 돌파 후 매수, 또는 돌파 이후 넥라인 되돌림(풀백) 시.\n**목표가**: 헤드에서 넥라인까지의 거리를 돌파 지점에서 상방으로 설정.\n**손절**: 오른쪽 숄더 저점 아래.",
    },
    ja: {
      title: "逆ヘッドアンドショルダー",
      shortDesc: "下降トレンドの終焉を示す3つの谷で構成される反転パターン。",
      definition: "ヘッドアンドショルダーの逆形で下降トレンドの底で形成されます。3つの谷: 中央の低い谷（ヘッド）と両側の高い谷（ショルダー）。ネックラインを上抜けると強気転換を示します。",
      why: "売り圧力が弱まり、ヘッドでパニック売りが頂点に達し、スマートマネーが静かに買い集め始めます。右肩の高い安値は売り方優位の終わりを示します。ネックライン突破は蓄積フェーズからマークアップフェーズへの転換を宣言します。",
      strategy: "**エントリー**: ネックライン上抜け確認後の買い、または突破後のネックラインへの引き戻し時。\n**目標**: ヘッドからネックラインまでの距離を上方に投影。\n**損切り**: 右肩の安値の下。",
    },
  },
  {
    id: "double-top",
    type: "bearish",
    svg: <DoubleTopSVG />,
    en: {
      title: "Double Top",
      shortDesc: "Two equal highs at resistance — a classic bearish reversal signal.",
      definition: "The Double Top forms when price reaches the same resistance level twice and fails to break through. The two peaks are roughly equal in height, separated by a moderate pullback. Confirmed by a break below the valley between the two peaks (the 'neckline').",
      why: "The first peak represents strong buying followed by profit-taking. As sellers emerge at the same level on the second attempt, it reveals a supply zone where institutional sellers consistently offload positions. The market psychologically 'remembers' where it was rejected before. A break of the valley confirms that demand has been fully exhausted at this level.",
      strategy: "**Entry**: Short on a close below the valley (neckline) between the two tops.\n**Target**: Measure the height of the pattern (peak to valley) and subtract from the breakdown point.\n**Stop-Loss**: Just above the second peak. The pattern fails if a new high is made.",
    },
    ko: {
      title: "이중 천장 (Double Top)",
      shortDesc: "저항선에서 두 번 막히는 고전적인 하락 반전 신호.",
      definition: "가격이 같은 저항 수준에 두 번 도달하지만 돌파에 실패할 때 형성됩니다. 두 고점의 높이는 거의 동일하며, 중간에 적당한 되돌림이 있습니다. 두 고점 사이의 저점(넥라인) 하방 이탈로 확인됩니다.",
      why: "첫 번째 고점은 강한 매수 후 차익 실현입니다. 두 번째 시도에서 같은 가격대에 다시 매도세가 등장하면, 그 수준에서 기관이 지속적으로 매물을 내놓는 공급 구간임을 드러냅니다. 시장은 이전에 거부당했던 가격을 '기억'합니다. 저점 이탈은 매수세가 완전히 소진됐음을 확인합니다.",
      strategy: "**진입**: 두 고점 사이 저점(넥라인) 하방 종가 이탈 시 공매도.\n**목표가**: 패턴 높이(고점→저점)를 이탈 지점에서 하방으로 설정.\n**손절**: 두 번째 고점 바로 위. 신고가 발생 시 패턴 무효.",
    },
    ja: {
      title: "ダブルトップ",
      shortDesc: "抵抗線で2回跳ね返される古典的な弱気反転シグナル。",
      definition: "価格が同じ抵抗レベルに2回到達するが突破できない時に形成されます。2つのピークは概ね同じ高さで、中間に適度な押し目があります。2つのピーク間の谷（ネックライン）を下抜けると確認されます。",
      why: "最初のピークは強い買いの後の利益確定です。同じ水準で再び売りが出ると、機関投資家が継続的に売り出す供給ゾーンの存在を示します。谷の下抜けは需要の完全な枯渇を確認します。",
      strategy: "**エントリー**: ネックライン下抜け確認後の売り。\n**目標**: パターンの高さをブレイクダウン地点から下方に投影。\n**損切り**: 第2ピークのすぐ上。",
    },
  },
  {
    id: "double-bottom",
    type: "bullish",
    svg: <DoubleBottomSVG />,
    en: {
      title: "Double Bottom",
      shortDesc: "Two equal lows at support — a reliable bullish reversal pattern.",
      definition: "The opposite of Double Top. Price finds support at the same level twice and bounces. Two roughly equal troughs separated by a recovery rally. Confirmed when price breaks above the peak between the two bottoms.",
      why: "The first trough attracts bargain hunters and long-term value investors. At the second test of the same level, the fact that sellers cannot push lower demonstrates demand absorption. Each bounce proves buyers are 'defending' the support level with increasing conviction. The breakout above the middle peak signals that supply has been fully absorbed and a new uptrend begins.",
      strategy: "**Entry**: Buy on a confirmed close above the middle peak (neckline).\n**Target**: Add the pattern height (trough to middle peak) above the breakout level.\n**Stop-Loss**: Just below the second bottom. A new low invalidates the pattern.",
    },
    ko: {
      title: "이중 바닥 (Double Bottom)",
      shortDesc: "지지선에서 두 번 반등하는 신뢰할 수 있는 상승 반전 패턴.",
      definition: "이중 천장의 반대 형태. 가격이 같은 지지 수준에서 두 번 반등합니다. 두 저점의 높이가 거의 같고 중간에 반등이 있습니다. 두 바닥 사이 고점(넥라인) 상방 돌파로 확인됩니다.",
      why: "첫 번째 저점에서 저가 매수자와 가치 투자자들이 유입됩니다. 두 번째 테스트에서 같은 수준 아래로 내려가지 못한다는 것은 매수 흡수력을 보여줍니다. 매번 반등은 매수자들이 지지선을 더욱 강한 확신으로 '방어'함을 증명합니다. 넥라인 돌파는 매물 소화 완료와 새로운 상승 추세의 시작을 알립니다.",
      strategy: "**진입**: 두 바닥 사이 고점(넥라인) 상방 종가 돌파 시 매수.\n**목표가**: 패턴 높이(저점→넥라인)를 돌파 지점에서 상방으로 설정.\n**손절**: 두 번째 저점 바로 아래. 신저가 발생 시 패턴 무효.",
    },
    ja: {
      title: "ダブルボトム",
      shortDesc: "サポートで2回跳ね返される信頼性の高い強気反転パターン。",
      definition: "ダブルトップの逆形。価格が同じサポートレベルで2回反発します。概ね等しい2つの谷と中間の反発ラリー。2つの底の間のピークを上抜けると確認されます。",
      why: "最初の谷でバーゲンハンターや長期投資家が買いを入れます。2回目のテストで下抜けできないことは需要の吸収力を示します。ネックライン突破は供給の完全な吸収と新たな上昇トレンドの開始を示します。",
      strategy: "**エントリー**: ネックライン上抜け確認後の買い。\n**目標**: パターンの高さをブレイクアウト地点から上方に投影。\n**損切り**: 第2底のすぐ下。",
    },
  },
  {
    id: "cup-handle",
    type: "bullish",
    svg: <CupHandleSVG />,
    en: {
      title: "Cup and Handle",
      shortDesc: "A U-shaped consolidation followed by a small pullback before a major breakout.",
      definition: "The Cup and Handle is a bullish continuation pattern. A rounded bottom (the 'Cup') forms over weeks or months, followed by a smaller, shallower pullback (the 'Handle'). A breakout above the cup's rim on high volume confirms the pattern.",
      why: "The cup represents a long period of base-building where weak holders are gradually replaced by strong, patient investors. The handle is a final shakeout—a brief pullback that scares away last-minute sellers and reduces overhead supply. When institutional investors recognize the base is complete, they step in aggressively on the breakout, driving volume and price sharply higher.",
      strategy: "**Entry**: Buy on a high-volume breakout above the cup's rim (the resistance formed at the top of the cup).\n**Target**: Add the depth of the cup to the breakout point.\n**Stop-Loss**: Below the handle's low. The longer and more rounded the cup, the more powerful the eventual breakout.",
    },
    ko: {
      title: "컵앤핸들 (Cup & Handle)",
      shortDesc: "U자형 바닥 형성 후 작은 되돌림, 이후 강한 상방 돌파.",
      definition: "상승 추세 지속 패턴. 둥근 바닥(컵)이 수주~수개월에 걸쳐 형성되고, 이후 작고 얕은 되돌림(핸들)이 나타납니다. 컵 상단 저항선(림)을 고거래량으로 돌파하면 패턴이 확인됩니다.",
      why: "컵은 약한 매수자들이 인내심 강한 투자자로 서서히 교체되는 바닥 다지기 기간을 나타냅니다. 핸들은 마지막 흔들기(Shakeout) — 남은 단기 투자자를 털어내어 오버헤드 매물을 줄입니다. 기관 투자자들이 바닥 완성을 인식하고 돌파 시 강하게 매수에 나서며 거래량과 주가를 급등시킵니다.",
      strategy: "**진입**: 컵 상단 저항선(림) 고거래량 돌파 시 매수.\n**목표가**: 컵의 깊이를 돌파 지점에서 상방으로 설정.\n**손절**: 핸들의 저점 아래. 컵이 길고 둥글수록 돌파의 폭발력이 강합니다.",
    },
    ja: {
      title: "カップアンドハンドル",
      shortDesc: "U字型底固めの後、小さな押し目を経て大きなブレイクアウト。",
      definition: "強気の継続パターン。丸い底（カップ）が数週間〜数ヶ月かけて形成され、その後小さく浅い押し目（ハンドル）が現れます。カップの縁を高出来高で上抜けると確認されます。",
      why: "カップは弱い保有者が忍耐強い投資家に徐々に入れ替わるベース形成期間を表します。ハンドルは最後の振るい落とし。機関投資家がベース完成を認識し積極的に買い上げます。",
      strategy: "**エントリー**: カップの縁を高出来高でブレイクアウト時の買い。\n**目標**: カップの深さをブレイクアウト地点から上方に投影。\n**損切り**: ハンドルの安値の下。",
    },
  },
  {
    id: "bull-flag",
    type: "bullish",
    svg: <BullFlagSVG />,
    en: {
      title: "Bull Flag",
      shortDesc: "A sharp rally followed by a tight parallel pullback — continuation of the uptrend.",
      definition: "A bull flag consists of a near-vertical price surge (the 'pole') followed by a brief, orderly pullback within parallel trendlines (the 'flag'). The flag typically retraces 30–50% of the pole. A breakout above the upper flag boundary signals continuation.",
      why: "The pole represents a surge of new buyers overwhelming sellers. The flag is a controlled consolidation where short-term profit-takers exit but new buyers are not yet aggressive. Crucially, volume dries up during the flag — sellers are not motivated. When volume returns on the breakout, it confirms fresh institutional demand is entering, targeting the 'measured move' of another pole-length gain.",
      strategy: "**Entry**: Buy on a breakout above the upper flag trendline on increasing volume.\n**Target**: Add the pole's length to the flag's breakout point (measured move).\n**Stop-Loss**: Below the lower flag boundary. Tight stop = high reward-to-risk ratio.",
    },
    ko: {
      title: "상승 깃발 (Bull Flag)",
      shortDesc: "급등(폴) 이후 좁은 박스권 조정 — 상승 추세의 지속 패턴.",
      definition: "수직에 가까운 급등(폴)에 이어 평행 추세선 안에서 질서 있는 조정(깃발)이 나타납니다. 깃발은 폴 길이의 30~50% 정도 되돌립니다. 깃발 상단 돌파 시 상승 지속을 알립니다.",
      why: "폴은 매수세가 매도세를 압도한 급등 구간입니다. 깃발에서는 단기 차익 실현자들이 빠져나가지만 새로운 매수자들은 아직 적극적이지 않습니다. 핵심은 깃발 구간에서 거래량이 감소한다는 것 — 매도자들이 동기를 잃은 상태입니다. 돌파 시 거래량이 되살아나면 기관의 신규 매수 유입을 확인하며 폴 길이만큼 추가 상승(Measured Move)을 목표합니다.",
      strategy: "**진입**: 깃발 상단 추세선을 거래량 증가와 함께 돌파 시 매수.\n**목표가**: 폴 길이를 깃발 돌파 지점에서 상방으로 설정(Measured Move).\n**손절**: 깃발 하단 추세선 아래. 좁은 손절 = 높은 손익비.",
    },
    ja: {
      title: "ブルフラッグ",
      shortDesc: "急騰（ポール）の後、狭いレンジの押し目 — 上昇トレンドの継続パターン。",
      definition: "ほぼ垂直の急騰（ポール）に続き、平行トレンドライン内での短い押し目（フラッグ）が現れます。フラッグはポールの30〜50%程度を押し戻します。上のフラッグラインを上抜けると継続シグナルです。",
      why: "ポールは買い方が売り方を圧倒した急騰です。フラッグでは短期利益確定者が出ますが新規買いはまだ積極的でありません。出来高が減少することが重要で、突破時に出来高が戻れば機関の新規参入を確認します。",
      strategy: "**エントリー**: フラッグ上限を出来高増加で突破時の買い。\n**目標**: ポールの長さをブレイクアウト地点から上方に投影。\n**損切り**: フラッグ下限の下。",
    },
  },
  {
    id: "bear-flag",
    type: "bearish",
    svg: <BearFlagSVG />,
    en: {
      title: "Bear Flag",
      shortDesc: "A sharp drop followed by a brief parallel bounce — continuation of the downtrend.",
      definition: "The bearish mirror of the Bull Flag. A sharp price drop (pole) is followed by a brief, low-volume rally within parallel trendlines (flag). A breakdown below the lower flag boundary confirms the downtrend continuation.",
      why: "The pole represents panic selling overwhelming buyers. The flag is a 'dead cat bounce' — weak buyers hoping for a recovery while institutional sellers use the bounce to unload more inventory. Volume declining during the flag shows lack of genuine buying conviction. The breakdown triggers stop-losses of those who bought the bounce, amplifying the next leg down.",
      strategy: "**Entry**: Short on a close below the lower flag trendline.\n**Target**: Subtract the pole's length from the flag's breakdown point.\n**Stop-Loss**: Above the upper flag boundary. Low risk for a high potential reward on the downside.",
    },
    ko: {
      title: "하락 깃발 (Bear Flag)",
      shortDesc: "급락(폴) 이후 소폭 반등 조정 — 하락 추세의 지속 패턴.",
      definition: "상승 깃발의 반대 형태. 급락(폴) 이후 평행 추세선 안에서 저거래량 소폭 반등(깃발)이 나타납니다. 깃발 하단 이탈 시 하락 추세 지속을 확인합니다.",
      why: "폴은 패닉 매도가 매수세를 압도한 구간입니다. 깃발은 '데드 캣 바운스' — 반등을 기대하는 약한 매수자들이 들어오지만, 기관 매도자들은 이 반등을 이용해 추가 물량을 소화합니다. 깃발 구간의 거래량 감소는 진정한 매수 의지가 없음을 보여줍니다. 이탈 시 반등 매수자들의 손절매가 연쇄 실행되어 추가 하락을 심화시킵니다.",
      strategy: "**진입**: 깃발 하단 추세선 하방 종가 이탈 시 공매도.\n**목표가**: 폴 길이를 이탈 지점에서 하방으로 설정.\n**손절**: 깃발 상단 추세선 위.",
    },
    ja: {
      title: "ベアフラッグ",
      shortDesc: "急落（ポール）の後、短い反発 — 下降トレンドの継続パターン。",
      definition: "ブルフラッグの弱気版。急落（ポール）に続き、平行トレンドライン内での低出来高の短期反発（フラッグ）が現れます。下のフラッグラインを下抜けると下降継続を確認します。",
      why: "ポールはパニック売りが買いを圧倒した区間です。フラッグは「デッドキャットバウンス」で、機関の売り手はこの反発を使って追加の在庫を処分します。フラッグ下限の突破で反発買いの損切りが連鎖します。",
      strategy: "**エントリー**: フラッグ下限を下抜けた確認後の売り。\n**目標**: ポールの長さをブレイクダウン地点から下方に投影。\n**損切り**: フラッグ上限の上。",
    },
  },
  {
    id: "ascending-triangle",
    type: "bullish",
    svg: <AscendingTriangleSVG />,
    en: {
      title: "Ascending Triangle",
      shortDesc: "Flat resistance with rising lows — bulls are accumulating pressure for an upside breakout.",
      definition: "An ascending triangle has a flat upper resistance line and a rising lower trendline. Each swing low is higher than the last, compressing price toward the resistance. The expected breakout is to the upside, confirmed by a close above the flat resistance with volume.",
      why: "Buyers are becoming increasingly aggressive — each time price pulls back, buyers step in at a higher level. Meanwhile, sellers are holding firm at the same resistance. The rising lows reflect growing demand and conviction. Eventually, the buying pressure overwhelms the sellers, and the breakout occurs. This is a textbook accumulation pattern used by patient institutional buyers.",
      strategy: "**Entry**: Buy on a high-volume breakout above the flat resistance line.\n**Target**: Add the height of the widest part of the triangle to the breakout point.\n**Stop-Loss**: Below the last swing low before the breakout.",
    },
    ko: {
      title: "상승 삼각형 (Ascending Triangle)",
      shortDesc: "수평 저항과 상승하는 저점 — 상방 돌파를 준비하는 매수 압력 집중.",
      definition: "수평의 저항선과 우상향하는 지지선으로 구성됩니다. 매번 되돌림 저점이 이전보다 높아지며 가격이 저항선으로 압축됩니다. 거래량을 동반한 저항선 상방 이탈이 예상됩니다.",
      why: "매수자들이 점점 더 공격적이 됩니다 — 되돌림마다 더 높은 가격에서 매수가 들어옵니다. 반면 매도자들은 같은 저항 수준을 지킵니다. 상승하는 저점은 수요와 확신의 증가를 반영합니다. 결국 매수 압력이 매도세를 압도하고 돌파가 발생합니다. 기관의 인내심 있는 매집 패턴의 교과서적 형태입니다.",
      strategy: "**진입**: 수평 저항선 고거래량 상방 돌파 시 매수.\n**목표가**: 삼각형의 가장 넓은 부분 높이를 돌파 지점에서 상방으로 설정.\n**손절**: 돌파 직전 마지막 저점 아래.",
    },
    ja: {
      title: "アセンディングトライアングル",
      shortDesc: "水平抵抗と上昇する安値 — 上方ブレイクアウトに向けた買い圧力の蓄積。",
      definition: "水平の上限抵抗線と上昇する下限トレンドラインで構成されます。押し目の安値が毎回切り上がり、価格が抵抗線に向かって圧縮されます。出来高を伴う上限突破で確認されます。",
      why: "買い方がますます積極的になります。押し目のたびに高い水準で買いが入ります。上昇する安値は需要と確信の高まりを反映します。最終的に買い圧力が売りを圧倒してブレイクアウトが起きます。",
      strategy: "**エントリー**: 水平抵抗線を高出来高で上抜け時の買い。\n**目標**: 三角形の最大幅をブレイクアウト地点から上方に投影。\n**損切り**: ブレイクアウト直前の最後の安値の下。",
    },
  },
  {
    id: "descending-triangle",
    type: "bearish",
    svg: <DescendingTriangleSVG />,
    en: {
      title: "Descending Triangle",
      shortDesc: "Flat support with falling highs — sellers dominate, breakdown likely.",
      definition: "Mirror of ascending triangle. A flat lower support line with a falling upper trendline. Each swing high is lower than the last, compressing price toward support. The expected breakdown is downward, confirmed by a close below the flat support.",
      why: "Sellers are becoming increasingly aggressive — each rally fails at a lower level, showing weakening demand. Meanwhile, a specific support level absorbs selling pressure temporarily. The falling highs reveal distribution: smart money is systematically selling into every rally. When the support finally gives way, trapped longs panic-sell and the drop accelerates rapidly.",
      strategy: "**Entry**: Short on a close below the flat support line with volume confirmation.\n**Target**: Subtract the triangle height from the breakdown point.\n**Stop-Loss**: Above the last swing high before the breakdown.",
    },
    ko: {
      title: "하강 삼각형 (Descending Triangle)",
      shortDesc: "수평 지지와 하락하는 고점 — 매도세 지배, 하방 이탈 가능성 높음.",
      definition: "상승 삼각형의 반대. 수평 지지선과 우하향하는 저항선으로 구성됩니다. 매번 반등 고점이 낮아지며 가격이 지지선으로 압축됩니다. 지지선 하방 이탈이 예상됩니다.",
      why: "매도자들이 점점 더 공격적입니다 — 매번 반등이 더 낮은 수준에서 막히며 수요 약화를 보여줍니다. 반면 특정 지지선이 일시적으로 매도 압력을 흡수합니다. 하락하는 고점은 분산(Distribution) — 스마트머니가 매번 반등에 물량을 처분합니다. 지지선이 뚫리면 매도 포지션에 물린 매수자들의 패닉 셀링이 하락을 가속합니다.",
      strategy: "**진입**: 수평 지지선 거래량 동반 하방 이탈 시 공매도.\n**목표가**: 삼각형 높이를 이탈 지점에서 하방으로 설정.\n**손절**: 이탈 직전 마지막 고점 위.",
    },
    ja: {
      title: "ディセンディングトライアングル",
      shortDesc: "水平サポートと下落する高値 — 売り方優勢、下方ブレイクの可能性大。",
      definition: "アセンディングトライアングルの逆形。水平の下限サポートラインと下降する上限トレンドライン。戻り高値が毎回切り下がり、価格がサポートに圧縮されます。",
      why: "売り方がますます積極的で、戻りが低い水準で止まり需要の弱さを示します。下落する高値は分散を示し、スマートマネーが戻りごとに売り抜けます。サポート割れで踏まれた買い方のパニック売りが下落を加速します。",
      strategy: "**エントリー**: 水平サポートを出来高で下抜け確認後の売り。\n**目標**: 三角形の高さをブレイクダウン地点から下方に投影。\n**損切り**: ブレイクダウン直前の最後の高値の上。",
    },
  },
  {
    id: "golden-cross",
    type: "bullish",
    svg: <GoldenCrossSVG />,
    en: {
      title: "Golden Cross",
      shortDesc: "50-day MA crosses above 200-day MA — a major bullish trend confirmation.",
      definition: "The Golden Cross occurs when a shorter-term moving average (typically 50-day) crosses above a longer-term moving average (typically 200-day). It signals a shift in momentum from bearish to bullish and is widely watched by institutional investors as a trend-following confirmation.",
      why: "Moving averages represent the average cost basis of holders over different time periods. When the 50-day MA crosses above the 200-day MA, it means recent buyers are, on average, more profitable than long-term holders — signaling strong positive momentum. Institutions that follow trend-following rules (CTAs, quant funds) automatically increase exposure on this signal, creating a self-fulfilling dynamic that sustains the trend.",
      strategy: "**Entry**: Buy near the crossover point, ideally when price is above both MAs.\n**Target**: No fixed target — hold as long as the 50 MA remains above the 200 MA.\n**Stop-Loss**: A Death Cross (50-day crossing back below 200-day) signals exit. Can also use the 200-day MA as a dynamic stop.",
    },
    ko: {
      title: "골든 크로스 (Golden Cross)",
      shortDesc: "50일 MA가 200일 MA를 상향 돌파 — 강력한 상승 추세 확인 신호.",
      definition: "단기 이동평균(주로 50일)이 장기 이동평균(주로 200일)을 상향 돌파하는 현상. 하락→상승 모멘텀 전환을 신호하며, 기관 투자자들이 추세 추종 확인 지표로 널리 주목합니다.",
      why: "이동평균은 각 기간 보유자들의 평균 매수 단가를 나타냅니다. 50일 MA가 200일 MA를 상회한다는 것은, 최근 매수자들이 평균적으로 장기 보유자보다 수익권임을 의미하며 강한 양의 모멘텀을 시사합니다. 추세 추종 규칙을 따르는 기관(CTA, 퀀트펀드)들이 이 신호에 자동으로 비중을 늘리며 자기실현적으로 추세를 지속시킵니다.",
      strategy: "**진입**: 크로스 지점 근처에서 매수, 이상적으로는 가격이 두 MA 모두 위에 있을 때.\n**목표가**: 고정 목표 없음 — 50일 MA가 200일 MA 위에 있는 동안 보유.\n**손절**: 데드 크로스(50일이 200일 아래로 역전) 발생 시 청산. 200일 MA를 동적 손절로 활용 가능.",
    },
    ja: {
      title: "ゴールデンクロス",
      shortDesc: "50日MAが200日MAを上抜け — 主要な強気トレンド確認シグナル。",
      definition: "短期移動平均線（主に50日）が長期移動平均線（主に200日）を上向きにクロスする現象。弱気から強気へのモメンタム転換を示し、機関投資家がトレンドフォロー確認指標として広く注目します。",
      why: "移動平均線は各期間の保有者の平均取得コストを表します。50日MAが200日MAを上回ることは、最近の買い手が長期保有者よりも平均的に利益を得ていることを意味し、強いポジティブモメンタムを示します。トレンドフォロールールに従う機関（CTA、クオンツファンド）がこのシグナルで自動的にエクスポージャーを増やします。",
      strategy: "**エントリー**: クロスポイント付近での買い、理想的には価格が両MAの上にある時。\n**目標**: 固定目標なし — 50日MAが200日MAの上にある間は保有継続。\n**損切り**: デスクロス発生時に撤退。200日MAを動的損切りとして活用可能。",
    },
  },
  {
    id: "death-cross",
    type: "bearish",
    svg: <DeathCrossSVG />,
    en: {
      title: "Death Cross",
      shortDesc: "50-day MA crosses below 200-day MA — a major bearish trend confirmation.",
      definition: "The bearish counterpart to the Golden Cross. The 50-day moving average crosses below the 200-day moving average, signaling that the intermediate trend has turned negative. Often used as a risk-management exit signal by institutional investors.",
      why: "When the 50-day MA drops below the 200-day MA, recent buyers are on average underwater compared to long-term holders — signaling momentum has shifted to the downside. Trend-following funds automatically reduce long exposure or initiate short positions on this signal. The Death Cross often appears after significant market declines, so price may not fall dramatically immediately. However, it signals that recovery will be difficult and sustained upside is unlikely without a reversal.",
      strategy: "**Entry**: Reduce long positions or initiate shorts on the crossover. More aggressive: sell on confirmed close below the 200-day MA before the Death Cross forms.\n**Target**: No fixed target — avoid long exposure while 50 MA < 200 MA.\n**Stop-Loss**: A Golden Cross (50-day crossing back above 200-day) signals re-entry for longs.",
    },
    ko: {
      title: "데드 크로스 (Death Cross)",
      shortDesc: "50일 MA가 200일 MA를 하향 돌파 — 주요 하락 추세 확인 신호.",
      definition: "골든 크로스의 반대. 50일 이동평균이 200일 이동평균을 하향 돌파하여 중기 추세가 하락으로 전환됐음을 알립니다. 기관 투자자들의 리스크 관리 청산 신호로 자주 활용됩니다.",
      why: "50일 MA가 200일 MA 아래로 내려가면, 최근 매수자들이 평균적으로 장기 보유자보다 손실 상태임을 의미하며 하방 모멘텀 전환을 시사합니다. 추세 추종 펀드들이 자동으로 롱 비중을 줄이거나 숏 포지션을 개시합니다. 데드 크로스는 이미 상당한 하락 이후 나타나는 경우가 많아 직후의 추가 하락 폭이 작을 수 있습니다. 그러나 회복이 어렵고 지속적인 상승이 어려울 것임을 시사합니다.",
      strategy: "**진입**: 크로스 발생 시 롱 포지션 축소 또는 숏 진입. 더 적극적: 데드 크로스 형성 전 200일 MA 하방 이탈 시 매도.\n**목표가**: 고정 목표 없음 — 50일 MA < 200일 MA인 동안 롱 포지션 자제.\n**손절**: 골든 크로스 발생 시 롱 재진입 신호.",
    },
    ja: {
      title: "デスクロス",
      shortDesc: "50日MAが200日MAを下抜け — 主要な弱気トレンド確認シグナル。",
      definition: "ゴールデンクロスの弱気版。50日移動平均線が200日移動平均線を下向きにクロスし、中期トレンドが下落に転換したことを示します。機関投資家のリスク管理撤退シグナルとして活用されます。",
      why: "50日MAが200日MAを下回ると、最近の買い手が長期保有者より平均的に損失状態であることを意味します。トレンドフォロンドがロングエクスポージャーを自動削減または空売り開始します。デスクロスは大幅な下落後に現れることが多いです。",
      strategy: "**エントリー**: クロス発生時にロングを削減またはショートを開始。\n**目標**: 固定目標なし — 50日MA < 200日MAの間はロング回避。\n**損切り**: ゴールデンクロス発生時に再度ロング検討。",
    },
  },
  {
    id: "bollinger-squeeze",
    type: "neutral",
    svg: <BollingerSqueezeSVG />,
    en: {
      title: "Bollinger Band Squeeze",
      shortDesc: "Bands narrow to a historic low — a major volatility breakout is imminent.",
      definition: "A Bollinger Band Squeeze occurs when the upper and lower bands converge tightly, indicating very low volatility. This compression typically precedes a powerful move in either direction. The direction of the breakout — not the squeeze itself — determines the trade.",
      why: "Markets alternate between periods of low volatility (contraction) and high volatility (expansion). The squeeze reflects a standoff between bulls and bears where neither side has conviction — but the calm cannot last forever. One catalyst (earnings, Fed announcement, geopolitical event) can break the stalemate. Institutional players who recognize the squeeze build positions early, and when the breakout occurs, momentum algorithms pile in, generating explosive moves.",
      strategy: "**Entry**: Wait for a confirmed breakout direction. Buy if price breaks above with increasing volume; sell short if price breaks below.\n**Target**: The first expansion after the squeeze often travels as far as the price moved during the previous expansion period.\n**Stop-Loss**: Re-entry into the squeeze (price reverting inside the bands after a breakout) signals a false breakout — exit immediately.",
    },
    ko: {
      title: "볼린저 밴드 스퀴즈 (BB Squeeze)",
      shortDesc: "밴드가 극도로 좁아짐 — 강력한 방향성 돌파가 임박했다는 신호.",
      definition: "상단과 하단 볼린저 밴드가 가깝게 수렴하여 변동성이 매우 낮음을 나타낼 때 발생합니다. 이 수렴 이후 보통 강력한 방향성 움직임이 따라옵니다. 스퀴즈 자체가 아닌 돌파 방향이 거래 방향을 결정합니다.",
      why: "시장은 낮은 변동성(수축)과 높은 변동성(팽창)을 번갈아 겪습니다. 스퀴즈는 강세론자와 약세론자 모두 확신이 없는 교착 상태를 반영하지만, 이 고요함은 영원히 지속될 수 없습니다. 실적 발표, 연준 발표, 지정학적 이벤트 등 하나의 촉매가 교착을 깨뜨립니다. 스퀴즈를 인식한 기관들이 미리 포지션을 구축하고, 돌파 시 모멘텀 알고리즘들이 참여하며 폭발적인 움직임이 발생합니다.",
      strategy: "**진입**: 돌파 방향 확인 후 진입. 상방 돌파+거래량 증가 → 매수; 하방 이탈 → 공매도.\n**목표가**: 스퀴즈 이후 첫 팽창은 보통 이전 팽창 기간 동안의 움직임만큼 이동.\n**손절**: 돌파 후 밴드 안으로 다시 진입하면 페이크아웃 신호 — 즉시 청산.",
    },
    ja: {
      title: "ボリンジャーバンドスクイーズ",
      shortDesc: "バンドが極端に収縮 — 強力な方向性ブレイクアウトが迫っているシグナル。",
      definition: "上下のボリンジャーバンドが接近して低ボラティリティを示す時に発生します。この収縮は通常、どちらかの方向への強力な動きに先行します。スクイーズ自体ではなくブレイクアウトの方向が取引方向を決めます。",
      why: "市場は低ボラティリティ（収縮）と高ボラティリティ（拡張）を交互に経験します。スクイーズは強気と弱気が膠着した状態を反映しますが、この静けさは永続しません。一つの触媒が膠着を打ち破ります。機関はスクイーズを認識し早期にポジションを積み上げます。",
      strategy: "**エントリー**: ブレイクアウト方向の確認後に参入。上方突破+出来高増加→買い、下方割れ→売り。\n**目標**: スクイーズ後の最初の拡張は前の拡張期間の動きに匹敵することが多い。\n**損切り**: ブレイクアウト後にバンド内に戻ればフォルスブレイク — 即撤退。",
    },
  },
  {
    id: "rising-wedge",
    type: "bearish",
    svg: <RisingWedgeSVG />,
    en: {
      title: "Rising Wedge",
      shortDesc: "Price rises in a narrowing channel — deceptively bullish but signals reversal.",
      definition: "The Rising Wedge has both trendlines sloping upward, with the lower line steeper than the upper. This creates a narrowing 'wedge' shape. Despite the rising price, this is typically a bearish reversal pattern. A break below the lower trendline confirms the reversal.",
      why: "Although price is rising, the upward momentum is decelerating — each push higher requires more effort for smaller gains. This reflects diminishing buying enthusiasm: the market is running out of buyers willing to pay higher prices. Volume typically declines as the wedge progresses, confirming weakening conviction. Sellers patiently wait for this exhaustion before stepping in aggressively on the breakdown.",
      strategy: "**Entry**: Short on a close below the lower wedge trendline.\n**Target**: Measure from the start of the wedge (widest point) to the breakdown and project downward.\n**Stop-Loss**: Above the most recent swing high within the wedge.",
    },
    ko: {
      title: "상승 쐐기 (Rising Wedge)",
      shortDesc: "좁아지는 상승 채널 — 겉보기엔 강세지만 반전을 예고하는 패턴.",
      definition: "두 추세선 모두 상향이지만 하단선의 기울기가 더 가파른 좁아지는 쐐기 형태. 가격이 상승함에도 불구하고 전형적인 하락 반전 패턴입니다. 하단 추세선 이탈 시 반전이 확인됩니다.",
      why: "가격이 상승하지만 모멘텀이 둔화됩니다 — 더 높은 가격을 위해 더 많은 노력이 필요하나 상승폭은 줄어듭니다. 이는 매수 열기 감소를 반영합니다: 시장이 더 높은 가격을 지불할 의향이 있는 매수자가 고갈됩니다. 쐐기가 진행될수록 거래량이 감소하며 확신의 약화를 확인합니다. 매도자들은 이 소진을 기다렸다가 이탈 시 공격적으로 진입합니다.",
      strategy: "**진입**: 하단 쐐기 추세선 하방 종가 이탈 시 공매도.\n**목표가**: 쐐기 시작점(가장 넓은 부분)에서 이탈 지점까지의 거리를 하방으로 설정.\n**손절**: 쐐기 내 최근 반등 고점 위.",
    },
    ja: {
      title: "ライジングウェッジ",
      shortDesc: "先細りの上昇チャネル — 一見強気だが反転を示すパターン。",
      definition: "両トレンドラインが上向きだが下限ラインの方が急勾配な先細りウェッジ形状。価格が上昇していても典型的な弱気反転パターンです。下限トレンドラインの下抜けで反転確認。",
      why: "価格は上昇していますが上昇モメンタムが鈍化しています。より高い価格のために多くの努力が必要ですが上昇幅は縮小します。出来高の減少が確信の弱まりを確認します。売り方はこの枯渇を待って積極的に参入します。",
      strategy: "**エントリー**: 下限ウェッジラインを下抜け確認後の売り。\n**目標**: ウェッジの最大幅をブレイクダウン地点から下方に投影。\n**損切り**: ウェッジ内の直近高値の上。",
    },
  },
  {
    id: "falling-wedge",
    type: "bullish",
    svg: <FallingWedgeSVG />,
    en: {
      title: "Falling Wedge",
      shortDesc: "Price falls in a narrowing channel — a bullish reversal/continuation pattern.",
      definition: "Both trendlines slope downward, with the upper line steeper. Despite the declining price, this is typically a bullish pattern — either a reversal at the end of a downtrend or a continuation in an uptrend. A break above the upper trendline confirms the bullish move.",
      why: "While price declines, the selling pressure is actually weakening — each down-move is smaller than the last. Buyers are absorbing the selling at progressively higher lows (relative to the declining resistance). Volume typically dries up as the wedge matures. The breakout above the upper trendline reveals that sellers have exhausted their supply, and even modest new demand can push prices sharply higher.",
      strategy: "**Entry**: Buy on a confirmed close above the upper wedge trendline.\n**Target**: Measure the height of the wedge at its widest point and project upward from the breakout.\n**Stop-Loss**: Below the most recent swing low within the wedge.",
    },
    ko: {
      title: "하락 쐐기 (Falling Wedge)",
      shortDesc: "좁아지는 하락 채널 — 상승 반전 또는 지속을 예고하는 패턴.",
      definition: "두 추세선 모두 하향이지만 상단선의 기울기가 더 가파른 좁아지는 형태. 가격이 하락하지만 전형적으로 상승 패턴(하락 추세 말 반전 또는 상승 추세 내 지속). 상단 추세선 상방 이탈로 확인됩니다.",
      why: "가격이 하락하지만 매도 압력이 실제로 약해지고 있습니다 — 매번 하락폭이 이전보다 작아집니다. 매수자들이 점점 더 높은 저점에서 매물을 흡수합니다. 쐐기가 성숙함에 따라 거래량이 감소합니다. 상단 추세선 돌파는 매도자들이 물량을 소진했음을 드러내며, 소폭의 신규 매수도 가격을 크게 밀어올릴 수 있습니다.",
      strategy: "**진입**: 상단 쐐기 추세선 상방 종가 돌파 시 매수.\n**목표가**: 쐐기 시작점(가장 넓은 부분) 높이를 돌파 지점에서 상방으로 설정.\n**손절**: 쐐기 내 최근 저점 아래.",
    },
    ja: {
      title: "フォーリングウェッジ",
      shortDesc: "先細りの下降チャネル — 強気の反転または継続パターン。",
      definition: "両トレンドラインが下向きだが上限ラインの方が急勾配。価格は下落していますが典型的な強気パターン（下降トレンド末の反転または上昇トレンド内の継続）。上限トレンドラインの上抜けで確認。",
      why: "価格は下落していますが売り圧力は実際に弱まっています。下落幅が毎回小さくなります。出来高が減少します。上限ラインの突破は売り方の在庫枯渇を示し、わずかな新規需要でも価格を大幅に押し上げます。",
      strategy: "**エントリー**: 上限ウェッジラインを上抜け確認後の買い。\n**目標**: ウェッジの最大幅をブレイクアウト地点から上方に投影。\n**損切り**: ウェッジ内の直近安値の下。",
    },
  },
  {
    id: "rounding-bottom",
    type: "bullish",
    svg: <RoundingBottomSVG />,
    en: {
      title: "Rounding Bottom (Saucer)",
      shortDesc: "A gradual U-shaped base — the slowest and most reliable reversal pattern.",
      definition: "The Rounding Bottom (or Saucer) is a long-term reversal pattern characterized by a slow, gradual curve from downtrend to uptrend. It can take months or even years to form. The breakout above the left side's price level confirms the new bull trend.",
      why: "The rounding bottom reflects a gradual transfer of shares from weak hands (sellers) to strong hands (long-term investors). Unlike sharp V-reversal patterns, the slow rounding indicates no panic or euphoria — just patient accumulation. As the bottom rounds, diminishing selling pressure meets gradually increasing buying interest. Institutional investors often use this multi-month base to build very large positions without disrupting price. The eventual breakout is typically explosive due to years of pent-up demand.",
      strategy: "**Entry**: Buy on a breakout above the 'lip' (the price level matching the left start of the pattern), or accumulate during the base formation.\n**Target**: No strict formula — the pattern can yield very large gains. Consider the prior decline magnitude as a guide.\n**Stop-Loss**: Below the midpoint of the rounding base.",
    },
    ko: {
      title: "원형 바닥 (Rounding Bottom / Saucer)",
      shortDesc: "완만한 U자형 바닥 — 가장 느리고 가장 신뢰할 수 있는 반전 패턴.",
      definition: "하락→상승 전환이 천천히, 점진적으로 곡선을 그리며 이루어지는 장기 반전 패턴. 형성에 수개월~수년이 걸릴 수 있습니다. 왼쪽 출발점 가격(립) 상방 돌파 시 새로운 강세장을 확인합니다.",
      why: "원형 바닥은 약한 손(매도자)에서 강한 손(장기 투자자)으로의 점진적인 주식 이전을 반영합니다. 급격한 V자 반등과 달리, 완만한 곡선은 공황이나 흥분 없이 인내심 있는 매집을 나타냅니다. 바닥이 둥글게 변하면서 감소하는 매도 압력이 점점 증가하는 매수 관심과 만납니다. 기관 투자자들은 종종 이 수개월의 바닥을 이용해 가격에 충격을 주지 않고 대규모 포지션을 구축합니다. 돌파 시 수년 간 쌓인 잠재 수요로 인해 폭발적 상승이 나타날 수 있습니다.",
      strategy: "**진입**: 패턴 왼쪽 출발점 가격(립) 상방 돌파 시 매수, 또는 바닥 형성 기간 동안 분할 매수.\n**목표가**: 엄격한 공식 없음 — 이전 하락폭을 참고로 상당한 상승 가능. \n**손절**: 원형 바닥 중간점 아래.",
    },
    ja: {
      title: "ラウンディングボトム（ソーサー）",
      shortDesc: "緩やかなU字型底 — 最も遅く最も信頼性の高い反転パターン。",
      definition: "下降から上昇へゆっくりと曲線を描く長期反転パターン。形成に数ヶ月〜数年かかることもあります。左端の価格水準（リップ）を上抜けると新たな強気トレンドを確認します。",
      why: "弱い手から強い手への株式の緩やかな移転を反映します。急激なV字反転と異なり、緩やかな曲線はパニックも熱狂もない忍耐強い蓄積を示します。機関投資家はこの数ヶ月のベースを使って大規模なポジションを静かに構築します。突破時は長年の潜在需要により爆発的な上昇となることが多いです。",
      strategy: "**エントリー**: リップを上抜け確認時の買い、またはベース形成中の分割買い。\n**目標**: 厳密な公式なし — 前の下落幅を参考に大幅上昇が期待できる。\n**損切り**: ラウンディングベースの中間点の下。",
    },
  },
];

// ─── Disclaimer text ───────────────────────────────────────────────────────────
const DISCLAIMER: Record<Lang, string> = {
  ko: "⚠️ 기술적 분석 및 차트 패턴 활용 시 유의사항: 본 메뉴에서 제공하는 차트 패턴 및 기술적 지표는 과거 시장 데이터의 통계적 시각화 자료이며, 미래의 투자 수익을 보장하거나 특정 종목의 매수/매도를 권유하지 않습니다. 시장의 돌발 악재, 매크로 변수 등에 의해 패턴은 언제든 무력화(Fake-out)될 수 있으므로, 반드시 기업의 펀더멘털 및 철저한 리스크 관리(손절매 기준 설정)와 병행하여 참고용으로만 활용하시기 바랍니다.",
  en: "⚠️ Important Disclaimer on Technical Analysis & Chart Patterns: The chart patterns and technical indicators provided in this section are statistical visualizations of historical market data only. They do not guarantee future investment returns or constitute a recommendation to buy or sell any specific security. Patterns can be invalidated at any time by unexpected news events, macro-economic variables, or low-volume 'fake-outs.' Always combine technical analysis with fundamental research and strict risk management (including defined stop-loss levels).",
  ja: "⚠️ テクニカル分析・チャートパターン活用に関する重要な注意事項: 本セクションで提供するチャートパターンおよびテクニカル指標は、過去の市場データの統計的可視化に過ぎず、将来の投資収益を保証するものでも、特定の有価証券の売買を推奨するものでもありません。予期せぬニュース、マクロ経済変数、低出来高のフォルスブレイクアウト等により、パターンはいつでも無効化される可能性があります。必ずファンダメンタル分析および厳格なリスク管理（損切り水準の設定を含む）と組み合わせてご活用ください。",
};

// ─── Helper to render strategy text with **bold** markdown ────────────────────
function StrategyText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="text-foreground font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ChartMaster() {
  const { data: user } = useUser();
  const lang = ((user?.language || "ko") as Lang);
  const t = translations[lang as keyof typeof translations];

  const [selected, setSelected] = useState<Pattern | null>(null);
  const [filter, setFilter] = useState<PatternType | "all">("all");

  const filtered = filter === "all" ? PATTERNS : PATTERNS.filter(p => p.type === filter);

  const typeColors: Record<PatternType, string> = {
    bullish: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
    bearish: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",
    neutral: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
  };
  const typeIcons: Record<PatternType, React.ReactNode> = {
    bullish: <TrendingUp className="w-3.5 h-3.5" />,
    bearish: <TrendingDown className="w-3.5 h-3.5" />,
    neutral: <Minus className="w-3.5 h-3.5" />,
  };
  const typeLabels: Record<PatternType, Record<Lang, string>> = {
    bullish: { en: "Bullish", ko: "상승", ja: "強気" },
    bearish: { en: "Bearish", ko: "하락", ja: "弱気" },
    neutral: { en: "Neutral", ko: "중립", ja: "中立" },
  };

  const getText = (p: Pattern) => p[lang] ?? p.en;

  return (
    <div className="flex-1 min-h-screen bg-background pb-20">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <span className="text-2xl">📈</span>
            {lang === "ko" ? "차트 마스터" : lang === "ja" ? "チャートマスター" : "Chart Master"}
          </h1>
          <p className="text-muted-foreground text-base">
            {lang === "ko"
              ? "15가지 핵심 차트 패턴의 원리와 실전 전략을 배워보세요."
              : lang === "ja"
              ? "15の重要チャートパターンの原理と実践戦略を学びましょう。"
              : "Master 15 essential chart patterns — their mechanics, market psychology, and actionable trade strategies."}
          </p>
        </div>

        {/* Disclaimer */}
        <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-5 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
            {DISCLAIMER[lang]}
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "bullish", "bearish", "neutral"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {f === "all"
                ? (lang === "ko" ? "전체" : lang === "ja" ? "全て" : "All")
                : typeLabels[f][lang]}
              <span className="ml-2 text-xs opacity-70">
                {f === "all" ? PATTERNS.length : PATTERNS.filter(p => p.type === f).length}
              </span>
            </button>
          ))}
        </div>

        {/* Pattern grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(pattern => {
            const text = getText(pattern);
            return (
              <button
                key={pattern.id}
                onClick={() => setSelected(pattern)}
                className="group bg-card border border-border rounded-2xl p-5 text-left hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col gap-3"
                data-testid={`card-pattern-${pattern.id}`}
              >
                {/* Type badge */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${typeColors[pattern.type]}`}>
                    {typeIcons[pattern.type]}
                    {typeLabels[pattern.type][lang]}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>

                {/* SVG icon */}
                <div className={`w-full h-16 ${pattern.type === "bullish" ? "text-emerald-500" : pattern.type === "bearish" ? "text-red-500" : "text-amber-500"}`}>
                  {pattern.svg}
                </div>

                {/* Title + desc */}
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-foreground leading-tight">{text.title}</h3>
                  <p className="text-muted-foreground text-sm leading-snug line-clamp-2">{text.shortDesc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-3xl">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${typeColors[selected.type]}`}>
                  {typeIcons[selected.type]}
                  {typeLabels[selected.type][lang]}
                </span>
                <h2 className="font-display font-bold text-lg text-foreground leading-tight">
                  {getText(selected).title}
                </h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-close-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-6 space-y-6">
              {/* Mini SVG */}
              <div className={`w-full h-24 ${selected.type === "bullish" ? "text-emerald-500" : selected.type === "bearish" ? "text-red-500" : "text-amber-500"}`}>
                {selected.svg}
              </div>

              {/* Definition */}
              <section className="space-y-2">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
                  {lang === "ko" ? "정의 (Definition)" : lang === "ja" ? "定義" : "Definition"}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed pl-8">
                  {getText(selected).definition}
                </p>
              </section>

              <div className="border-t border-border" />

              {/* Why / Market Psychology */}
              <section className="space-y-2">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center text-xs font-bold">2</span>
                  {lang === "ko" ? "발생 원인 및 시장 심리 (Why)" : lang === "ja" ? "発生原因と市場心理" : "Market Psychology — The 'Why'"}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed pl-8">
                  {getText(selected).why}
                </p>
              </section>

              <div className="border-t border-border" />

              {/* Trading Strategy */}
              <section className="space-y-2">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${selected.type === "bullish" ? "bg-emerald-500/10 text-emerald-500" : selected.type === "bearish" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>3</span>
                  {lang === "ko" ? "실전 전략 (Trading Strategy)" : lang === "ja" ? "実践戦略" : "Trading Strategy"}
                </h3>
                <div className="text-sm text-muted-foreground leading-relaxed pl-8 space-y-1">
                  {getText(selected).strategy.split("\n").map((line, i) => (
                    <p key={i}><StrategyText text={line} /></p>
                  ))}
                </div>
              </section>

              {/* Mini disclaimer */}
              <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 flex gap-2 mt-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {lang === "ko"
                    ? "본 내용은 교육 목적으로만 제공됩니다. 패턴은 언제든 무력화(Fake-out)될 수 있으며, 반드시 손절 기준과 리스크 관리를 병행하세요."
                    : lang === "ja"
                    ? "本内容は教育目的のみで提供されます。パターンはいつでも無効化される可能性があります。必ず損切り基準とリスク管理を併用してください。"
                    : "For educational purposes only. Patterns can be invalidated (fake-outs) at any time. Always use defined stop-losses and risk management."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
