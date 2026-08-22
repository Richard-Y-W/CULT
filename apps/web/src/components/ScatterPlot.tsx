export interface ScatterPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  positive: boolean;
}

/** Minimal cross-sectional scatter (e.g. volatility vs. momentum across the
 * universe) -- real points only, axes labeled with actual units, no
 * regression line or fit unless computed from real data. */
export function ScatterPlot({
  points,
  xLabel,
  yLabel,
  onSelect,
  height = 320,
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  onSelect?: (id: string) => void;
  height?: number;
}) {
  if (!points.length) return null;
  const w = 560,
    pad = 36,
    xs = points.map((p) => p.x),
    ys = points.map((p) => p.y),
    xMin = Math.min(...xs),
    xMax = Math.max(...xs),
    yMin = Math.min(0, Math.min(...ys)),
    yMax = Math.max(0, Math.max(...ys)),
    sx = (v: number) =>
      pad + ((v - xMin) / (xMax - xMin || 1)) * (w - pad * 2),
    sy = (v: number) =>
      height - pad - ((v - yMin) / (yMax - yMin || 1)) * (height - pad * 2);
  const zeroY = sy(0);
  return (
    <svg
      className="scatter-plot"
      viewBox={`0 0 ${w} ${height}`}
      style={{ width: "100%", height }}
    >
      <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke="#2a2e39" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#2a2e39" />
      {points.map((p) => (
        <g
          key={p.id}
          transform={`translate(${sx(p.x)},${sy(p.y)})`}
          onClick={() => onSelect?.(p.id)}
          className="scatter-point"
        >
          <circle r={5} fill={p.positive ? "#089981" : "#f23645"} opacity={0.9} />
          <text
            y={-8}
            textAnchor="middle"
            fontSize={9}
            fontFamily="'DM Sans', system-ui, sans-serif"
            fill="#787b86"
          >
            {p.label}
          </text>
        </g>
      ))}
      <text
        x={w - pad}
        y={height - 8}
        textAnchor="end"
        fontSize={10}
        fontFamily="'DM Sans', system-ui, sans-serif"
        fill="#5d606b"
      >
        {xLabel} →
      </text>
      <text
        x={pad}
        y={16}
        fontSize={10}
        fontFamily="'DM Sans', system-ui, sans-serif"
        fill="#5d606b"
      >
        ↑ {yLabel}
      </text>
    </svg>
  );
}
