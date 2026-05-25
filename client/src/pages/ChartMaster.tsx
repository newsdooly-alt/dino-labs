import { useState, useRef, useEffect, useMemo } from "react";
import { X, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronRight, BookOpen, Brain, Trophy, RefreshCw, Check, XCircle } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type Lang = "en" | "ko" | "ja";
type PatternType = "bullish" | "bearish" | "neutral";
type Difficulty = "beginner" | "intermediate" | "advanced";

interface PatternText {
  title: string;
  shortDesc: string;
  definition: string;
  why: string;
  indicatorFusion: string;
  strategy: string;
}
interface Pattern {
  id: string;
  type: PatternType;
  difficulty: Difficulty;
  coreIndicators: string[];
  svg: React.ReactNode;
  en: PatternText;
  ko: PatternText;
  ja: PatternText;
}

// ─── OHLCV helpers ─────────────────────────────────────────────────────────────
interface OHLCV { o: number; h: number; l: number; c: number; v: number; }
function genCandles(startPrice: number, moves: Array<{trend:number;vol:number;count:number;vBase:number;vMul?:number}>): OHLCV[] {
  let price = startPrice; let seed = 12345;
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; };
  const out: OHLCV[] = [];
  for (const m of moves) {
    for (let i = 0; i < m.count; i++) {
      const o = price;
      const c = o + m.trend + (rng() - 0.5) * m.vol * 2;
      const wick = m.vol * rng() * 0.8;
      const h = Math.max(o, c) + wick;
      const l = Math.min(o, c) - wick * 0.6;
      const v = m.vBase * (0.6 + rng() * 0.8) * (m.vMul ?? 1);
      out.push({ o: +o.toFixed(2), h: +h.toFixed(2), l: +Math.max(l, 0).toFixed(2), c: +c.toFixed(2), v: Math.round(v) });
      price = c;
    }
  }
  return out;
}

