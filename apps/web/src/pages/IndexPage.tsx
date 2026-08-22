import { useParams } from "react-router-dom";
import { useApi, money } from "../lib/api.js";
import { Spark } from "../components/Spark.js";
import { Change } from "../components/Change.js";

export function IndexPage() {
  const { ticker = "EMOJI100" } = useParams();
  const { data: x } = useApi<any>(`/indexes/${ticker}`, null);
  if (!x) return <main className="loading">Reconstituting index…</main>;
  return (
    <main className="page">
      <p className="eyebrow">
        CULTURAL INDEX / {x.methodologyClassification?.replace("_", "-")} /{" "}
        {x.rebalanceFrequency} REBALANCE
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
            <div className="activity" key={c.assetId}>
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
