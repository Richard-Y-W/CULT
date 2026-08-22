import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

export interface PricePoint {
  timeSec: number;
  value: number;
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16),
    g = parseInt(value.slice(2, 4), 16),
    b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Appends points incrementally (never destroys/recreates the chart per
 * tick). If the viewer has panned away from the latest point, it stays
 * where they left it and shows a LIVE resume control instead of snapping
 * back -- see docs/design/design-system.md and spec item 10.
 */
export function PriceChart({
  points,
  height = 280,
  color = "#4d9630",
  dark = false,
}: {
  points: PricePoint[];
  height?: number;
  color?: string;
  dark?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const lastAppliedLength = useRef(0);
  const [pannedAway, setPannedAway] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: dark ? "#787b86" : "#737d72",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: dark ? "#1e222d" : "#e1e3dd" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: true },
      crosshair: { mode: 0 },
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: withAlpha(color, 0.28),
      bottomColor: withAlpha(color, 0),
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    lastAppliedLength.current = 0;

    const handleRange = () => {
      const position = chart.timeScale().scrollPosition();
      setPannedAway(position < -0.5);
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(handleRange);

    const resize = () => chart.applyOptions({ width: container.clientWidth });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleRange);
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // Chart instance is created once per mount; color/theme changes apply
    // via the separate effects below rather than recreating the chart.
  }, [height, dark]);

  useEffect(() => {
    seriesRef.current?.applyOptions({
      lineColor: color,
      topColor: withAlpha(color, 0.28),
      bottomColor: withAlpha(color, 0),
    });
  }, [color]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !points.length) return;
    if (lastAppliedLength.current === 0) {
      series.setData(
        points.map((p) => ({ time: p.timeSec as UTCTimestamp, value: p.value })),
      );
    } else {
      for (let i = lastAppliedLength.current; i < points.length; i++) {
        const point = points[i];
        if (point)
          series.update({ time: point.timeSec as UTCTimestamp, value: point.value });
      }
    }
    lastAppliedLength.current = points.length;
  }, [points]);

  return (
    <div className="price-chart">
      <div ref={containerRef} />
      {pannedAway && (
        <button
          className="live-resume"
          onClick={() => {
            chartRef.current?.timeScale().scrollToRealTime();
            setPannedAway(false);
          }}
        >
          LIVE ●
        </button>
      )}
    </div>
  );
}
