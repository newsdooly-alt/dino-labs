// ── Financial Math Library ──────────────────────────────────────────────────
// Pure functions — no side effects, no DOM, safe for Web Workers.

export interface CandlePoint {
  date: string;
  open: number; high: number; low: number; close: number; volume: number;
}

// ── Simple Moving Average ──────────────────────────────────────────────────
export function calcSMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    if (i >= period - 1) result[i] = sum / period;
  }
  return result;
}

// ── Exponential Moving Average ──────────────────────────────────────────────
export function calcEMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period) return result;
  const k = 2 / (period + 1);
  let ema = 0;
  for (let i = 0; i < period; i++) ema += closes[i];
  ema /= period;
  result[period - 1] = ema;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

// ── Bollinger Bands (20-period, 2σ) ────────────────────────────────────────
export function calcBB(
  closes: number[], period = 20, mult = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = calcSMA(closes, period);
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i]!;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    upper[i] = mean + mult * std;
    lower[i] = mean - mult * std;
  }
  return { upper, middle, lower };
}

// ── RSI (Wilder's smoothing, 14-period default) ─────────────────────────────
export function calcRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return result;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period; avgLoss /= period;
  const rsi = (al: number) => al === 0 ? 100 : 100 - 100 / (1 + avgGain / al);
  result[period] = rsi(avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    result[i] = rsi(avgLoss);
  }
  return result;
}

// ── MACD (12, 26, 9) ───────────────────────────────────────────────────────
export function calcMACD(closes: number[]): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd: (number | null)[] = ema12.map((v, i) =>
    v !== null && ema26[i] !== null ? v - ema26[i]! : null
  );

  // EMA(9) of MACD values — only on non-null entries
  const macdVals = macd.filter((v): v is number => v !== null);
  const sigVals = calcEMA(macdVals, 9);

  const signal: (number | null)[] = new Array(closes.length).fill(null);
  let si = 0;
  for (let i = 0; i < closes.length; i++) {
    if (macd[i] !== null) { signal[i] = sigVals[si] ?? null; si++; }
  }

  const histogram: (number | null)[] = macd.map((v, i) =>
    v !== null && signal[i] !== null ? v - signal[i]! : null
  );
  return { macd, signal, histogram };
}

// ── Volume MA (20-period) ───────────────────────────────────────────────────
export function calcVolumeMA(volumes: number[], period = 20): (number | null)[] {
  return calcSMA(volumes, period);
}

// ── Convert indicator arrays to chart-ready data ────────────────────────────
export function toLineData(
  timestamps: number[], values: (number | null)[]
): { time: number; value: number }[] {
  return timestamps
    .map((t, i) => ({ time: t, value: values[i] }))
    .filter((d): d is { time: number; value: number } => d.value !== null);
}
