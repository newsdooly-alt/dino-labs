export function calculateSMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

export function calculateEMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  if (prices.length === 0) return result;
  if (prices.length < period) return prices.map(() => null);

  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      result.push(ema);
    } else {
      ema = prices[i] * k + ema * (1 - k);
      result.push(ema);
    }
  }
  return result;
}

export function calculateRSI(prices: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (prices.length < period + 1) return prices.map(() => null);

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = 0; i < period; i++) result.push(null);

  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + firstRS));

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.abs(Math.min(change, 0));
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

export interface BollingerBandPoint {
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

export function calculateBollingerBands(
  prices: number[],
  period = 20,
  multiplier = 2
): BollingerBandPoint[] {
  const sma = calculateSMA(prices, period);
  return prices.map((_, i) => {
    const mean = sma[i];
    if (mean === null) return { upper: null, middle: null, lower: null };
    const slice = prices.slice(Math.max(0, i - period + 1), i + 1);
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / slice.length;
    const stdDev = Math.sqrt(variance);
    return {
      upper: mean + multiplier * stdDev,
      middle: mean,
      lower: mean - multiplier * stdDev,
    };
  });
}

export interface CrossoverSignal {
  index: number;
  signal: "buy" | "sell";
}

export function detectMACrossover(
  prices: number[],
  shortPeriod = 20,
  longPeriod = 60
): CrossoverSignal[] {
  if (prices.length < longPeriod + 2) return [];

  const shortMA = calculateSMA(prices, shortPeriod);
  const longMA = calculateSMA(prices, longPeriod);
  const signals: CrossoverSignal[] = [];

  for (let i = 1; i < prices.length; i++) {
    const ps = shortMA[i - 1];
    const pl = longMA[i - 1];
    const cs = shortMA[i];
    const cl = longMA[i];
    if (ps === null || pl === null || cs === null || cl === null) continue;
    if (ps <= pl && cs > cl) signals.push({ index: i, signal: "buy" });
    else if (ps >= pl && cs < cl) signals.push({ index: i, signal: "sell" });
  }
  return signals;
}

export interface SRLevels {
  supports: number[];
  resistances: number[];
}

export function calculateSupportResistance(
  prices: number[],
  topN = 3
): SRLevels {
  if (prices.length < 15) return { supports: [], resistances: [] };

  const window = Math.max(3, Math.floor(prices.length / 15));
  const peaks: number[] = [];
  const troughs: number[] = [];

  for (let i = window; i < prices.length - window; i++) {
    const price = prices[i];
    let isPeak = true;
    let isTrough = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (prices[j] >= price) isPeak = false;
      if (prices[j] <= price) isTrough = false;
    }
    if (isPeak) peaks.push(price);
    if (isTrough) troughs.push(price);
  }

  function cluster(levels: number[], n: number): number[] {
    levels.sort((a, b) => a - b);
    const result: number[] = [];
    for (const level of levels) {
      const last = result[result.length - 1];
      if (last === undefined || Math.abs(level - last) / last > 0.018) {
        result.push(level);
      }
    }
    return result.slice(0, n);
  }

  return {
    supports: cluster(troughs, topN),
    resistances: cluster(peaks, topN).slice(-topN),
  };
}
