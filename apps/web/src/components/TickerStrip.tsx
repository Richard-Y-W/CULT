import { ASSETS } from "@cult/shared";
import { useInstrument } from "../realtime/marketStore.js";
import { money, pct } from "../lib/api.js";

function TickerCell({ ticker, emoji, marketPrice, dailyChange, id }: {
  ticker: string;
  emoji: string;
  marketPrice: number;
  dailyChange: number;
  id: string;
}) {
  const live = useInstrument(id);
  const price = live?.price ?? marketPrice,
    change = live?.changePercent ?? dailyChange;
  return (
    <span className="ticker-cell">
      <i>{emoji}</i>
      <b>{ticker}</b>
      <span>{money(price)}</span>
      <em className={change >= 0 ? "term-up" : "term-down"}>{pct(change)}</em>
    </span>
  );
}

/** Bloomberg-style scrolling market-internals strip. Real live data, one
 * subscription per cell so a single tick only repaints its own cell. */
export function TickerStrip() {
  return (
    <div className="ticker-strip">
      <div className="ticker-strip-track">
        {[...ASSETS, ...ASSETS].map((a, i) => (
          <TickerCell
            key={`${a.id}-${i}`}
            id={a.id}
            ticker={a.ticker}
            emoji={a.canonicalExpression}
            marketPrice={a.marketPrice}
            dailyChange={a.dailyChange}
          />
        ))}
      </div>
    </div>
  );
}
