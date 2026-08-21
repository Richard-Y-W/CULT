# Market accounting

Every account mutation appends a signed integer-cent ledger entry. Initial grant is +1,000,000 minor units. A buy/cover appends negative `TRADE_DEBIT` and negative `TRADING_FEE`; sell/short appends positive `TRADE_CREDIT` and a negative fee. Account cash must equal the sum of its ledger at all times.

The V0 execution adapter quotes the current simulated midpoint plus bounded size slippage, then fills immediately. `ExecutionEngine` isolates quote, submission, and cancellation so an order book or AMM can replace it. SELL cannot exceed a long; COVER cannot exceed a short; orders that require unavailable cash are rejected before mutation.

Average cost is weighted when exposure increases. Closing quantity realizes `(exit − average entry) × closed quantity × prior position sign`. Crossing through zero starts the residual position at the execution price. PostgreSQL numeric/bigint types preserve account precision.

## Phase 3 simulation boundary

The experimental virtual provider maintains `market = reference × exp(log premium)`. Premium decays by a configurable stable mean-reversion coefficient; signed simulated order-flow imbalance moves it. Optional seeded shocks remain separate from reference measurement. Quotes expose baseline, reference-volatility, inverse-square-root-liquidity, data-risk, and optional inventory components. Square-root impact is a declared simulation assumption, not empirical calibration.

C++ close-derived signals execute on the next bar by default. Costs separately report commission, spread, impact, borrow, and funding. Positions mark to market mid, never reference. `MARGIN_CALL`, `FORCED_DELEVERAGING`, `LIQUIDATION`, `BANKRUPTCY`, and `BAILOUT` remain distinct.
