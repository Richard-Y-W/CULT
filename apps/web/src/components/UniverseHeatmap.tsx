import { useNavigate } from "react-router-dom";
import type { ExpressionAsset } from "@cult/shared";
import { useInstrument } from "../realtime/marketStore.js";
import { money } from "../lib/api.js";

function heatColor(change: number): string {
  const intensity = Math.min(1, Math.abs(change) / 20);
  return change >= 0
    ? `rgba(8,153,129,${0.14 + intensity * 0.34})`
    : `rgba(242,54,69,${0.14 + intensity * 0.34})`;
}

function HeatTile({ asset, mode }: { asset: ExpressionAsset; mode: "analyst" | "trade" | "quant" }) {
  const navigate = useNavigate();
  const live = useInstrument(asset.id);
  const price = live?.price ?? asset.marketPrice,
    change = live?.changePercent ?? asset.dailyChange;
  const isGlyph = asset.assetType === "EMOJI";
  return (
    <button
      className="heat-tile"
      style={{ background: heatColor(change) }}
      onClick={() => navigate(`/${mode}/${asset.ticker}`)}
    >
      {isGlyph && <span>{asset.canonicalExpression}</span>}
      <b>{asset.ticker}</b>
      <small>{money(price)}</small>
      <em>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</em>
    </button>
  );
}

/** Full-universe daily-change heatmap -- the classic sector/market-map view
 * analysts use to scan an entire universe at a glance, tile size uniform
 * (we don't have a market-cap-equivalent to size by honestly), color
 * intensity mapped from real daily change. */
export function UniverseHeatmap({
  assets,
  mode = "analyst",
}: {
  assets: ExpressionAsset[];
  mode?: "analyst" | "trade" | "quant";
}) {
  return (
    <div className="heatmap-grid">
      {assets.map((a) => (
        <HeatTile key={a.id} asset={a} mode={mode} />
      ))}
    </div>
  );
}
