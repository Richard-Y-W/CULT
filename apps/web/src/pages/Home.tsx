import { useNavigate } from "react-router-dom";
import type { ExpressionAsset, IndexDefinition } from "@cult/shared";
import { useApi, money, pct } from "../lib/api.js";
import { useInstrument, usePriceHistory } from "../realtime/marketStore.js";
import { useAnimatedNumber } from "../components/useAnimatedNumber.js";
import { usePriceFlash } from "../components/usePriceFlash.js";
import { PriceChart } from "../components/PriceChart.js";
import { Spark } from "../components/Spark.js";
import { Change } from "../components/Change.js";

const METHODOLOGY_LABEL: Record<IndexDefinition["methodologyClassification"], string> = {
  CURATED: "Curated",
  RULES_BASED: "Rules-based",
  DATA_DRIVEN: "Data-driven",
  EXPERIMENTAL: "Experimental",
};

function FeaturedMarket({ asset }: { asset: ExpressionAsset }) {
  const navigate = useNavigate();
  const live = useInstrument(asset.id);
  const history = usePriceHistory(asset.id);
  const price = live?.price ?? asset.marketPrice;
  const change = live?.changePercent ?? asset.dailyChange;
  const displayed = useAnimatedNumber(price);
  const flash = usePriceFlash(price);
  return (
    <section className="featured">
      <div className="featured-info">
        <p className="eyebrow">TRENDING NOW</p>
        <button className="featured-title" onClick={() => navigate(`/trade/${asset.ticker}`)}>
          <span className="emoji">{asset.canonicalExpression}</span>
          <span>
            <b>{asset.ticker}</b>
            <small>{asset.displayName}</small>
          </span>
        </button>
        <div className="featured-price">
          <strong className={flash}>{money(displayed)}</strong>
          <Change value={change} />
        </div>
        <p className="featured-blurb">
          {asset.ticker} is {change >= 0 ? "up" : "down"} {Math.abs(change).toFixed(1)}%
          today on {money(asset.currentIndexValue)} measured internet usage.
        </p>
        <div className="featured-actions">
          <button className="submit" onClick={() => navigate(`/trade/${asset.ticker}`)}>
            Trade {asset.ticker} →
          </button>
        </div>
      </div>
      <div className="featured-chart">
        <PriceChart
          points={history}
          height={280}
          color={change >= 0 ? "#4d9630" : "#cf4d45"}
        />
        {!history.length && <p className="event-label">Connecting to live feed…</p>}
      </div>
    </section>
  );
}

function AssetCard({ asset }: { asset: ExpressionAsset }) {
  const navigate = useNavigate();
  const live = useInstrument(asset.id);
  const history = usePriceHistory(asset.id);
  const price = live?.price ?? asset.marketPrice;
  const change = live?.changePercent ?? asset.dailyChange;
  return (
    <button
      className="asset-card"
      onClick={() => navigate(`/trade/${asset.ticker}`)}
    >
      <div className="asset-top">
        <span className="emoji">{asset.canonicalExpression}</span>
        <Change value={change} />
      </div>
      <strong>{asset.ticker}</strong>
      <small>{asset.displayName}</small>
      {history.length >= 2 ? (
        <Spark
          points={history.map((p) => p.value)}
          color={change >= 0 ? "#75c642" : "#e2534b"}
          height={55}
        />
      ) : (
        <div className="spark-pending" style={{ height: 55 }} />
      )}
      <b>{money(price)}</b>
      <span className="reference">INDEX {money(asset.currentIndexValue)}</span>
    </button>
  );
}

function MoversRow({ asset }: { asset: ExpressionAsset }) {
  const navigate = useNavigate();
  const live = useInstrument(asset.id);
  const price = live?.price ?? asset.marketPrice;
  const change = live?.changePercent ?? asset.dailyChange;
  return (
    <button className="movers-row" onClick={() => navigate(`/trade/${asset.ticker}`)}>
      <span>{asset.canonicalExpression}</span>
      <b>{asset.ticker}</b>
      <span className="movers-price">{money(price)}</span>
      <Change value={change} />
    </button>
  );
}

export function Home() {
  const { data: assets } = useApi<
    { data?: ExpressionAsset[] } | ExpressionAsset[]
  >("/assets", []);
  const rows = Array.isArray(assets) ? assets : [];
  const { data: indexes } = useApi<IndexDefinition[]>("/indexes", []);
  const navigate = useNavigate();

  const byMovement = [...rows].sort(
    (a, b) => Math.abs(b.dailyChange) - Math.abs(a.dailyChange),
  );
  const featured = byMovement[0];
  const gainers = [...rows]
    .filter((a) => a.dailyChange > 0)
    .sort((a, b) => b.dailyChange - a.dailyChange)
    .slice(0, 5);
  const losers = [...rows]
    .filter((a) => a.dailyChange < 0)
    .sort((a, b) => a.dailyChange - b.dailyChange)
    .slice(0, 5);

  return (
    <main>
      <div className="market-open market-open-strip">
        <i /> MARKET OPEN <span>•</span> {rows.length} EXPRESSIONS TRADING
      </div>
      {featured && <FeaturedMarket asset={featured} />}
      <section className="section">
        <div className="section-title">
          <div>
            <p className="eyebrow">LIVE MARKETS</p>
            <h2>What's moving today?</h2>
          </div>
        </div>
        <div className="cards">
          {byMovement.slice(1, 9).map((a) => (
            <AssetCard key={a.id} asset={a} />
          ))}
        </div>
      </section>
      <section className="two-col">
        <div>
          <div className="section-title">
            <div>
              <p className="eyebrow">BIGGEST MOVERS</p>
              <h2>Gainers &amp; losers</h2>
            </div>
          </div>
          <div className="movers-grid">
            <div>
              <p className="movers-label up">GAINERS</p>
              {gainers.map((a) => (
                <MoversRow key={a.id} asset={a} />
              ))}
            </div>
            <div>
              <p className="movers-label down">LOSERS</p>
              {losers.map((a) => (
                <MoversRow key={a.id} asset={a} />
              ))}
            </div>
          </div>
        </div>
        <div>
          <div className="section-title">
            <div>
              <p className="eyebrow">CULTURAL INDEXES</p>
              <h2>Entire sectors of posting.</h2>
            </div>
          </div>
          <div className="index-list">
            {indexes.map((x) => (
              <button key={x.id} onClick={() => navigate(`/index/${x.ticker}`)}>
                <span>
                  <b>{x.ticker}</b>
                  <small>{x.name}</small>
                  <em className="index-badge">
                    {METHODOLOGY_LABEL[x.methodologyClassification]}
                  </em>
                </span>
                <strong>{money(x.currentValue)}</strong>
                <Change value={x.dailyChange} />
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
