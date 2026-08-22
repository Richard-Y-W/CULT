import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ExpressionAsset, MarketPoint } from "@cult/shared";
import { request, useApi, money, pct } from "../lib/api.js";
import { Spark } from "../components/Spark.js";
import { PriceChart, type PricePoint } from "../components/PriceChart.js";
import { Watchlist } from "../components/Watchlist.js";
import { UniverseHeatmap } from "../components/UniverseHeatmap.js";
import { ScatterPlot, type ScatterPoint } from "../components/ScatterPlot.js";
import { useInstrument } from "../realtime/marketStore.js";

const TABS = [
  { id: "heatmap", label: "Heatmap" },
  { id: "scatter", label: "Scatter" },
  { id: "correlations", label: "Correlations" },
  { id: "pairs", label: "Pairs" },
  { id: "events", label: "Events" },
  { id: "platforms", label: "Platforms" },
  { id: "semantics", label: "Semantics" },
  { id: "data", label: "Data quality" },
  { id: "backtest", label: "Backtest" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function PanelTitle({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="panel-title">
      <b>{title}</b>
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

export function Analyst() {
  const { ticker = "CRY" } = useParams();
  const navigate = useNavigate();
  const { data: asset } = useApi<any>(`/assets/${ticker}`, null),
    { data: history } = useApi<{ data?: MarketPoint[]; events?: any[] } | MarketPoint[]>(
      `/assets/${ticker}/history`,
      { data: [] },
    ),
    { data: platforms } = useApi<any>(`/assets/${ticker}/platforms`, {}),
    { data: semantics } = useApi<any[]>(`/assets/${ticker}/semantics`, []);
  const { data: corr } = useApi<{ ticker: string; values: number[] }[]>(
    "/analytics/correlation",
    [],
  );
  const { data: dataStatus } = useApi<any>("/data/status", null);
  const { data: universeRaw } = useApi<{ data?: ExpressionAsset[] } | ExpressionAsset[]>(
    "/assets",
    [],
  );
  const universe = Array.isArray(universeRaw) ? universeRaw : (universeRaw.data ?? []);
  const live = useInstrument(asset?.id ?? "");
  const [pair, setPair] = useState<any>(null),
    [backtest, setBacktest] = useState<any>(null),
    [command, setCommand] = useState(""),
    [tab, setTab] = useState<Tab>("heatmap"),
    [universeDetail, setUniverseDetail] = useState<Record<string, any>>({});
  useEffect(() => {
    request("/analytics/pair?a=CRY&b=SKULL").then(setPair);
  }, []);
  useEffect(() => {
    setCommand(`${ticker} DES`);
  }, [ticker]);
  useEffect(() => {
    if (!universe.length) return;
    Promise.all(
      universe.map((a) => request<any>(`/assets/${a.ticker}`).then((d) => [a.ticker, d] as const)),
    ).then((entries) => setUniverseDetail(Object.fromEntries(entries)));
  }, [universe.length]);

  const scatterPoints: ScatterPoint[] = useMemo(
    () =>
      universe
        .filter((a) => universeDetail[a.ticker])
        .map((a) => {
          const d = universeDetail[a.ticker];
          return {
            id: a.ticker,
            label: a.ticker,
            x: d.analytics.volatility.d30 * 100,
            y: d.analytics.momentum.d30 * 100,
            positive: d.analytics.momentum.d30 >= 0,
          };
        }),
    [universe, universeDetail],
  );

  const points = Array.isArray(history) ? history : (history.data ?? []),
    events = (Array.isArray(history) ? [] : (history.events ?? [])) as {
      day: number;
      title: string;
      timestamp: string;
      assets: string[];
    }[];

  const chartPoints: PricePoint[] = useMemo(
    () =>
      points.map((p) => ({
        timeSec: Math.floor(Date.parse(p.timestamp) / 1000),
        value: p.indexValue,
      })),
    [points],
  );

  if (!asset)
    return (
      <div className="terminal loading">
        INITIALIZING CULT QUANTITATIVE EXPRESSION SYSTEM…
      </div>
    );
  const latest = semantics.at(-1)?.labels ?? asset.latestSemantics.labels,
    reference = asset.referenceMetrics,
    marketPrice = live?.price ?? asset.marketPrice,
    changePercent = live?.changePercent ?? asset.dailyChange;
  const metric = (value: number | null | undefined, digits = 2) =>
    value == null ? "N/A" : value.toFixed(digits);

  const runCommand = () => {
    const target = command.trim().split(/\s+/)[0]?.toUpperCase();
    if (target) navigate(`/analyst/${target}`);
  };

  return (
    <div className="terminal">
      <header className="term-head">
        <button onClick={() => navigate("/")} className="term-logo">
          CULT//TERMINAL
        </button>
        <div className="command">
          <span>⌕</span>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runCommand()}
            aria-label="Terminal command"
          />
          <kbd onClick={runCommand}>ENTER</kbd>
        </div>
        <div className="system">
          <i /> {reference?.sourceHealth ?? "UNKNOWN"}
          <br />
          <small>{reference?.mode ?? "UNKNOWN"} DATA</small>
        </div>
      </header>
      <div className="term-workspace">
        <main className="term-main">
          <div className="term-title">
            <div className="term-expression">{asset.canonicalExpression}</div>
            <div>
              <p>{asset.ticker} / EXPRESSION REFERENCE</p>
              <h1>{asset.displayName.toUpperCase()}</h1>
            </div>
            <div className="term-header-right">
              <div className="term-price">
                <small>REFERENCE</small>
                <strong>{money(asset.currentIndexValue)}</strong>
                <span>
                  MARKET {money(marketPrice)}{" "}
                  <em>
                    {pct((marketPrice / asset.currentIndexValue - 1) * 100)} BASIS
                  </em>
                </span>
              </div>
              <button className="term-trade-cta" onClick={() => navigate(`/trade/${asset.ticker}`)}>
                Trade {asset.ticker} →
              </button>
            </div>
          </div>
          <div className="term-chart-panel">
            <PriceChart
              points={chartPoints}
              height={340}
              color={changePercent >= 0 ? "#089981" : "#f23645"}
              dark
            />
            <div className="term-kpis">
              <TermKpi label="1D" value={pct(asset.analytics?.momentum?.d1 * 100)} />
              <TermKpi label="7D" value={pct(asset.analytics?.momentum?.d7 * 100)} />
              <TermKpi label="30D" value={pct(asset.analytics?.momentum?.d30 * 100)} />
              <TermKpi label="90D" value={pct(asset.analytics?.momentum?.d90 * 100)} />
              <TermKpi
                label="VOL30"
                value={asset.analytics?.volatility?.d30 != null ? (asset.analytics.volatility.d30 * 100).toFixed(2) : "N/A"}
              />
              <TermKpi label="BETA" value={asset.analytics?.betaHeart?.toFixed(2) ?? "N/A"} />
            </div>
          </div>
          <div className="term-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "term-tab-active" : ""}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="panel term-tab-panel">
            {tab === "heatmap" && (
              <>
                <PanelTitle
                  title="UNIVERSE HEATMAP"
                  meta={`${universe.length} EXPRESSIONS · DAILY CHANGE`}
                />
                <UniverseHeatmap assets={universe} mode="analyst" />
                <p className="fineprint">
                  Tile color intensity is real daily change; tile size is
                  uniform (no market-cap-equivalent exists to size by
                  honestly). Click a tile to open that expression.
                </p>
              </>
            )}
            {tab === "scatter" && (
              <>
                <PanelTitle
                  title="CROSS-SECTIONAL SCATTER"
                  meta={`VOL30 vs 30D MOMENTUM · ${scatterPoints.length}/${universe.length} LOADED`}
                />
                {scatterPoints.length ? (
                  <ScatterPlot
                    points={scatterPoints}
                    xLabel="30D VOLATILITY"
                    yLabel="30D MOMENTUM"
                    onSelect={(id) => navigate(`/analyst/${id}`)}
                    height={320}
                  />
                ) : (
                  <p className="fineprint">Loading universe analytics…</p>
                )}
                <p className="fineprint">
                  Each point is one expression's real 30-day volatility and
                  momentum from its own analytics response. Click a point to
                  open that expression.
                </p>
              </>
            )}
            {tab === "events" && (
              <>
                <PanelTitle
                  title="EXPRESSION EVENTS"
                  meta={`${events.length} EVENT${events.length === 1 ? "" : "S"}`}
                />
                {events.length ? (
                  <div className="event-feed">
                    {events.map((event) => (
                      <div key={event.day}>
                        <span>{new Date(event.timestamp).toISOString().slice(0, 10)}</span>
                        <b>{event.title}</b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="fineprint">No dataset events reference this expression.</p>
                )}
                <p className="fineprint">
                  Synthetic dataset narrative events. Live-shadow deployments will
                  replace these with real amplification/attention-block signal
                  events once the event-tape repository is activated (see
                  docs/KNOWN_LIMITATIONS.md).
                </p>
              </>
            )}
            {tab === "platforms" && (
              <>
                <PanelTitle title="PLATFORM DECOMPOSITION" meta="LATEST WINDOW" />
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
                      <tr key={name}>
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
              </>
            )}
            {tab === "semantics" && (
              <>
                <PanelTitle
                  title="SEMANTIC STATE"
                  meta={`ENTROPY ${semantics.at(-1)?.entropy?.toFixed(3)}`}
                />
                {Object.entries(latest)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .map(([k, v]) => (
                    <div className="term-bar" key={k}>
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
              </>
            )}
            {tab === "data" && (
              <>
                <PanelTitle
                  title="REFERENCE & DATA QUALITY"
                  meta={`${reference?.mode ?? "UNKNOWN"} · ${reference?.status ?? "UNKNOWN"}`}
                />
                <div className="term-kpis">
                  <TermKpi label="USES / 1M" value={metric(reference?.rawPrevalence)} />
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
                  <TermKpi label="BREADTH" value={metric(reference?.signals?.breadth, 3)} />
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
                  <dd>{reference?.seasonalAdjustmentStatus ?? "INSUFFICIENT_HISTORY"}</dd>
                  <dt>METHODOLOGY</dt>
                  <dd>{reference?.methodologyVersion ?? "N/A"}</dd>
                  <dt>REGISTRY</dt>
                  <dd>{reference?.expressionRegistryVersion ?? "N/A"}</dd>
                  <dt>ENGAGEMENT ATTRIBUTION COVERAGE</dt>
                  <dd>
                    {dataStatus?.mappedEngagementRate == null
                      ? "N/A"
                      : `${(dataStatus.mappedEngagementRate * 100).toFixed(2)}%`}
                  </dd>
                </dl>
                <p className="fineprint">
                  A data-quality score is not a probability. Unavailable
                  components remain N/A; live one-source observations are
                  provisional.
                </p>
              </>
            )}
            {tab === "correlations" && (
              <>
                <PanelTitle title="ROLLING CORRELATION MATRIX" meta="90D · PEARSON" />
                <div className="matrix">
                  <span />
                  {corr.slice(0, 10).map((r) => (
                    <b key={`h-${r.ticker}`}>{r.ticker}</b>
                  ))}
                  {corr.slice(0, 10).flatMap((r, i) => [
                    <b key={`row-${r.ticker}`}>{r.ticker}</b>,
                    ...r.values.slice(0, 10).map((v, j) => (
                      <i
                        key={`${i}-${j}`}
                        style={{
                          background: `rgba(${v > 0 ? "8,153,129" : "242,54,69"},${0.1 + Math.abs(v) * 0.45})`,
                        }}
                      >
                        {v.toFixed(2)}
                      </i>
                    )),
                  ])}
                </div>
              </>
            )}
            {tab === "pairs" && pair && (
              <>
                <PanelTitle title="PAIR MONITOR" meta="CRY / SKULL" />
                <div className="pair-value">
                  <span>RATIO</span>
                  <b>{pair.series.at(-1).ratio.toFixed(4)}</b>
                </div>
                <Spark points={pair.series.map((x: any) => x.ratio)} height={105} />
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
            {tab === "backtest" && (
              <>
                <PanelTitle title="BACKTEST LAB" meta="NO LOOK-AHEAD · 10 BPS" />
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
                    <TermKpi label="TOTAL RETURN" value={pct(backtest.totalReturn * 100)} />
                    <TermKpi label="MAX DD" value={pct(backtest.maxDrawdown * 100)} />
                    <TermKpi label="SHARPE-LIKE" value={backtest.sharpe.toFixed(2)} />
                    <TermKpi label="TRADES" value={String(backtest.trades)} />
                  </div>
                )}
              </>
            )}
          </div>
        </main>
        <Watchlist selectedTicker={asset.ticker} mode="analyst" />
      </div>
      <div className="statusbar">
        <span>CULT OBSERVABLE INTERNET PANEL</span>
        <span>{reference?.methodologyVersion ?? "COIP-1"}</span>
        <span>OBJECTIVE LAYER: {reference?.mode ?? "UNKNOWN"}</span>
        <span>SOURCE: {dataStatus?.source?.state ?? reference?.sourceHealth}</span>
        <span>SEMANTIC LAYER: SYNTHETIC</span>
        <span>REGISTRY: {reference?.expressionRegistryVersion ?? "N/A"}</span>
      </div>
    </div>
  );
}
