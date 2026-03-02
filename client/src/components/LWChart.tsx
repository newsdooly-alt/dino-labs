import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type AreaData,
  type SeriesType,
} from "lightweight-charts";
import { cn } from "@/lib/utils";

// ── Technical indicator helpers ──────────────────────────────────────────────
function calcSMA(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    return sum / period;
  });
}

function calcEMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return result;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

function calcBB(
  values: number[],
  period = 20,
  mult = 2
): { upper: number | null; middle: number | null; lower: number | null }[] {
  return values.map((_, i) => {
    if (i < period - 1) return { upper: null, middle: null, lower: null };
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    return { upper: mean + mult * std, middle: mean, lower: mean - mult * std };
  });
}

function calcRSI(values: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period + 1) return result;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs0);
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = Math.max(0, diff);
    const loss = Math.max(0, -diff);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
  }
  return result;
}

interface MACDResult {
  macd: number | null;
  signal: number | null;
  hist: number | null;
}

function calcMACD(values: number[]): MACDResult[] {
  const ema12 = calcEMA(values, 12);
  const ema26 = calcEMA(values, 26);
  const macdLine: (number | null)[] = values.map((_, i) => {
    const e12 = ema12[i], e26 = ema26[i];
    return e12 !== null && e26 !== null ? e12 - e26 : null;
  });
  const macdNonNull: number[] = [];
  const macdNonNullIdx: number[] = [];
  macdLine.forEach((v, i) => { if (v !== null) { macdNonNull.push(v); macdNonNullIdx.push(i); } });
  const sig9 = calcEMA(macdNonNull, 9);
  const signalLine: (number | null)[] = new Array(values.length).fill(null);
  macdNonNullIdx.forEach((origIdx, j) => { signalLine[origIdx] = sig9[j]; });
  return values.map((_, i) => ({
    macd: macdLine[i],
    signal: signalLine[i],
    hist: macdLine[i] !== null && signalLine[i] !== null ? macdLine[i]! - signalLine[i]! : null,
  }));
}

// ── Time conversion ──────────────────────────────────────────────────────────
function toTime(dateStr: string): Time {
  if (dateStr.length > 10) {
    return Math.floor(new Date(dateStr).getTime() / 1000) as UTCTimestamp;
  }
  return dateStr as unknown as Time;
}

// ── Constants ────────────────────────────────────────────────────────────────
const MA_COLORS = ["#f59e0b", "#3b82f6", "#a855f7", "#ef4444"];
const RSI_H = 110;
const MACD_H = 110;

// ── Types ────────────────────────────────────────────────────────────────────
export interface LWCandlePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePct?: number | null;
}

export interface LWSRLevels {
  supports: number[];
  resistances: number[];
}

export interface LWChartProps {
  data: LWCandlePoint[];
  height?: number;
  isDark?: boolean;
  formatPrice?: (v: number, opts?: any) => string;
  nativeCurrency?: string;
  isIntraday?: boolean;
  chartType?: "candle" | "area" | "line";
  showVolume?: boolean;
  showMA?: boolean;
  maPeriods?: number[];
  maColors?: string[];
  showBB?: boolean;
  showRSI?: boolean;
  showMACD?: boolean;
  showSR?: boolean;
  srLevels?: LWSRLevels;
  logScale?: boolean;
  lang?: string;
  className?: string;
  onCrosshairMove?: (data: LWCandlePoint | null) => void;
}

