# Portfolio analytics

Cash and fees use integer CULT cents. Position quantity and price determine signed market value. Unrealized P&L is `quantity × (mark − average entry)`; realized P&L applies that formula only to closed quantity using the pre-close sign. Gross exposure sums absolute market values; net exposure sums signed values.

Total return compares marked equity to contributed simulation capital. Time-weighted return chain-links subperiod returns around external grants. Drawdown is marked equity divided by its prior high minus one. Volatility is the sample deviation of returns, annualized for the observation frequency. The Sharpe-like score is mean return divided by sample volatility times the square root of periods and assumes a zero simulated baseline. Win rate, holding time, and turnover require persisted fills and snapshots.

These are game statistics, not investment performance.
