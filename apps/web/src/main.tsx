import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  ExpressionAsset,
  IndexDefinition,
  MarketPoint,
  OrderSide,
} from "@cult/shared";
import "./styles.css";
const API = import.meta.env.VITE_API_URL ?? "http://localhost:4100/api/v1";
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json" },
    ...init,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Request failed");
  return j.data ?? j;
}
function useApi<T>(path: string, initial: T) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  useEffect(() => {
    request<T>(path)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [path]);
  return { data, error, reload: () => request<T>(path).then(setData) };
}
const money = (n: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n),
  pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
function Spark({
  points,
  color = "#a8ff60",
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
function Change({ value }: { value: number }) {
  return <span className={value >= 0 ? "up" : "down"}>{pct(value)}</span>;
}
function Shell() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const fn = () => setPath(location.pathname);
    addEventListener("popstate", fn);
    return () => removeEventListener("popstate", fn);
  }, []);
  const go = (p: string) => {
    history.pushState({}, "", p);
    setPath(p);
    scrollTo(0, 0);
  };
  if (path.startsWith("/terminal")) return <Terminal path={path} go={go} />;
  let page: React.ReactNode = <Home go={go} />;
  if (path.startsWith("/asset/"))
    page = <Asset ticker={path.split("/")[2] ?? "CRY"} go={go} />;
  else if (path === "/portfolio") page = <Portfolio />;
  else if (path === "/leaderboard") page = <Leaderboard />;
  else if (path.startsWith("/index/"))
    page = <IndexPage ticker={path.split("/")[2] ?? "EMOJI100"} />;
  return (
    <>
      <header className="nav">
        <button className="brand" onClick={() => go("/")}>
          CULT<span>®</span>
        </button>
        <nav>
          <button onClick={() => go("/")}>Markets</button>
          <button onClick={() => go("/portfolio")}>Portfolio</button>
          <button onClick={() => go("/leaderboard")}>Leaderboard</button>
        </nav>
        <button className="terminal-entry" onClick={() => go("/terminal")}>
          ENTER ANALYST MODE <kbd>⌘ K</kbd>
        </button>
        <div className="balance">
          10,000 <small>CULT</small>
        </div>
      </header>
      {page}
      <Footer />
    </>
  );
}
function Home({ go }: { go: (p: string) => void }) {
  const { data: assets } = useApi<
    { data?: ExpressionAsset[] } | ExpressionAsset[]
  >("/assets", []);
  const rows = Array.isArray(assets) ? assets : [];
  const { data: indexes } = useApi<IndexDefinition[]>("/indexes", []);
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">THE EXPRESSION MARKET</p>
        <h1>
          Trade how the internet
          <br />
          <em>expresses itself.</em>
        </h1>
        <p>
          Expression markets backed by a deterministic, cross-platform reference
          index. Fake money. Unreasonably serious methodology.
        </p>
        <div className="market-open">
          <i /> MARKET OPEN <span>•</span> 19 EXPRESSIONS
        </div>
      </section>
      <section className="section">
        <div className="section-title">
          <div>
            <p className="eyebrow">LIVE MARKETS</p>
            <h2>What’s moving today?</h2>
          </div>
          <button>View all →</button>
        </div>
        <div className="cards">
          {rows.slice(0, 8).map((a, i) => (
            <button
              className="asset-card"
              key={a.id}
              onClick={() => go(`/asset/${a.ticker}`)}
            >
              <div className="asset-top">
                <span className="emoji">{a.canonicalExpression}</span>
                <Change value={a.dailyChange} />
              </div>
              <strong>{a.ticker}</strong>
              <small>{a.displayName}</small>
              <Spark
                points={Array.from(
                  { length: 20 },
                  (_, j) =>
                    a.currentIndexValue *
                    (1 +
                      Math.sin(j * 0.7 + i) * 0.015 +
                      ((j / 19 - 1) * a.dailyChange) / 100),
                )}
                color={a.dailyChange >= 0 ? "#75c642" : "#e2534b"}
                height={55}
              />
              <b>{money(a.marketPrice)}</b>
              <span className="reference">
                INDEX {money(a.currentIndexValue)}
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="tape">
        MARKET NOTE{" "}
        <span>
          😭 breadth expanded across all observed platforms. 🥀 volatility
          reached a 30-day high. BRAINROT20 entered correction-recovery
          territory.
        </span>
      </section>
      <section className="section two-col">
        <div>
          <div className="section-title">
            <div>
              <p className="eyebrow">CULTURAL INDEXES</p>
              <h2>Entire sectors of posting.</h2>
            </div>
          </div>
          <div className="index-list">
            {indexes.map((x) => (
              <button key={x.id} onClick={() => go(`/index/${x.ticker}`)}>
                <span>
                  <b>{x.ticker}</b>
                  <small>{x.name}</small>
                </span>
                <strong>{money(x.currentValue)}</strong>
                <Change value={x.dailyChange} />
              </button>
            ))}
          </div>
        </div>
        <div className="expression-day">
          <p className="eyebrow">EXPRESSION OF THE DAY</p>
          <div>🥀</div>
          <h2>WILT</h2>
          <p>
            Attention is broadening following a transition into a
            high-volatility regime.
          </p>
          <dl>
            <dt>1D MOMENTUM</dt>
            <dd className="up">+18.2%</dd>
            <dt>DATA MODE</dt>
            <dd>SYNTHETIC</dd>
          </dl>
        </div>
      </section>
    </main>
  );
}
function Asset({ ticker, go }: { ticker: string; go: (p: string) => void }) {
  const { data: asset } = useApi<any>(`/assets/${ticker}`, null),
    { data: history } = useApi<any>(`/assets/${ticker}/history`, { data: [] });
  const [side, setSide] = useState<OrderSide>("BUY"),
    [qty, setQty] = useState(1),
    [message, setMessage] = useState("");
  if (!asset)
    return <main className="loading">Loading expression market…</main>;
  const points = (history.data ?? history ?? []) as MarketPoint[];
  const labels = asset.latestSemantics?.labels ?? {};
  const trade = async () => {
    try {
      await request("/orders", {
        method: "POST",
        body: JSON.stringify({ assetId: asset.id, side, quantity: qty }),
      });
      setMessage(`${side} filled at the simulated market price.`);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <main className="asset-page">
      <button className="back" onClick={() => go("/")}>
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
              <small>MARKET PRICE</small>
              <strong>{money(asset.marketPrice)}</strong>
              <Change value={asset.dailyChange} />
            </div>
            <div>
              <small>EXPRESSION INDEX</small>
              <strong>{money(asset.currentIndexValue)}</strong>
              <span>
                {asset.referenceMetrics?.mode ?? "UNKNOWN"} ·{" "}
                {asset.referenceMetrics?.status ?? "UNKNOWN"}
              </span>
            </div>
          </div>
          <div className="chart-panel">
            <div className="chart-tabs">
              <b>1Y</b>
              <span>Market price</span>
              <span>Reference index</span>
            </div>
            <Spark points={points.map((x) => x.marketPrice)} height={290} />
            <div className="event-label">
              ▲{" "}
              {points.find((x) => x.event)?.event ??
                "Observable Internet Panel history"}
            </div>
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
              <strong>
                {(asset.analytics.volatility.d30 * 100).toFixed(2)}
              </strong>
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
              <span>Estimated notional</span>
              <b>{money(qty * asset.marketPrice)} CULT</b>
            </div>
            <button className="submit" onClick={trade}>
              {side} {asset.ticker}
            </button>
            {message && <p className="order-message">{message}</p>}
            <small>Immediate simulated fill • 10 bps fee</small>
          </div>
          <div className="semantic">
            <p className="eyebrow">SEMANTIC COMPOSITION</p>
            {Object.entries(labels)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(([k, v]) => (
                <div className="semantic-row">
                  <span>{k}</span>
                  <i>
                    <b style={{ width: `${(v as number) * 100}%` }} />
                  </i>
                  <strong>{((v as number) * 100).toFixed(1)}%</strong>
                </div>
              ))}
            <button onClick={() => go(`/terminal/${asset.ticker}`)}>
              Open full analysis →
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
function Portfolio() {
  const { data: p, reload } = useApi<any>("/portfolio", null);
  if (!p) return <main className="loading">Marking portfolio…</main>;
  return (
    <main className="page">
      <p className="eyebrow">PORTFOLIO / @CRYINGCAPITAL</p>
      <h1>
        {money(p.value)} <small>CULT</small>
      </h1>
      <p className={p.value >= 10000 ? "up" : "down"}>
        {pct((p.value / 10000 - 1) * 100)} all time
      </p>
      <div className="summary-grid">
        <div>
          <small>AVAILABLE CASH</small>
          <b>{money(p.cash)}</b>
        </div>
        <div>
          <small>GROSS EXPOSURE</small>
          <b>{money(p.grossExposure)}</b>
        </div>
        <div>
          <small>NET EXPOSURE</small>
          <b>{money(p.netExposure)}</b>
        </div>
        <div>
          <small>UNREALIZED P&amp;L</small>
          <b>{money(p.unrealizedPnl)}</b>
        </div>
      </div>
      <section className="table-panel">
        <h2>Positions</h2>
        <table>
          <thead>
            <tr>
              <th>Expression</th>
              <th>Quantity</th>
              <th>Avg entry</th>
              <th>Mark</th>
              <th>Market value</th>
              <th>Unrealized P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {p.positions.length ? (
              p.positions.map((x: any) => (
                <tr>
                  <td>{x.assetId.replace("expr_", "").toUpperCase()}</td>
                  <td>{x.quantity}</td>
                  <td>{money(x.averageEntryPrice)}</td>
                  <td>{money(x.currentMark)}</td>
                  <td>{money(x.marketValue)}</td>
                  <td className={x.unrealizedPnl >= 0 ? "up" : "down"}>
                    {money(x.unrealizedPnl)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  No positions. The committee remains cautiously unexpressed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <div className="two-col">
        <section className="table-panel">
          <h2>Recent trades</h2>
          {p.orders.map((o: any) => (
            <div className="activity">
              <b>
                {o.side} {o.assetId.replace("expr_", "")}
              </b>
              <span>
                {o.quantity} @ {money(o.price)}
              </span>
            </div>
          ))}
        </section>
        <section className="table-panel">
          <h2>Institutional record</h2>
          <div className="badge-row">
            <span>💎 DIAMOND HANDS</span>
            <span>📉 {p.bankruptcies} BANKRUPTCIES</span>
          </div>
          <p className="muted">
            Portfolio analytics describe simulated performance only and have no
            financial meaning.
          </p>
        </section>
      </div>
    </main>
  );
}
function Leaderboard() {
  const { data: rows } = useApi<any[]>("/leaderboard", []);
  return (
    <main className="page">
      <p className="eyebrow">RISK-ADJUSTED EXCELLENCE</p>
      <h1>Leaderboard</h1>
      <p className="lede">
        Ranked by time-weighted return. Bailout capital provides no competitive
        advantage.
      </p>
      <section className="table-panel">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Analyst</th>
              <th>Time-weighted return</th>
              <th>Portfolio</th>
              <th>Bankruptcies</th>
              <th>Trades</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr>
                <td>#{r.rank}</td>
                <td>
                  <b>@{r.username}</b>
                </td>
                <td className={r.twr >= 0 ? "up" : "down"}>{pct(r.twr)}</td>
                <td>{money(r.value)} CULT</td>
                <td>{r.bankruptcies}</td>
                <td>{r.trades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
function IndexPage({ ticker }: { ticker: string }) {
  const { data: x } = useApi<any>(`/indexes/${ticker}`, null);
  if (!x) return <main className="loading">Reconstituting index…</main>;
  return (
    <main className="page">
      <p className="eyebrow">
        CULTURAL INDEX / {x.rebalanceFrequency} REBALANCE
      </p>
      <h1>
        {x.ticker} <small>{x.name}</small>
      </h1>
      <div className="quote">
        <div>
          <small>INDEX VALUE</small>
          <strong>{money(x.currentValue)}</strong>
          <Change value={x.dailyChange} />
        </div>
      </div>
      <div className="chart-panel">
        <Spark points={x.history.map((p: any) => p.value)} height={260} />
      </div>
      <div className="two-col">
        <section className="table-panel">
          <h2>Constituents</h2>
          {x.constituents.map((c: any) => (
            <div className="activity">
              <b>{c.assetId.replace("expr_", "").toUpperCase()}</b>
              <span>{(c.weight * 100).toFixed(1)}%</span>
            </div>
          ))}
        </section>
        <section className="table-panel">
          <h2>Methodology</h2>
          <p>{x.methodology}</p>
          <p className="muted">
            Historical compositions are immutable. Semantic factors inform
            selection but never the objective expression oracle.
          </p>
        </section>
      </div>
    </main>
  );
}
function Footer() {
  return (
    <footer>
      <b>CULT</b>
      <span>Simulated markets for internet expression.</span>
      <span>No cash value. No prizes. No dignity compromised.</span>
    </footer>
  );
}
function Terminal({ path, go }: { path: string; go: (p: string) => void }) {
  const ticker = path.split("/")[2] ?? "CRY";
  const { data: asset } = useApi<any>(`/assets/${ticker}`, null),
    { data: history } = useApi<any>(`/assets/${ticker}/history`, { data: [] }),
    { data: platforms } = useApi<any>(`/assets/${ticker}/platforms`, {}),
    { data: semantics } = useApi<any[]>(`/assets/${ticker}/semantics`, []);
  const { data: corr } = useApi<{ ticker: string; values: number[] }[]>(
    "/analytics/correlation",
    [],
  );
  const { data: dataStatus } = useApi<any>("/data/status", null);
  const [pair, setPair] = useState<any>(null),
    [backtest, setBacktest] = useState<any>(null);
  useEffect(() => {
    request("/analytics/pair?a=CRY&b=SKULL").then(setPair);
  }, []);
  if (!asset)
    return (
      <div className="terminal loading">
        INITIALIZING CULT QUANTITATIVE EXPRESSION SYSTEM…
      </div>
    );
  const points = (history.data ?? history ?? []) as MarketPoint[],
    latest = semantics.at(-1)?.labels ?? asset.latestSemantics.labels,
    reference = asset.referenceMetrics;
  const metric = (value: number | null | undefined, digits = 2) =>
    value == null ? "N/A" : value.toFixed(digits);
  return (
    <div className="terminal">
      <header className="term-head">
        <button onClick={() => go("/")} className="term-logo">
          CULT//TERMINAL
        </button>
        <div className="command">
          <span>⌕</span>
          <input
            defaultValue={`${asset.ticker} DES`}
            aria-label="Terminal command"
          />
          <kbd>ENTER</kbd>
        </div>
        <div className="system">
          <i /> {reference?.sourceHealth ?? "UNKNOWN"}
          <br />
          <small>{reference?.mode ?? "UNKNOWN"} DATA</small>
        </div>
      </header>
      <div className="term-body">
        <aside className="rail">
          <p>WORKSPACE</p>
          {[
            "Overview",
            "History",
            "Platforms",
            "Semantics",
            "Momentum",
            "Volatility",
            "Correlations",
            "Pairs",
            "Indexes",
            "Events",
            "Data",
            "Backtest",
          ].map((x, i) => (
            <button className={i === 0 ? "active" : ""}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {x}
            </button>
          ))}
          <button className="exit" onClick={() => go("/")}>
            ← CASUAL MODE
          </button>
        </aside>
        <main className="term-main">
          <div className="term-title">
            <div className="term-expression">{asset.canonicalExpression}</div>
            <div>
              <p>{asset.ticker} / EXPRESSION REFERENCE</p>
              <h1>{asset.displayName.toUpperCase()}</h1>
            </div>
            <div className="term-price">
              <small>REFERENCE / MARKET</small>
              <strong>{money(asset.currentIndexValue)}</strong>
              <span>
                {money(asset.marketPrice)}{" "}
                <em>
                  {pct((asset.marketPrice / asset.currentIndexValue - 1) * 100)}{" "}
                  PREMIUM
                </em>
              </span>
            </div>
          </div>
          <div className="term-grid">
            <section className="panel wide">
              <PanelTitle
                n="01"
                title="EXPRESSION HISTORY"
                meta="1Y · DAILY · CULT OBSERVABLE INTERNET PANEL"
              />
              <Spark points={points.map((x) => x.indexValue)} height={220} />
              <div className="term-kpis">
                <TermKpi
                  label="1D"
                  value={pct(asset.analytics.momentum.d1 * 100)}
                />
                <TermKpi
                  label="7D"
                  value={pct(asset.analytics.momentum.d7 * 100)}
                />
                <TermKpi
                  label="30D"
                  value={pct(asset.analytics.momentum.d30 * 100)}
                />
                <TermKpi
                  label="90D"
                  value={pct(asset.analytics.momentum.d90 * 100)}
                />
                <TermKpi
                  label="VOL30"
                  value={(asset.analytics.volatility.d30 * 100).toFixed(2)}
                />
                <TermKpi
                  label="BETA"
                  value={asset.analytics.betaHeart.toFixed(2)}
                />
              </div>
            </section>
            <section className="panel">
              <PanelTitle
                n="02"
                title="PLATFORM DECOMPOSITION"
                meta="LATEST WINDOW"
              />
              <table>
                <thead>
                  <tr>
                    <th>PLATFORM</th>
                    <th>USE/1M</th>
                    <th>VELOCITY</th>
                    <th>BREADTH</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(platforms).map(([name, o]: any) => (
                    <tr>
                      <td>{name}</td>
                      <td>{money(o.normalizedUsage)}</td>
                      <td className={o.velocity >= 0 ? "term-up" : "term-down"}>
                        {o.velocity >= 0 ? "+" : ""}
                        {money(o.velocity)}
                      </td>
                      <td>{(o.breadth * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="fineprint">
                Platform observations are normalized independently before
                aggregation. Collection volume does not determine index weight.
              </p>
            </section>
            <section className="panel">
              <PanelTitle
                n="03"
                title="SEMANTIC STATE"
                meta={`ENTROPY ${semantics.at(-1)?.entropy?.toFixed(3)}`}
              />
              {Object.entries(latest)
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .map(([k, v]) => (
                  <div className="term-bar">
                    <span>{k.toUpperCase()}</span>
                    <i>
                      <b style={{ width: `${(v as number) * 100}%` }} />
                    </i>
                    <strong>{((v as number) * 100).toFixed(1)}</strong>
                  </div>
                ))}
              <p className="fineprint">
                Analytical inference only. Semantic labels do not control market
                settlement.
              </p>
            </section>
            <section className="panel wide">
              <PanelTitle
                n="04"
                title="REFERENCE & DATA QUALITY"
                meta={`${reference?.mode ?? "UNKNOWN"} · ${reference?.status ?? "UNKNOWN"}`}
              />
              <div className="term-kpis">
                <TermKpi
                  label="USES / 1M"
                  value={metric(reference?.rawPrevalence)}
                />
                <TermKpi
                  label="SMOOTHED / 1M"
                  value={metric(reference?.smoothedPrevalence)}
                />
                <TermKpi
                  label="VELOCITY"
                  value={metric(reference?.signals?.velocity, 4)}
                />
                <TermKpi
                  label="ACCELERATION"
                  value={metric(reference?.signals?.acceleration, 4)}
                />
                <TermKpi
                  label="BREADTH"
                  value={metric(reference?.signals?.breadth, 3)}
                />
                <TermKpi
                  label="PERSISTENCE"
                  value={metric(reference?.signals?.persistence, 3)}
                />
              </div>
              <dl className="term-dl">
                <dt>COIP SOURCES</dt>
                <dd>{reference?.coipSources ?? "N/A"}</dd>
                <dt>SOURCE HEALTH</dt>
                <dd>{reference?.sourceHealth ?? "N/A"}</dd>
                <dt>DATA QUALITY SCORE</dt>
                <dd>{metric(reference?.dataQualityScore)}</dd>
                <dt>SEASONAL ADJUSTMENT</dt>
                <dd>
                  {reference?.seasonalAdjustmentStatus ??
                    "INSUFFICIENT_HISTORY"}
                </dd>
                <dt>METHODOLOGY</dt>
                <dd>{reference?.methodologyVersion ?? "N/A"}</dd>
                <dt>REGISTRY</dt>
                <dd>{reference?.expressionRegistryVersion ?? "N/A"}</dd>
              </dl>
              <p className="fineprint">
                A data-quality score is not a probability. Unavailable
                components remain N/A; live one-source observations are
                provisional.
              </p>
            </section>
            <section className="panel wide">
              <PanelTitle
                n="05"
                title="ROLLING CORRELATION MATRIX"
                meta="90D · PEARSON"
              />
              <div className="matrix">
                <span />
                {corr.slice(0, 7).map((r) => (
                  <b>{r.ticker}</b>
                ))}
                {corr.slice(0, 7).flatMap((r, i) => [
                  <b key={`row-${r.ticker}`}>{r.ticker}</b>,
                  ...r.values.slice(0, 7).map((v, j) => (
                    <i
                      key={`${i}-${j}`}
                      style={{
                        background: `rgba(${v > 0 ? "110,208,70" : "220,75,75"},${0.12 + Math.abs(v) * 0.65})`,
                      }}
                    >
                      {v.toFixed(2)}
                    </i>
                  )),
                ])}
              </div>
            </section>
            <section className="panel">
              <PanelTitle n="06" title="PAIR MONITOR" meta="CRY / SKULL" />
              {pair && (
                <>
                  <div className="pair-value">
                    <span>RATIO</span>
                    <b>{pair.series.at(-1).ratio.toFixed(4)}</b>
                  </div>
                  <Spark
                    points={pair.series.map((x: any) => x.ratio)}
                    height={105}
                  />
                  <dl className="term-dl">
                    <dt>CORRELATION</dt>
                    <dd>{pair.correlation.toFixed(3)}</dd>
                    <dt>Z-SCORE</dt>
                    <dd>{pair.zScore.toFixed(2)}σ</dd>
                    <dt>REL MOMENTUM</dt>
                    <dd>{pct(pair.relativeMomentum * 100)}</dd>
                  </dl>
                </>
              )}
            </section>
            <section className="panel">
              <PanelTitle
                n="07"
                title="BACKTEST LAB"
                meta="NO LOOK-AHEAD · 10 BPS"
              />
              <h3>TOP 3 / 30D MOMENTUM</h3>
              <p className="fineprint">
                Weekly rebalance. Equal weight. Synthetic daily close execution.
              </p>
              <button
                className="run"
                onClick={() =>
                  request("/backtests", { method: "POST", body: "{}" }).then(
                    setBacktest,
                  )
                }
              >
                RUN MODEL
              </button>
              {backtest && (
                <div className="backtest-results">
                  <TermKpi
                    label="TOTAL RETURN"
                    value={pct(backtest.totalReturn * 100)}
                  />
                  <TermKpi
                    label="MAX DD"
                    value={pct(backtest.maxDrawdown * 100)}
                  />
                  <TermKpi
                    label="SHARPE-LIKE"
                    value={backtest.sharpe.toFixed(2)}
                  />
                  <TermKpi label="TRADES" value={String(backtest.trades)} />
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
      <div className="statusbar">
        <span>CULT OBSERVABLE INTERNET PANEL</span>
        <span>{reference?.methodologyVersion ?? "COIP-1"}</span>
        <span>OBJECTIVE LAYER: {reference?.mode ?? "UNKNOWN"}</span>
        <span>
          SOURCE: {dataStatus?.source?.state ?? reference?.sourceHealth}
        </span>
        <span>SEMANTIC LAYER: SYNTHETIC</span>
        <span>REGISTRY: {reference?.expressionRegistryVersion ?? "N/A"}</span>
      </div>
    </div>
  );
}
function PanelTitle({
  n,
  title,
  meta,
}: {
  n: string;
  title: string;
  meta: string;
}) {
  return (
    <div className="panel-title">
      <b>
        {n} / {title}
      </b>
      <span>{meta}</span>
    </div>
  );
}
function TermKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="term-kpi">
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Shell />
  </React.StrictMode>,
);
