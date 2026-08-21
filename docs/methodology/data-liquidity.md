# Expression data liquidity

Data liquidity is distinct from simulated exchange liquidity. It uses observed creation inter-arrivals, zero-window probabilities, event rate, effective authors, data quality, Fano factor, and burstiness.

Initial experimental recommendations are:

| Tier                  | Mechanical rule in the reference implementation |
| --------------------- | ----------------------------------------------- |
| Tier 1 — HFT eligible | median inter-arrival <=1s and `P(N_1s=0)<=0.5`  |
| Tier 2 — Fast         | median <=15s                                    |
| Tier 3 — Intraday     | median <=300s                                   |
| Tier 4 — Slow         | otherwise                                       |
| Insufficient          | fewer than two arrivals                         |

These thresholds are uncalibrated and must be replaced/versioned after a durable live sufficiency study. Tier 1 means an event-driven simulator has enough representative input—not that the underlying internet changes at exchange nanosecond speed.

`Fano = Var(count)/E[count]`. Inter-arrival burstiness is `(σ-μ)/(σ+μ)`. Neither identifies a Hawkes process by itself.
