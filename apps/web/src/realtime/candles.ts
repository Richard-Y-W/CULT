import { useMemo } from "react";
import type { PricePoint } from "../components/PriceChart.js";
import { usePriceHistory } from "./marketStore.js";

export interface Candle {
  timeSec: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Buckets real observed ticks into OHLC candles -- open/high/low/close are
 * all genuinely observed values within the bucket, never invented. This is
 * only honest for the live/session portion of history (the WS tick stream);
 * there is no intraday history before the browser connected, so candles
 * start empty and fill in as real ticks arrive.
 */
export function bucketCandles(points: PricePoint[], bucketSeconds: number): Candle[] {
  if (!points.length) return [];
  const candles: Candle[] = [];
  let current: Candle | null = null;
  for (const point of points) {
    const bucketStart = Math.floor(point.timeSec / bucketSeconds) * bucketSeconds;
    if (!current || current.timeSec !== bucketStart) {
      if (current) candles.push(current);
      current = {
        timeSec: bucketStart,
        open: point.value,
        high: point.value,
        low: point.value,
        close: point.value,
      };
    } else {
      current.high = Math.max(current.high, point.value);
      current.low = Math.min(current.low, point.value);
      current.close = point.value;
    }
  }
  if (current) candles.push(current);
  return candles;
}

export function useCandles(assetId: string, bucketSeconds = 10): Candle[] {
  const points = usePriceHistory(assetId);
  return useMemo(() => bucketCandles(points, bucketSeconds), [points, bucketSeconds]);
}