// ── Component ────────────────────────────────────────────────────────────────
export function LWChart({
  data,
  height = 320,
  isDark = false,
  formatPrice,
  nativeCurrency = "USD",
  isIntraday = false,
  chartType = "candle",
  showVolume = true,
  showMA = false,
  maPeriods = [20, 60, 120],
  maColors,
  showBB = false,
  showRSI = false,
  showMACD = false,
  showSR = false,
  srLevels,
  logScale = false,
  lang = "en",
  className,
  onCrosshairMove,
}: LWChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const colors = maColors ?? MA_COLORS;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || data.length === 0) return;

    // ── Theme ──────────────────────────────────────────────────────────────
    const textC = isDark ? "#9ca3af" : "#6b7280";
    const gridC = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
    const borderC = isDark ? "#1e293b" : "#e5e7eb";

    const sharedOpts = {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" as string },
        textColor: textC,
      },
      grid: { vertLines: { color: gridC }, horzLines: { color: gridC } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: borderC },
      timeScale: { borderColor: borderC, timeVisible: isIntraday, secondsVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    };

    // ── Main chart ─────────────────────────────────────────────────────────
    const mainChart = createChart(container, {
      ...sharedOpts,
      width: container.clientWidth,
      height,
    });

    if (logScale) {
      mainChart.priceScale("right").applyOptions({ mode: 1 });
    }

    // ── Data prep ──────────────────────────────────────────────────────────
    const times: Time[] = data.map(d => toTime(d.date));
    const closes = data.map(d => d.close);

    const changePctMap = new Map<number, number>();
    data.forEach((d, i) => {
      if (d.changePct != null) {
        changePctMap.set(i, d.changePct);
      } else if (i > 0 && data[i - 1].close > 0) {
        changePctMap.set(i, ((d.close - data[i - 1].close) / data[i - 1].close) * 100);
      }
    });

    // ── Main series (v5 API) ───────────────────────────────────────────────
    let mainSeries: ISeriesApi<SeriesType>;

    if (chartType === "candle") {
      mainSeries = mainChart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
      mainSeries.setData(data.map((d, i) => ({
        time: times[i],
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      } as CandlestickData)));
    } else if (chartType === "area") {
      mainSeries = mainChart.addSeries(AreaSeries, {
        lineColor: "#6366f1",
        topColor: "rgba(99,102,241,0.3)",
        bottomColor: "rgba(99,102,241,0.0)",
        lineWidth: 2,
      });
      mainSeries.setData(data.map((d, i) => ({ time: times[i], value: d.close } as AreaData)));
    } else {
      mainSeries = mainChart.addSeries(LineSeries, { color: "#6366f1", lineWidth: 2 });
      mainSeries.setData(data.map((d, i) => ({ time: times[i], value: d.close } as LineData)));
    }

    // ── Volume ─────────────────────────────────────────────────────────────
    if (showVolume) {
      mainChart.priceScale("right").applyOptions({ scaleMargins: { top: 0.1, bottom: 0.18 } });
      const volSeries = mainChart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      mainChart.priceScale("vol").applyOptions({
        scaleMargins: { top: 0.84, bottom: 0 },
        drawTicks: false,
        borderVisible: false,
      });
      volSeries.setData(data.map((d, i) => ({
        time: times[i],
        value: d.volume,
        color: d.close >= d.open ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)",
      } as HistogramData)));
    }

    // ── MA overlays ────────────────────────────────────────────────────────
    const maValsCache: (number | null)[][] = [];
    if (showMA) {
      maPeriods.forEach((period, idx) => {
        const smaVals = calcSMA(closes, period);
        maValsCache.push(smaVals);
        const maData: LineData[] = [];
        smaVals.forEach((v, i) => { if (v !== null) maData.push({ time: times[i], value: v }); });
        const s = mainChart.addSeries(LineSeries, {
          color: colors[idx % colors.length],
          lineWidth: 1.5,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
          title: `MA${period}`,
        });
        s.setData(maData);
      });
    }

    // ── Bollinger Bands ────────────────────────────────────────────────────
    if (showBB) {
      const bbVals = calcBB(closes, 20, 2);
      const bbDefs: { key: "upper" | "middle" | "lower"; color: string; dash: boolean; label: string }[] = [
        { key: "upper",  color: "#ef4444", dash: false, label: "BB+" },
        { key: "middle", color: "#9ca3af", dash: true,  label: "BB"  },
        { key: "lower",  color: "#22c55e", dash: false, label: "BB-" },
      ];
      bbDefs.forEach(({ key, color, dash, label }) => {
        const bbData: LineData[] = [];
        bbVals.forEach((v, i) => {
          const val = v[key];
          if (val !== null) bbData.push({ time: times[i], value: val! });
        });
        const s = mainChart.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          lineStyle: dash ? LineStyle.Dashed : LineStyle.Solid,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
          title: label,
        });
        s.setData(bbData);
      });
    }

    // ── S/R price lines ────────────────────────────────────────────────────
    if (showSR && srLevels) {
      srLevels.supports.slice(0, 3).forEach((level, i) => {
        mainSeries.createPriceLine({
          price: level,
          color: "rgba(34,197,94,0.7)",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: lang === "ko" ? `지지 ${i + 1}` : `S${i + 1}`,
        });
      });
      srLevels.resistances.slice(0, 3).forEach((level, i) => {
        mainSeries.createPriceLine({
          price: level,
          color: "rgba(239,68,68,0.7)",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: lang === "ko" ? `저항 ${i + 1}` : `R${i + 1}`,
        });
      });
    }

    // ── Tooltip overlay ────────────────────────────────────────────────────
    const tooltip = tooltipRef.current;
    const rsiValsCache = calcRSI(closes, 14);

    mainChart.subscribeCrosshairMove((param) => {
      if (!tooltip) return;

      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        tooltip.style.display = "none";
        onCrosshairMove?.(null);
        return;
      }

      const idx = data.findIndex(d => String(toTime(d.date)) === String(param.time));
      if (idx < 0) { tooltip.style.display = "none"; return; }

      const d = data[idx];
      onCrosshairMove?.(d);

      const isUp = d.close >= d.open;
      const pct = changePctMap.get(idx) ?? 0;
      const priceStr = formatPrice ? formatPrice(d.close, { nativeCurrency }) : d.close.toFixed(2);
      const pctStr = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
      const priceColor = isUp ? "#22c55e" : "#ef4444";

      const dateStr = isIntraday
        ? new Date(d.date).toLocaleTimeString(lang === "ko" ? "ko-KR" : "en-US", {
            hour: "2-digit", minute: "2-digit", hour12: false,
          })
        : new Date(d.date).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
            month: "short", day: "numeric", year: "numeric",
          });

      const tc = isDark ? "#9ca3af" : "#6b7280";
      const fc = isDark ? "#e5e7eb" : "#111827";
      let html = `<div style="font-size:10px;color:${tc};margin-bottom:4px;font-weight:600">${dateStr}</div>`;

      if (chartType === "candle") {
        const ko = lang === "ko";
        html += `<div style="display:grid;grid-template-columns:auto 1fr;gap:1px 10px;font-size:11px">`;
        html += `<span style="color:${tc}">${ko ? "시가" : "O"}</span><span style="color:${fc};font-weight:600;text-align:right">${formatPrice ? formatPrice(d.open, { nativeCurrency }) : d.open.toFixed(2)}</span>`;
        html += `<span style="color:${tc}">${ko ? "고가" : "H"}</span><span style="color:#22c55e;font-weight:600;text-align:right">${formatPrice ? formatPrice(d.high, { nativeCurrency }) : d.high.toFixed(2)}</span>`;
        html += `<span style="color:${tc}">${ko ? "저가" : "L"}</span><span style="color:#ef4444;font-weight:600;text-align:right">${formatPrice ? formatPrice(d.low, { nativeCurrency }) : d.low.toFixed(2)}</span>`;
        html += `<span style="color:${tc}">${ko ? "종가" : "C"}</span><span style="color:${priceColor};font-weight:700;text-align:right">${priceStr}<span style="font-size:9.5px;opacity:.8"> (${pctStr})</span></span>`;
        html += `</div>`;
      } else {
        html += `<div style="color:${priceColor};font-weight:700;font-size:12px">${priceStr} <span style="font-size:10px;opacity:.85">(${pctStr})</span></div>`;
      }

      if (showVolume && d.volume > 0) {
        const volStr = d.volume >= 1e9
          ? `${(d.volume / 1e9).toFixed(1)}B`
          : d.volume >= 1e6
          ? `${(d.volume / 1e6).toFixed(1)}M`
          : `${(d.volume / 1e3).toFixed(0)}K`;
        html += `<div style="font-size:10px;color:${tc};margin-top:3px">${lang === "ko" ? "거래량" : "Vol"}: <span style="color:${fc}">${volStr}</span></div>`;
      }

      if (showMA) {
        maValsCache.forEach((vals, i) => {
          const v = vals[idx];
          if (v !== null) {
            const vStr = formatPrice ? formatPrice(v, { nativeCurrency, compact: true }) : v.toFixed(2);
            html += `<div style="font-size:10px;color:${colors[i % colors.length]};margin-top:1px">MA${maPeriods[i]}: ${vStr}</div>`;
          }
        });
      }

      if (showRSI && rsiValsCache[idx] != null) {
        const rsi = rsiValsCache[idx]!;
        const rsiC = rsi > 70 ? "#ef4444" : rsi < 30 ? "#22c55e" : fc;
        html += `<div style="font-size:10px;color:${rsiC};margin-top:1px">RSI(14): ${rsi.toFixed(1)}</div>`;
      }

      tooltip.innerHTML = html;
      tooltip.style.display = "block";

      const containerRect = container.getBoundingClientRect();
      const ttW = 160;
      let left = param.point.x + 14;
      if (left + ttW > containerRect.width) left = param.point.x - ttW - 8;
      tooltip.style.left = `${Math.max(0, left)}px`;
      tooltip.style.top = `${Math.max(4, param.point.y - 44)}px`;
    });

    // ── RSI sub-chart ──────────────────────────────────────────────────────
    let rsiChart: IChartApi | null = null;
    const rsiVals = calcRSI(closes, 14);

    if (showRSI && rsiRef.current) {
      rsiChart = createChart(rsiRef.current, {
        ...sharedOpts,
        width: container.clientWidth,
        height: RSI_H,
        rightPriceScale: {
          borderColor: borderC,
          scaleMargins: { top: 0.1, bottom: 0.1 },
          minimumWidth: 50,
        },
        timeScale: {
          ...sharedOpts.timeScale,
          visible: !showMACD,
          borderColor: borderC,
        },
      });

      const rsiSeries = rsiChart.addSeries(LineSeries, {
        color: "#a855f7",
        lineWidth: 1.5,
        lastValueVisible: true,
        priceLineVisible: false,
      });
      const rsiData: LineData[] = [];
      rsiVals.forEach((v, i) => { if (v !== null) rsiData.push({ time: times[i], value: v }); });
      rsiSeries.setData(rsiData);

      rsiSeries.createPriceLine({ price: 70, color: "rgba(239,68,68,0.5)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
      rsiSeries.createPriceLine({ price: 30, color: "rgba(34,197,94,0.5)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
      rsiSeries.createPriceLine({ price: 50, color: "rgba(156,163,175,0.3)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });

      mainChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) rsiChart?.timeScale().setVisibleLogicalRange(range);
      });
      rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) mainChart.timeScale().setVisibleLogicalRange(range);
      });
    }

    // ── MACD sub-chart ─────────────────────────────────────────────────────
    let macdChart: IChartApi | null = null;

    if (showMACD && macdRef.current) {
      const macdVals = calcMACD(closes);

      macdChart = createChart(macdRef.current, {
        ...sharedOpts,
        width: container.clientWidth,
        height: MACD_H,
        rightPriceScale: {
          borderColor: borderC,
          minimumWidth: 50,
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: { ...sharedOpts.timeScale, borderColor: borderC },
      });

      const histData: HistogramData[] = [];
      const macdLineData: LineData[] = [];
      const signalData: LineData[] = [];

      macdVals.forEach((v, i) => {
        if (v.hist !== null)   histData.push({ time: times[i], value: v.hist, color: v.hist >= 0 ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.55)" });
        if (v.macd !== null)   macdLineData.push({ time: times[i], value: v.macd });
        if (v.signal !== null) signalData.push({ time: times[i], value: v.signal });
      });

      const histSeries = macdChart.addSeries(HistogramSeries, { lastValueVisible: false, priceLineVisible: false });
      histSeries.setData(histData);

      const macdLineSeries = macdChart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1.5, lastValueVisible: true, priceLineVisible: false, title: "MACD" });
      macdLineSeries.setData(macdLineData);

      const signalSeries = macdChart.addSeries(LineSeries, { color: "#f97316", lineWidth: 1.5, lastValueVisible: true, priceLineVisible: false, title: "Signal" });
      signalSeries.setData(signalData);

      mainChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) macdChart?.timeScale().setVisibleLogicalRange(range);
      });
      macdChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range) mainChart.timeScale().setVisibleLogicalRange(range);
      });
      if (rsiChart) {
        rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
          if (range) macdChart?.timeScale().setVisibleLogicalRange(range);
        });
      }
    }

    // ── ResizeObserver ─────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      if (w > 0) {
        mainChart.applyOptions({ width: w });
        rsiChart?.applyOptions({ width: w });
        macdChart?.applyOptions({ width: w });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      mainChart.remove();
      rsiChart?.remove();
      macdChart?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isDark, chartType, showVolume, showMA, showBB, showRSI, showMACD, showSR, logScale, height]);

  return (
    <div className={cn("relative select-none", className)} style={{ touchAction: "none" }}>
      <div ref={containerRef} />

      {showRSI && (
        <>
          <div className="flex items-center gap-2 px-3 py-0.5 border-t border-border/40 bg-muted/10 flex-shrink-0">
            <span className="text-[9px] font-semibold text-muted-foreground">RSI (14)</span>
            <span className="text-[9px] text-red-400">OB: 70</span>
            <span className="text-[9px] text-green-400">OS: 30</span>
          </div>
          <div ref={rsiRef} />
        </>
      )}

      {showMACD && (
        <>
          <div className="flex items-center gap-2 px-3 py-0.5 border-t border-border/40 bg-muted/10 flex-shrink-0">
            <span className="text-[9px] font-semibold text-muted-foreground">MACD (12/26/9)</span>
            <span className="text-[9px] text-blue-400">MACD</span>
            <span className="text-[9px] text-orange-400">Signal</span>
          </div>
          <div ref={macdRef} />
        </>
      )}

      {/* Floating tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          display: "none",
          pointerEvents: "none",
          background: "var(--tooltip-bg, rgba(15,23,42,0.95))",
          border: "1px solid var(--tooltip-border, #1e293b)",
          borderRadius: 8,
          padding: "8px 12px",
          zIndex: 50,
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          minWidth: 140,
          maxWidth: 210,
          color: "var(--tooltip-fg, #e5e7eb)",
        }}
      />
    </div>
  );
}
