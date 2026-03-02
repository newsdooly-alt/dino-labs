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

export interface CrossoverSignal {
  index: number;
  signal: "buy" | "sell";
}

export function detectMACrossover(
  prices: number[],
  shortPeriod = 5,
  longPeriod = 20
): CrossoverSignal[] {
  if (prices.length < longPeriod + 2) return [];

  const shortEMA = calculateEMA(prices, shortPeriod);
  const longEMA = calculateEMA(prices, longPeriod);
  const signals: CrossoverSignal[] = [];

  for (let i = 1; i < prices.length; i++) {
    const ps = shortEMA[i - 1];
    const pl = longEMA[i - 1];
    const cs = shortEMA[i];
    const cl = longEMA[i];
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
  topN = 2
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
