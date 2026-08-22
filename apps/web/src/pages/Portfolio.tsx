import { useApi, money, pct } from "../lib/api.js";

export function Portfolio() {
  const { data: p } = useApi<any>("/portfolio", null);
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
                <tr key={x.assetId}>
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
            <div className="activity" key={o.id}>
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
