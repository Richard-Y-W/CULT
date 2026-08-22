import { useApi, money, pct } from "../lib/api.js";

export function Leaderboard() {
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
              <tr key={r.rank}>
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
