import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { MarketPoint, OrderSide } from "@cult/shared";
import { request, useApi, money, pct } from "../lib/api.js";
import { useAnimatedNumber } from "../components/useAnimatedNumber.js";
import { usePriceFlash } from "../components/usePriceFlash.js";
import { useInstrument, usePriceHistory } from "../realtime/marketStore.js";
import { PriceChart, type PricePoint } from "../components/PriceChart.js";
import { Change } from "../components/Change.js";
import { InfoTip } from "../components/InfoTip.js";

type Series = "MARKET" | "REFERENCE";
type Range = "1H" | "1D" | "1W" | "1M" | "ALL";
const RANGES: Range[] = ["1H", "1D", "1W", "1M", "ALL"];
const RANGE_DAYS: Record<Exclude<Range, "1H">, number> = {
  "1D": 2,
  "1W": 7,
  "1M": 30,
  ALL: Infinity,
};

type OrderState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "filled"; price: number; quantity: number; side: OrderSide }
  | { status: "rejected"; reason: string };

export function Asset() {
  const { ticker = "CRY" } = useParams();
  const navigate = useNavigate();
  const { data: asset } = useApi<any>(`/assets/${ticker}`, null);
  const { data: dailyHistory } = useApi<{ data?: MarketPoint[] } | MarketPoint[]>(
    `/assets/${ticker}/history`,
    [],
  );
  const live = useInstrument(asset?.id ?? "");
  const liveHistory = usePriceHistory(asset?.id ?? "");
  const [side, setSide] = useState<OrderSide>("BUY"),
    [qty, setQty] = useState(1),
    [order, setOrder] = useState<OrderState>({ status: "idle" }),
    [series, setSeries] = useState<Series>("MARKET"),
    [range, setRange] = useState<Range>("1H");
  // Authoritative price: once the live feed has ticked this asset, it is
  // the single source of truth for display and order estimates -- the
  // pre-connection REST snapshot is a loading-state fallback only, never
  // shown alongside a different "live" number for the same asset. Hooks
  // must run unconditionally, so this (and the animation hook below it)
  // stays above the `!asset` early return.
  const authoritativePrice = live?.price ?? asset?.marketPrice ?? 0;
  const displayedPrice = useAnimatedNumber(authoritativePrice);
  const priceFlash = usePriceFlash(authoritativePrice);

  const dailyPoints = Array.isArray(dailyHistory)
    ? dailyHistory
    : (dailyHistory.data ?? []);

  const chartPoints: PricePoint[] = useMemo(() => {
    if (series === "MARKET" && range === "1H") return liveHistory;
    if (range === "1H") return []; // no live reference tick source yet
    const days = RANGE_DAYS[range],
      sliced =
        days === Infinity ? dailyPoints : dailyPoints.slice(-days);
    return sliced.map((p) => ({
      timeSec: Math.floor(Date.parse(p.timestamp) / 1000),
      value: series === "MARKET" ? p.marketPrice : p.indexValue,
    }));
  }, [series, range, liveHistory, dailyPoints]);

  if (!asset) return <main className="loading">Loading expression market…</main>;

  const changePercent = live?.changePercent ?? asset.dailyChange;
  const labels = asset.latestSemantics?.labels ?? {};

  const trade = async () => {
    setOrder({ status: "sending" });
    try {
      const result = await request<{ price: number; quantity: number }>(
        "/orders",
        {
          method: "POST",
          body: JSON.stringify({ assetId: asset.id, side, quantity: qty }),
        },
      );
      setOrder({
        status: "filled",
        price: result.price,
        quantity: result.quantity,
        side,
      });
    } catch (e) {
      setOrder({ status: "rejected", reason: (e as Error).message });
    }
  };

  return (
    <main className="asset-page">
      <button className="back" onClick={() => navigate("/")}>
        ← All markets
      </button>
      <div className="asset-grid">
        <section>
          <div className="asset-heading">
            <span>{asset.canonicalExpression}</span>
            <div>
              <p className="eyebrow">
                {asset.ticker} / {asset.assetType}
              </p>
              <h1>{asset.displayName}</h1>
            </div>
          </div>
          <div className="quote">
            <div>
              <small>
                MARKET PRICE {!live && "· CONNECTING"}
                <InfoTip>
                  The simulated price you actually trade at. Moves with
                  CULT-side order flow, not just measured internet activity.
                </InfoTip>
              </small>
              <strong className={priceFlash}>{money(displayedPrice)}</strong>
              <Change value={changePercent} />
            </div>
            <div>
              <small>
                EXPRESSION INDEX
                <InfoTip>
                  The measured reference index: how much this expression is
                  actually being used, independent of trading.
                </InfoTip>
              </small>
              <strong>{money(asset.currentIndexValue)}</strong>
              <span>
                {asset.referenceMetrics?.mode ?? "UNKNOWN"} ·{" "}
                {asset.referenceMetrics?.status ?? "UNKNOWN"}
              </span>
            </div>
          </div>
          <div className="chart-panel">
            <div className="chart-tabs">
              {(["MARKET", "REFERENCE"] as Series[]).map((s) => (
                <button
                  key={s}
                  className={series === s ? "chart-tab-active" : ""}
                  onClick={() => setSeries(s)}
                >
                  {s === "MARKET" ? "Market" : "Reference"}
                </button>
              ))}
              <span className="chart-tabs-spacer" />
              {RANGES.map((r) => (
                <button
                  key={r}
                  disabled={r === "1H" && series === "REFERENCE"}
                  title={
                    r === "1H" && series === "REFERENCE"
                      ? "Reference has no live tick feed yet"
                      : undefined
                  }
                  className={range === r ? "chart-tab-active" : ""}
                  onClick={() => setRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <PriceChart
              points={chartPoints}
              height={290}
              color={changePercent >= 0 ? "#4d9630" : "#cf4d45"}
            />
            {!chartPoints.length && (
              <p className="event-label">
                {range === "1H" && series === "REFERENCE"
                  ? "Select a longer range for reference history."
                  : "Awaiting market data…"}
              </p>
            )}
          </div>
          <div className="stats-grid">
            {Object.entries(asset.analytics?.momentum ?? {}).map(([k, v]) => (
              <div key={k}>
                <small>{k.toUpperCase()} MOMENTUM</small>
                <strong>{pct((v as number) * 100)}</strong>
              </div>
            ))}
            <div>
              <small>VOL 30</small>
              <strong>{(asset.analytics.volatility.d30 * 100).toFixed(2)}</strong>
            </div>
            <div>
              <small>DRAWDOWN</small>
              <strong>{pct(asset.analytics.drawdown * 100)}</strong>
            </div>
          </div>
        </section>
        <aside>
          <div className="trade-box">
            <div className="side-tabs">
              {(["BUY", "SHORT"] as OrderSide[]).map((x) => (
                <button
                  key={x}
                  className={side === x ? "active" : ""}
                  onClick={() => setSide(x)}
                >
                  {x}
                </button>
              ))}
            </div>
            <label>
              Quantity
              <input
                type="number"
                min=".01"
                step="1"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </label>
            <div className="order-line">
              <span>Estimated execution</span>
              <b>{money(authoritativePrice)}</b>
            </div>
            <div className="order-line">
              <span>Estimated notional</span>
              <b>{money(qty * authoritativePrice)} CULT</b>
            </div>
            <button
              className="submit"
              onClick={trade}
              disabled={order.status === "sending"}
            >
              {order.status === "sending" ? "SENDING…" : `${side} ${asset.ticker}`}
            </button>
            {order.status === "filled" && (
              <p className="order-message order-filled">
                Filled {order.quantity} {asset.ticker} @ {money(order.price)}.
              </p>
            )}
            {order.status === "rejected" && (
              <p className="order-message order-rejected">
                Order rejected — {order.reason}
              </p>
            )}
            <small>Immediate simulated fill • 10 bps fee</small>
          </div>
          <div className="semantic">
            <p className="eyebrow">SEMANTIC COMPOSITION</p>
            {Object.entries(labels)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(([k, v]) => (
                <div className="semantic-row" key={k}>
                  <span>{k}</span>
                  <i>
                    <b style={{ width: `${(v as number) * 100}%` }} />
                  </i>
                  <strong>{((v as number) * 100).toFixed(1)}%</strong>
                </div>
              ))}
            <button onClick={() => navigate(`/analyst/${asset.ticker}`)}>
              Open full analysis →
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
