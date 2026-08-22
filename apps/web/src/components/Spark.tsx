/** Minimal SVG polyline sparkline for compact real-data series. Callers
 * must only pass genuinely observed points -- never synthesize a shape to
 * fill space (see docs/design/design-system.md). */
export function Spark({
  points,
  color = "#4d9630",
  height = 86,
}: {
  points: number[];
  color?: string;
  height?: number;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points),
    max = Math.max(...points),
    w = 400,
    coords = points
      .map(
        (v, i) =>
          `${(i / (points.length - 1)) * w},${height - ((v - min) / (max - min || 1)) * (height - 8) - 4}`,
      )
      .join(" ");
  return (
    <svg
      className="spark"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ height, width: "100%" }}
    >
      <polyline
        points={coords}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
