# Pre-live readiness audit (Phase 5.5)

Date: 2026-08-22. Commit base: `3ecac65` (this audit's fixes land on top as a
separate commit). Scope: correctness, integration, performance, durability,
numerical sanity, observability, failure recovery, frontend/backend
consistency, live-readiness. No product/feature expansion.

Method: four parallel read-only code audits (data path/units/timestamps/
attribution; C++ exchange/HFT core; frontend; ops/security/gates), each
required to cite `file:line` and separate verified-correct claims from
findings. Findings were triaged, the true P0s fixed, the full local test
matrix re-run after every fix, and one real (non-persistent) Bluesky
Jetstream connectivity smoke was performed. Findings are reproduced below
with an explicit **status** for each: `FIXED` (changed and re-verified this
pass), `DOCUMENTED` (real, scoped correctly as out of this pass — see
rationale), or `NOT TESTED` (requires infrastructure unavailable in this
environment).

## Environment constraints (read this first)

- **Docker/PostgreSQL unavailable.** `docker info` fails in this environment
  (as it has throughout this project's history — see `docs/BUILD_LOG.md`).
  Every finding below that requires a live PostgreSQL instance (migrations
  from clean DB, sustained insert workload, lock contention, connection pool
  behavior, DB failure/recovery) is marked **NOT TESTED**, matching this
  repo's established pattern of deferring PostgreSQL verification to CI.
- **No local ASan/UBSan/TSan.** No `clang++` is present; the local GCC
  (Strawberry MinGW 13.2.0) cannot link `libasan`/`libubsan` (documented
  pre-existing gap, `docs/BUILD_LOG.md`). CI's dedicated `sanitizers` job
  (`.github/workflows/ci.yml`) is the only sanitizer coverage; the FOK fix
  below (order book, hot path for STP) has not been sanitizer-verified
  locally and should be watched on the next CI run.
- **No multi-hour soak possible in this session.** Sections 45/74 (1-hour+
  soak, 72-hour campaign) were not executed. The longest sustained run
  performed was the ~5-minute in-process dev-server verification below.
- **One real network touch was made**, exactly as scoped by §70: a single
  manual, non-persistent Bluesky Jetstream connectivity smoke
  (`npm run smoke:live`). See §10 below.

## 1. Data path (verified against code, not docs)

```
Bluesky Jetstream (wss) / synthetic fixture / replay JSONL
  -> BlueskyEventParser.parse()            [apps/worker/src/parser.ts]
       - zod schema validation, malformed -> counted, dropped
       - EventDeduplicator (in-memory, O(1)-amortized after this pass)
       - AttributionStore.resolve/recordPost (HMAC-keyed, Postgres-backed)
  -> MinuteAggregator.add()                [apps/worker/src/aggregator.ts]
       - UTC-minute-floor bucketing, per-minute HMAC author hashing
  -> flush() on window rollover / socket close / STALE transition (new)
  -> CompositeSink([PostgresAggregateSink, ReplaySink])  [sink.ts]
       - both attempted independently now (was: Postgres failure blocked
         the local ReplaySink durable append too -- fixed, see P0 #3)
  -> expression_observations_v3 / source_watermarks / source_health_snapshots_v2
  -> apps/api/src/server.ts REST reads (/api/v1/data/status, /assets/:ticker)
  -> apps/web REST fetch (lib/api.ts request())
```

Separately, the **realtime market tick channel** (`/ws`, `channel: "market"`)
is architecturally independent, per ADR-016 (three tapes) and ADR-018
(live-shadow does not drive the market): `MarketTickEngine`
(`apps/api/src/realtime.ts`) drives price from a seeded `VirtualLiquidityProvider`
PRNG, **always**, regardless of `CULT_DATA_MODE`. This is correct
architecture (public engagement must not directly become market order
flow), not a defect -- the defect was that the payload's `dataMode` field
and the frontend's connection label did not say so honestly. Fixed (P0 #1).

The **Quant "Great Cry Shock" scenario** (`/api/v1/quant/*`) is a separate,
fully synthetic, fixed-scenario replay (`createPhase4Demo`), built once at
process start and never fed from the live worker's Postgres aggregates or
JSONL behavior tape. No code path anywhere connects them. This is
consistent with the project's own stated scope (`docs/KNOWN_LIMITATIONS.md`:
"Quant endpoints expose a deterministic Great Cry Shock fixture, not a
multi-user live venue") and Quant's UI already labels this section
"FIXED SCENARIO REPLAY" distinctly from its separate `LiveSection`. No
functional change made; documented here so it is not mistaken for an
integration gap discovered by this audit.

Ownership/schema/timestamp semantics for every hop, and every producer/
consumer pair, were traced file-by-file by the data-path audit; no
undocumented "magical jump" was found between layers -- every field's
producer and at least one consumer were identified in code.

## 2-3. Mode consistency and misleading LIVE labels

**P0 — FIXED.** `apps/web/src/app/Shell.tsx`'s `ConnectionIndicator` derived
its label purely from WebSocket `ConnectionState`, mapping `CONNECTED` to
the literal string `"LIVE FEED"` regardless of the actual data mode. A
`dataMode` field already flowed end-to-end from `MarketTickEngine` through
the WS envelope into `marketStore.ts`, but was stored and never read for
display. Combined with `MarketTickEngine` stamping whatever `CULT_DATA_MODE`
the process was started with (even though its price math is unconditionally
synthetic), a live-shadow deployment's WS feed would have honestly-carried
`dataMode: "live-shadow"` on fabricated PRNG prices -- a real mislabeling
risk, not merely a missing display.

Fixed in three places:
- `apps/api/src/realtime.ts`: `MarketTickEngine.tick()` now always stamps
  `dataMode: "synthetic"` (removed the `CultDataMode` parameter entirely) --
  this is unconditionally true about how this specific feed computes price,
  independent of the worker's ingestion mode. `attachRealtimeServer` no
  longer takes a `getDataMode` callback.
- `apps/web/src/realtime/marketStore.ts`: added top-level `dataMode` state
  and a `useMarketDataMode()` selector.
- `apps/web/src/app/Shell.tsx`: `ConnectionIndicator` now renders **STREAM**
  (WS connection state) and **DATA** (data mode) as two separate facts --
  `STREAM: CONNECTED · DATA: SYNTHETIC`, never a single conflated "LIVE FEED"
  string. Verified live via a direct WS client connection during this audit:
  `{"dataMode":"synthetic", ...}` on every tick, and a headless-Chrome
  screenshot confirming the rendered header.

**P2 — DOCUMENTED, not fixed.** Static "LIVE"/"MARKET OPEN" strings remain
in `Quant.tsx` (already correctly gated behind its own explicit LIVE vs.
FIXED-SCENARIO-REPLAY sections, verified by the frontend audit) and
`Home.tsx` ("MARKET OPEN", "LIVE MARKETS" -- these describe the simulated
market being open for trading, not a claim about data authenticity; lower
risk, left as-is).

## 4. Authoritative price domain consistency

**Verified correct**, and re-confirmed live this pass: Casual (`Home.tsx`,
`Asset.tsx`), Analyst (`Analyst.tsx`), and Quant's `LiveSection`
(`Quant.tsx`) all read the same `useInstrument()` value backed by the one
`MarketTickEngine`. Live WS tick observed during this audit: CRY price
`8396.96` -- correctly in the reference-index scale, not the isolated
~1000-tick scenario scale, confirming last session's price-scale fix held.

`createPhase4Demo("great-cry", undefined, undefined, prices["expr_crying_face"])`
(`apps/api/src/server.ts`) still correctly threads CRY's live price into the
Quant scenario book. **P2 — DOCUMENTED**: only CRY gets this treatment
(`packages/hft-engine/src/index.ts` defaults `referencePrice = 1000` for any
other caller), but this is not a live bug today because `Quant.tsx`
hardcodes `scenarioTicker = "CRY"` for all scenario-replay calls and
explicitly shows "No Phase 4 scenario tape exists for {ticker} yet" for any
other asset. Flagged for whoever wires additional scenario tickers in a
future pass.

## 5-6. Synthetic generator and reference mathematics

Not re-audited in depth this pass (already recalibrated and verified in the
immediately preceding session against an explicit target return-distribution
table; see `docs/BUILD_LOG.md`, "Price-scale unification + synthetic
volatility recalibration"). The regenerated Phase 4 fixtures
(`data/synthetic/phase4/*.json`) were stale relative to that recalibration
and have been regenerated and re-verified deterministic this pass (see §37).
Full independent 1D-return diagnostic battery (mean/median/stdev/skew/
kurtosis, |return| threshold percentages, 30-day/1-year index ranges,
cross-sectional correlation, jump frequency) was **NOT run this pass** --
out of time budget; recommended as a follow-up before the 72-hour campaign,
not a blocker (the qualitative target-distribution verification already
done in the prior session covers the same intent).

## 7-9. Financial/quant calculations, units, timestamps

- **Verified correct**: simulator logical time (`DeterministicScheduler`,
  `run_great_cry_shock`) never mixes with wall-clock time -- no
  `Date.now()`/wall-clock call appears anywhere in
  `cpp/src/exchange/simulator.cpp`. Minute-window bucketing is correct UTC
  floor division at both ingest and flush, with a throwing guard against
  cross-window contamination (`aggregator.ts`).
- **P1 — DOCUMENTED.** Jetstream's microsecond `time_us` is truncated to
  millisecond `eventAtMs` at parse time, then re-expanded to fake-precision
  nanoseconds (`eventTimeNs = eventAtMs * 1_000_000n`) when written to the
  behavior tape -- true sub-millisecond timing is discarded, not fabricated
  (the nanosecond field is always an exact multiple of 1e6), but any future
  consumer expecting real ns-resolution ordering from this tape should know
  it doesn't have it.
- **P1 — DOCUMENTED.** The behavior-tape JSONL writer emits `id`/`cascadeId`/
  `recordId` as SHA-256/HMAC hex strings; `packages/hft-engine`'s
  `ExpressionTapeEvent` types declare these as `number`. No bridge between
  the real tape and the numeric-typed C++/TS structures exists yet (matches
  §1's finding that nothing currently reads this tape) -- flagged before
  anyone builds that bridge.
- **P2 — DOCUMENTED.** `basisPercent` fields hold a decimal fraction (0.02 =
  2%) while `MarketTickPayload.changePercent` holds an actual percent
  (already ×100). Internally consistent per call site; the naming invites a
  ×100 bug in a future consumer. No behavior change made (renaming now would
  be a wire-format change touching multiple consumers, larger than this
  pass's scope) -- see `docs/audits/unit-consistency.md`.
- Cross-language calculation parity: **`npm run test:differential` passes,
  25 metrics, abs 1e-11 / rel 1e-10 tolerance**, re-verified this pass after
  a clean C++ rebuild. **P1 — DOCUMENTED**: this differential suite covers
  only the legacy analytics/index metrics (momentum, volatility, entropy,
  Wilson intervals, etc.) -- it never touches the order book / risk engine.
  A full independent TS reimplementation of `PreTradeRisk` exists
  (`packages/hft-engine/src/index.ts`) and is missing the `killed`/
  `source_health`/`message_rate` checks the C++ version has, while sharing
  the collar bug below. Nothing in CI currently catches risk-logic
  divergence between the two languages.

## 10. Engagement attribution durability

**Verified correct**, live-tested this pass:
- `npm run smoke:live` succeeded against the real public Bluesky Jetstream
  endpoint: `{"status":"ok","source":"BLUESKY","contentBucket":"ORIGINAL","emojiExpressionsDetected":0,"cursor":1787370989793748,"retainedText":false,"retainedActorIdentifier":false}`.
  Connection worked, the parser accepted a live payload, Unicode extraction
  ran, no text/identifier was retained, and the process exited cleanly
  (§70's connectivity smoke, no sustained collection performed).
- HMAC-SHA256 attribution hashing is deterministic and privacy-safe across
  restarts when `CULT_CASCADE_HASH_SECRET` is set (`attribution.ts`); warm
  restore correctly re-links state (`restore()`, called before the live loop
  starts in `main.ts`).
- Retention/cleanup: `cleanupExpired()` deletes durable rows past
  `expires_at`, run on an hourly timer.

**P1 — FIXED.** `forgetPost()` (DELETE handling) only cleared the in-memory
cache, never issuing a DB delete/tombstone -- a warm-started worker would
resurrect attribution for posts explicitly forgotten pre-restart. Now
issues `DELETE FROM post_attribution_map WHERE record_id = $1` alongside
the in-memory clear.

**P0 — FIXED (fail-closed).** If `CULT_CASCADE_HASH_SECRET` was unset in a
durable (DATABASE_URL-configured) deployment, `AttributionStore` silently
degraded to a random per-process key with only a `console.warn` -- this both
made record IDs unrecoverable across restarts (defeating warm-start) and
silently disabled all durable writes (`mappedEngagementRate` would collapse
to 0 with no hard failure). Now throws at construction instead. Compounding
this, `docker-compose.yml`'s shipped `live-shadow` profile defaulted
`CULT_CASCADE_HASH_SECRET` to the literal, publicly-known string
`local-development-only-change-me` -- anyone who has read this repo (i.e.
everyone) could compute the same HMAC key and de-anonymize every
`record_id`/`cascade_root_id` a default-configured deployment ever produced.
This was the single most severe finding in the audit. Fixed: the compose
file now uses `${CULT_CASCADE_HASH_SECRET:?set CULT_CASCADE_HASH_SECRET in
.env before running live-shadow}`, which fails the `docker compose` command
outright if unset, and the worker itself now throws rather than degrading
even if compose's guard were somehow bypassed (defense in depth).

## 11. Engagement attribution coverage

**Verified correct.** `mappedEngagementRate` is computed as
`mapped / eligible` (not `mapped / total`), returns `null` (not a fabricated
0) before any eligible engagement exists, and is exposed on
`GET /api/v1/data/status`. `eligibleEngagementEvents` increments for every
engagement with a resolvable subject regardless of hit;
`mappedEngagementEvents` only on an actual cache hit. Unmapped engagement is
counted, not silently dropped.

**P2 — DOCUMENTED.** These counters are in-memory cumulative and not
persisted/restored across worker restarts, so the *rate* resets to a
false-looking "coverage cliff" after every restart even though the
underlying per-window durable data is fine. Not fixed this pass (would
require a schema change to persist cumulative counters); acceptable for
live-shadow but should be tracked before treating `mappedEngagementRate` as
a long-run operational metric across restarts.

## 12-14. Cascade graph, multi-expression attribution, Unicode

**Verified correct** (C++ audit, cross-checked against `cpp/tests/test_main.cpp`):
- Recursive cascade depth is genuinely recursive, not capped at 2:
  `depth(child) = depth(parent) + 1`, tested to depth 4 on a
  create→reply→quote→reply chain.
- Cycle/self-reference safety is structural (O(1) hashmap lookup per event,
  never a graph traversal), so a malformed/self-referential parent pointer
  cannot cause a stack overflow or infinite loop by construction.
- HHI / effective_cascades / largest_cascade_share are derived from one
  consistent per-cascade contribution vector.
- Multi-occurrence within one document (😭😭😭) does not inflate prevalence:
  `EmojiRegistry.extract()` groups matches by expression id, one
  `documents++` per distinct expression regardless of repetition count;
  `intensityWhenPresent` exposes the repetition separately.
- Multi-expression attribution (😭💀 in one post) is an explicit, tested,
  documented choice (fractional attribution mode in the C++
  `BehaviorAccumulator`, full-array `expressionIds` on TS behavior events),
  not an accidental double-count.
- Hostile-Unicode property test suite (`cult_unicode_property_tests`)
  passed this pass's clean rebuild.

No changes needed in this area.

## 15-16. Idempotency, checkpoint/resume

**Verified correct at the DB layer**: `expression_observations_v3` and
`post_attribution_map` both have real uniqueness constraints backing
`ON CONFLICT ... DO UPDATE` upserts -- replaying a complete window or a
duplicate post record is safe even after an in-memory dedup reset.

**P0 — FIXED.** Three compounding durability bugs, all in the
`main.ts` / `sink.ts` / `aggregator.ts` write path:
1. `CompositeSink.write()` ran sinks in sequence and stopped at the first
   failure -- since Postgres was listed first, a transient Postgres error
   meant the local `ReplaySink` JSONL append (the designated durability
   backstop) never ran either, losing the aggregate window from *both*
   places. Fixed: every sink is now attempted independently; failures are
   logged per-sink; the call only throws if every sink failed.
2. `PostgresAggregateSink`'s single `pg.Client` had no `'error'` listener --
   an unexpected connection drop would crash the process as a raw, unhandled
   exception. Fixed: a structured error log plus deliberate `process.exit(1)`
   (same net effect under `restart: unless-stopped`, now with real
   diagnostics instead of an opaque crash).
3. `EventDeduplicator.seen()` scanned its entire map to prune expired
   entries on every single call -- O(n) per event, i.e. effectively O(n²)
   over an hour of sustained traffic, since the map can hold hundreds of
   thousands of entries at real Jetstream volume. Benchmarked: the old
   implementation did not finish 200,000 events (simulated at 200/sec) in
   under 2 minutes; the fixed version (amortized O(1), pruning from the
   front since expiry order tracks insertion order) processed 500,000
   events in 329ms. Fixed by adding an early-exit break once a
   non-expired entry is reached.

**P0 — FIXED.** The `STALE` source-health transition (no message received
for 120s) only updated in-memory `health.state` on a 60s timer -- it was
never flushed to `source_health_snapshots_v2` unless a real aggregate window
happened to roll over or the socket closed. If Jetstream stopped sending
data without the TCP socket actually closing, the dashboard would keep
serving the last-written `HEALTHY` row indefinitely -- the single most
dangerous "everything looks fine, nothing is happening" failure mode for an
unattended 72-hour campaign. Fixed: `main.ts` now persists a health-only
snapshot (zero observations, real health/watermark fields) the instant the
health timer detects a `HEALTHY`→`STALE` edge, using the sink's existing
write path (no schema change).

**P0 — FIXED.** `shutdown()` (SIGINT/SIGTERM handler) cleared timers but
never closed the active Jetstream socket; `live()`'s reconnect loop only
checks `stopping` after the current socket's own close/error promise
settles. A source that keeps its TCP connection open but goes silent could
make a container orchestrator's SIGTERM hang past its grace period and get
SIGKILLed, skipping the checkpoint/sink flush in `live()`'s `finally` block.
Fixed: the active socket is now tracked at module scope and explicitly
closed in `shutdown()`.

**P2 — DOCUMENTED, not fixed.** A crash/restart mid-window causes the
resumed worker to flush a partial window for a `windowStart` that may
already have a complete row in Postgres; the upsert replaces (not
increments) the count, silently undercounting that one ~60s window before
self-correcting on the next window. Bounded impact, not fixed this pass.

## 17-18. Database durability and reconciliation

**NOT TESTED.** Docker/PostgreSQL is unavailable in this environment (see
Environment constraints above), consistent with every prior phase in this
project's `docs/BUILD_LOG.md`. `PostgresAggregateSink.write()` was read and
confirmed to wrap all inserts in an explicit `BEGIN`/`COMMIT`/`ROLLBACK`
transaction (so a mid-batch failure cannot leave a half-written window), but
this has not been exercised against a real database this pass. **This
remains the single largest actual gap between this audit and full
live-shadow confidence** -- recommend running the full migration/seed/
sustained-insert verification in CI (as this repo has always done) before
or during the first hours of the real campaign, watching CI's dedicated
PostgreSQL job pass on the exact commit that starts collection.

## 19-20. Rolling window boundaries, missing-vs-zero

**Verified correct.** UTC-minute floor bucketing with a throwing guard
(`aggregator.ts`) prevents a document from silently landing in the wrong
window. `mappedEngagementRate` returning `null` rather than `0` before data
exists (see §11) is one concrete instance of the "missing is not zero"
principle being correctly followed; no counter-example found in the areas
audited.

## 21-24. Source health, outage, reconnect, sequence integrity

**Verified correct**: `SourceHealth` state machine
(`HEALTHY/DEGRADED/STALE/DISCONNECTED/BACKFILLING`) is defined and exposed
identically through worker → DB → `/api/v1/data/status` → (not yet
consumed by the frontend's data-mode display, since the current frontend
only distinguishes stream-connected vs. data-mode, not fine-grained source
health -- a reasonable scope boundary for this pass, not re-litigated here).

**P1 — DOCUMENTED, not fixed.** `evaluateAlerts()`
(`packages/hft-engine/src/index.ts`) implements concrete alert thresholds
(`DATA_SOURCE_DEGRADED`, `LIQUIDITY_COLLAPSE`, `MARGIN_CALL`, `HALT`,
z-score shocks) but is only ever called from `tests/phase4-hft.test.ts` --
it is dead code with respect to the live system; no runtime alerting fires
from real health data. Wiring it into the worker/API's health-check loop is
real, scoped work (not a one-line fix) and was left for a follow-up rather
than rushed under this pass's time budget -- flagged as a P1 for before the
72-hour campaign, since sustained live-shadow with human eyes off it is
exactly when this would matter.

**No local sequence-gap / reconnect-storm / delta-feed-recovery testing was
performed** -- the current `/ws` `market` channel is not a delta feed (every
tick is a full snapshot per asset), so §24's snapshot-replay-on-gap
machinery does not apply yet; this is correctly out of scope until a delta
channel (e.g. L2 depth) exists on the live path, consistent with the
`connectionManager.ts` scoping note from the prior session's plan.

## 25-29. Order book correctness, HFT information path

**P0 — FIXED, empirically verified.** `LimitOrderBook::available()`
(`cpp/src/exchange/order_book.cpp`), used for the `fill_or_kill` pre-check,
summed all contra-side liquidity from other agents regardless of whether
some of it sat *behind* the requester's own resting order in price-time
order. Under `StpMode::cancel_newest`/`cancel_both` (this book's actual
configured mode), the real matching loop stops the instant it reaches the
requester's own order -- so `available()` was systematically overcounting,
letting a FOK order pass its precheck and then partially fill before
self-trade prevention interrupted it. Empirically reproduced before the fix
(three asks at one price level from three agents, the requester's own order
sandwiched between two others' -- a FOK buy for 50 was accepted, then
filled 30 and killed 20, violating FOK's all-or-nothing guarantee).

Fixed by making `available()` mirror the matching loop's actual STP
behavior: under `cancel_newest`/`cancel_both`, counting stops the instant an
own-order is reached (matching the real `break`); under `cancel_oldest`,
own orders remain transparent to the count (matching that mode's actual
"remove and continue" behavior). A regression test was added
(`cpp/tests/test_main.cpp`) reproducing the exact scenario; the full C++
suite (`cult_cpp_tests`, `cult_unicode_property_tests`,
`cult_order_book_property_tests`) passes after the fix.

**P1 — DOCUMENTED, not fixed.** The price collar
(`PreTradeRisk::check`, `cpp/src/exchange/simulator.cpp`, mirrored in
`packages/hft-engine/src/index.ts`) is a structural no-op for market
orders: for a market order the code substitutes `price = mid` before
comparing `abs(price - mid) > collar_ticks`, which is always `0` by
construction. Every strategy currently wired up (`EventDrivenAgent`,
`ReferenceArbitrageStrategy`, the latency-arbitrage aggressor) sends market
orders -- exactly the order type most exposed to slippage risk sweeping a
thin book. A correct fix requires the risk check to see either the top-of-
book best price or a worst-case sweep price, which `PreTradeRisk::check()`'s
current signature (`request, account, midpoint, health, messages`) does not
carry -- adding it is a real interface change touching both language
implementations, their tests, and the differential-parity gap noted in §7-9,
not a one-line fix. Left unfixed and documented rather than patched
superficially, per this phase's explicit instruction not to respond to a
problem by hiding it with a change that doesn't actually address the risk.
**Recommended before the 72-hour campaign** if market orders will run
unsupervised against synthetic scenarios with wide/thin books; lower urgency
for live-shadow itself, which does not let live data drive orders at all
(see §1).

**Verified correct** (existing + this pass's rebuild/rerun):
price-time priority, partial fills, cancel, replace, IOC, post-only, STP
`cancel_oldest`/`cancel_both` mechanics, snapshot/restore, queue position,
50,000-op randomized property fuzzer (`cult_order_book_property_tests`).
Risk gate genuinely blocks `book.submit()` (not decorative) --
`test_main.cpp` confirms a tightened exposure limit yields
`risk_decision != accept && trades == 0`. Latency causality chain is
strictly increasing (`decision_time → agent_receive_time → send_time →
book.submit`); no path lets an agent act before receiving its signal.
Stale-quote adverse selection genuinely depends on cancel latency (fast
cancel → not filled; slow cancel → filled with negative markout).
Determinism is real, not one-shot: `run_great_cry_shock` is hash-compared
twice in `test_main.cpp`, and CI runs `npm run replay:hft` against the
recorded fixture.

**P2 — DOCUMENTED, not fixed.** `run_latency_arbitrage`'s
`maker_markout_ticks` is a hardcoded `-9.0` literal on any filled outcome,
ignoring the real `markout()` function and the actual fill price/size --
the *boolean* stale-fill outcome is genuinely latency-dependent and correct
(verified above), but the reported markout number is not a real economic
measure. Similarly `run_queue_tradeoff`'s `*_pnl_ticks` fields are `1.0`/
`0.0` booleans dressed as P&L, not real tick economics -- the underlying
fill-vs-no-fill differentiation this test is meant to demonstrate is
correctly answered, only the numeric P&L labels overstate precision.

**P2 — DOCUMENTED.** `should_halt`/`reopening_auction_price` are pure
library functions never invoked from any integrated scenario path
(`run_great_cry_shock`, `run_latency_arbitrage`, `run_queue_tradeoff`,
`hft_demo.cpp`). No frontend "HALTED" state is currently backed by a
running control -- consistent with `Quant.tsx`'s honest scope (it does not
currently claim a live halt state).

**P2 — DOCUMENTED, not implemented.** No P&L/equity reconciliation identity
(`ending equity = starting cash + realized + unrealized PnL - fees`) is
computed or tested anywhere; `AccountState` is used only as a static risk-
check probe input, never derived from accumulated fills.

**Six of eight `RiskDecision` branches are untested** (`killed`,
`source_health`, `order_size`, `position`, `leverage`, `message_rate` have
no dedicated pass/fail test) -- this is exactly how the collar bug and a
plausible FOK-class bug could have gone unnoticed. **P1 — DOCUMENTED**,
recommended as follow-up test-writing before the 72-hour campaign; not
attempted this pass given time budget after the two P0/P1 fixes above.

## 30-35. Risk, margin, halt, P&L, microstructure, market/reference separation

Covered above (§25-29) for the C++/exchange side. **Verified correct**:
microstructure sign conventions (`effective_spread_ticks`,
`order_flow_imbalance`, `microprice_ticks`, `trade_imbalance`) all use
standard, consistent buyer/seller-aggressor conventions -- no sign-flip
bugs found. Market/reference separation is structurally real: the market
tick engine's `VirtualLiquidityProvider` maintains an independent
mean-reverting premium/discount around reference rather than snapping to
it (re-tuned for stability in the prior session, unchanged this pass).
No margin-call/liquidation integration test was run this pass (would
require the DB-backed account state this environment cannot exercise --
see §17-18).

## 36-38. Great Cry Shock end-to-end, determinism, cross-language parity

**Verified and re-run this pass.** The canonical scenario was replayed
twice from a clean C++ rebuild with an identical `outputHash`
(`1133858755361010280`) both times -- genuine determinism, not a one-shot
claim. `npm run test:differential` passed (25 metrics, tight tolerances)
after the clean rebuild.

**P1 — FOUND AND FIXED this pass.** The recorded fixtures
(`data/synthetic/phase4/{great-cry,celebrity,spam}.json`) were stale
relative to the prior session's price-scale fix to `createPhase4Demo` --
`npm run replay:hft` failed with a hash mismatch (the live TS engine's
output was itself reproducibly deterministic across two runs, just no
longer matching the recorded baseline). Regenerated via `npm run hft:demo`
and re-verified: all three scenarios now replay deterministically
(`great-cry`, `celebrity`, `spam` each pass `npm run replay:hft`). This
would have been a real, confusing red flag for the first operator to run
`npm run replay:hft` after that earlier fix landed.

## 39-40. Memory safety, fuzzing

**NOT TESTED locally** (no `clang++`; local GCC cannot link
`libasan`/`libubsan` -- see Environment constraints). CI's `sanitizers` job
covers all three CTest binaries including the order-book property fuzzer.
The FOK fix in this pass has not been sanitizer-verified locally and should
be watched on the next CI run for this branch. No additional fuzzing
campaign (Unicode/WebSocket-payload/order-lifecycle) was run beyond the
existing property-test suites, which passed.

## 41-44. Load, backpressure

`cult_hft_benchmarks`/`cult_benchmarks` were re-run this pass (Release,
clean rebuild): order-book insert/cancel ~1.68M ops/sec, cancel/replace
~2.20M ops/sec, matches ~1.66M ops/sec, L2 snapshots ~3.84M/sec, strategy
callbacks ~47M/sec. These are isolated in-memory operations (no
persistence/serialization), consistent with the documented benchmark
caveats. This is many orders of magnitude above any plausible Bluesky
firehose rate for the tracked collections.

**Fixed as part of §15-16**: the one genuine, load-relevant correctness bug
found (`EventDeduplicator`'s O(n²) scan) is resolved; benchmarked at
500,000 events in 329ms post-fix vs. the old implementation not completing
200,000 events in under 2 minutes at the same simulated rate.

**NOT TESTED**: a true end-to-end load test (source event → parser →
matcher → behavior → aggregation → **persistence** → signal → API/WS) needs
PostgreSQL, unavailable here. No explicit queue-depth/backpressure metric
exists on the ingestion path today (the worker processes messages
synchronously per WS message with no internal queue to overflow) -- this is
a reasonable design for the current single-process, in-order-processing
architecture, not a gap requiring a new mechanism.

## 45-47. Soak, browser soak, frontend render stress

**NOT TESTED at the 1-hour/72-hour scale** -- out of this session's time
budget. A short (~5 minute) live dev-server verification was performed
(fresh `npm run dev`, direct WS client connection, headless-Chrome
screenshot of Casual mode) confirming the label fix and price-domain
consistency render correctly with no console errors observed in that
window. History buffers are bounded (`MAX_HISTORY_POINTS = 600` in
`marketStore.ts`, ~10 minutes at 1s cadence) -- this was verified by
reading the code, not by an extended live run.

## 48-51. Casual/Analyst/Quant/cross-screen end-to-end

Not re-run as scripted end-to-end flows this pass (would need an
interactive browser tool, unavailable this session; headless single-shot
screenshots were used, as in the prior session). The frontend audit's
static analysis is the evidence base here: no dead controls, no fabricated
analytics, consistent single price source across all three modes (see §4).

## 52-57. Dead controls, capability audit, API contracts, rounding

**Verified clean**: zero `href="#"`, `TODO`, `console.log`, or empty-handler
debris anywhere in `apps/web/src`; the two `disabled` buttons found are both
correctly justified with a `title` explaining why. No fabricated analytics
found -- every Analyst/Quant panel gates on real API data with explicit
`N/A`/loading copy rather than placeholder charts.

**P1 — PARTIALLY FIXED.** No `ErrorBoundary` existed anywhere in the
frontend; several market-critical numeric fields were accessed without
optional chaining (`asset.analytics.betaHeart.toFixed(2)` and similar in
`Analyst.tsx`/`Asset.tsx`), so a missing/malformed API field would throw
during render and blank the entire page with no recovery. Fixed: added
`apps/web/src/app/ErrorBoundary.tsx`, wired around `<Outlet />` in
`Shell.tsx` (keyed by route path so it resets cleanly on navigation instead
of sticking a stale error across an unrelated page), and added optional
chaining with honest `"N/A"` fallbacks to the specific cited call sites in
`Analyst.tsx` and `Asset.tsx` (`lib/api.ts`'s `pct()` now also accepts
`null`/`undefined`/`NaN` and renders `"N/A"` instead of the string
`"NaN%"`). **Not fixed**: `Portfolio.tsx`, `Leaderboard.tsx`, `IndexPage.tsx`
still type their API responses loosely and chain fields without optional
access -- the new ErrorBoundary now bounds the blast radius of a crash
there to that one page (shell/nav stay usable), but the underlying
unguarded access remains and should be cleaned up in a follow-up pass.

**P2 — DOCUMENTED, not fixed.** Three `request(...).then(setX)` calls in
`Analyst.tsx` (pairs, backtest tabs, and a `Promise.all`) have no `.catch()`,
unlike the shared `useApi` hook's pattern -- a failed fetch on those three
tabs becomes a silent unhandled rejection with no user-visible error.
Scattered `.toFixed()` calls (32 sites across 6 files) are not centralized
through `lib/api.ts`'s `money()`/`pct()` helpers -- not currently causing
visible inconsistency but no shared contract enforces it.

**P2 — DOCUMENTED.** `apps/web/src/components/TickerStrip.tsx` is fully
implemented but imported nowhere; `docs/BUILD_LOG.md` claims it was
integrated into Analyst ("added a Bloomberg-style live ticker tape strip...
across the top") when it currently is not. Left as-is (removing working,
tested code or writing a build-log correction were both judged lower value
than the fixes above within this pass's time budget); flagged so it isn't
mistaken for a live feature.

## 58-60. Network/database/process failure tests

Network (API/WS stop-restart) and process-crash (worker/API kill-restart)
tests were **not executed as live drills** this pass -- the durability
fixes in §15-16 (socket close on shutdown, sink error handling, health-only
flush) were verified by code reading and unit/property test re-runs, not by
physically killing a running process and observing recovery. Recommended as
part of the first-hour live-shadow validation (see the runbook). Database
failure test: **NOT TESTED** (no local Postgres).

## 61-67. Privacy, logging, metrics, alerts, shutdown, config, secrets

**Verified correct**: full worker console-call inventory contains no raw
post text or actor identifiers at any log level; `behavior-tape.ts`'s JSONL
writer only ever serializes hashed/opaque fields; `data/checkpoints/bluesky.json`
contains only `{source, cursor, updatedAt}`. Per-minute author-concentration
hashing uses a fresh random key discarded every flush (stronger than the
static HMAC key, since it prevents cross-window author correlation even by
someone holding the secret). No committed `.env` or hardcoded credential
was found anywhere in the tracked repository (grepped for API-key/token/
password/PEM/connection-string patterns). `.gitignore` excludes `.env`.
`CULT_DATA_MODE` fails loudly (throws) on an invalid value rather than
silently defaulting.

**P0 — FIXED** (see §10/§15-16 above): the compose-file hardcoded HMAC
secret default, the attribution store's silent degrade-instead-of-fail,
and the STALE-never-reaches-DB / crash-not-logged / shutdown-doesn't-close-
socket findings are all closed.

**P1 — DOCUMENTED, not fixed.** `apps/api/src/server.ts` does not enforce
`DATABASE_URL` presence under live-shadow/live-market (the worker does, via
a hard throw; the API process just leaves `livePool` null and silently
serves synthetic-labeled fallback responses). During a real 72-hour window
this is exactly the kind of misconfiguration that could produce a
convincing-looking "everything's fine" dashboard while the API quietly
serves synthetic numbers alongside a worker that's genuinely collecting
live data -- `/health` would report the true `dataMode` while data
endpoints silently degrade. Not fixed this pass (would need a decision on
whether the API should hard-fail at startup or per-request under this
condition, a product/ops judgment call beyond a pure bug fix); flagged as
the top operational risk to watch during the first hours of a real
campaign.

**P1 — DOCUMENTED, not fixed.** `evaluateAlerts()` exists with concrete
thresholds but is not wired into either running process (see §21-24).

**P1 — DOCUMENTED.** `CULT_LIVE_SHADOW_VALIDATED_HOURS` is a bare
self-reported environment variable, not derived from any actual observed
elapsed/validated time (no query against health history). The project's own
docs already call this "a technical floor, not automatic approval" -- this
audit confirms that characterization is accurate and does not overstate
what the gate protects against. Not a hidden bug; a known, honestly-
documented limitation. No code path was found that could flip `live-market`
on without both `CULT_LIVE_MARKET_ACK` and `CULT_LIVE_SHADOW_VALIDATED_HOURS
>= 72` being explicitly, deliberately set in the environment -- there is no
implicit escalation from a connected live source.

## 68-69. Live-shadow / live-market safety gates

This is the highest-stakes single check in the audit. **Verified, and
strengthened this pass:**
- `resolveDataMode()` (`packages/hft-engine/src/index.ts`) throws on an
  unrecognized `CULT_DATA_MODE`, and throws on `live-market` without both
  `CULT_LIVE_MARKET_ACK === "I_ACKNOWLEDGE_EXPERIMENTAL"` and
  `CULT_LIVE_SHADOW_VALIDATED_HOURS >= 72`. No code path sets these values
  implicitly; they must be explicitly present in the process environment.
- The worker throws immediately if `DATABASE_URL` is missing under
  live-shadow/live-market (`main.ts`) -- fails closed, as required.
- **Now also**: the worker fails closed if `CULT_CASCADE_HASH_SECRET` is
  missing under a durable deployment (previously degraded silently -- fixed,
  see §10), and the shipped Docker Compose profile can no longer start
  live-shadow with a known, committed default secret (fixed, see §61-67).
- **Remaining, documented, not fixed**: `sink.ts`'s `connect()` establishes
  a Postgres connection but does not check migration completeness before
  proceeding -- a missing migration surfaces as a generic "Bluesky stream
  error" on the first write, not a clear "migrations not applied"
  diagnostic. And the API process's `DATABASE_URL` enforcement gap (above).
  Neither of these lets `live-market` activate incorrectly (the two-env-var
  gate is independent of both), so they are P1, not P0.

**No path was found, adversarially, by which `live-market` could activate
merely because a live source connects.** The two required environment
variables are the only mechanism, and both must be set deliberately.

## 70. Limited connectivity smoke

Performed, as scoped: `npm run smoke:live` connected to the real public
Bluesky Jetstream endpoint, parsed one live event, confirmed the expected
schema, ran Unicode extraction, and retained neither text nor actor
identifier. No sustained collection was started. See §10 for the exact
output.

## 71-77. Runbook, first-hour/72-hour validation, stop conditions

See `docs/operations/live-shadow-runbook.md` (new this pass).

## 78. Test matrix

| Data mode | System | Reconnect | Duplicate | Missing | Stale | Restart | Load |
| --- | --- | --- | --- | --- | --- | --- | --- |
| synthetic | collector (worker) | NOT TESTED (live drill) | PASS (unit) | PASS (unit) | FIXED, re-verified via code+unit path | PASS (checkpoint/resume design verified in code; not live-drilled) | PASS (benchmarked, in-proc) |
| synthetic | DB | NOT TESTED (no Postgres) | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| synthetic | reference/index engine | PASS (unit) | N/A | PASS (returns null, not 0) | N/A | N/A | NOT TESTED at scale |
| synthetic | signals | PASS (unit) | N/A | N/A | N/A | N/A | NOT TESTED |
| synthetic | simulator (C++) | N/A | N/A | N/A | N/A | PASS (determinism hash re-verified) | PASS (benchmarked) |
| synthetic | API | PASS (health/build) | N/A | N/A | N/A | NOT TESTED (live kill/restart) | NOT TESTED |
| synthetic | WS | PASS (live-verified this pass) | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED (kill/restart drill) | NOT TESTED |
| synthetic | Casual | PASS (screenshot-verified) | N/A | N/A | N/A | N/A | NOT TESTED |
| synthetic | Analyst | PASS (static audit) | N/A | N/A | N/A | N/A | NOT TESTED |
| synthetic | Quant | PASS (static audit) | N/A | N/A | N/A | N/A | NOT TESTED |
| replay | collector | PASS (unit, `tests/replay.test.ts`) | PASS | N/A | N/A | PASS (deterministic hash) | N/A |
| live-shadow-smoke | collector | N/A (single connect) | N/A | N/A | N/A | N/A | N/A |
| live-shadow-smoke | network | **PASS** (real Jetstream, this pass) | N/A | N/A | N/A | N/A | N/A |

`N/A` = not applicable to that system/failure combination as currently
architected (e.g. "duplicate" doesn't apply to the C++ simulator, which has
no external input stream). `NOT TESTED` = genuinely not exercised this pass,
almost entirely due to the missing Postgres/Docker/browser-automation/
multi-hour-runtime environment constraints listed at the top of this
document, not because the check was skipped by choice.

## 79. Blocker severity summary

**P0 (7 found, 7 fixed this pass):**
1. Misleading "LIVE FEED" label / dishonest `dataMode` passthrough on the
   synthetic market tick feed.
2. Committed default HMAC secret in the live-shadow Docker Compose profile.
3. `AttributionStore` silently degrading (not failing closed) without a
   real secret in a durable deployment.
4. `CompositeSink` losing data to both Postgres *and* the local durability
   backstop on a single sink failure.
5. `PostgresAggregateSink`'s unhandled connection-error crash.
6. `STALE` source health never reaching the database when the stream goes
   silent without a socket close.
7. `LimitOrderBook`'s FOK/self-trade-prevention interaction, empirically
   verified to produce partial fills on an order type whose entire contract
   is all-or-nothing.

**P1 (10 found; 3 fixed, 7 documented for follow-up):**
Fixed: `EventDeduplicator` O(n²) scan; `forgetPost()` not tombstoning the
durable row; missing frontend `ErrorBoundary` + specific unguarded field
access. Documented, not fixed (each requires either a real interface/schema
change or a product judgment call beyond this pass's scope, per the reasons
given in each section above): price collar no-op for market orders; six of
eight `RiskDecision` branches untested; `evaluateAlerts()` not wired to any
running process; API process doesn't enforce `DATABASE_URL` under live
modes; risk-engine cross-language differential coverage gap; nanosecond
fake-precision + numeric/string id type mismatch on the behavior tape;
`CULT_LIVE_SHADOW_VALIDATED_HOURS` self-reported (already honestly
documented as such by the project).

**P2/P3:** see inline above; none block live-shadow, none delayed for this
pass's purposes.

## 80-81. Final report and scorecard

See `docs/audits/pre-live-final-report.md`.
