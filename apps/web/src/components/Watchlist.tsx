import { useNavigate } from "react-router-dom";
import { ASSETS, type ExpressionAsset } from "@cult/shared";
import { useInstrument } from "../realtime/marketStore.js";
import { money, pct } from "../lib/api.js";

const BADGE_COLORS = ["#2962ff", "#7e57c2", "#26a69a", "#ef6c00", "#ec407a", "#5c6bc0"];
function badgeColor(ticker: string): string {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) hash = (hash * 31 + ticker.charCodeAt(i)) >>> 0;
  return BADGE_COLORS[hash % BADGE_COLORS.length]!;
}

function WatchlistRow({ asset, active, mode }: {
  asset: ExpressionAsset;
  active: boolean;
  mode: "analyst" | "trade" | "quant";
}) {
  const navigate = useNavigate();
  const live = useInstrument(asset.id);
  const price = live?.price ?? asset.marketPrice,
    change = live?.changePercent ?? asset.dailyChange;
  return (
    <button
      className={active ? "watchlist-row active" : "watchlist-row"}
      onClick={() => navigate(`/${mode}/${asset.ticker}`)}
    >
      {asset.assetType === "EMOJI" ? (
        <span className="watchlist-badge watchlist-badge-emoji">{asset.canonicalExpression}</span>
      ) : (
        <span className="watchlist-badge" style={{ background: badgeColor(asset.ticker) }}>
          {asset.ticker.slice(0, 1)}
        </span>
      )}
      <span className="watchlist-ticker">{asset.ticker}</span>
      <span className="watchlist-price">{money(price)}</span>
      <span className={change >= 0 ? "watchlist-chg term-up" : "watchlist-chg term-down"}>
        {pct(change)}
      </span>
    </button>
  );
}

/** Live watchlist sidebar, TradingView-style -- real per-asset subscriptions,
 * navigates within the current mode (Analyst stays in Analyst, etc). */
export function Watchlist({
  selectedTicker,
  mode = "analyst",
}: {
  selectedTicker: string;
  mode?: "analyst" | "trade" | "quant";
}) {
  return (
    <aside className="watchlist">
      <p className="watchlist-title">WATCHLIST</p>
      <div className="watchlist-rows">
        {ASSETS.map((a) => (
          <WatchlistRow
            key={a.id}
            asset={a}
            active={a.ticker === selectedTicker}
            mode={mode}
          />
        ))}
      </div>
    </aside>
  );
}
