const api = "http://localhost:4100/api/v1";
async function call(path: string, init?: RequestInit) {
  const response = await fetch(`${api}${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: ${JSON.stringify(body)}`);
  return body.data ?? body;
}
const health = (await fetch("http://localhost:4100/health").then((r) =>
  r.json(),
)) as { status: string };
if (health.status !== "ok") throw new Error("Health check failed");
await call("/orders", {
  method: "POST",
  body: JSON.stringify({
    assetId: "expr_crying_face",
    side: "BUY",
    quantity: 0.5,
  }),
});
await call("/orders", {
  method: "POST",
  body: JSON.stringify({ assetId: "expr_joy", side: "SHORT", quantity: 0.5 }),
});
const portfolio = (await call("/portfolio")) as {
  positions: unknown[];
  orders: unknown[];
};
if (portfolio.positions.length !== 2 || portfolio.orders.length < 2)
  throw new Error("Trade state did not reach portfolio");
const backtest = (await call("/backtests", { method: "POST", body: "{}" })) as {
  totalReturn: number;
  maxDrawdown: number;
  trades: number;
};
if (!Number.isFinite(backtest.totalReturn) || backtest.maxDrawdown < -1)
  throw new Error("Backtest violated bounded long-only equity");
const web = await fetch("http://localhost:5173").then((r) => r.text());
if (!web.includes('id="root"')) throw new Error("Web entry did not render");
console.log(
  JSON.stringify({
    health: health.status,
    positions: portfolio.positions.length,
    orders: portfolio.orders.length,
    backtest: {
      totalReturn: backtest.totalReturn,
      maxDrawdown: backtest.maxDrawdown,
      trades: backtest.trades,
    },
    web: "ok",
  }),
);