// ─── SVG components ─────────────────────────────────────────────────────────────
function HeadShouldersSVG() { return <svg viewBox="0 0 120 64" className="w-full h-full"><polyline points="0,52 18,22 28,40 58,6 88,40 102,26 120,52" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="24" y1="40" x2="94" y2="40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/></svg>; }
function InverseHSSVG() { return <svg viewBox="0 0 120 64" className="w-full h-full"><polyline points="0,12 18,42 28,24 58,58 88,24 102,38 120,12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="24" y1="24" x2="94" y2="24" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/></svg>; }
function DoubleTopSVG() { return <svg viewBox="0 0 120 64" className="w-full h-full"><polyline points="0,54 28,10 56,36 84,10 120,54" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="10" y1="10" x2="110" y2="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/></svg>; }
function DoubleBottomSVG() { return <svg viewBox="0 0 120 64" className="w-full h-full"><polyline points="0,10 28,54 56,28 84,54 120,10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="10" y1="54" x2="110" y2="54" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/></svg>; }
function CupHandleSVG() { return <svg viewBox="0 0 120 64" className="w-full h-full"><path d="M0,14 Q30,58 60,58 Q90,58 90,14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><polyline points="90,14 100,22 108,16 120,8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function BullFlagSVG() { return <svg viewBox="0 0 120 64" className="w-full h-full"><polyline points="4,58 36,10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><polyline points="36,10 56,18 76,26 96,18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="36,22 56,30 76,38 96,30" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/><polyline points="96,18 120,4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>; }
function BearFlagSVG() { return <svg viewBox="0 0 120 64" className="w-full h-full"><polyline points="4,6 36,54" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><polyline points="36,54 56,46 76,38 96,46" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="96,46 120,60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>; }
function AscendingTriangleSVG() { return <svg viewBox="0 0 120 64" className="w-full h-full"><line x1="0" y1="14" x2="104" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="0,54 24,44 48,34 72,24 96,14 120,4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3"/></svg>; }
function DescendingTriangleSVG() { return <svg viewBox="0 0 120 64" className="w-full h-full"><line x1="0" y1="50" x2="104" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="0,10 24,20 48,30 72,40 96,50 120,60" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3"/></svg>; }
function GoldenCrossSVG() { return <svg viewBox="0 0 120 64" className="w-full h-full"><polyline points="0,46 40,42 70,20 120,8" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><polyline points="0,54 40,50 70,36 120,16" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3"/><circle cx="62" cy="30" r="4" fill="#22c55e" opacity="0.9"/></svg>; }
function BollingerSqueezeSVG() { return <svg viewBox="0 0 120 64" className="w-full h-full"><polyline points="0,8 30,18 55,28 65,32 75,28 90,18 120,6" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 2"/><polyline points="0,56 30,46 55,36 65,32 75,36 90,46 120,58" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 2"/><polyline points="0,32 30,32 55,32 65,32 75,32 90,30 108,14 120,6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function RisingWedgeSVG() { return <svg viewBox="0 0 120 64" className="w-full h-full"><polyline points="0,50 30,32 60,22 90,16 108,14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="0,58 30,46 60,38 90,32 108,30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 3"/><polyline points="108,22 120,54" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>; }
function FallingWedgeSVG() { return <svg viewBox="0 0 120 64" className="w-full h-full"><polyline points="0,14 30,28 60,36 90,44 108,48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="0,6 30,16 60,22 90,28 108,32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 3"/><polyline points="108,40 120,10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>; }
function RoundingBottomSVG() { return <svg viewBox="0 0 120 64" className="w-full h-full"><path d="M0,12 Q60,62 120,12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>; }
function BasicCandlesSVG() {
  return <svg viewBox="0 0 120 64" className="w-full h-full">
    <g transform="translate(8,0)"><line x1="0" y1="8" x2="0" y2="56" stroke="#22c55e" strokeWidth="1.5"/><rect x="-5" y="18" width="10" height="26" fill="#22c55e" rx="1"/></g>
    <g transform="translate(30,0)"><line x1="0" y1="12" x2="0" y2="52" stroke="#ef4444" strokeWidth="1.5"/><rect x="-5" y="20" width="10" height="22" fill="#ef4444" rx="1"/></g>
    <g transform="translate(52,0)"><line x1="0" y1="20" x2="0" y2="44" stroke="#94a3b8" strokeWidth="1.5"/><rect x="-5" y="28" width="10" height="8" fill="#94a3b8" rx="1"/></g>
    <g transform="translate(74,0)"><line x1="0" y1="10" x2="0" y2="54" stroke="#22c55e" strokeWidth="1.5"/><rect x="-5" y="36" width="10" height="16" fill="#22c55e" rx="1"/></g>
    <g transform="translate(96,0)"><line x1="0" y1="14" x2="0" y2="50" stroke="#ef4444" strokeWidth="1.5"/><rect x="-5" y="14" width="10" height="20" fill="#ef4444" rx="1"/></g>
  </svg>;
}
function SupportResistanceSVG() {
  return <svg viewBox="0 0 120 64" className="w-full h-full">
    <line x1="0" y1="12" x2="120" y2="12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.6"/>
    <line x1="0" y1="52" x2="120" y2="52" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.6"/>
    <polyline points="0,52 15,46 22,52 36,40 50,52 62,34 75,46 88,52 98,38 112,52 120,44" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="2" y="10" fontSize="7" fill="currentColor" opacity="0.7">R</text>
    <text x="2" y="62" fontSize="7" fill="currentColor" opacity="0.7">S</text>
  </svg>;
}
function TrendLineSVG() {
  return <svg viewBox="0 0 120 64" className="w-full h-full">
    <line x1="0" y1="54" x2="120" y2="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.5"/>
    <polyline points="0,54 18,50 22,44 38,42 44,36 58,34 66,26 78,24 88,18 100,16 112,10 120,8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
function MovingAverageSVG() {
  return <svg viewBox="0 0 120 64" className="w-full h-full">
    <polyline points="0,44 10,38 22,30 34,36 46,26 58,30 70,18 82,22 94,14 106,18 120,10" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2"/>
    <polyline points="0,48 20,42 40,36 60,32 80,24 100,18 120,12" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="0,52 30,48 60,42 90,32 120,20" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2"/>
  </svg>;
}
function RSIDivergenceSVG() {
  return <svg viewBox="0 0 120 64" className="w-full h-full">
    <text x="2" y="9" fontSize="6" fill="currentColor" opacity="0.6">Price</text>
    <polyline points="0,30 25,22 50,18 75,26 100,14 120,10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="50" cy="18" r="3" fill="currentColor" opacity="0.5"/>
    <circle cx="100" cy="14" r="3" fill="currentColor" opacity="0.5"/>
    <line x1="50" y1="18" x2="100" y2="14" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" opacity="0.4"/>
    <line x1="0" y1="38" x2="120" y2="38" stroke="currentColor" strokeWidth="0.8" opacity="0.3"/>
    <text x="2" y="47" fontSize="6" fill="currentColor" opacity="0.6">RSI</text>
    <polyline points="0,52 25,46 50,42 75,50 100,54 120,58" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="50" cy="42" r="3" fill="#a855f7" opacity="0.7"/>
    <circle cx="100" cy="54" r="3" fill="#a855f7" opacity="0.7"/>
    <line x1="50" y1="42" x2="100" y2="54" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="3 2"/>
    <text x="62" y="36" fontSize="6" fill="#ef4444" opacity="0.9" fontWeight="bold">↘ Divergence</text>
  </svg>;
}
function MACDCrossSVG() {
  return <svg viewBox="0 0 120 64" className="w-full h-full">
    <line x1="0" y1="32" x2="120" y2="32" stroke="currentColor" strokeWidth="0.8" opacity="0.3"/>
    <polyline points="0,48 30,40 55,34 65,30 80,20 110,14 120,10" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="0,52 30,46 55,42 65,40 80,32 110,26 120,22" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3"/>
    <circle cx="63" cy="36" r="5" fill="#22c55e" opacity="0.25" stroke="#22c55e" strokeWidth="1.5"/>
    <text x="38" y="58" fontSize="7" fill="#22c55e" opacity="0.9">Golden Cross</text>
  </svg>;
}
function VolumeProfileSVG() {
  return <svg viewBox="0 0 120 64" className="w-full h-full">
    <polyline points="40,8 40,18 40,26 40,34 40,42 40,56" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
    <rect x="40" y="8" width="55" height="5" fill="#ef4444" opacity="0.7" rx="1"/>
    <rect x="40" y="15" width="30" height="5" fill="#ef4444" opacity="0.5" rx="1"/>
    <rect x="40" y="22" width="70" height="5" fill="#22c55e" opacity="0.8" rx="1"/>
    <rect x="40" y="29" width="45" height="5" fill="#22c55e" opacity="0.6" rx="1"/>
    <rect x="40" y="36" width="80" height="5" fill="#22c55e" opacity="0.9" rx="1"/>
    <rect x="40" y="43" width="25" height="5" fill="#94a3b8" opacity="0.5" rx="1"/>
    <rect x="40" y="50" width="50" height="5" fill="#ef4444" opacity="0.6" rx="1"/>
    <text x="2" y="28" fontSize="6" fill="currentColor" opacity="0.6">Price</text>
    <polyline points="30,8 35,20 28,32 32,44 25,56" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2"/>
  </svg>;
}
function VWAPStrategySVG() {
  return <svg viewBox="0 0 120 64" className="w-full h-full">
    <polyline points="0,50 15,44 30,38 42,36 55,32 68,28 82,24 95,20 110,16 120,12" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3"/>
    <polyline points="0,54 12,48 24,44 36,50 48,42 60,36 72,30 84,22 96,18 108,14 120,10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="2" y="30" fontSize="6" fill="#f59e0b" opacity="0.9">VWAP</text>
    <line x1="0" y1="34" x2="120" y2="34" stroke="currentColor" strokeWidth="0.5" opacity="0.2"/>
  </svg>;
}
function FakeoutSVG() {
  return <svg viewBox="0 0 120 64" className="w-full h-full">
    <line x1="0" y1="18" x2="120" y2="18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.5"/>
    <polyline points="0,52 20,46 40,38 60,28 72,16 80,10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="80" cy="10" r="4" fill="#ef4444" opacity="0.3" stroke="#ef4444" strokeWidth="1.5"/>
    <polyline points="80,10 88,8 92,6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <polyline points="92,6 100,16 110,30 120,46" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="58" y="62" fontSize="7" fill="#ef4444" opacity="0.9">Fake-out!</text>
  </svg>;
}
function MultiTimeframeSVG() {
  return <svg viewBox="0 0 120 64" className="w-full h-full">
    <rect x="1" y="2" width="36" height="27" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
    <polyline points="4,22 10,18 16,14 22,16 28,10 34,6" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="3" y="30" fontSize="5" fill="currentColor" opacity="0.5">1D</text>
    <rect x="42" y="2" width="36" height="27" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
    <polyline points="45,26 51,20 57,16 63,18 69,12 75,8" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="44" y="30" fontSize="5" fill="currentColor" opacity="0.5">4H</text>
    <rect x="1" y="36" width="77" height="26" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
    <polyline points="5,54 14,48 23,46 32,50 41,42 50,44 59,38 68,40 75,36" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="3" y="63" fontSize="5" fill="currentColor" opacity="0.5">15m</text>
    <rect x="84" y="2" width="34" height="60" rx="2" fill="currentColor" opacity="0.05" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
    <text x="88" y="14" fontSize="5" fill="#22c55e" opacity="0.8">All ✓</text>
    <text x="88" y="24" fontSize="5" fill="#22c55e" opacity="0.8">Bull</text>
    <text x="88" y="36" fontSize="5" fill="currentColor" opacity="0.5">Entry</text>
    <text x="88" y="46" fontSize="5" fill="currentColor" opacity="0.5">Zone</text>
  </svg>;
}

// ─── Candlestick chart renderer ────────────────────────────────────────────────
function CandlestickChart({ candles, revealFrom, showReveal }: { candles: OHLCV[]; revealFrom: number; showReveal: boolean }) {
  const CW = 14; const GAP = 4; const PH = 200; const VH = 44; const PAD = 4;
  const visible = showReveal ? candles : candles.slice(0, revealFrom);
  const allPrices = visible.flatMap(c => [c.h, c.l]);
  const minP = Math.min(...allPrices) * 0.999;
  const maxP = Math.max(...allPrices) * 1.001;
  const range = maxP - minP || 1;
  const toY = (p: number) => PAD + ((maxP - p) / range) * (PH - PAD * 2);
  const maxV = Math.max(...candles.map(c => c.v));
  const totalW = candles.length * (CW + GAP);
  const decX = revealFrom * (CW + GAP) - GAP / 2;

  return (
    <div className="w-full overflow-x-auto rounded-xl bg-muted/30">
      <svg viewBox={`0 0 ${totalW} ${PH + VH + 8}`} className="w-full" style={{ minWidth: `${Math.max(totalW, 320)}px`, maxHeight: "260px" }}>
        {/* Price grid lines */}
        {[0.2, 0.4, 0.6, 0.8].map(f => (
          <line key={f} x1="0" y1={PAD + f * (PH - PAD * 2)} x2={totalW} y2={PAD + f * (PH - PAD * 2)} stroke="currentColor" strokeWidth="0.5" opacity="0.08"/>
        ))}
        {/* Candles */}
        {candles.map((c, i) => {
          const isReveal = i >= revealFrom;
          if (isReveal && !showReveal) return null;
          const x = i * (CW + GAP) + CW / 2;
          const bull = c.c >= c.o;
          const col = bull ? "#22c55e" : "#ef4444";
          const bTop = toY(Math.max(c.o, c.c));
          const bBot = toY(Math.min(c.o, c.c));
          const bH = Math.max(1, bBot - bTop);
          const vH2 = (c.v / maxV) * VH;
          return (
            <g key={i} style={isReveal ? { animation: "fadeInUp 0.4s ease both", animationDelay: `${(i - revealFrom) * 60}ms` } : {}}>
              <line x1={x} y1={toY(c.h)} x2={x} y2={toY(c.l)} stroke={col} strokeWidth="1.5"/>
              <rect x={x - CW / 2} y={bTop} width={CW} height={bH} fill={col} opacity={isReveal ? 0.9 : 0.85}/>
              <rect x={x - CW / 2} y={PH + 4 + (VH - vH2)} width={CW} height={vH2} fill={col} opacity={isReveal ? 0.5 : 0.35} rx="1"/>
            </g>
          );
        })}
        {/* Decision line */}
        {!showReveal && (
          <line x1={decX} y1="0" x2={decX} y2={PH + VH + 8} stroke="#f59e0b" strokeWidth="2" strokeDasharray="6 4" opacity="0.8"/>
        )}
        {/* "?" label at decision */}
        {!showReveal && (
          <text x={decX + 6} y="20" fontSize="12" fill="#f59e0b" fontWeight="bold" opacity="0.9">?</text>
        )}
      </svg>
    </div>
  );
}

// ─── Pattern database ──────────────────────────────────────────────────────────
const PATTERNS: Pattern[] = [
  // ── BEGINNER ──
  {
    id:"basic-candles", type:"neutral", difficulty:"beginner",
    coreIndicators:["Candlestick Bodies","Wicks","Volume"],
    svg:<BasicCandlesSVG/>,
    en:{
      title:"Basic Candlesticks",
      shortDesc:"The building block of all chart analysis — reading a single candle's story.",
      definition:"A candlestick encodes four prices: Open, High, Low, Close (OHLC). The 'body' is the range between open and close. Wicks (shadows) show the high/low extremes. A filled/red body = price fell (close < open). A hollow/green body = price rose (close > open). Key single-candle signals: Doji (indecision), Hammer (bullish reversal at lows), Shooting Star (bearish reversal at highs), Marubozu (strong conviction).",
      why:"Every candle is a miniature battle report between buyers and sellers for that time period. A long lower wick means sellers pushed price down but buyers aggressively bought back up before close — powerful buying absorption. A small body with long wicks means neither side won decisively — look for clarification from the next candle. Institutional traders pay close attention to these micro-battles because they reveal who controls the order flow.",
      indicatorFusion:"**Volume confirms candlestick signals**: A bullish Hammer with 3× average volume is highly significant; the same Hammer on 0.3× volume may be a trap. **RSI context**: A Hammer at RSI 25 (deeply oversold) is far more powerful than one at RSI 55. **Moving Averages**: A Doji forming exactly at the 200-day MA is a high-probability setup — the market is deciding whether that major level holds.",
      strategy:"**Key candles to memorize**: (1) Hammer/Inverted Hammer — potential bullish reversal after downtrend (2) Shooting Star/Hanging Man — potential bearish reversal after uptrend (3) Engulfing candles — one candle's body completely engulfs the prior candle, high conviction signal (4) Doji — market indecision, wait for direction. Never trade a single candle in isolation — always check trend, volume, and nearby support/resistance.",
    },
    ko:{
      title:"기본 캔들스틱",
      shortDesc:"모든 차트 분석의 기반 — 단 하나의 캔들이 전하는 이야기 읽기.",
      definition:"캔들은 네 가지 가격을 담습니다: 시가(Open), 고가(High), 저가(Low), 종가(Close). '몸통'은 시가와 종가의 범위이며, 꼬리(그림자)는 고점/저점 극단값을 보여줍니다. 적색/채워진 몸통 = 하락(종가<시가). 녹색/빈 몸통 = 상승(종가>시가). 핵심 단일 캔들 신호: 도지(방향 불확실), 망치형(저가대 상승 반전), 슈팅스타(고가대 하락 반전), 마루보주(강한 방향성).",
      why:"모든 캔들은 해당 시간 동안 매수자와 매도자의 미니 전투 보고서입니다. 긴 아래꼬리는 매도자가 가격을 밀어내렸지만 매수자가 공격적으로 되돌렸음을 의미합니다 — 강력한 매수 흡수. 긴 꼬리의 작은 몸통은 어느 쪽도 결정적 승리를 못 했음을 뜻합니다. 기관 트레이더들은 이러한 미시 전투에 주목하며 오더플로우 주도권을 파악합니다.",
      indicatorFusion:"**거래량이 캔들 신호를 확인합니다**: 3배 평균 거래량의 망치형은 매우 의미 있지만 0.3배 거래량의 망치형은 함정일 수 있습니다. **RSI 맥락**: RSI 25에서의 망치형은 RSI 55에서보다 훨씬 강력합니다. **이동평균**: 200일 MA에서 정확히 형성된 도지는 고확률 셋업으로, 시장이 그 주요 레벨의 지지 여부를 결정하는 순간입니다.",
      strategy:"**외워야 할 핵심 캔들**: (1) 망치형/역망치형 — 하락 추세 이후 상승 반전 가능성 (2) 슈팅스타/행잉맨 — 상승 추세 이후 하락 반전 가능성 (3) 장악형(Engulfing) — 이전 몸통을 완전히 삼키는 강한 확신 신호 (4) 도지 — 시장 우유부단, 방향 확인 대기. 절대 단일 캔들만으로 매매하지 마세요 — 항상 추세, 거래량, 지지/저항 확인 필수.",
    },
    ja:{
      title:"基本的なキャンドルスティック",
      shortDesc:"全てのチャート分析の土台 — 1本のキャンドルのストーリーを読む。",
      definition:"キャンドルは4つの価格を表します：始値、高値、安値、終値（OHLC）。「実体」は始値と終値の範囲。ヒゲは高値・安値の極端値を示します。赤/塗り潰し実体 = 下落。緑/空実体 = 上昇。主要な単線シグナル：同時線（優柔不断）、ハンマー（強気反転）、シューティングスター（弱気反転）、丸坊主（強い確信）。",
      why:"すべてのキャンドルはその期間の買い手と売り手のミニバトルレポートです。長い下ヒゲは売り手が価格を押し下げたが買い手が積極的に買い戻したことを示します。小さな実体と長いヒゲはどちらも決定的な勝利がなかったことを意味します。",
      indicatorFusion:"**出来高がキャンドルシグナルを確認します**：平均の3倍の出来高を伴うハンマーは非常に重要。**RSIの文脈**：RSI25でのハンマーは遥かに強力。**移動平均線**：200日MAで形成される同時線は高確率セットアップ。",
      strategy:"**覚えるべき主要なキャンドル**：(1)ハンマー/逆ハンマー — 下降後の強気反転可能性 (2)シューティングスター/首吊り線 — 上昇後の弱気反転 (3)包み足 — 前のキャンドルの実体を完全に包む強い確信シグナル (4)同時線 — 市場の優柔不断、方向確認待ち。単一のキャンドルだけで取引しないこと。",
    },
  },
  {
    id:"support-resistance", type:"neutral", difficulty:"beginner",
    coreIndicators:["Price Levels","Volume at Price","Historical Pivots"],
    svg:<SupportResistanceSVG/>,
    en:{
      title:"Support & Resistance",
      shortDesc:"The foundation of all price action — levels where buyers and sellers consistently battle.",
      definition:"Support is a price level where buying demand is strong enough to prevent further decline. Resistance is a price level where selling supply is strong enough to prevent further advance. These levels are not exact prices but 'zones.' Key rule: a broken support level often flips to become new resistance, and vice versa (role reversal).",
      why:"Support and resistance exist because of market memory. When price fell to $50 three times and bounced, many traders placed buy orders 'just above $50.' When price approaches again, these orders activate, creating buying pressure. Conversely, traders who bought at $50 in a prior downtrend are relieved to break even and sell at that level (trapped traders creating resistance). Institutional players know where retail stop-losses cluster and use this knowledge in their execution strategies.",
      indicatorFusion:"**Volume Profile (매물대)**: High volume at a price level = strong S/R. Low volume zones = price moves through quickly. **RSI**: A test of support while RSI is oversold (<30) is a high-probability bounce setup. **Moving Averages**: The 50-day and 200-day MAs act as dynamic support/resistance. **Candlestick confirmation**: Look for Hammers at support and Shooting Stars at resistance for high-conviction entries.",
      strategy:"**Trading S/R**: (1) Buy near support when price approaches with slowing momentum, wait for a bullish candle confirmation (2) Sell/short near resistance with bearish confirmation (3) On a strong break + close above resistance, consider the old resistance as new support for entry (4) Wider zones (tested 3+ times) are stronger than recently formed single-touch levels.",
    },
    ko:{
      title:"지지/저항선 (Support & Resistance)",
      shortDesc:"모든 가격 분석의 기초 — 매수자와 매도자가 지속적으로 대립하는 수준.",
      definition:"지지선은 매수 수요가 추가 하락을 막을 만큼 강한 가격 수준입니다. 저항선은 매도 공급이 추가 상승을 막을 만큼 강한 가격 수준입니다. 이 수준들은 정확한 가격이 아닌 '구간'입니다. 핵심 규칙: 돌파된 지지선은 종종 새로운 저항선이 되고, 그 반대도 성립합니다(역할 전환).",
      why:"지지선/저항선은 시장의 기억 때문에 존재합니다. 가격이 세 번 50달러에서 반등했을 때, 많은 트레이더들이 '50달러 바로 위'에 매수 주문을 넣습니다. 가격이 다시 접근하면 이 주문들이 활성화되어 매수 압력을 형성합니다. 반대로, 이전 하락장에서 50달러에 매수했던 투자자들이 손익분기점에서 매도하려 합니다(갇힌 투자자들이 저항을 만듦). 기관은 개인 투자자의 손절 주문이 몰려있는 곳을 파악하고 이를 실행 전략에 활용합니다.",
      indicatorFusion:"**거래량 프로파일(매물대)**: 특정 가격대의 높은 거래량 = 강한 지지/저항. 거래량이 적은 구간 = 가격이 빠르게 통과. **RSI**: 과매도(<30) 상태에서 지지선 테스트 = 고확률 반등 셋업. **이동평균**: 50일, 200일 MA는 동적 지지/저항으로 작용. **캔들 확인**: 지지선에서 망치형, 저항선에서 슈팅스타를 찾으면 고확신 진입 가능.",
      strategy:"**지지/저항 매매**: (1) 모멘텀 둔화와 함께 가격이 지지선에 접근 시 상승 캔들 확인 후 매수 (2) 저항선에서 하락 확인 후 매도/공매도 (3) 저항선을 강하게 돌파하고 종가가 그 위에서 마감되면, 이전 저항선이 새 지지선으로 전환 → 재진입 고려 (4) 3회 이상 테스트된 넓은 구간이 최근 1회 터치된 수준보다 강합니다.",
    },
    ja:{
      title:"サポート＆レジスタンス（支持線/抵抗線）",
      shortDesc:"全ての価格分析の基礎 — 買い手と売り手が継続的に争うレベル。",
      definition:"サポートは買い需要がそれ以上の下落を防ぐのに十分強い価格水準です。レジスタンスは売り供給がそれ以上の上昇を防ぐ水準です。これらは正確な価格ではなく「ゾーン」です。重要なルール：突破されたサポートは新しいレジスタンスになることが多く、その逆もあります（役割転換）。",
      why:"サポート・レジスタンスは市場の記憶があるから存在します。価格が3回$50で反発した時、多くのトレーダーが「$50のすぐ上」に買い注文を置きます。機関投資家は個人投資家の損切り注文が集まる場所を把握し、執行戦略に活用します。",
      indicatorFusion:"**出来高プロファイル**：特定価格帯の高出来高 = 強いS/R。**RSI**：売られ過ぎ(<30)でのサポートテスト = 高確率リバウンドセットアップ。**移動平均線**：50日・200日MAは動的S/Rとして機能。**キャンドル確認**：サポートでハンマー、レジスタンスでシューティングスターを探す。",
      strategy:"**S/R取引**：(1)モメンタム鈍化を伴いサポートに接近した際、強気キャンドル確認後に買い (2)レジスタンスで弱気確認後に売り/空売り (3)レジスタンスを強く上抜け・終値が上回ると旧レジスタンスが新サポートに転換 → 再エントリー検討 (4)3回以上テストされた広いゾーンはより強い。",
    },
  },
  {
    id:"trend-lines", type:"neutral", difficulty:"beginner",
    coreIndicators:["Highs/Lows","Slope","Volume on Breaks"],
    svg:<TrendLineSVG/>,
    en:{
      title:"Trend Lines",
      shortDesc:"Connecting price pivots to visualize trend direction and momentum.",
      definition:"An uptrend line connects at least 2-3 rising lows. A downtrend line connects 2-3 declining highs. The trend line acts as dynamic support (uptrend) or resistance (downtrend). The slope reveals momentum: steep = strong trend, shallow = weakening. A break of the trend line is the first warning of potential trend change.",
      why:"Trend lines work because market participants observe and react to them. When a stock is in an uptrend and pulls back to its trend line, many traders see this as an opportunity to buy 'dips.' This self-fulfilling behavior creates buying pressure exactly at the trend line, making it a real support level. Similarly, institutions use trend lines to time their accumulation: buying on each test of the uptrend line is a lower-risk strategy than chasing price at highs.",
      indicatorFusion:"**Volume validation**: Rising volume on bounces from the trend line confirms demand. Declining volume as price approaches the trend line from below (during an uptrend) = potential break. **MACD**: A bearish MACD crossover as price tests the uptrend line suggests the bounce may fail. **RSI**: RSI making lower highs while price is still making higher highs (touching the trend line) signals hidden weakness.",
      strategy:"**Using trend lines**: (1) Connect a minimum of 3 pivot points for reliability (2 points create a line, 3+ create a 'confirmed' trend line) (2) Use the trend line as your dynamic stop-loss level: exit if price closes convincingly below (3) Steeper trend lines break more frequently — use them to time entries but don't rely on them for long-duration holds (4) A broken uptrend line that is later retested from below is a high-conviction short entry.",
    },
    ko:{
      title:"추세선 (Trend Lines)",
      shortDesc:"가격 피벗을 연결하여 추세 방향과 모멘텀을 시각화하기.",
      definition:"상승 추세선은 최소 2-3개의 상승하는 저점을 연결합니다. 하락 추세선은 2-3개의 하락하는 고점을 연결합니다. 추세선은 동적 지지선(상승 추세) 또는 저항선(하락 추세) 역할을 합니다. 기울기는 모멘텀을 나타냅니다: 가파름 = 강한 추세, 완만함 = 약화. 추세선 이탈은 추세 전환 가능성의 첫 번째 경고입니다.",
      why:"추세선이 효과를 발휘하는 이유는 시장 참가자들이 이를 관찰하고 반응하기 때문입니다. 주식이 상승 추세에 있고 추세선까지 되돌릴 때, 많은 트레이더들이 '저점 매수' 기회로 봅니다. 이 자기실현적 행동이 추세선에서 정확히 매수 압력을 형성하여 진짜 지지 수준을 만듭니다. 기관들도 추세선을 이용해 매집 타이밍을 조절합니다.",
      indicatorFusion:"**거래량 검증**: 추세선 반등 시 거래량 증가 = 수요 확인. **MACD**: 가격이 상승 추세선을 테스트할 때 하락 MACD 교차 = 반등 실패 가능성 시사. **RSI**: RSI가 낮은 고점을 만들지만 가격은 여전히 추세선에 닿으며 고점을 만드는 경우 = 숨겨진 약세(베어리쉬 다이버전스) 신호.",
      strategy:"**추세선 활용법**: (1) 신뢰성을 위해 최소 3개의 피벗 포인트 연결 (2개는 선 그리기, 3개 이상은 '확인된' 추세선) (2) 추세선을 동적 손절 수준으로 활용: 아래로 종가 이탈 시 청산 (3) 더 가파른 추세선은 더 자주 이탈됨 — 진입 타이밍에 활용하되 장기 보유 기준으로는 부적합 (4) 이탈된 상승 추세선을 아래에서 재테스트하면 고확률 공매도 진입 기회.",
    },
    ja:{
      title:"トレンドライン",
      shortDesc:"価格のピボットを結んでトレンドの方向とモメンタムを視覚化する。",
      definition:"上昇トレンドラインは最低2〜3の上昇する安値を結びます。下降トレンドラインは2〜3の下降する高値を結びます。トレンドラインは動的サポート（上昇トレンド）またはレジスタンス（下降トレンド）として機能します。傾きがモメンタムを示します：急勾配 = 強いトレンド、緩やか = 弱まり。",
      why:"トレンドラインは市場参加者が観察して反応するため機能します。株が上昇トレンドにあり、トレンドラインまで押し戻された時、多くのトレーダーが「押し目買い」の機会と見ます。この自己実現的な行動がトレンドラインで買い圧力を生み出します。",
      indicatorFusion:"**出来高検証**：トレンドラインでの反発時に出来高増加 = 需要確認。**MACD**：価格がトレンドラインをテスト中にMACDの弱気クロス = 反発失敗の可能性。**RSI**：ベアリッシュダイバージェンス = 隠れた弱さのシグナル。",
      strategy:"**トレンドラインの活用**：(1)信頼性のために最低3つのピボットポイントを結ぶ (2)動的損切り水準として活用 (3)急勾配のトレンドラインはより頻繁に割れる (4)割れた上昇トレンドラインの下からの再テストは高確率の空売りエントリー。",
    },
  },
  {
    id:"basic-moving-averages", type:"neutral", difficulty:"beginner",
    coreIndicators:["SMA 20/50/200","EMA 9/21","Price vs MA"],
    svg:<MovingAverageSVG/>,
    en:{
      title:"Basic Moving Averages",
      shortDesc:"Smooth out price noise to reveal the underlying trend direction.",
      definition:"A Simple Moving Average (SMA) calculates the average price over N periods. Common periods: 20-day (short-term trend), 50-day (medium-term), 200-day (long-term). The Exponential Moving Average (EMA) weights recent prices more heavily, making it more responsive. When price is above a MA, trend is bullish; below = bearish. MAs slope and spacing reveal trend strength.",
      why:"Moving averages represent the average cost basis of investors over different time horizons. The 200-day MA especially is watched religiously by institutional investors as a dividing line between bull and bear markets. Pension funds and large mutual funds often have rules: 'only buy stocks trading above their 200-day MA.' This creates a self-reinforcing dynamic — the more participants watch a level, the more 'real' it becomes as a support/resistance.",
      indicatorFusion:"**MA Crossover System**: 9/21 EMA crossover for short-term signals; 50/200 SMA for long-term (Golden/Death Cross). **Ribbon approach**: When 20, 50, 100, 200 MAs are fanned out and rising = strong bull trend; compressed or tangled = consolidation or trend change. **Price vs 200 MA**: Above = potential buy dips. Below = potential sell rallies. **Volume**: A pullback to the MA on declining volume (healthy correction) vs expanding volume (potential breakdown) is a key distinction.",
      strategy:"**MA trading rules**: (1) In an uptrend, use the 20-day EMA as a buy-the-dip level; the 50-day as a deeper support (2) A stock finding support at its 200-day MA for the first time after a pullback often signals a major buying opportunity (3) Never fight the trend — if price is below the 200-day MA, all longs are higher-risk (4) In sideways markets, MAs give false signals constantly — switch to S/R analysis instead.",
    },
    ko:{
      title:"기본 이동평균 (Moving Averages)",
      shortDesc:"가격 노이즈를 평탄화하여 추세 방향을 파악하는 기초 도구.",
      definition:"단순이동평균(SMA)은 N개 기간의 평균 가격을 계산합니다. 주요 기간: 20일(단기 추세), 50일(중기), 200일(장기). 지수이동평균(EMA)은 최근 가격에 더 큰 가중치를 부여하여 더 빠르게 반응합니다. 가격이 MA 위 = 강세, 아래 = 약세. MA의 기울기와 간격은 추세 강도를 나타냅니다.",
      why:"이동평균은 각 시간 지평에 걸친 투자자들의 평균 취득 원가를 나타냅니다. 특히 200일 MA는 기관 투자자들이 강세장과 약세장의 경계선으로 가장 중요시합니다. 연금 펀드와 대형 뮤추얼 펀드는 종종 '200일 MA 위에서 거래되는 주식만 매수'라는 규정이 있습니다. 이것이 자기 강화적 역학을 만듭니다.",
      indicatorFusion:"**MA 교차 시스템**: 단기 신호는 9/21 EMA 교차, 장기는 50/200 SMA(골든/데드 크로스). **리본 접근법**: 20, 50, 100, 200 MA가 펼쳐지며 상승 = 강한 강세 추세. **가격 vs 200 MA**: 위 = 저점 매수 고려, 아래 = 반등 시 매도 고려. **거래량**: 감소하는 거래량으로 MA까지 되돌림(건강한 조정) vs 증가하는 거래량(잠재적 이탈) 구분이 핵심.",
      strategy:"**MA 매매 규칙**: (1) 상승 추세에서 20일 EMA를 저점 매수 기준으로, 50일을 더 깊은 지지로 활용 (2) 하락 이후 처음으로 200일 MA에서 지지받는 주식은 종종 주요 매수 기회를 시사 (3) 추세에 역행하지 말 것 — 200일 MA 아래라면 모든 롱 포지션은 더 높은 리스크 (4) 횡보장에서는 MA가 끊임없이 거짓 신호 제공 — 지지/저항 분석으로 전환.",
    },
    ja:{
      title:"基本的な移動平均線",
      shortDesc:"価格のノイズを平滑化してトレンド方向を把握する基礎ツール。",
      definition:"単純移動平均（SMA）はN期間の平均価格を計算します。主要期間：20日（短期）、50日（中期）、200日（長期）。指数移動平均（EMA）は直近価格に大きなウェイトを置き、より速く反応します。価格がMAの上 = 強気、下 = 弱気。",
      why:"移動平均線は各時間軸での投資家の平均取得コストを表します。特に200日MAは機関投資家が強気相場と弱気相場の境界線として最も重視します。年金ファンドや大型投資信託は「200日MAの上で取引される銘柄のみを買う」というルールを持つことが多いです。",
      indicatorFusion:"**MAクロスオーバーシステム**：短期は9/21 EMAクロス、長期は50/200 SMA（ゴールデン/デスクロス）。**リボンアプローチ**：複数MAが広がって上昇中 = 強い強気トレンド。**出来高**：減少する出来高でMAまでの押し戻り（健全な調整）vs 増加する出来高（潜在的割れ）の区別が重要。",
      strategy:"**MA取引ルール**：(1)上昇トレンドでは20日EMAを押し目買いの基準に (2)下落後初めて200日MAでサポートされた銘柄は主要な買い機会を示すことが多い (3)トレンドに逆らわない — 200日MAの下では全てのロングはリスクが高い (4)横ばい市場ではMAは頻繁に偽シグナルを出す。",
    },
  },
  // ── INTERMEDIATE ──
  {
    id:"head-shoulders", type:"bearish", difficulty:"intermediate",
    coreIndicators:["Price Structure","Volume","Neckline"],
    svg:<HeadShouldersSVG/>,
    en:{title:"Head & Shoulders",shortDesc:"Three peaks signal the end of an uptrend — the most classic reversal pattern.",definition:"Three peaks: a higher middle peak (Head) flanked by two lower peaks (Shoulders). A 'neckline' connects the two troughs. A confirmed close below the neckline on volume signals bearish reversal.",why:"Left shoulder: optimistic buyers push up, profit-taking emerges. Head: bulls make a final push to new high but sellers absorb every bid. Right shoulder: bulls fail to reach even the prior high — institutional 'smart money' has rotated out. Neckline break triggers algorithmic stop-losses.",indicatorFusion:"**Volume pattern**: Volume should be highest on left shoulder, lower on head, lowest on right shoulder — diminishing buying conviction. A surge in volume on the neckline break confirms institutional selling. **RSI**: Bearish divergence (RSI makes lower highs across the three peaks) is a powerful confirmation. **MACD**: A bearish MACD crossover during right shoulder formation is an early warning.",strategy:"**Entry**: Short on confirmed close below neckline, or retest of neckline from below.\n**Target**: Head-to-neckline distance projected downward from breakpoint.\n**Stop-Loss**: Just above right shoulder."},
    ko:{title:"헤드앤숄더 (Head & Shoulders)",shortDesc:"세 개의 봉우리가 상승 추세의 끝을 알리는 가장 고전적인 반전 패턴.",definition:"세 개의 고점: 더 높은 가운데 고점(헤드)과 양쪽의 낮은 두 고점(숄더). '넥라인'이 두 저점을 연결. 거래량을 동반한 넥라인 하방 종가 이탈 = 하락 반전 신호.",why:"왼쪽 숄더: 낙관적 매수 후 차익 실현. 헤드: 강세론자의 마지막 시도로 신고가 달성 후 매도 흡수. 오른쪽 숄더: 이전 고점도 못 넘으며 스마트머니 이탈 확인. 넥라인 이탈 시 알고리즘 손절매 연쇄 발동.",indicatorFusion:"**거래량 패턴**: 왼쪽 숄더에서 가장 높고, 헤드에서 낮고, 오른쪽 숄더에서 가장 낮아야 합니다 — 매수 확신의 감소. 넥라인 이탈 시 거래량 급증 = 기관 매도 확인. **RSI**: 세 고점에 걸쳐 RSI가 낮은 고점(베어리쉬 다이버전스) = 강력한 확인. **MACD**: 오른쪽 숄더 형성 중 하락 MACD 교차 = 조기 경고.",strategy:"**진입**: 넥라인 하방 종가 이탈 후 공매도, 또는 넥라인 재테스트 시.\n**목표가**: 헤드에서 넥라인까지의 거리를 이탈 지점에서 하방으로.\n**손절**: 오른쪽 숄더 바로 위."},
    ja:{title:"ヘッドアンドショルダー",shortDesc:"3つの山が上昇トレンドの終焉を告げる最も古典的な反転パターン。",definition:"3つのピーク：高い中央ピーク（ヘッド）と両側の低いピーク（ショルダー）。ネックラインが2つの谷を結ぶ。出来高を伴うネックライン下抜けが弱気反転を示します。",why:"左肩：楽観的な買いの後に利益確定。ヘッド：強気筋の最後の試みで新高値を付けるが売りに阻まれる。右肩：前の高値も届かず機関の売り抜け確認。ネックライン割れで連鎖的な損切りが発動。",indicatorFusion:"**出来高パターン**：左肩が最多、ヘッドで減少、右肩で最少 — 買いの確信の低下。ネックライン割れ時の出来高急増 = 機関の売りを確認。**RSI**：ベアリッシュダイバージェンス = 強力な確認。**MACD**：右肩形成中の弱気クロス = 早期警告。",strategy:"**エントリー**：ネックライン下抜け確認後の空売り、またはネックラインの再テスト時。\n**目標**：ヘッドからネックラインまでの距離を下方に投影。\n**損切り**：右肩のすぐ上。"},
  },
  {
    id:"double-bottom", type:"bullish", difficulty:"intermediate",
    coreIndicators:["Price Structure","Volume","Neckline Break"],
    svg:<DoubleBottomSVG/>,
    en:{title:"Double Bottom",shortDesc:"Two equal lows at support — a reliable bullish reversal pattern.",definition:"Price finds support at the same level twice and bounces. Two roughly equal troughs separated by a recovery rally. Confirmed when price breaks above the peak between the two bottoms.",why:"First trough attracts bargain hunters. Second test proves demand absorption — sellers cannot push lower. Each bounce proves buyers are 'defending' support with increasing conviction. Neckline breakout signals demand has absorbed all supply.",indicatorFusion:"**Volume**: Second bottom should form on LOWER volume than first (sellers exhausted). Neckline breakout on HIGH volume confirms. **RSI**: Bullish divergence (RSI makes higher low at second bottom) is the strongest confirmation signal. **MACD**: A bullish crossover during or just after the second bottom is ideal entry confirmation.",strategy:"**Entry**: Buy on confirmed close above neckline (middle peak).\n**Target**: Pattern height (trough to neckline) projected upward from breakout.\n**Stop-Loss**: Below second bottom. A new low invalidates the pattern."},
    ko:{title:"이중 바닥 (Double Bottom)",shortDesc:"지지선에서 두 번 반등 — 신뢰할 수 있는 상승 반전 패턴.",definition:"가격이 같은 지지 수준에서 두 번 반등합니다. 두 저점이 거의 같고 중간에 반등이 있습니다. 두 바닥 사이 고점(넥라인) 상방 돌파로 확인됩니다.",why:"첫 저점에서 저가 매수자 유입. 두 번째 테스트에서 매수 흡수 증명. 매번 반등은 매수자들이 지지선을 더 강한 확신으로 방어함을 증명. 넥라인 돌파는 공급 소화 완료 신호.",indicatorFusion:"**거래량**: 두 번째 저점은 첫 번째보다 낮은 거래량으로 형성(매도 소진). 넥라인 돌파는 높은 거래량으로 확인. **RSI**: 두 번째 저점에서 RSI가 더 높은 저점(불리쉬 다이버전스) = 가장 강력한 확인 신호. **MACD**: 두 번째 저점 중 또는 직후 상승 교차 = 이상적인 진입 확인.",strategy:"**진입**: 넥라인(중간 고점) 상방 종가 돌파 시 매수.\n**목표가**: 패턴 높이(저점→넥라인)를 돌파 지점에서 상방으로.\n**손절**: 두 번째 저점 아래. 신저가 발생 시 패턴 무효."},
    ja:{title:"ダブルボトム",shortDesc:"サポートで2回反発 — 信頼性の高い強気反転パターン。",definition:"価格が同じサポート水準で2回反発します。概ね等しい2つの谷と中間の反発ラリー。2つの底の間のピークを上抜けると確認されます。",why:"最初の谷でバーゲンハンターが買いを入れます。2回目のテストで需要の吸収力を証明。ネックライン突破は供給の完全な吸収を示します。",indicatorFusion:"**出来高**：2番底は1番底より低い出来高で形成（売り手枯渇）。ネックライン突破は高出来高で確認。**RSI**：ブリッシュダイバージェンス = 最強の確認シグナル。**MACD**：2番底後の強気クロス = 理想的なエントリー確認。",strategy:"**エントリー**：ネックライン上抜け確認後の買い。\n**目標**：パターンの高さをブレイクアウト地点から上方に投影。\n**損切り**：2番底の下。"},
  },
  {
    id:"rsi-divergence", type:"neutral", difficulty:"intermediate",
    coreIndicators:["RSI (14)","Price Action","Oscillator Reading"],
    svg:<RSIDivergenceSVG/>,
    en:{
      title:"RSI Divergence",
      shortDesc:"When price and momentum tell opposite stories — a powerful early reversal signal.",
      definition:"Divergence occurs when price and RSI move in opposite directions. **Bearish Divergence**: Price makes a higher high, but RSI makes a lower high — momentum is weakening despite price gains. **Bullish Divergence**: Price makes a lower low, but RSI makes a higher low — selling pressure is losing conviction despite price decline. Hidden divergence is used for trend continuation setups.",
      why:"The RSI measures the speed and magnitude of price changes — it tracks internal momentum, not just price. When a stock makes new highs but the RSI fails to confirm (lower high), it means each successive rally is requiring less buying energy. Early institutional sellers are quietly exiting at each push higher, preventing RSI from expanding. This is a 'price leading, momentum lagging' divergence that typically resolves with price eventually catching down to where RSI was already pointing.",
      indicatorFusion:"**Confirm with MACD**: Divergence on both RSI and MACD simultaneously is a very high-conviction signal. **Volume**: Bearish divergence forming on declining volume = weak demand. **S/R levels**: Divergence at a major resistance level dramatically increases its reliability — price meets structural resistance + internal momentum failure simultaneously. **Candlestick**: A bearish engulfing or shooting star at the divergence high confirms the reversal.",
      strategy:"**Entry for bearish divergence**: Short when price approaches the divergence high, confirmed by a bearish candlestick. Or wait for MACD to cross bearish.\n**Entry for bullish divergence**: Buy near the divergence low with bullish confirmation candle.\n**Stop-Loss**: Beyond the divergence extreme (above recent high for bearish, below recent low for bullish).\n**Note**: Divergence alone is not enough — it can persist for many candles. Always wait for price action confirmation.",
    },
    ko:{
      title:"RSI 다이버전스 (RSI Divergence)",
      shortDesc:"가격과 모멘텀이 반대 방향 — 강력한 조기 반전 신호.",
      definition:"다이버전스는 가격과 RSI가 반대 방향으로 움직일 때 발생합니다. **베어리쉬 다이버전스**: 가격이 더 높은 고점을 만들지만 RSI는 더 낮은 고점 — 가격 상승에도 모멘텀 약화. **불리쉬 다이버전스**: 가격이 더 낮은 저점을 만들지만 RSI는 더 높은 저점 — 가격 하락에도 매도 압력 약화. 숨겨진 다이버전스는 추세 지속 셋업에 활용됩니다.",
      why:"RSI는 가격 변화의 속도와 크기를 측정합니다 — 단순 가격이 아닌 내부 모멘텀을 추적합니다. 주식이 신고가를 만들지만 RSI가 확인하지 못하면, 각 반등이 점점 적은 매수 에너지를 필요로 함을 의미합니다. 초기 기관 매도자들이 매번 상승 시 조용히 청산하여 RSI 확장을 막습니다. 이것이 '가격 선행, 모멘텀 후행'의 다이버전스로, 결국 가격이 RSI가 이미 가리켰던 방향으로 따라옵니다.",
      indicatorFusion:"**MACD 확인**: RSI와 MACD 모두에 동시 다이버전스 = 매우 고확신 신호. **거래량**: 감소하는 거래량으로 형성되는 베어리쉬 다이버전스 = 약한 수요. **지지/저항**: 주요 저항선에서의 다이버전스는 신뢰성을 크게 높입니다. **캔들**: 다이버전스 고점에서 하락 장악형 또는 슈팅스타 = 반전 확인.",
      strategy:"**베어리쉬 다이버전스 진입**: 가격이 다이버전스 고점에 접근 시 하락 캔들 확인 후 공매도. 또는 MACD 하락 교차 대기.\n**불리쉬 다이버전스 진입**: 다이버전스 저점 근처에서 상승 확인 캔들로 매수.\n**손절**: 다이버전스 극단값 너머.\n**주의**: 다이버전스만으로는 충분하지 않습니다 — 여러 캔들에 걸쳐 지속될 수 있습니다. 항상 가격 행동 확인을 기다리세요.",
    },
    ja:{
      title:"RSIダイバージェンス",
      shortDesc:"価格とモメンタムが逆方向を示す時 — 強力な早期反転シグナル。",
      definition:"ダイバージェンスは価格とRSIが逆方向に動く時に発生します。**ベアリッシュ**：価格が高値を更新するがRSIは低い高値 — モメンタム低下。**ブリッシュ**：価格が安値を更新するがRSIは高い安値 — 売り圧力の低下。",
      why:"RSIは価格変化の速度と大きさを測定します。新高値なのにRSIが確認しない場合、各反発がより少ない買いエネルギーを必要としていることを意味します。初期の機関投資家の売り手が各上昇で静かにポジションを清算し、RSIの拡張を妨げています。",
      indicatorFusion:"**MACDで確認**：RSIとMACDの両方に同時ダイバージェンス = 非常に高確信シグナル。**出来高**：減少する出来高でのベアリッシュダイバージェンス = 弱い需要。**S/R**：主要レジスタンスでのダイバージェンスは信頼性を大幅に高める。**キャンドル**：ダイバージェンス高値での弱気包み足やシューティングスター = 反転確認。",
      strategy:"**ベアリッシュエントリー**：価格がダイバージェンス高値に近づいた時、弱気キャンドル確認後に空売り。**ブリッシュエントリー**：ダイバージェンス安値付近で強気確認キャンドルで買い。**損切り**：ダイバージェンスの極端値の向こう側。",
    },
  },
  {
    id:"macd-cross", type:"neutral", difficulty:"intermediate",
    coreIndicators:["MACD Line","Signal Line","Histogram"],
    svg:<MACDCrossSVG/>,
    en:{
      title:"MACD Golden/Death Cross",
      shortDesc:"The MACD line crossing its signal line — a momentum shift confirmation tool.",
      definition:"The MACD (Moving Average Convergence Divergence) is calculated as 12-period EMA minus 26-period EMA. The Signal Line is a 9-period EMA of the MACD. **Golden Cross**: MACD line crosses above Signal → bullish momentum. **Death Cross**: MACD line crosses below Signal → bearish momentum. The Histogram shows the gap between MACD and Signal — a shrinking histogram forecasts an upcoming crossover.",
      why:"MACD captures the convergence or divergence of two EMAs — essentially measuring whether recent price momentum is accelerating or decelerating relative to its longer-term average. When the fast 12-period EMA pulls away from the slow 26-period EMA to the upside, it means recent buyers are paying more than the average cost of the past 26 days — strong momentum. The crossover represents the tipping point where momentum shifts direction.",
      indicatorFusion:"**RSI confirmation**: MACD Golden Cross confirmed by RSI crossing above 50 = very strong bullish signal. **Volume**: High volume on the crossover day adds conviction. **Histogram divergence**: Histogram bars declining BEFORE the crossover (each bar smaller) predicts the crossover — earlier entry possible. **Price action**: MACD Golden Cross when price is also above its 200-day MA = only-bullish environment. Below 200-day MA = countertrend rally, be cautious.",
      strategy:"**Bullish entry**: Buy when MACD line crosses above Signal line, confirmed by price above key MA.\n**Bearish entry**: Sell/short on MACD Death Cross below Signal, confirmed by price below key MA.\n**Advanced**: Use histogram to enter BEFORE the crossover (histogram shrinking to zero = crossover imminent).\n**Caution**: MACD is a lagging indicator. In fast-moving markets or on smaller timeframes, by the time the cross occurs, most of the move may be over.",
    },
    ko:{
      title:"MACD 골든/데드 크로스",
      shortDesc:"MACD선이 시그널선을 교차 — 모멘텀 전환 확인 도구.",
      definition:"MACD = 12기간 EMA - 26기간 EMA. 시그널선은 MACD의 9기간 EMA. **골든 크로스**: MACD선이 시그널선 상방 교차 → 상승 모멘텀. **데드 크로스**: MACD선이 시그널선 하방 교차 → 하락 모멘텀. 히스토그램은 MACD와 시그널의 차이를 표시 — 줄어드는 히스토그램은 교차 예고.",
      why:"MACD는 두 EMA의 수렴/발산을 포착하여 최근 가격 모멘텀이 장기 평균 대비 가속 또는 감속하는지를 측정합니다. 빠른 12기간 EMA가 느린 26기간 EMA를 상방으로 이탈하면, 최근 매수자들이 지난 26일 평균 비용보다 더 높은 가격을 지불한다는 의미 — 강한 모멘텀. 교차는 모멘텀이 방향을 전환하는 티핑 포인트를 나타냅니다.",
      indicatorFusion:"**RSI 확인**: MACD 골든 크로스 + RSI 50선 상방 교차 = 매우 강한 강세 신호. **거래량**: 교차 당일 높은 거래량이 확신 추가. **히스토그램 다이버전스**: 교차 전 히스토그램 막대 감소(조기 진입 가능). **가격 행동**: 200일 MA 위에서의 MACD 골든 크로스 = 순수 강세 환경. 200일 MA 아래 = 역추세 반등, 주의 필요.",
      strategy:"**상승 진입**: MACD선이 시그널선 상방 교차 시, 가격이 주요 MA 위에 있음을 확인 후 매수.\n**하락 진입**: 주요 MA 아래에서 MACD 데드 크로스 시 매도/공매도.\n**고급**: 히스토그램이 0으로 수렴(교차 임박) 시 교차 전 진입 가능.\n**주의**: MACD는 후행 지표입니다. 빠른 시장이나 작은 시간대에서는 교차 발생 시 이미 움직임의 대부분이 끝났을 수 있습니다.",
    },
    ja:{
      title:"MACDゴールデン/デスクロス",
      shortDesc:"MACDラインがシグナルラインをクロス — モメンタム転換確認ツール。",
      definition:"MACD = 12期間EMA - 26期間EMA。シグナルラインはMACDの9期間EMA。**ゴールデンクロス**：MACDラインがシグナルを上抜け → 強気モメンタム。**デスクロス**：MACDラインがシグナルを下抜け → 弱気モメンタム。ヒストグラムはMACDとシグナルの差を表示 — 縮小するヒストグラムはクロスオーバーを予告。",
      why:"MACDは2つのEMAの収束/乖離を捉え、最近の価格モメンタムが長期平均に対して加速または減速しているかを測定します。速い12期間EMAが遅い26期間EMAを上方に離れると、最近の買い手が過去26日の平均コストより高い価格を払っていることを意味します。",
      indicatorFusion:"**RSI確認**：MACDゴールデンクロス + RSIが50を上抜け = 非常に強い強気シグナル。**出来高**：クロス当日の高出来高が確信を追加。**ヒストグラムダイバージェンス**：クロス前のヒストグラム縮小（早期エントリー可能）。",
      strategy:"**強気エントリー**：MACDラインがシグナルを上抜け時、価格が主要MAの上にあることを確認して買い。\n**弱気エントリー**：主要MAの下でMACDデスクロス時に売り/空売り。\n**注意**：MACDは遅行指標です。速い市場では、クロス発生時に動きの大部分が終わっている可能性があります。",
    },
  },
  {
    id:"volume-profile", type:"neutral", difficulty:"intermediate",
    coreIndicators:["Volume at Price","Point of Control","High Volume Nodes"],
    svg:<VolumeProfileSVG/>,
    en:{
      title:"Volume Profile (매물대)",
      shortDesc:"Where was the most trading done? High-volume price zones = strongest support/resistance.",
      definition:"Volume Profile displays trading activity at each price level (horizontal histogram) rather than over time. Key concepts: **Point of Control (POC)** = price level with the highest volume (strongest S/R). **High Volume Nodes (HVN)** = price zones where lots of trading occurred (strong S/R, price may consolidate here). **Low Volume Nodes (LVN)** = price zones with little trading history (price moves through quickly — these are acceleration zones).",
      why:"Volume is the most honest indicator — it literally shows where real money changed hands. When institutional investors buy a large position, they do it near a price level repeatedly, creating a HVN (High Volume Node). When price returns to that level, those institutions recognize it as their cost basis and either add more (buying support) or defend it (selling resistance). LVNs are 'price voids' — there are few orders resting there, so price 'falls through' or 'rockets through' with minimal friction.",
      indicatorFusion:"**Combine with Price Action**: Price approaching a POC from above = likely support. Price approaching from below = likely resistance. **S/R Zones**: Use Volume Profile HVNs as your primary S/R levels — they're more reliable than arbitrary round numbers. **Trend Lines**: An uptrend line that aligns with a HVN is doubly strong. **VWAP**: VWAP and POC near the same price = triple confluence support/resistance level.",
      strategy:"**Trading Volume Profile**: (1) In a range-bound market, buy near the bottom HVN, sell near the top HVN — the POC is likely mid-range (2) For breakouts: a close above an LVN with volume = fast move coming (few orders above) (3) A pullback to the POC after a breakout = ideal re-entry for bulls (4) Watch for 'volume gaps' (LVNs) above price during consolidation — these are price targets once the range breaks.",
    },
    ko:{
      title:"거래량 프로파일 (Volume Profile / 매물대)",
      shortDesc:"가장 많은 거래가 이루어진 곳은? 고거래량 가격대 = 가장 강한 지지/저항.",
      definition:"거래량 프로파일은 시간이 아닌 각 가격 수준에서의 거래 활동을 수평 히스토그램으로 표시합니다. 핵심 개념: **POC(Point of Control)** = 가장 높은 거래량의 가격 수준(가장 강한 지지/저항). **HVN(High Volume Node)** = 거래가 많이 발생한 가격대(강한 지지/저항, 가격이 여기서 횡보 가능). **LVN(Low Volume Node)** = 거래 이력이 적은 가격대(가격이 빠르게 통과 — 가속 구간).",
      why:"거래량은 가장 정직한 지표 — 실제 돈이 이동한 곳을 문자 그대로 보여줍니다. 기관 투자자들이 대규모 포지션을 매수할 때, 특정 가격 수준 근처에서 반복적으로 매수하여 HVN을 형성합니다. 가격이 그 수준으로 돌아오면 기관들은 이를 자신의 취득 원가로 인식하고 추가 매수(지지 형성) 또는 방어(저항 형성)를 합니다. LVN은 '가격 공백' — 그곳에 대기 주문이 거의 없어 가격이 마찰 없이 '통과'합니다.",
      indicatorFusion:"**가격 행동과 결합**: 위에서 POC에 접근하는 가격 = 지지 가능. 아래에서 접근 = 저항 가능. **지지/저항**: Volume Profile HVN을 임의적 라운드 넘버보다 더 신뢰할 수 있는 지지/저항으로 활용. **추세선**: HVN과 일치하는 추세선은 배가 강력. **VWAP**: VWAP과 POC가 같은 가격 근처에 있으면 = 삼중 수렴 지지/저항 수준.",
      strategy:"**Volume Profile 매매**: (1) 레인지 장에서: 하단 HVN 근처 매수, 상단 HVN 근처 매도 (2) 돌파 시: LVN 위를 거래량으로 종가 이탈 = 빠른 움직임 예상(위에 주문 없음) (3) 돌파 후 POC로 되돌림 = 강세론자의 이상적인 재진입 (4) 횡보 중 가격 위 '거래량 공백(LVN)' 관찰 — 레인지 돌파 후 가격 목표.",
    },
    ja:{
      title:"出来高プロファイル（ボリュームプロファイル）",
      shortDesc:"最も多くの取引が行われた場所は？高出来高価格帯 = 最強のサポート/レジスタンス。",
      definition:"出来高プロファイルは時間軸ではなく各価格水準での取引活動を水平ヒストグラムで表示します。**POC（ポイントオブコントロール）** = 最高出来高の価格水準（最強S/R）。**HVN（高出来高ノード）** = 多くの取引が行われた価格帯（強いS/R）。**LVN（低出来高ノード）** = 取引履歴が少ない価格帯（価格が素早く通過 = 加速ゾーン）。",
      why:"出来高は最も正直な指標 — 実際のお金が移動した場所を文字通り示します。機関投資家が大規模ポジションを買う際、特定の価格水準近くで繰り返し買い、HVNを形成します。LVNは「価格の空白」で、そこには待機注文がほとんどないため、価格は摩擦なく「通過」します。",
      indicatorFusion:"**価格アクションとの組み合わせ**：上からPOCに接近 = サポートの可能性。下から接近 = レジスタンスの可能性。**VWAP**：VWAPとPOCが同じ価格近くにある = トリプル収束S/R水準。",
      strategy:"**出来高プロファイル取引**：(1)レンジ相場では下部HVN付近で買い、上部HVN付近で売り (2)ブレイクアウト時：LVNを出来高で上抜け = 速い動きの予兆 (3)ブレイクアウト後のPOCへの押し目 = 理想的な再エントリー (4)横ばい中の価格上部の「出来高の空白(LVN)」を観察。",
    },
  },
  {
    id:"bull-flag", type:"bullish", difficulty:"intermediate",
    coreIndicators:["Volume","Consolidation Angle","Breakout"],
    svg:<BullFlagSVG/>,
    en:{title:"Bull Flag",shortDesc:"Sharp rally then tight pullback — textbook continuation of the uptrend.",definition:"A near-vertical price surge (pole) followed by an orderly pullback within parallel trendlines (flag). The flag retraces 30–50% of the pole. High-volume breakout above flag = continuation.",why:"The pole shows buyers overwhelming sellers. The flag is controlled consolidation with drying volume — sellers lack conviction. When volume returns on breakout, fresh institutional demand enters, targeting another pole-length gain.",indicatorFusion:"**Volume**: Volume must DRY UP during the flag. Flag forming on sustained high volume = distribution, not consolidation. **RSI**: RSI pulling back to 50 during the flag (not oversold) = healthy momentum correction. **Moving Averages**: Flag ideally stays above the 20-day EMA — a healthy pullback that doesn't threaten the trend.",strategy:"**Entry**: Buy on high-volume breakout above upper flag trendline.\n**Target**: Add pole's length to flag's breakout point (measured move).\n**Stop-Loss**: Below lower flag boundary."},
    ko:{title:"상승 깃발 (Bull Flag)",shortDesc:"급등 이후 좁은 조정 — 상승 추세 지속의 교과서적 패턴.",definition:"수직에 가까운 급등(폴)에 이어 평행 추세선 안에서 질서 있는 조정(깃발). 깃발은 폴의 30~50% 되돌림. 고거래량 돌파 = 지속.",why:"폴은 매수세가 매도세를 압도. 깃발은 거래량 감소를 동반한 통제된 조정. 돌파 시 거래량이 돌아오면 기관의 신규 매수 유입을 확인.",indicatorFusion:"**거래량**: 깃발 구간에서 반드시 거래량이 감소해야 합니다. 지속적인 고거래량 = 분산(배분), 조정 아님. **RSI**: 깃발 중 RSI가 50으로 되돌림(과매도 아님) = 건강한 모멘텀 조정. **이동평균**: 깃발이 이상적으로 20일 EMA 위에 유지 — 추세를 위협하지 않는 건강한 조정.",strategy:"**진입**: 깃발 상단 추세선 고거래량 돌파 시 매수.\n**목표가**: 폴 길이를 돌파 지점에서 상방으로(Measured Move).\n**손절**: 깃발 하단 추세선 아래."},
    ja:{title:"ブルフラッグ",shortDesc:"急騰後の狭い押し目 — 上昇トレンド継続の教科書的パターン。",definition:"ほぼ垂直の急騰（ポール）に続く平行トレンドライン内での押し目（フラッグ）。フラッグはポールの30〜50%を押し戻します。高出来高のブレイクアウト = 継続。",why:"ポールは買い方が売り方を圧倒。フラッグは出来高が減少する統制されたもみ合い。ブレイクアウト時に出来高が戻れば機関の新規参入を確認。",indicatorFusion:"**出来高**：フラッグ中は必ず出来高が減少する必要があります。持続的な高出来高 = 分散、もみ合いではない。**RSI**：フラッグ中にRSIが50に引き戻る（売られ過ぎでない） = 健全なモメンタム調整。",strategy:"**エントリー**：フラッグ上限を高出来高でブレイクアウト時の買い。\n**目標**：ポールの長さをブレイクアウト地点から上方に投影。\n**損切り**：フラッグ下限の下。"},
  },
  {
    id:"cup-handle", type:"bullish", difficulty:"intermediate",
    coreIndicators:["Base Duration","Handle Depth","Breakout Volume"],
    svg:<CupHandleSVG/>,
    en:{title:"Cup and Handle",shortDesc:"Months-long U-shaped base + brief shakeout = explosive breakout setup.",definition:"A rounded bottom (Cup) forms over weeks/months, followed by a shallow pullback (Handle, ≤12% from the cup high). Breakout above the cup's rim on high volume confirms.",why:"The cup represents institutional base-building — patient accumulation replacing weak holders with strong ones. The handle is a final shakeout of momentum traders before breakout. When institutions recognize the base is complete, they step in aggressively.",indicatorFusion:"**Handle must contract**: Volume should decrease throughout the handle; the week before the breakout often shows the lowest volume in the handle. **RS (Relative Strength) Rating**: Strong stocks have RS lines making new highs during the cup/handle formation. **Moving Averages**: Price should reclaim all major MAs by the time it forms the handle. **Market conditions**: Cup & Handle breakouts work best in bull markets — require overall market tailwind.",strategy:"**Entry**: Buy on high-volume breakout above the cup's rim ('pivot point').\n**Target**: Cup depth projected upward from breakout.\n**Stop-Loss**: Below the handle's low or 7-8% below entry."},
    ko:{title:"컵앤핸들 (Cup & Handle)",shortDesc:"수개월의 U자형 바닥 + 마지막 흔들기 = 폭발적 돌파 셋업.",definition:"둥근 바닥(컵)이 수주~수개월 형성 후 얕은 되돌림(핸들, 컵 고점의 12% 이내). 거래량 동반 컵 상단 돌파로 확인.",why:"컵은 기관의 바닥 구축 — 인내심 있는 매집으로 약한 보유자를 강한 보유자로 교체. 핸들은 돌파 전 마지막 흔들기. 기관이 바닥 완성을 인식하고 공격적으로 매수.",indicatorFusion:"**핸들이 수축해야 합니다**: 핸들 전반에 걸쳐 거래량이 감소해야 합니다. **상대강도(RS)**: 강한 주식은 컵/핸들 형성 중 RS 라인이 신고가. **이동평균**: 핸들 형성 시점에 가격이 모든 주요 MA를 회복해야 합니다. **시장 환경**: 컵앤핸들 돌파는 강세장에서 가장 잘 작동합니다.",strategy:"**진입**: 컵 상단(피벗 포인트) 고거래량 돌파 시 매수.\n**목표가**: 컵 깊이를 돌파 지점에서 상방으로.\n**손절**: 핸들 저점 아래 또는 진입가 7-8% 하락 시."},
    ja:{title:"カップアンドハンドル",shortDesc:"数ヶ月のU字型底 + 最後の振るい落とし = 爆発的ブレイクアウトセットアップ。",definition:"丸い底（カップ）が数週〜数ヶ月かけて形成され、浅い押し目（ハンドル、カップ高値の12%以内）が続きます。高出来高でのカップ縁の上抜けで確認。",why:"カップは機関投資家のベース構築 — 忍耐強い蓄積で弱い保有者を強い保有者に入れ替え。ハンドルはブレイクアウト前の最後の振るい落とし。機関がベース完成を認識し積極的に買い上げます。",indicatorFusion:"**ハンドルが収縮する必要があります**：ハンドル全体を通じて出来高が減少する必要があります。**RS（相対力）**：強い銘柄はカップ/ハンドル形成中にRSラインが新高値。**市場環境**：カップアンドハンドルのブレイクアウトは強気相場で最も有効。",strategy:"**エントリー**：カップ縁（ピボットポイント）を高出来高で上抜け時の買い。\n**目標**：カップの深さをブレイクアウト地点から上方に投影。\n**損切り**：ハンドルの安値の下または買値から7〜8%下落。"},
  },
  // ── ADVANCED ──
  {
    id:"ascending-triangle", type:"bullish", difficulty:"advanced",
    coreIndicators:["Flat Resistance","Rising Lows","Volume Confirmation"],
    svg:<AscendingTriangleSVG/>,
    en:{title:"Ascending Triangle",shortDesc:"Flat resistance + rising lows = building pressure for an upside breakout.",definition:"Flat upper resistance line and a rising lower trendline. Each swing low is higher, compressing price toward resistance. Expected breakout: upside on volume.",why:"Buyers are increasingly aggressive — each pullback attracts buyers at higher levels. Meanwhile, sellers hold firm at the same resistance. Rising lows = growing demand. Eventually, buying pressure overwhelms sellers. Textbook institutional accumulation.",indicatorFusion:"**MACD**: MACD making higher lows (ascending triangle pattern on MACD too) = momentum building. **RSI**: RSI above 50 and rising during triangle = bullish pressure dominant. **Volume**: Volume should be DECLINING through the triangle as price compresses (like a spring being compressed) then EXPLODING on breakout. **Timeframe confirmation**: Triangle on weekly chart + bullish setup on daily = multi-timeframe confluence.",strategy:"**Entry**: Buy on high-volume breakout above flat resistance.\n**Target**: Triangle height (widest point) projected upward from breakout.\n**Stop-Loss**: Below the last rising low before breakout."},
    ko:{title:"상승 삼각형 (Ascending Triangle)",shortDesc:"수평 저항 + 상승 저점 = 상방 돌파를 위한 압력 집중.",definition:"수평 상단 저항선과 상향하는 하단 추세선. 매번 저점이 높아지며 가격이 저항선으로 압축. 예상 돌파: 거래량 동반 상방.",why:"매수자들이 점점 더 공격적으로 변합니다. 매번 조정마다 더 높은 수준에서 매수가 들어옵니다. 반면 매도자들은 같은 저항을 지킵니다. 상승하는 저점 = 증가하는 수요. 기관의 교과서적 매집 패턴.",indicatorFusion:"**MACD**: MACD도 더 높은 저점(상승 삼각형) 형성 = 모멘텀 축적. **RSI**: 삼각형 중 RSI 50 이상 및 상승 = 강세 압력 지배. **거래량**: 압축 중 감소(스프링 압축처럼), 돌파 시 폭발. **다중 시간대**: 주간 차트 삼각형 + 일간 차트 강세 셋업 = 다중 시간대 수렴.",strategy:"**진입**: 수평 저항선 고거래량 상방 돌파 시 매수.\n**목표가**: 삼각형 높이(가장 넓은 부분)를 돌파 지점에서 상방으로.\n**손절**: 돌파 직전 마지막 상승 저점 아래."},
    ja:{title:"アセンディングトライアングル",shortDesc:"水平抵抗 + 上昇する安値 = 上方ブレイクアウトに向けた圧力の蓄積。",definition:"水平な上限抵抗線と上昇する下限トレンドライン。押し目のたびに安値が切り上がり、価格が抵抗線に圧縮されます。期待されるブレイクアウト：出来高を伴う上方。",why:"買い方がますます積極的になります。押し目のたびに高い水準で買いが入ります。上昇する安値 = 需要の増加。機関投資家の教科書的な蓄積パターン。",indicatorFusion:"**MACD**：MACDも高い安値（上昇三角形パターン）形成 = モメンタム蓄積。**RSI**：三角形中にRSIが50超で上昇 = 強気圧力優勢。**出来高**：圧縮中に減少（バネが圧縮されるように）、ブレイクアウト時に爆発。",strategy:"**エントリー**：水平抵抗線を高出来高で上抜け時の買い。\n**目標**：三角形の最大幅をブレイクアウト地点から上方に投影。\n**損切り**：ブレイクアウト直前の最後の上昇安値の下。"},
  },
  {
    id:"bollinger-squeeze", type:"neutral", difficulty:"advanced",
    coreIndicators:["Bollinger Bands","Band Width","Volume on Breakout"],
    svg:<BollingerSqueezeSVG/>,
    en:{title:"Bollinger Band Squeeze + Volume",shortDesc:"Extreme volatility compression + volume expansion = explosive directional move imminent.",definition:"BB Squeeze: upper and lower bands converge to a historic low in Band Width. This compression precedes a powerful expansion. The direction of breakout determines the trade — NOT the squeeze itself. Volume is the critical confirmation tool.",why:"Markets alternate between contraction (low volatility, no conviction) and expansion (high volatility, decisive movement). The squeeze reflects a standoff — bulls and bears equally uncertain. One catalyst (earnings, macro data, news) breaks the stalemate. Institutional players who recognize the squeeze build positions early; when the breakout fires, momentum algorithms pile in.",indicatorFusion:"**Volume is ESSENTIAL**: A BB Squeeze breakout on low volume = likely fake-out. A breakout with volume 2× average or more = legitimate. **RSI**: At the moment of breakout, check which side RSI is leaning (>50 = bullish bias, <50 = bearish bias). **Bollinger %B**: %B crossing above 1.0 on the upper band squeeze breakout = strong confirmation. **Multi-timeframe**: Daily squeeze confirming weekly squeeze = highest-probability setup.",strategy:"**Entry**: WAIT for confirmed breakout direction. Buy above upper band with volume; short below lower band with volume.\n**Target**: First expansion often travels as far as the prior expansion period moved.\n**Stop-Loss**: Re-entry into the squeeze zone after breakout = fake-out, exit immediately."},
    ko:{title:"볼린저 밴드 스퀴즈 + 거래량",shortDesc:"극단적 변동성 압축 + 거래량 확장 = 폭발적 방향성 움직임 임박.",definition:"볼린저 밴드 스퀴즈: 상/하단 밴드가 역사적 낮은 밴드폭으로 수렴. 이 압축은 강력한 팽창에 선행합니다. 돌파 방향이 매매 방향을 결정 — 스퀴즈 자체가 아님. 거래량이 핵심 확인 도구.",why:"시장은 수축(낮은 변동성, 확신 없음)과 팽창(높은 변동성, 결정적 움직임)을 번갈아 겪습니다. 스퀴즈는 교착 상태를 반영합니다. 하나의 촉매가 교착을 깨뜨립니다. 스퀴즈를 인식한 기관들이 미리 포지션 구축, 돌파 시 모멘텀 알고리즘들이 참여합니다.",indicatorFusion:"**거래량이 필수적**: 저거래량 BB 스퀴즈 돌파 = 페이크아웃 가능성. 평균의 2배 이상 거래량 돌파 = 합법적. **RSI**: 돌파 순간 RSI 방향 확인(>50 = 강세 편향, <50 = 약세 편향). **볼린저 %B**: 상단 밴드 스퀴즈 돌파 시 %B가 1.0 상방 교차 = 강력한 확인. **다중 시간대**: 일간 스퀴즈 + 주간 스퀴즈 확인 = 최고 확률 셋업.",strategy:"**진입**: 돌파 방향 확인을 기다리세요. 거래량과 함께 상단 밴드 위 매수; 하단 밴드 아래 거래량 동반 공매도.\n**목표가**: 첫 팽창은 이전 팽창 기간만큼 이동하는 경우가 많음.\n**손절**: 돌파 후 스퀴즈 구간으로 재진입 = 페이크아웃, 즉시 청산."},
    ja:{title:"ボリンジャーバンドスクイーズ + 出来高",shortDesc:"極端なボラティリティ圧縮 + 出来高拡大 = 爆発的な方向性の動き迫る。",definition:"BBスクイーズ：上下バンドが過去最低のバンド幅に収束。この圧縮は強力な拡張に先行します。ブレイクアウトの方向が取引の方向を決定 — スクイーズ自体ではない。出来高が重要な確認ツール。",why:"市場は収縮（低ボラティリティ）と拡張（高ボラティリティ）を交互に経験します。スクイーズは膠着状態を反映。一つの触媒が膠着を打ち破ります。機関がスクイーズを認識し早期にポジション構築、ブレイクアウト時にモメンタムアルゴが参入。",indicatorFusion:"**出来高が不可欠**：低出来高のBBスクイーズブレイクアウト = フォルスブレイクの可能性。平均の2倍以上の出来高 = 本物。**RSI**：ブレイクアウト時のRSI方向確認。**マルチタイムフレーム**：日足スクイーズ + 週足スクイーズ確認 = 最高確率セットアップ。",strategy:"**エントリー**：ブレイクアウト方向の確認を待つ。出来高を伴い上バンドを上抜け→買い；下バンドを下抜け→空売り。\n**目標**：最初の拡張は前の拡張期間の動きに匹敵することが多い。\n**損切り**：ブレイクアウト後のスクイーズゾーンへの再侵入 = フォルスブレイク、即撤退。"},
  },
  {
    id:"vwap-strategy", type:"neutral", difficulty:"advanced",
    coreIndicators:["VWAP","Standard Deviations","Volume"],
    svg:<VWAPStrategySVG/>,
    en:{
      title:"VWAP Strategy",
      shortDesc:"The institutional benchmark — buying below VWAP and selling above it is how the pros trade.",
      definition:"VWAP (Volume-Weighted Average Price) is the average price weighted by volume, recalculated from the market open each day. It represents the 'fair value' of the stock on that day in the eyes of institutional algorithms. Stocks trading above VWAP = buyers in control; below = sellers in control. VWAP Standard Deviation bands (1SD, 2SD) create dynamic S/R levels.",
      why:"Most institutional algorithms, mutual funds, and pension funds use VWAP as a benchmark for their execution quality. A fund that needs to buy 1 million shares tries to buy as close to VWAP as possible to avoid 'market impact.' This creates predictable support near VWAP on every test. Smart money observes: when retail panic-sells below VWAP, institutions quietly accumulate. When retail FOMO buys far above VWAP, institutions distribute — 'selling into strength.'",
      indicatorFusion:"**Opening Range**: The first 30 minutes' high/low combined with VWAP creates a high-probability support/resistance framework for the day. **Volume Nodes**: When VWAP aligns with a Volume Profile HVN = strongest possible intraday level. **Moving Averages**: Daily chart: VWAP trends above the 20-day MA = sustained bull trend. **Anchored VWAP**: Draw VWAP from major pivots (earnings date, 52-week high breakout) for swing trading S/R levels.",
      strategy:"**Intraday (day trading)**: Buy the first pullback to VWAP after a strong opening gap-up above VWAP. Short the first rally to VWAP after a strong gap-down.\n**Swing trading**: Anchored VWAP from recent earnings or major pivot — buying below anchored VWAP and targeting 1SD or 2SD above.\n**Stop-Loss**: Below VWAP for longs (price reclaiming below VWAP after bullish setup = wrong).",
    },
    ko:{
      title:"VWAP 전략",
      shortDesc:"기관의 벤치마크 — VWAP 아래에서 매수, 위에서 매도하는 것이 프로의 방식.",
      definition:"VWAP(거래량 가중 평균 가격)는 거래량으로 가중된 평균 가격으로, 매일 장 시작부터 다시 계산됩니다. 기관 알고리즘이 바라보는 그날의 '공정 가치'를 나타냅니다. VWAP 위 = 매수자 통제, 아래 = 매도자 통제. VWAP 표준편차 밴드(1SD, 2SD)는 동적 지지/저항 수준을 만듭니다.",
      why:"대부분의 기관 알고리즘, 뮤추얼 펀드, 연금 펀드는 VWAP를 실행 품질의 벤치마크로 사용합니다. 100만 주를 매수해야 하는 펀드는 '시장 충격'을 피하기 위해 VWAP에 최대한 가깝게 매수하려 합니다. 이것이 매번 VWAP 테스트에서 예측 가능한 지지를 만듭니다. 스마트머니 관찰: 개인 투자자가 VWAP 아래로 패닉 매도할 때 기관은 조용히 매집합니다. VWAP 훨씬 위에서 FOMO 매수할 때 기관은 분산(매도)합니다.",
      indicatorFusion:"**오프닝 레인지**: 첫 30분의 고/저점 + VWAP = 당일 고확률 지지/저항 프레임워크. **거래량 노드**: VWAP가 Volume Profile HVN과 일치 = 가장 강력한 장중 수준. **고정 VWAP(Anchored VWAP)**: 실적 발표일이나 52주 신고가 돌파 등 주요 피벗에서 시작하는 VWAP → 스윙 트레이딩 지지/저항 수준으로 활용.",
      strategy:"**장중(데이 트레이딩)**: VWAP 위로 강한 갭업 오픈 후 VWAP로 첫 번째 되돌림에서 매수. 강한 갭다운 후 VWAP로의 첫 번째 반등에서 공매도.\n**스윙 트레이딩**: 최근 실적이나 주요 피벗에서 시작하는 고정 VWAP — 고정 VWAP 아래에서 매수하고 1SD 또는 2SD를 목표로.\n**손절**: 롱 포지션의 경우 VWAP 아래(강세 셋업 후 가격이 VWAP 아래로 다시 내려오면 틀린 것).",
    },
    ja:{
      title:"VWAP戦略",
      shortDesc:"機関のベンチマーク — VWAPの下で買い、上で売るのがプロの手法。",
      definition:"VWAP（出来高加重平均価格）は出来高で加重された平均価格で、毎日の市場オープンから再計算されます。機関アルゴリズムが見る当日の「公正価値」を表します。VWAP上 = 買い方優勢、下 = 売り方優勢。VWAPの標準偏差バンド（1SD、2SD）が動的S/R水準を作ります。",
      why:"ほとんどの機関アルゴリズム、投資信託、年金ファンドはVWAPを執行品質のベンチマークとして使用します。これがVWAPのテストごとに予測可能なサポートを生み出します。個人がVWAPを下回ってパニック売りする時、機関は静かに積み上げます。VWAPを大きく上回ってFOMO買いをする時、機関は分散します。",
      indicatorFusion:"**オープニングレンジ**：最初の30分の高値/安値 + VWAP = 当日の高確率S/Rフレームワーク。**出来高ノード**：VWAPが出来高プロファイルのHVNと一致 = 最強の日中水準。**アンカードVWAP**：決算日や主要ピボットからのVWAP → スイングトレーディングのS/R水準として活用。",
      strategy:"**日中（デイトレード）**：VWAPの上への強いギャップアップ後、VWAPへの最初の押し戻しで買い。\n**スイングトレード**：アンカードVWAPの下で買い、1SDまたは2SDを目標に。\n**損切り**：ロングの場合はVWAPの下。",
    },
  },
  {
    id:"fakeout", type:"neutral", difficulty:"advanced",
    coreIndicators:["Volume on Break","RSI","Reversal Candle","Retrace Speed"],
    svg:<FakeoutSVG/>,
    en:{
      title:"Fake-out Detection (속임수 돌파 필터링)",
      shortDesc:"Recognize false breakouts before they trap you — the most valuable advanced skill.",
      definition:"A fake-out (false breakout) occurs when price briefly breaks above a key resistance (or below support) but quickly reverses and closes back inside the prior range. Fake-outs can trigger retail stop-losses and lure FOMO buyers, after which the price reverses sharply in the opposite direction. Recognizing fake-outs is a critical edge for avoiding costly mistakes.",
      why:"Fake-outs are often engineered by large institutional players. Here's the mechanism: Large sellers need to exit massive positions, but doing so on open market would collapse the price. Instead, they allow or help price break above key resistance (triggering retail buy stop orders + FOMO buying), which creates the liquidity (buyers) they need to sell their large position into. Once they've sold, demand evaporates and price collapses. Understanding this 'stop hunt' mechanism changes how you see every breakout.",
      indicatorFusion:"**Volume**: The single best fake-out detector. A breakout on BELOW-average volume = very suspicious. Real breakouts have 1.5-3× normal volume. **RSI**: A breakout to new highs while RSI makes a lower high (bearish divergence) = high fake-out risk. **Candle close**: Check WHERE price closes on the breakout candle — a long upper wick that closes back BELOW resistance = classic fake-out candle. **Time at new level**: Price that breaks out but immediately reverses within 1-2 candles = fake-out. Real breakouts hold above the level for multiple candles.",
      strategy:"**Avoiding fake-outs**: (1) Only enter breakouts with volume ≥ 1.5× average (2) Wait for a CLOSE above resistance (not just an intraday print) (3) Allow 1-3 candles to 'confirm' the hold above the level before entering (4) Use RSI and MACD as filters — both should be trending up on a real breakout.\n**Trading the fake-out reversal**: After a confirmed fake-out (close back below resistance), this is a high-probability SHORT setup. Entry: close below resistance after fake-out. Target: prior range low or next support. Stop: above the fake-out high.",
    },
    ko:{
      title:"페이크아웃 감지 (Fake-out Detection)",
      shortDesc:"함정에 빠지기 전에 속임수 돌파를 인식하기 — 가장 가치 있는 고급 스킬.",
      definition:"페이크아웃(거짓 돌파)은 가격이 주요 저항선 위(또는 지지선 아래)를 잠깐 이탈하지만 빠르게 되돌아와 이전 범위 안으로 종가 마감하는 현상입니다. 페이크아웃은 개인 손절매를 촉발하고 FOMO 매수자를 유인한 뒤 반대 방향으로 급격히 반전됩니다. 페이크아웃 인식은 비용이 많이 드는 실수를 피하기 위한 핵심 기술입니다.",
      why:"페이크아웃은 종종 대형 기관에 의해 '설계'됩니다. 메커니즘: 대형 매도자가 대규모 포지션을 청산해야 하지만, 공개 시장에서 그렇게 하면 가격이 붕괴됩니다. 대신, 가격이 주요 저항선을 돌파하도록 허용하거나 도움을 줍니다(개인의 매수 스탑 오더 + FOMO 매수 촉발). 이것이 그들의 대규모 포지션을 매도할 유동성(매수자)을 만듭니다. 매도 완료 후 수요가 사라지고 가격이 붕괴됩니다. 이 '스탑 헌팅' 메커니즘을 이해하면 모든 돌파를 보는 시각이 바뀝니다.",
      indicatorFusion:"**거래량**: 단일 최고의 페이크아웃 감지기. 평균 이하 거래량의 돌파 = 매우 의심스러움. 진짜 돌파는 정상 거래량의 1.5~3배. **RSI**: 신고가 돌파인데 RSI는 낮은 고점(베어리쉬 다이버전스) = 높은 페이크아웃 위험. **캔들 종가**: 돌파 캔들이 어디서 종가 마감하는지 확인 — 긴 위꼬리 + 저항선 아래 종가 = 고전적 페이크아웃 캔들. **새 수준 유지 시간**: 돌파 후 1-2캔들 안에 즉시 반전 = 페이크아웃.",
      strategy:"**페이크아웃 방지**: (1) 거래량 ≥ 평균 1.5배의 돌파만 진입 (2) 장중 고점이 아닌 저항선 위에서의 종가 마감 대기 (3) 수준 위 유지 확인을 위해 1-3캔들 대기 후 진입 (4) RSI와 MACD를 필터로 — 진짜 돌파라면 둘 다 상승 추세여야 함.\n**페이크아웃 반전 매매**: 확인된 페이크아웃(저항선 아래 종가) 후 = 고확률 공매도 셋업. 진입: 페이크아웃 후 저항선 하방 종가. 목표: 이전 레인지 하단 또는 다음 지지선. 손절: 페이크아웃 고점 위.",
    },
    ja:{
      title:"フォルスブレイクアウト検出",
      shortDesc:"罠にかかる前にだましのブレイクアウトを見抜く — 最も価値のある高度なスキル。",
      definition:"フォルスブレイクアウト（だまし）は、価格が主要レジスタンスを一時的に上抜け（またはサポートを下抜け）するが、すぐに反転して前のレンジ内に終値で戻る現象です。フォルスブレイクアウトは個人の損切りを発動させ、FOMOバイヤーを誘い込んだ後、逆方向に急反転します。",
      why:"フォルスブレイクアウトはしばしば大型機関によって「設計」されます。大口売り手が大規模ポジションを手放す必要がある場合、価格が主要レジスタンスを突破するのを許可または支援します（個人の買いストップ注文 + FOMO買いを誘発）。これが彼らの大規模ポジションを売り抜けるための流動性（買い手）を作り出します。この「ストップハント」メカニズムを理解すると、全てのブレイクアウトの見方が変わります。",
      indicatorFusion:"**出来高**：最高のフォルスブレイクアウト検出器。平均以下の出来高でのブレイクアウト = 非常に疑わしい。本物のブレイクアウトは通常の1.5〜3倍の出来高。**RSI**：新高値ブレイクアウトなのにRSIが低い高値（ベアリッシュダイバージェンス）= 高フォルスブレイクリスク。**キャンドル終値**：突破後にどこで終値を付けるか確認 — 長い上ヒゲ + レジスタンス下での終値 = 典型的なフォルスブレイクキャンドル。",
      strategy:"**フォルスブレイク回避**：(1)出来高 ≥ 平均1.5倍のブレイクアウトのみ参入 (2)ブレイクアウトの日中印刷ではなくレジスタンス上での終値を待つ (3)1〜3キャンドル確認待ち (4)RSIとMACDをフィルターとして使用。\n**フォルスブレイク反転取引**：確認されたフォルスブレイク（レジスタンス下での終値）後 = 高確率の空売りセットアップ。",
    },
  },
  {
    id:"multi-timeframe", type:"neutral", difficulty:"advanced",
    coreIndicators:["Weekly Trend","Daily Setup","1H Entry","Volume"],
    svg:<MultiTimeframeSVG/>,
    en:{
      title:"Multi-Timeframe Analysis",
      shortDesc:"Trade in the direction of higher timeframes and enter on lower timeframe precision.",
      definition:"Multi-timeframe analysis (MTA) uses multiple chart timeframes (e.g., weekly → daily → hourly) simultaneously. The principle: use higher timeframes for trend direction and key levels, use lower timeframes for precise entry timing. Classic framework: Weekly (trend), Daily (setup), 4H/1H (entry trigger). Never trade against the weekly trend.",
      why:"Markets are fractal — the same patterns repeat on every timeframe, but higher timeframes carry more 'weight' because they represent more participants and more capital. When a weekly chart shows a bullish ascending triangle AND the daily chart shows a bull flag AND the hourly shows a bullish MACD cross — all three timeframes align. This multi-timeframe confluence means institutional buyers on the weekly, swing traders on the daily, and day traders on the hourly are ALL entering simultaneously, creating a powerful demand surge.",
      indicatorFusion:"**Top-down hierarchy**: Weekly → Daily → 4H → 1H → 15m. NEVER skip timeframes. A setup on the 15m that contradicts the weekly = AVOID. **RSI on each timeframe**: Ideally, RSI should be trending up on weekly, daily, AND hourly simultaneously. **Volume confirmation**: Volume should expand on the 'entry timeframe' (lower TF) when all higher TFs are aligned bullish. **Moving averages**: Use 200-day MA on daily, 200-hour MA on hourly — both above their MAs = ideal.",
      strategy:"**Framework**: (1) Start with Weekly — identify trend direction and major S/R (2) Move to Daily — find the specific pattern or setup forming (3) Use 4H or 1H to find precise entry — a pullback to support, a MACD cross, a bullish candle (4) Place stop-loss based on the DAILY chart level but size position so that the hourly-based stop doesn't exceed 1-2% of portfolio.\n**Key rule**: If weekly and daily agree = higher conviction. If weekly and daily conflict = skip the trade.",
    },
    ko:{
      title:"다중 시간대 분석 (Multi-Timeframe Analysis)",
      shortDesc:"상위 시간대 방향으로 매매하고 하위 시간대로 정밀하게 진입.",
      definition:"다중 시간대 분석(MTA)은 여러 차트 시간대(예: 주간 → 일간 → 시간)를 동시에 활용합니다. 원칙: 상위 시간대로 추세 방향과 핵심 수준 파악, 하위 시간대로 정밀한 진입 타이밍. 고전적 프레임워크: 주간(추세), 일간(셋업), 4시간/1시간(진입 트리거). 주간 추세에 역행하지 말 것.",
      why:"시장은 프랙탈입니다 — 같은 패턴이 모든 시간대에서 반복되지만, 상위 시간대는 더 많은 참가자와 더 많은 자본을 나타내므로 더 큰 '무게'를 갖습니다. 주간 차트가 강세 상승 삼각형 + 일간 차트가 상승 깃발 + 시간 차트가 강세 MACD 교차를 보여줄 때 — 세 시간대가 모두 정렬됩니다. 이 다중 시간대 수렴은 주간의 기관 매수자, 일간의 스윙 트레이더, 시간 차트의 데이 트레이더가 모두 동시에 진입하며 강력한 수요 급증을 만든다는 것을 의미합니다.",
      indicatorFusion:"**하향식 계층**: 주간 → 일간 → 4시간 → 1시간 → 15분. 시간대를 건너뛰지 말 것. 주간 추세에 모순되는 15분 셋업 = 피하세요. **각 시간대의 RSI**: 이상적으로, RSI는 주간, 일간, 시간 차트 모두에서 동시에 상승해야 합니다. **거래량 확인**: 모든 상위 시간대가 강세로 정렬되었을 때 '진입 시간대'(하위 시간대)에서 거래량 증가.",
      strategy:"**프레임워크**: (1) 주간부터 시작 — 추세 방향과 주요 지지/저항 파악 (2) 일간으로 이동 — 형성 중인 특정 패턴 또는 셋업 찾기 (3) 4시간 또는 1시간으로 정밀한 진입 시점 찾기 (4) 일간 차트 수준 기반 손절 설정, 하지만 포지션 크기는 시간 차트 기반 손절이 포트폴리오의 1-2%를 초과하지 않도록 조정.\n**핵심 규칙**: 주간과 일간이 일치 = 높은 확신. 주간과 일간이 충돌 = 거래 생략.",
    },
    ja:{
      title:"マルチタイムフレーム分析",
      shortDesc:"上位タイムフレームの方向に沿って取引し、下位タイムフレームで精密にエントリー。",
      definition:"マルチタイムフレーム分析（MTA）は複数のチャートタイムフレーム（例：週足→日足→時間足）を同時に活用します。原則：上位タイムフレームでトレンド方向と主要水準を把握、下位タイムフレームで精密なエントリータイミング。週足トレンドに逆らわないこと。",
      why:"市場はフラクタルです — 同じパターンがすべてのタイムフレームで繰り返されますが、上位タイムフレームはより多くの参加者とより多くの資本を表すため、より大きな「重み」を持ちます。週足の強気アセンディングトライアングル + 日足のブルフラッグ + 時間足の強気MACDクロス — 3つのタイムフレームが全て整列。これはウィークリーの機関投資家、デイリーのスイングトレーダー、時間足のデイトレーダーが全員同時にエントリーすることを意味し、強力な需要急増を生み出します。",
      indicatorFusion:"**トップダウン階層**：週足→日足→4時間足→1時間足→15分足。タイムフレームを飛ばさないこと。**各タイムフレームのRSI**：理想的には、週足、日足、時間足のRSIが同時に上昇。**出来高確認**：全ての上位タイムフレームが強気に整列した時、エントリータイムフレームで出来高が増加。",
      strategy:"**フレームワーク**：(1)週足から始める — トレンド方向と主要S/Rを特定 (2)日足に移る — 形成中の特定パターンを探す (3)4時間または1時間でエントリータイミングを精密に探す (4)日足チャートの水準に基づく損切りを設定、しかし時間足ベースの損切りがポートフォリオの1〜2%を超えないようポジションサイズを調整。\n**重要ルール**：週足と日足が一致 = 高確信。週足と日足が矛盾 = スキップ。",
    },
  },
  {
    id:"rising-wedge", type:"bearish", difficulty:"advanced",
    coreIndicators:["Trendline Convergence","Volume Decay","RSI Divergence"],
    svg:<RisingWedgeSVG/>,
    en:{title:"Rising Wedge",shortDesc:"Deceptive upward channel — rising price hides deteriorating internals.",definition:"Both trendlines slope upward with lower line steeper. Narrowing 'wedge.' Despite rising price = bearish reversal. Break below lower trendline confirms.",why:"Price rises but momentum decelerates — each push higher requires more effort for smaller gains. Reflects diminishing buying enthusiasm. Volume typically declines confirming weakening conviction. Sellers patiently wait for exhaustion.",indicatorFusion:"**RSI Divergence**: The most important confirmation — if RSI is making lower highs as price makes higher highs INSIDE the wedge, the pattern is almost certainly bearish. **Volume**: Each rally in the wedge should print lower volume than the previous — measuring distribution. **MACD**: Histogram bars shrinking through the wedge = momentum leak. **Bollinger Bands**: Rising wedge touching/piercing upper BB = extended, ripe for reversal.",strategy:"**Entry**: Short on close below lower wedge trendline.\n**Target**: Width of wedge at widest point, projected downward.\n**Stop-Loss**: Above most recent swing high inside the wedge."},
    ko:{title:"상승 쐐기 (Rising Wedge)",shortDesc:"기만적인 상승 채널 — 상승하는 가격 뒤에 악화되는 내부 지표.",definition:"두 추세선 모두 상향이지만 하단선 기울기가 더 가파른 좁아지는 쐐기. 가격이 상승해도 하락 반전 패턴. 하단 추세선 이탈로 확인.",why:"가격은 오르지만 모멘텀이 둔화됩니다. 매수 열기가 감소합니다. 거래량은 전형적으로 감소하며 확신 약화를 확인합니다.",indicatorFusion:"**RSI 다이버전스**: 가장 중요한 확인 — 쐐기 내에서 가격은 더 높은 고점을 만들지만 RSI는 더 낮은 고점 = 거의 확실히 하락. **거래량**: 쐐기 내 각 반등이 이전보다 낮은 거래량 = 분산 측정. **MACD**: 쐐기를 통과하며 줄어드는 히스토그램 = 모멘텀 누수. **볼린저 밴드**: 상단 BB를 터치/돌파하는 상승 쐐기 = 과매수, 반전 무르익음.",strategy:"**진입**: 하단 쐐기 추세선 하방 종가 이탈 시 공매도.\n**목표가**: 쐐기 가장 넓은 부분 크기를 하방으로 설정.\n**손절**: 쐐기 내 최근 반등 고점 위."},
    ja:{title:"ライジングウェッジ",shortDesc:"欺瞞的な上昇チャネル — 上昇する価格の裏に悪化する内部指標。",definition:"両トレンドラインが上向きで下限ラインの方が急勾配な先細りウェッジ。価格が上昇しても弱気反転パターン。下限トレンドラインの下抜けで確認。",why:"価格は上昇しますがモメンタムが鈍化。出来高は典型的に減少し確信の弱まりを確認。",indicatorFusion:"**RSIダイバージェンス**：最重要確認 — ウェッジ内で価格が高値を更新するがRSIが低い高値 = ほぼ確実に弱気。**出来高**：ウェッジ内の各反発が前回より低い出来高 = 分散を測定。",strategy:"**エントリー**：下限ウェッジラインの下抜け確認後の空売り。\n**目標**：ウェッジの最大幅を下方に投影。\n**損切り**：ウェッジ内の直近高値の上。"},
  },
];

// ─── Quiz scenarios ────────────────────────────────────────────────────────────
interface QuizScenario {
  id: string;
  difficulty: Difficulty;
  pattern: string;
  patternId: string;
  answer: "up" | "down";
  en: { context: string; analysis: string };
  ko: { context: string; analysis: string };
  ja: { context: string; analysis: string };
  history: OHLCV[];
  reveal: OHLCV[];
}

const SCENARIOS: QuizScenario[] = [
  {
    id:"q1", difficulty:"beginner", pattern:"Double Bottom", patternId:"double-bottom", answer:"up",
    history: genCandles(120, [{trend:-1.2,vol:1.5,count:10,vBase:2000},{trend:1.5,vol:1.2,count:5,vBase:1400},{trend:-1.0,vol:1.2,count:7,vBase:1600},{trend:0.3,vol:1.0,count:3,vBase:1800}]),
    reveal: genCandles(0, [{trend:0,vol:0,count:0,vBase:0}]).slice(0,0).concat(
      genCandles(98, [{trend:2.0,vol:1.5,count:6,vBase:3200,vMul:1.8}])
    ),
    en:{
      context:"📊 Scenario: A tech stock has fallen 18% from its highs over the past 5 weeks. It touched support near $95 twice (3 weeks apart), forming two equal troughs. RSI reached 28 on both tests. Volume on the second bottom is noticeably lower than the first. The stock is now attempting to reclaim the neckline at $107.",
      analysis:"✅ **UP was correct.** This was a textbook Double Bottom reversal.\n\n**Why this worked:**\n• **Two-trough equality**: Both bottoms touched ~$95, confirming the support zone has structural demand.\n• **Volume confirmation**: Lower volume on the 2nd trough = sellers are exhausted. Fewer shares changing hands at the lows means less supply.\n• **RSI Bullish Divergence**: RSI formed higher lows between the two bottoms, revealing hidden buying conviction despite the price holding flat.\n• **Neckline breakout volume**: The breakout above $107 occurred on volume 1.8× the average — institutional confirmation.\n\n**Pattern target**: $95 (trough) → $107 (neckline) = $12 pattern height. Target: $107 + $12 = $119.",
    },
    ko:{
      context:"📊 시나리오: 한 기술주가 지난 5주에 걸쳐 고점 대비 18% 하락했습니다. 3주 간격으로 두 번에 걸쳐 $95 근처 지지선에 닿아 두 개의 동일한 저점을 형성했습니다. 두 번의 테스트에서 RSI는 28까지 내려갔습니다. 두 번째 저점의 거래량은 첫 번째보다 눈에 띄게 낮습니다. 현재 주가는 $107의 넥라인을 회복하려 시도 중입니다.",
      analysis:"✅ **상승이 정답이었습니다.** 교과서적인 이중 바닥 반전이었습니다.\n\n**이것이 작동한 이유:**\n• **두 저점의 동등성**: 두 저점 모두 ~$95에 닿으며 구조적 수요를 가진 지지 구간을 확인.\n• **거래량 확인**: 두 번째 저점에서 더 낮은 거래량 = 매도 소진. 저점에서 거래되는 주식 수가 적다는 것은 공급이 적다는 의미.\n• **RSI 불리쉬 다이버전스**: 두 저점 사이에서 RSI가 더 높은 저점 형성, 가격이 동일한 수준임에도 숨겨진 매수 확신 노출.\n• **넥라인 돌파 거래량**: $107 상방 돌파가 평균의 1.8배 거래량으로 발생 — 기관 확인 신호.",
    },
    ja:{
      context:"📊 シナリオ：ある技術株が過去5週間で高値から18%下落しました。3週間の間隔で$95付近のサポートに2回タッチし、2つの等しい谷を形成しました。両テストでRSIは28に達しました。2番底の出来高は1番底より明らかに低いです。現在、株価は$107のネックラインを回復しようとしています。",
      analysis:"✅ **上昇が正解でした。** 教科書的なダブルボトム反転でした。\n\n**機能した理由:**\n• **2つの谷の同等性**: 両底が~$95にタッチし、構造的需要のあるサポートゾーンを確認。\n• **出来高確認**: 2番底での低出来高 = 売り手枯渇。\n• **RSIブリッシュダイバージェンス**: 2つの底の間でRSIが高い安値を形成し、隠れた買いの確信を示す。\n• **ネックラインブレイクアウト出来高**: $107の上抜けが平均の1.8倍の出来高で発生 — 機関の確認。",
    },
  },
  {
    id:"q2", difficulty:"intermediate", pattern:"Bear Flag Breakdown", patternId:"bear-flag", answer:"down",
    history: genCandles(110, [{trend:-2.2,vol:2.0,count:8,vBase:3000,vMul:1.5},{trend:0.8,vol:1.0,count:8,vBase:1200},{trend:0.2,vol:0.8,count:4,vBase:900}]),
    reveal: genCandles(0,  [{trend:0,vol:0,count:0,vBase:0}]).slice(0,0).concat(
      genCandles(88, [{trend:-2.5,vol:2,count:7,vBase:3500,vMul:2.0}])
    ),
    en:{
      context:"📊 Scenario: A financial stock dropped sharply from $110 to $78 in just 8 days (the pole) on heavy volume. Over the next 12 sessions it has slowly drifted up to $88 in a tight, orderly channel — volume has been declining throughout this bounce. RSI sits at 48. The stock has now tested the top of this channel for the third time.",
      analysis:"✅ **DOWN was correct.** This was a Bear Flag with declining volume — a high-conviction continuation short.\n\n**Why this worked:**\n• **The pole**: -29% decline in 8 days on high volume = strong institutional selling dominance established.\n• **Volume in the flag**: Each day of the 'recovery' had lower volume than the day before — no real buying conviction. Sellers are just pausing to reload.\n• **RSI at 48**: Not oversold, not recovering toward 60+ — momentum stuck in neutral/bearish territory.\n• **3rd test of resistance**: Three rejections at $88 without a close above = the level is defended by sellers.\n• **Measured move target**: Pole length ($110 → $78 = $32) subtracted from flag breakdown point ($88) = ~$56.",
    },
    ko:{
      context:"📊 시나리오: 한 금융주가 단 8일 만에 고거래량으로 $110에서 $78로 급락했습니다(폴). 이후 12 거래일 동안 좁고 질서 있는 채널에서 $88까지 천천히 상승했으며, 이 반등 내내 거래량이 감소했습니다. RSI는 48입니다. 현재 주가는 이 채널의 상단을 세 번째로 테스트하고 있습니다.",
      analysis:"✅ **하락이 정답이었습니다.** 거래량 감소를 동반한 하락 깃발 — 고확신 지속 공매도 셋업.\n\n**이것이 작동한 이유:**\n• **폴**: 8일 만에 고거래량으로 -29% 하락 = 강한 기관 매도 우위 확립.\n• **깃발 내 거래량**: '회복' 중 매일 전날보다 낮은 거래량 — 진정한 매수 확신 없음. 매도자들은 재충전을 위해 잠시 쉬는 중.\n• **RSI 48**: 과매도도 아니고, 60+ 이상으로 회복도 안 됨 — 모멘텀이 중립/약세 영역에 갇힘.\n• **저항선 3번째 테스트**: $88에서 세 번 거부되고 위에서 종가 없음 = 매도자들이 방어 중.\n• **측정 목표**: 폴 길이($110→$78 = $32)를 깃발 이탈 지점($88)에서 차감 = ~$56.",
    },
    ja:{
      context:"📊 シナリオ：ある金融株が高出来高で$110から$78にわずか8日で急落しました（ポール）。その後12セッションかけて狭く整然としたチャネルで$88まで緩やかに上昇しましたが、この反発を通じて出来高は減少しています。RSIは48です。株価は現在このチャネルの上端を3回目にテストしています。",
      analysis:"✅ **下落が正解でした。** 出来高減少を伴うベアフラッグ — 高確信の継続空売りセットアップ。\n\n**機能した理由:**\n• **ポール**: 8日間で高出来高の-29%下落 = 強い機関の売り優位が確立。\n• **フラッグ内の出来高**: 「回復」の各日が前日より低い出来高 — 本物の買い確信なし。\n• **RSI 48**: 売られ過ぎでなく、60+への回復もない — モメンタムが中立/弱気ゾーンに留まる。\n• **レジスタンスへの3回目のテスト**: $88で3回拒絶、上での終値なし = 売り手が守っている。",
    },
  },
  {
    id:"q3", difficulty:"intermediate", pattern:"Ascending Triangle + Golden Cross", patternId:"ascending-triangle", answer:"up",
    history: genCandles(85, [{trend:-0.2,vol:1.5,count:6,vBase:1500},{trend:0.8,vol:1.2,count:5,vBase:1600},{trend:-0.4,vol:1.0,count:4,vBase:1200},{trend:0.6,vol:1.0,count:5,vBase:1400},{trend:-0.2,vol:0.8,count:4,vBase:1000}]),
    reveal: genCandles(0, [{trend:0,vol:0,count:0,vBase:0}]).slice(0,0).concat(
      genCandles(95, [{trend:1.8,vol:1.5,count:7,vBase:2800,vMul:2.2}])
    ),
    en:{
      context:"📊 Scenario: A semiconductor stock has been trading in an ascending triangle for 6 weeks. Resistance is flat at $98. The lows have been: $85, $87, $90, $93 — a clear rising staircase. Today the 50-day MA has just crossed above the 200-day MA (Golden Cross) for the first time in 8 months. Volume over the past 3 days has been 30% above average. RSI is 62.",
      analysis:"✅ **UP was correct.** Multiple high-conviction bullish signals converging.\n\n**The convergence:**\n• **Ascending triangle**: 4 rising lows compressing price toward flat resistance = classic institutional accumulation.\n• **Golden Cross**: 50-day crossing above 200-day triggers systematic buying from trend-following funds (CTAs, quant strategies).\n• **Volume expansion**: 3-day volume buildup (30% above avg) before the breakout = institutional positioning ahead of the move.\n• **RSI 62**: In bullish territory, trending up, NOT overbought — room to run.\n• **Multi-timeframe alignment**: Triangle (structural setup) + Golden Cross (momentum confirmation) + Volume (institutional participation) = textbook multi-factor confirmation.",
    },
    ko:{
      context:"📊 시나리오: 한 반도체 주식이 6주 동안 상승 삼각형 내에서 거래되고 있습니다. 저항선은 $98에 수평으로 유지됩니다. 저점들은: $85, $87, $90, $93 — 뚜렷한 상승하는 계단식 패턴. 오늘 50일 MA가 8개월 만에 처음으로 200일 MA를 상방 교차했습니다(골든 크로스). 지난 3일간 거래량이 평균보다 30% 높습니다. RSI는 62입니다.",
      analysis:"✅ **상승이 정답이었습니다.** 여러 고확신 강세 신호들이 수렴.\n\n**수렴한 신호들:**\n• **상승 삼각형**: 4개의 상승하는 저점이 가격을 수평 저항선으로 압축 = 고전적 기관 매집.\n• **골든 크로스**: 50일이 200일 상방 교차로 추세 추종 펀드(CTA, 퀀트 전략)들의 체계적 매수 트리거.\n• **거래량 확장**: 돌파 전 3일 거래량 증가(평균 30% 상회) = 움직임에 앞선 기관 포지셔닝.\n• **RSI 62**: 강세 영역, 상승 추세, 과매수 아님 — 상승 여력 있음.\n• **다중 시간대 정렬**: 삼각형(구조적 셋업) + 골든 크로스(모멘텀 확인) + 거래량(기관 참여) = 교과서적 다중 요소 확인.",
    },
    ja:{
      context:"📊 シナリオ：ある半導体株が6週間、上昇三角形で取引されています。レジスタンスは$98に水平に維持。安値は$85、$87、$90、$93と上昇する階段状のパターン。本日、50日MAが8ヶ月ぶりに200日MAを上回りました（ゴールデンクロス）。過去3日間の出来高は平均より30%高いです。RSIは62です。",
      analysis:"✅ **上昇が正解でした。** 複数の高確信な強気シグナルが収束。\n\n**収束したシグナル:**\n• **上昇三角形**: 4つの上昇する安値が価格を水平抵抗に圧縮 = 典型的な機関蓄積。\n• **ゴールデンクロス**: トレンドフォローファンドの体系的な買いをトリガー。\n• **出来高拡大**: ブレイクアウト前の3日間の出来高増加 = 機関のポジショニング。\n• **RSI 62**: 強気ゾーン、上昇中、買われ過ぎでない — 上昇余地あり。",
    },
  },
  {
    id:"q4", difficulty:"advanced", pattern:"Rising Wedge Fake-out at Resistance", patternId:"fakeout", answer:"down",
    history: genCandles(78, [{trend:1.2,vol:1.2,count:8,vBase:2000},{trend:0.6,vol:0.9,count:6,vBase:1400,vMul:0.7},{trend:0.3,vol:0.7,count:5,vBase:1000,vMul:0.5},{trend:0.5,vol:0.8,count:3,vBase:800,vMul:0.4}]),
    reveal: genCandles(0, [{trend:0,vol:0,count:0,vBase:0}]).slice(0,0).concat(
      genCandles(105, [{trend:-3.0,vol:2.0,count:7,vBase:4000,vMul:2.5}])
    ),
    en:{
      context:"📊 Scenario: A consumer stock has risen in a rising wedge pattern for 10 weeks. The major resistance zone is $100–$102 (52-week high). Yesterday, the stock gapped up to $104 on news of a product launch, printing one candle ABOVE the resistance zone. However: volume was only 0.6× average. RSI shows a bearish divergence (price at new high, RSI at 66 vs. 72 at the prior high). The candle closed with a long upper wick at $101 — back below the resistance zone.",
      analysis:"✅ **DOWN was correct.** This was a Rising Wedge Fake-out at major resistance — a high-probability short setup.\n\n**The fake-out anatomy:**\n• **Rising wedge**: Decelerating momentum for 10 weeks (volume declining throughout = distribution, not accumulation).\n• **Low-volume 'breakout'**: 0.6× average volume on the breakout candle = no institutional buying. Real breakouts need 1.5–3× volume.\n• **Shooting star candle**: Long upper wick + close BELOW resistance = sellers overwhelmed buyers AT resistance. Classic reversal candle.\n• **RSI Bearish Divergence**: Price at a NEW high but RSI at a LOWER level = internal momentum has been weakening all along.\n• **Close below resistance**: The key rule — intraday print above resistance is noise; CLOSING below resistance = fake-out confirmed.\n\n**This is the stop hunt**: Institutions used the news spike to sell into retail FOMO buyers at $104, then let price collapse.",
    },
    ko:{
      context:"📊 시나리오: 한 소비재 주식이 10주 동안 상승 쐐기 패턴으로 상승했습니다. 주요 저항 구간은 $100–$102(52주 신고가)입니다. 어제, 제품 출시 뉴스로 주가가 $104까지 갭업하며 저항 구간 위로 한 캔들을 출력했습니다. 하지만: 거래량은 평균의 0.6배에 불과했습니다. RSI는 베어리쉬 다이버전스를 보여줍니다(가격 신고가, RSI 66 vs. 이전 고점의 72). 캔들은 긴 위꼬리와 함께 $101에서 종가 — 저항 구간 아래로 다시 내려갔습니다.",
      analysis:"✅ **하락이 정답이었습니다.** 주요 저항선에서의 상승 쐐기 페이크아웃 — 고확률 공매도 셋업.\n\n**페이크아웃 해부학:**\n• **상승 쐐기**: 10주 동안 감속하는 모멘텀(내내 거래량 감소 = 분산, 매집 아님).\n• **저거래량 '돌파'**: 돌파 캔들에서 평균의 0.6배 거래량 = 기관 매수 없음. 진짜 돌파는 1.5~3배 거래량 필요.\n• **슈팅스타 캔들**: 긴 위꼬리 + 저항선 아래 종가 = 저항에서 매도자가 매수자를 압도. 고전적 반전 캔들.\n• **RSI 베어리쉬 다이버전스**: 가격은 신고가이지만 RSI는 더 낮은 수준 = 내부 모멘텀이 계속 약화되어 왔음.\n• **저항선 아래 종가**: 핵심 규칙 — 장중 고점은 노이즈이지만, 저항선 아래 종가 마감 = 페이크아웃 확인.\n\n**이것이 스탑 헌팅**: 기관들이 뉴스 스파이크를 이용해 $104에서 개인 FOMO 매수자들에게 매도하고 가격을 폭락시켰습니다.",
    },
    ja:{
      context:"📊 シナリオ：ある消費財株が10週間、上昇ウェッジパターンで上昇しています。主要な抵抗ゾーンは$100〜$102（52週高値）です。昨日、製品発表のニュースで株価は$104にギャップアップし、抵抗ゾーンの上に1本のキャンドルを出力しました。しかし：出来高は平均の0.6倍に過ぎませんでした。RSIはベアリッシュダイバージェンスを示しています（価格は新高値、RSIは前回高値の72に対して66）。キャンドルは長い上ヒゲを付け、$101で終値 — 抵抗ゾーンの下に戻りました。",
      analysis:"✅ **下落が正解でした。** 主要レジスタンスでの上昇ウェッジフォルスブレイクアウト — 高確率の空売りセットアップ。\n\n**フォルスブレイクアウトの解剖:**\n• **上昇ウェッジ**: 10週間のモメンタム減速（出来高の継続的減少 = 分散、蓄積でない）。\n• **低出来高の「ブレイクアウト」**: 平均の0.6倍の出来高 = 機関の買いなし。\n• **シューティングスターキャンドル**: 長い上ヒゲ + レジスタンス下での終値 = レジスタンスで売り方が買い方を圧倒。\n• **RSIベアリッシュダイバージェンス**: 価格は新高値だがRSIは低い水準 = 内部モメンタムが弱まり続けていた。\n• **これがストップハント**: 機関はニュースの急騰を利用して$104で個人のFOMO買いに売り抜けました。",
    },
  },
  {
    id:"q5", difficulty:"advanced", pattern:"BB Squeeze + VWAP Reclaim", patternId:"bollinger-squeeze", answer:"up",
    history: genCandles(100, [{trend:0.05,vol:0.6,count:10,vBase:800,vMul:0.5},{trend:0.0,vol:0.4,count:8,vBase:600,vMul:0.3},{trend:0.1,vol:0.5,count:4,vBase:700}]),
    reveal: genCandles(0, [{trend:0,vol:0,count:0,vBase:0}]).slice(0,0).concat(
      genCandles(102, [{trend:2.2,vol:1.5,count:8,vBase:4500,vMul:3.0}])
    ),
    en:{
      context:"📊 Scenario: An energy stock has been locked in a $97–$103 range for 22 sessions. Bollinger Band width has compressed to the lowest reading in 18 months — a historic squeeze. The VWAP for the past 10 days is at $100.50, and today the stock closed at $102.20 — reclaiming VWAP on 2.8× average volume after spending 3 days below it. RSI is 54 and trending up from a low of 44.",
      analysis:"✅ **UP was correct.** Multi-factor confluence — BB Squeeze, VWAP Reclaim, Volume Explosion.\n\n**The confluence breakdown:**\n• **BB Squeeze (18-month low)**: The most compressed volatility in 1.5 years. A spring wound the tightest. Historical precedent: after 18-month lows in band width, the subsequent expansion averaged 22%.\n• **VWAP reclaim**: Closing above VWAP ($100.50) on 2.8× volume = institutional buyers stepped in decisively. They were accumulating 3 days BELOW VWAP (at a discount to their benchmark).\n• **RSI structure**: Rising from 44 to 54 = momentum recovering. Not overbought. 50-line cross = bullish regime shift.\n• **Volume explosion**: 3.0× average on the squeeze breakout candle = exactly what a real squeeze breakout looks like. Not a fake-out.\n• **Energy sector context**: Rising oil prices as backdrop provide fundamental tailwind amplifying the technical setup.",
    },
    ko:{
      context:"📊 시나리오: 한 에너지 주식이 22 거래일 동안 $97–$103 레인지에 갇혀 있었습니다. 볼린저 밴드 폭이 18개월 만에 최저 수준으로 압축됐습니다 — 역사적인 스퀴즈. 지난 10일간의 VWAP는 $100.50이며, 오늘 주가는 3일 동안 VWAP 아래에 있다가 평균의 2.8배 거래량으로 VWAP를 회복하며 $102.20에 마감했습니다. RSI는 44에서 상승하며 54를 기록 중입니다.",
      analysis:"✅ **상승이 정답이었습니다.** 다중 요소 수렴 — BB 스퀴즈, VWAP 회복, 거래량 폭발.\n\n**수렴 분석:**\n• **BB 스퀴즈 (18개월 최저)**: 1.5년 만의 가장 압축된 변동성. 가장 꽉 감긴 스프링. 역사적 선례: 밴드 폭의 18개월 최저치 이후 후속 팽창은 평균 22%.\n• **VWAP 회복**: 2.8배 거래량으로 VWAP($100.50) 위에서 종가 = 기관 매수자들이 결정적으로 개입. 그들은 벤치마크 아래 할인 가격으로 VWAP 아래 3일 동안 매집 중이었습니다.\n• **RSI 구조**: 44에서 54로 상승 = 모멘텀 회복. 과매수 아님. 50선 교차 = 강세 전환.\n• **거래량 폭발**: 스퀴즈 돌파 캔들에서 평균의 3.0배 = 진짜 스퀴즈 돌파의 정확한 모습. 페이크아웃 아님.\n• **에너지 섹터 맥락**: 유가 상승이 배경으로 기술적 셋업을 증폭시키는 펀더멘털 순풍 제공.",
    },
    ja:{
      context:"📊 シナリオ：あるエネルギー株が22セッション、$97〜$103のレンジに閉じ込められています。ボリンジャーバンド幅は18ヶ月で最低水準まで圧縮されました — 歴史的なスクイーズ。過去10日間のVWAPは$100.50で、本日株価はVWAPの下に3日間いた後、平均の2.8倍の出来高でVWAPを回復して$102.20で終値を付けました。RSIは44から上昇して54を記録中です。",
      analysis:"✅ **上昇が正解でした。** 多要素収束 — BBスクイーズ、VWAP回復、出来高爆発。\n\n**収束分析:**\n• **BBスクイーズ（18ヶ月最低）**: 1.5年で最も圧縮されたボラティリティ。最も固く巻かれたバネ。\n• **VWAP回復**: 2.8倍の出来高でVWAPの上で終値 = 機関の買い手が決定的に介入。彼らはVWAPの下で3日間（ベンチマーク下の割引価格で）積み上げていました。\n• **RSI構造**: 44から54に上昇 = モメンタム回復。50ライン交差 = 強気レジームシフト。\n• **出来高爆発**: スクイーズブレイクアウトキャンドルで平均の3.0倍 = 本物のスクイーズブレイクアウトの典型。",
    },
  },
];

// ─── Disclaimer ────────────────────────────────────────────────────────────────
const DISCLAIMER: Record<Lang, string> = {
  ko:"⚠️ 기술적 분석 및 차트 패턴 활용 시 유의사항: 본 메뉴에서 제공하는 차트 패턴 및 기술적 지표는 과거 시장 데이터의 통계적 시각화 자료이며, 미래의 투자 수익을 보장하거나 특정 종목의 매수/매도를 권유하지 않습니다. 패턴은 언제든 무력화(Fake-out)될 수 있으므로 반드시 기업 펀더멘털 및 철저한 리스크 관리(손절매 기준 설정)와 병행하세요.",
  en:"⚠️ Educational disclaimer: Chart patterns and technical indicators are statistical visualizations of historical data only. They do not guarantee future returns or constitute buy/sell recommendations. Patterns can be invalidated at any time by unexpected events. Always combine technical analysis with fundamental research and strict risk management.",
  ja:"⚠️ テクニカル分析に関する重要な注意事項: 本セクションのチャートパターンおよびテクニカル指標は過去データの統計的可視化に過ぎず、将来の投資収益を保証するものでも売買推奨でもありません。常にファンダメンタル分析とリスク管理を併用してください。",
};

function StrategyText({ text }: { text: string }) {
  return (
    <span>
      {text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i} className="text-foreground font-semibold">{p.slice(2,-2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ChartMaster() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const lang = (user?.language || "ko") as Lang;

  const [activeTab, setActiveTab] = useState<"learn" | "quiz">("learn");
  const [diffFilter, setDiffFilter] = useState<Difficulty | "all">("all");
  const [selected, setSelected] = useState<Pattern | null>(null);
  const [modalTab, setModalTab] = useState<"definition" | "why" | "fusion" | "strategy">("definition");

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [chosen, setChosen] = useState<"up" | "down" | null>(null);
  const [score, setScore] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [quizHistory, setQuizHistory] = useState<Array<{ correct: boolean; answer: "up" | "down" }>>([]);

  const scenario = SCENARIOS[quizIndex];
  const isCorrect = chosen === scenario?.answer;

  const typeColors: Record<PatternType, string> = {
    bullish:"text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
    bearish:"text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",
    neutral:"text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
  };
  const diffColors: Record<Difficulty, string> = {
    beginner:"text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-700",
    intermediate:"text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-700",
    advanced:"text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-700",
  };
  const diffLabels: Record<Difficulty, Record<Lang, string>> = {
    beginner:{en:"Beginner",ko:"초급",ja:"初級"},
    intermediate:{en:"Intermediate",ko:"중급",ja:"中級"},
    advanced:{en:"Advanced",ko:"고급",ja:"上級"},
  };
  const typeIcons: Record<PatternType, React.ReactNode> = {
    bullish:<TrendingUp className="w-3 h-3"/>,
    bearish:<TrendingDown className="w-3 h-3"/>,
    neutral:<Minus className="w-3 h-3"/>,
  };
  const typeLabels: Record<PatternType, Record<Lang, string>> = {
    bullish:{en:"Bullish",ko:"상승",ja:"強気"},
    bearish:{en:"Bearish",ko:"하락",ja:"弱気"},
    neutral:{en:"Neutral",ko:"중립",ja:"中立"},
  };

  const filtered = useMemo(() =>
    diffFilter === "all" ? PATTERNS : PATTERNS.filter(p => p.difficulty === diffFilter),
    [diffFilter]
  );

  const getText = (p: Pattern) => p[lang] ?? p.en;
  const getScenarioText = (s: QuizScenario) => s[lang] ?? s.en;

  const handleAnswer = async (dir: "up" | "down") => {
    if (answered) return;
    setChosen(dir);
    setAnswered(true);
    const correct = dir === scenario.answer;
    const xp = correct ? 15 : 5;
    setScore(s => s + (correct ? 1 : 0));
    setXpEarned(x => x + xp);
    setQuizHistory(h => [...h, { correct, answer: dir }]);
    try {
      await apiRequest("POST", "/api/quests/special/complete", { xpAmount: xp });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/me"] });
    } catch {}
  };

  const nextQuiz = () => {
    setQuizIndex(i => (i + 1) % SCENARIOS.length);
    setAnswered(false);
    setChosen(null);
  };

  const resetQuiz = () => {
    setQuizIndex(0);
    setAnswered(false);
    setChosen(null);
    setScore(0);
    setXpEarned(0);
    setQuizHistory([]);
  };

  const modalTabs: Array<{ key: "definition"|"why"|"fusion"|"strategy"; label: Record<Lang,string> }> = [
    { key:"definition", label:{en:"Definition",ko:"정의",ja:"定義"} },
    { key:"why", label:{en:"Psychology",ko:"시장 심리",ja:"市場心理"} },
    { key:"fusion", label:{en:"Indicator Fusion",ko:"지표 결합",ja:"指標融合"} },
    { key:"strategy", label:{en:"Strategy",ko:"전략",ja:"戦略"} },
  ];

  return (
    <div className="flex-1 min-h-screen bg-background pb-24">
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <span className="text-2xl">📈</span>
            {lang==="ko"?"차트 마스터":lang==="ja"?"チャートマスター":"Chart Master"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {lang==="ko"?"21가지 핵심 기술 분석 패턴 + 실전 차트 퀴즈로 전문가 수준의 실력을 키워보세요."
              :lang==="ja"?"21の重要テクニカル分析パターン + 実践チャートクイズでプロレベルのスキルを身につけましょう。"
              :"21 core technical analysis patterns + interactive chart quiz — build professional-grade skills."}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 p-1 bg-muted rounded-2xl w-fit">
          <button onClick={()=>setActiveTab("learn")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab==="learn"?"bg-card text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-learn">
            <BookOpen className="w-4 h-4"/>
            {lang==="ko"?"📚 패턴 학습":lang==="ja"?"📚 パターン学習":"📚 Learn Patterns"}
          </button>
          <button onClick={()=>setActiveTab("quiz")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab==="quiz"?"bg-card text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-quiz">
            <Brain className="w-4 h-4"/>
            {lang==="ko"?"🧪 차트 퀴즈":lang==="ja"?"🧪 チャートクイズ":"🧪 Chart Quiz"}
          </button>
        </div>

        {/* ── LEARN TAB ── */}
        {activeTab==="learn" && (
          <div className="space-y-5">
            {/* Disclaimer */}
            <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"/>
              <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">{DISCLAIMER[lang]}</p>
            </div>

            {/* Difficulty filter */}
            <div className="flex gap-2 flex-wrap">
              {(["all","beginner","intermediate","advanced"] as const).map(d=>(
                <button key={d} onClick={()=>setDiffFilter(d)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${diffFilter===d?"bg-primary text-primary-foreground border-primary shadow-sm":"bg-card text-muted-foreground border-border hover:bg-muted"}`}
                  data-testid={`filter-${d}`}>
                  {d==="all"?(lang==="ko"?"전체":lang==="ja"?"全て":"All")
                    :diffLabels[d][lang]}
                  <span className="ml-1.5 text-xs opacity-60">
                    {d==="all"?PATTERNS.length:PATTERNS.filter(p=>p.difficulty===d).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Pattern grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(p=>{
                const txt=getText(p);
                return (
                  <button key={p.id} onClick={()=>{setSelected(p);setModalTab("definition");}}
                    className="group bg-card border border-border rounded-2xl p-5 text-left hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col gap-3"
                    data-testid={`card-pattern-${p.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${diffColors[p.difficulty]}`}>
                          {diffLabels[p.difficulty][lang]}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${typeColors[p.type]}`}>
                          {typeIcons[p.type]}
                          {typeLabels[p.type][lang]}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0"/>
                    </div>
                    <div className={`w-full h-14 ${p.type==="bullish"?"text-emerald-500":p.type==="bearish"?"text-red-500":"text-amber-500"}`}>
                      {p.svg}
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-bold text-sm text-foreground leading-tight">{txt.title}</h3>
                      <p className="text-muted-foreground text-xs leading-snug line-clamp-2">{txt.shortDesc}</p>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {p.coreIndicators.slice(0,3).map(ind=>(
                          <span key={ind} className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{ind}</span>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── QUIZ TAB ── */}
        {activeTab==="quiz" && (
          <div className="space-y-5 max-w-3xl mx-auto">
            {/* Score header */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2">
                <Trophy className="w-4 h-4 text-amber-500"/>
                <span className="text-sm font-semibold">
                  {lang==="ko"?`정답: ${score}/${quizHistory.length}`:lang==="ja"?`正解: ${score}/${quizHistory.length}`:`${score}/${quizHistory.length} correct`}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2">
                <span className="text-sm font-semibold text-primary">+{xpEarned} XP</span>
              </div>
              <div className="flex gap-1.5">
                {quizHistory.map((h,i)=>(
                  <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center ${h.correct?"bg-emerald-500/20 text-emerald-500":"bg-red-500/20 text-red-500"}`}>
                    {h.correct?<Check className="w-3 h-3"/>:<XCircle className="w-3 h-3"/>}
                  </div>
                ))}
              </div>
              <button onClick={resetQuiz} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <RefreshCw className="w-3 h-3"/>
                {lang==="ko"?"초기화":lang==="ja"?"リセット":"Reset"}
              </button>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center gap-2">
              {SCENARIOS.map((s,i)=>(
                <div key={s.id} className={`h-1.5 flex-1 rounded-full transition-all ${i===quizIndex?"bg-primary":i<quizIndex?"bg-emerald-500":"bg-muted"}`}/>
              ))}
            </div>

            {/* Scenario card */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-lg border font-semibold ${diffColors[scenario.difficulty]}`}>
                      {diffLabels[scenario.difficulty][lang]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {lang==="ko"?`문제 ${quizIndex+1} / ${SCENARIOS.length}`:lang==="ja"?`問題 ${quizIndex+1} / ${SCENARIOS.length}`:`Question ${quizIndex+1} of ${SCENARIOS.length}`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {lang==="ko"?"다음 캔들 방향을 예측하세요":lang==="ja"?"次のロウソク足の方向を予測してください":"Predict the next price direction"}
                  </p>
                </div>
              </div>

              {/* Context */}
              <div className="px-5 pb-3">
                <p className="text-sm text-foreground leading-relaxed bg-muted/40 rounded-xl p-3">
                  {getScenarioText(scenario).context}
                </p>
              </div>

              {/* Chart */}
              <div className="px-5 pb-3">
                <CandlestickChart
                  candles={[...scenario.history, ...scenario.reveal]}
                  revealFrom={scenario.history.length}
                  showReveal={answered}
                />
              </div>

              {/* Buttons */}
              {!answered ? (
                <div className="px-5 pb-5 grid grid-cols-2 gap-3">
                  <button onClick={()=>handleAnswer("up")}
                    className="flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-500/20 hover:border-emerald-500 transition-all font-bold text-base"
                    data-testid="btn-answer-up">
                    <TrendingUp className="w-5 h-5"/>
                    {lang==="ko"?"📈 상승 / 매수":lang==="ja"?"📈 上昇 / 買い":"📈 Up / Buy"}
                  </button>
                  <button onClick={()=>handleAnswer("down")}
                    className="flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 border-2 border-red-300 dark:border-red-700 hover:bg-red-500/20 hover:border-red-500 transition-all font-bold text-base"
                    data-testid="btn-answer-down">
                    <TrendingDown className="w-5 h-5"/>
                    {lang==="ko"?"📉 하락 / 매도":lang==="ja"?"📉 下落 / 売り":"📉 Down / Sell"}
                  </button>
                </div>
              ) : (
                <div className="px-5 pb-5 space-y-4" style={{animation:"fadeInUp 0.4s ease"}}>
                  {/* Result banner */}
                  <div className={`rounded-xl p-4 border ${isCorrect?"bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700":"bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {isCorrect
                        ?<><Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400"/><span className="font-bold text-emerald-700 dark:text-emerald-300">{lang==="ko"?"정답! +15 XP":lang==="ja"?"正解！ +15 XP":"Correct! +15 XP"}</span></>
                        :<><XCircle className="w-5 h-5 text-red-600 dark:text-red-400"/><span className="font-bold text-red-700 dark:text-red-300">{lang==="ko"?`틀렸습니다. 정답: ${scenario.answer==="up"?"상승":"하락"} (+5 XP 참여)`:lang==="ja"?`不正解。正解: ${scenario.answer==="up"?"上昇":"下落"} (+5 XP 参加)`:` Incorrect — answer was ${scenario.answer.toUpperCase()}. (+5 XP for participating)`}</span></>
                      }
                    </div>
                    <div className="text-sm text-foreground leading-relaxed">
                      {getScenarioText(scenario).analysis.split("\n").map((line,i)=>(
                        <p key={i} className="mb-1"><StrategyText text={line}/></p>
                      ))}
                    </div>
                    <div className="mt-3 pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground">
                        {lang==="ko"?`관련 패턴: ${scenario.pattern} → 패턴 학습 탭에서 자세히 배워보세요.`
                          :lang==="ja"?`関連パターン: ${scenario.pattern} → パターン学習タブで詳しく学びましょう。`
                          :`Related pattern: ${scenario.pattern} — review it in the Learn tab for deeper context.`}
                      </p>
                    </div>
                  </div>

                  {/* Next button */}
                  <button onClick={nextQuiz}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
                    data-testid="btn-next-quiz">
                    {lang==="ko"?"다음 문제 →":lang==="ja"?"次の問題 →":"Next Question →"}
                  </button>
                </div>
              )}
            </div>

            {/* Educational note */}
            <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"/>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {lang==="ko"
                  ?"퀴즈는 교육 목적의 모의 시나리오입니다. 실제 투자 결정에 직접 적용하지 마세요. 정답 여부와 관계없이 모든 참여에 XP가 지급됩니다."
                  :lang==="ja"
                  ?"クイズは教育目的の模擬シナリオです。実際の投資決定に直接適用しないでください。正解・不正解に関わらずXPが付与されます。"
                  :"Quiz scenarios are simulated for educational purposes only. Do not apply directly to real investment decisions. XP is awarded for all participation."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── DETAIL MODAL ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={()=>setSelected(null)}>
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e=>e.stopPropagation()}>

            {/* Modal header */}
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${diffColors[selected.difficulty]}`}>
                  {diffLabels[selected.difficulty][lang]}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${typeColors[selected.type]}`}>
                  {typeIcons[selected.type]}{typeLabels[selected.type][lang]}
                </span>
                <h2 className="font-bold text-base text-foreground">{getText(selected).title}</h2>
              </div>
              <button onClick={()=>setSelected(null)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" data-testid="button-close-modal">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* SVG */}
              <div className={`w-full h-20 ${selected.type==="bullish"?"text-emerald-500":selected.type==="bearish"?"text-red-500":"text-amber-500"}`}>
                {selected.svg}
              </div>

              {/* Core indicators */}
              <div className="flex flex-wrap gap-1.5">
                {selected.coreIndicators.map(i=>(
                  <span key={i} className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium">{i}</span>
                ))}
              </div>

              {/* Modal tab pills */}
              <div className="flex gap-1 flex-wrap">
                {modalTabs.map(t=>(
                  <button key={t.key} onClick={()=>setModalTab(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${modalTab===t.key?"bg-primary text-primary-foreground border-primary":"bg-card text-muted-foreground border-border hover:bg-muted"}`}>
                    {t.label[lang]}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="text-sm text-muted-foreground leading-relaxed min-h-[120px]" style={{animation:"fadeInUp 0.2s ease"}}>
                {modalTab==="definition" && (
                  <div>
                    <p className="text-foreground font-medium mb-1">{lang==="ko"?"📐 정의 및 형태":lang==="ja"?"📐 定義と形状":"📐 Definition & Shape"}</p>
                    <p>{getText(selected).definition}</p>
                  </div>
                )}
                {modalTab==="why" && (
                  <div>
                    <p className="text-foreground font-medium mb-1">{lang==="ko"?"🧠 시장 심리 (The Psychological Catalyst)":lang==="ja"?"🧠 市場心理（心理的触媒）":"🧠 The Psychological Catalyst"}</p>
                    <p>{getText(selected).why}</p>
                  </div>
                )}
                {modalTab==="fusion" && (
                  <div>
                    <p className="text-foreground font-medium mb-1">{lang==="ko"?"🔀 지표 결합 (Indicator Fusion)":lang==="ja"?"🔀 指標融合":"🔀 Indicator Fusion — Cross-validation"}</p>
                    <div className="space-y-1">
                      {getText(selected).indicatorFusion.split("\n").map((line,i)=>(
                        <p key={i}><StrategyText text={line}/></p>
                      ))}
                    </div>
                  </div>
                )}
                {modalTab==="strategy" && (
                  <div>
                    <p className="text-foreground font-medium mb-1">{lang==="ko"?"📋 실전 전략":lang==="ja"?"📋 実践戦略":"📋 Trading Strategy"}</p>
                    <div className="space-y-1">
                      {getText(selected).strategy.split("\n").map((line,i)=>(
                        <p key={i}><StrategyText text={line}/></p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom disclaimer */}
              <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"/>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {lang==="ko"?"본 내용은 교육 목적으로만 제공됩니다. 패턴은 언제든 무력화될 수 있으며 반드시 손절 기준과 리스크 관리를 병행하세요."
                    :lang==="ja"?"本内容は教育目的のみで提供されます。パターンはいつでも無効化される可能性があります。損切り基準とリスク管理を必ず併用してください。"
                    :"For educational purposes only. Patterns can fail at any time. Always use defined stop-losses and risk management."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
