# Unit consistency (Phase 5.5 audit)

Compiled while tracing every quantitative field across the worker, API,
C++ core, and frontend for the pre-live readiness audit
(`docs/audits/pre-live-readiness.md`). No unit bugs (percent-as-decimal,
seconds-as-ms, price-points-as-ticks) were found in the areas audited; the
table below is the reference so a future change can be checked against it.

| Field | Unit | Producer | Notes |
| --- | --- | --- | --- |
| `referenceIndex` / reference value | index points, base 1000 | `packages/index-engine` reference engine | Chain-linked log-return index; base is a design choice, not a bug (see prior session's BUILD_LOG entry) |
| `price`, `bid`, `ask` (WS market tick) | CULT quote units (same numeric scale as the reference index for that asset) | `apps/api/src/realtime.ts` `MarketTickEngine` | Verified live this pass: CRY tick `8396.96`, correctly in the reference-index scale, not an isolated ~1000-tick scenario scale |
| `changePercent` (WS market tick) | **percent** (already ×100) | `MarketTickEngine.tick()` | e.g. `1.11` means +1.11%, not +111% |
| `basisPercent` (C++ `ScenarioReport`, TS `Phase4Demo.state`) | **decimal fraction** (0.02 = 2%) | `cpp/src/exchange/simulator.cpp`, `packages/hft-engine/src/index.ts` | **Naming risk**: despite "Percent" in the name, this is a fraction, not a percent. Internally consistent at every call site checked; flagged so a future consumer doesn't apply an extra ×100 |
| `prevalence` (raw/smoothed) | probability (0-1) and documents-per-million | `packages/expression-engine` `jeffreysPrevalence` | `rawPerMillion`/`smoothedPerMillion` fields are explicitly UPM-scaled; the underlying probability is 0-1 |
| UPM | documents per million eligible documents | `expression-engine` | Matches its name; no scaling bug found |
| `latency` (LatencyModel, causality chain) | nanoseconds (`tape::TimestampNs`) throughout the C++ simulator | `cpp/include/cult/exchange/simulator.hpp` | Never mixed with wall-clock ms; verified no `Date.now()`/wall-clock call anywhere in `cpp/src/exchange/simulator.cpp` |
| `eventAtMs`, `receivedAtMs`, `streamLagMs` | milliseconds (wall clock, UTC) | `apps/worker/src/parser.ts`, `types.ts` | Jetstream's `time_us` (microseconds) is truncated to ms at parse time -- see below |
| `eventTimeNs` (behavior tape) | nanoseconds, **fake precision** | `apps/worker/src/behavior-tape.ts` | Computed as `BigInt(eventAtMs) * 1_000_000n` -- always an exact multiple of 1e6; true sub-ms Jetstream timing (`time_us`) is discarded at the parser boundary, not fabricated finer than it is. Documented in the main audit, §7-9 |
| `quantity` (order book) | lots (integer, `config_.lot_size` multiples) | `cpp/include/cult/exchange/order_book.hpp` | Verified: rejects non-lot-multiple quantities |
| `priceTicks` | integer ticks (`config_.tick_size` multiples) | `cpp/include/cult/exchange/order_book.hpp` | Verified: rejects non-tick-multiple limit prices |
| `spreadTicks`, `relativeSpreadBps` | ticks, and **basis points** respectively | `cpp/src/exchange/simulator.cpp` `microstructure()` | `relative_spread_bps` is explicitly `10000.0 * spread / midpoint` -- correct bps scaling, not confused with the plain `basisPercent` fraction above |
| `beta` | dimensionless | `packages/analytics`, C++ `cult_analytics` | No scaling found |
| `z-score` (signal tape) | standard deviations, dimensionless | `packages/hft-engine`, C++ behavior engine | No scaling bug found |
| `OFI` (order flow imbalance) | signed quantity (lots), not normalized | `cpp/src/exchange/simulator.cpp` `order_flow_imbalance()` | Distinct from `imbalance_l1`/`imbalance_l5` (normalized to [-1, 1]) -- both exist, verified not conflated in any call site checked |
| `id` / `cascadeId` / `recordId` on the behavior tape vs. `ExpressionTapeEvent` types | **type mismatch, not a unit bug but adjacent**: tape writer emits HMAC/SHA-256 hex strings; `packages/hft-engine` types declare `number` | `apps/worker/src/behavior-tape.ts` vs. `packages/hft-engine/src/index.ts` | No bridge between the real tape and these numeric-typed structures exists yet (confirmed: nothing currently reads the live behavior tape). Flag before building that bridge -- documented in the main audit, §7-9 |

## Known-consistent, re-verified this pass

- Every screen (Casual, Analyst, Quant's `LiveSection`) reads price from the
  same `useInstrument()` selector backed by one `MarketTickEngine` instance
  -- confirmed via a direct WS client connection during this audit, not just
  static code reading.
- The Quant "Great Cry Shock" fixed-scenario replay correctly threads CRY's
  real reference price into its book (`apps/api/src/server.ts`); other
  assets are not yet wired the same way but `Quant.tsx` does not currently
  expose scenario replay for any ticker other than CRY, so this is not a
  live inconsistency today (see main audit, §4).

## Not verified this pass

A full independent recomputation of every listed metric against a hand-
calculated reference value (VaR, Expected Shortfall, Sharpe-like,
information ratio, drawdown duration, etc.) was not performed -- the
existing `npm run test:differential` (25 metrics, C++ vs. TS, tight
tolerances) and the C++/TS unit test suites are the evidence base for
correctness; this document only tracks *unit/scale* consistency, not
formula correctness, which is covered by those test suites.
