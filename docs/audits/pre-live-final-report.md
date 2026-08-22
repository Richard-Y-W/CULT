# Pre-live final report (Phase 5.5)

Full findings: `docs/audits/pre-live-readiness.md`. Units reference:
`docs/audits/unit-consistency.md`. Operational procedure:
`docs/operations/live-shadow-runbook.md`.

Commit base audited: `3ecac65`. This report and its fixes land as one
commit on top.

## Tests run and results

| Suite | Result |
| --- | --- |
| `npm run lint` | PASS (0 warnings, after every fix in this pass) |
| `npm run typecheck` | PASS |
| `npm test` (vitest, 10 files) | PASS, 52/52 |
| `npm run build` (all workspaces) | PASS |
| C++ clean rebuild (`cmake --build`, Release, GCC 13.2) | PASS |
| `ctest`: `cult_cpp_tests`, `cult_unicode_property_tests`, `cult_order_book_property_tests` | PASS, 3/3, including a new regression test for the FOK/STP fix |
| `npm run test:differential` (25 metrics, C++ vs TS) | PASS |
| `npm run replay:hft` for `great-cry`/`celebrity`/`spam` | PASS after regenerating stale fixtures found this pass |
| C++ determinism (`run_great_cry_shock` hashed twice) | PASS, identical hash |
| `npm run hft:benchmark` / `cult_hft_benchmarks` | Measured, no regressions (see readiness doc §41-44) |
| `npm run smoke:live` (real Bluesky Jetstream, one event, no persistence) | PASS |
| Live dev-server smoke (fresh process, direct WS client, headless screenshot) | PASS -- `STREAM: CONNECTED · DATA: SYNTHETIC` renders correctly; CRY WS tick `dataMode: "synthetic"`, price `8396.96` (correct reference-index scale) |

## Tests NOT run (with reason)

| Area | Reason |
| --- | --- |
| PostgreSQL migrations/seed/sustained insert/lock contention/connection pool | Docker daemon unavailable in this environment (`docker info` fails) -- consistent with this project's entire prior history (every phase's BUILD_LOG entry notes the same). GitHub CI's dedicated PostgreSQL 16 job is the established substitute and must pass on this commit. |
| ASan/UBSan/TSan | No local `clang++`; local GCC (Strawberry MinGW) cannot link `libasan`/`libubsan` (documented pre-existing gap). CI's `sanitizers` job is the established substitute. |
| 1-hour+ soak, 72-hour campaign | Out of this session's time budget. Runbook prepared for the operator to execute. |
| Live process-kill/restart drills (worker, API) | Durability fixes were code/unit-verified, not live-drilled, this pass. Runbook's first-hour checklist includes doing this once, live, before extending unattended. |
| Interactive end-to-end browser flows (place order, watch fill, portfolio reconciles) | No interactive browser tool available this session; static/code audit plus one live headless smoke were used instead. |
| Full independent recomputation of every financial/quant formula (VaR, ES, Sharpe-like, etc.) against hand-calculated references | Not attempted this pass beyond the existing differential/unit test suites, which passed. |

## Performance results

Release, clean rebuild, GCC 13.2, this machine (isolated in-memory
operations, no persistence/serialization -- not a production throughput
claim, consistent with the project's existing benchmark caveats):

- Order book insert/cancel: ~1.68M ops/sec
- Cancel/replace: ~2.20M ops/sec
- Matches: ~1.66M ops/sec
- L2 snapshot generation: ~3.84M/sec
- Strategy callbacks: ~47M/sec
- `EventDeduplicator` (fixed this pass): 500,000 events in 329ms at a
  simulated 200 events/sec sustained rate (the pre-fix version did not
  complete 200,000 events at the same rate within a 2-minute timeout)

These are many orders of magnitude above any plausible Bluesky firehose
rate for the tracked collections; headroom is not the concern for
live-shadow readiness. See the readiness doc §41-44 for what was and
wasn't load-tested end-to-end (persistence-inclusive load testing needs
PostgreSQL, not available this pass).

## Soak duration

None executed at scale this pass. A ~5-minute live dev-server smoke was
run (fresh process boot, direct WS client verification, one headless
screenshot) with no errors observed in that window. This is not a
substitute for the 1-hour/72-hour soak the full spec calls for; see the
runbook for the prepared (not yet executed) campaign plan.

## Memory behavior

Not measured under sustained load this pass (would require the soak
above). No local ASan/UBSan run (see table above); CI's sanitizer job is
the current source of truth and should be confirmed green on this commit.

## Database behavior

Not exercised this pass (no local Postgres). `PostgresAggregateSink.write()`
was read and confirmed to wrap every batch in an explicit
`BEGIN`/`COMMIT`/`ROLLBACK` transaction. Fixed this pass: the connection-
error crash was unhandled (now logs structured diagnostics and exits
deliberately), and a sink failure no longer also blocks the local
`ReplaySink` durability backstop (see readiness doc §15-16). CI's
PostgreSQL 16 job must pass on this commit before treating DB behavior as
verified.

## Reconnect behavior

Jetstream reconnect/backoff logic was read and is unchanged this pass
(exponential backoff capped at 30s, 5-second cursor overlap on resume --
both confirmed real in code, not just documentation). No live reconnect-
storm drill was performed. The worker's `shutdown()` now correctly closes
the active socket (fixed this pass), which should make an operator-
initiated restart during the runbook's first-hour checklist behave
cleanly; this specific behavior has not yet been observed live.

## Deterministic replay result

`run_great_cry_shock` hash: `1133858755361010280`, identical across two
runs, this pass, on a clean rebuild. `npm run replay:hft` passes for all
three fixture scenarios after regenerating them (found stale relative to
the prior session's price-scale fix -- see readiness doc §36-38).

## HFT result

FOK/self-trade-prevention atomicity bug found, empirically reproduced,
fixed, and covered by a new regression test (readiness doc §25-29). Order
book property fuzzer (50,000 randomized operations), latency causality
chain, and pre-trade risk gating (genuinely blocks `book.submit`, not
decorative) all verified. Price collar no-op for market orders found and
documented as an unfixed P1 (needs a real interface change, not a one-line
patch -- see rationale in the readiness doc).

## Frontend result

Misleading "LIVE FEED" label fixed and live-verified (STREAM/DATA split).
No dead controls, no fabricated analytics found. Added a global
`ErrorBoundary` plus specific optional-chaining fixes for the two cited
crash sites; several similar unguarded-access sites remain in
`Portfolio.tsx`/`Leaderboard.tsx`/`IndexPage.tsx` (now blast-radius-bounded
by the ErrorBoundary, not individually fixed -- documented as P1 follow-up).

## Remaining P1/P2/P3 findings

Full list with file:line citations in `docs/audits/pre-live-readiness.md`
§79. Summary:

**P1, documented and not fixed this pass** (each requires either a real
interface/schema change or a product judgment call, not a scoped bug fix):
price collar no-op for market orders; six of eight `RiskDecision` branches
untested; `evaluateAlerts()` not wired to any running process; API process
doesn't enforce `DATABASE_URL` under live modes; risk-engine cross-language
differential coverage gap; nanosecond fake-precision + numeric/string id
type mismatch on the behavior tape (only matters once something reads that
tape, which nothing does yet); `CULT_LIVE_SHADOW_VALIDATED_HOURS` is
self-reported (already honestly documented by the project as a floor, not
automatic approval).

**P2/P3:** markout/queue-tradeoff numeric labels overstating precision;
halt/reopen primitives unwired to any integrated scenario; no P&L/equity
reconciliation identity computed anywhere; `mappedEngagementRate` resets
its apparent coverage after a restart (underlying data is fine, the rate's
numerator/denominator are just in-memory); three unhandled-rejection call
sites in `Analyst.tsx`; scattered `.toFixed()` precision; orphaned
`TickerStrip.tsx` plus a stale `BUILD_LOG.md` claim about it; a crash-
mid-window can silently undercount one ~60-second aggregation window
before self-correcting.

None of these were assessed as blocking live-shadow specifically (as
opposed to an eventual live-market decision, or an unattended 72-hour
campaign without the runbook's checks followed).

## Readiness scorecard

PASS / CONDITIONAL / FAIL / NOT TESTED. No fabricated percentages.

| Area | Rating | Basis |
| --- | --- | --- |
| Source ingestion | CONDITIONAL | Core logic + durability P0s verified (unit/property tests, live Jetstream smoke); DB behavior under real load NOT TESTED locally |
| Unicode correctness | PASS | Hostile-Unicode property suite passed; live smoke correctly extracted from a real payload |
| Attribution durability | PASS | Fail-closed fix, DB tombstone fix, warm-start verified in code and exercised live via `smoke:live` |
| Cascade correctness | PASS | Recursive depth tested to 4; cycle-safe by construction, not by special-casing |
| Reference math | CONDITIONAL | 25-metric differential parity passes at tight tolerance; full independent hand-recompute of every formula not attempted this pass |
| Quant analytics | CONDITIONAL | Correctly isolated/labeled as fixed-scenario-replay by design (not a gap); six `RiskDecision` branches remain untested |
| Exchange correctness | CONDITIONAL | FOK atomicity bug found and fixed with a regression test; price collar for market orders remains a known, documented gap |
| HFT causality | PASS | Latency causality chain strictly increasing, tested; stale-quote adverse selection genuinely latency-dependent |
| Risk | CONDITIONAL | Gate genuinely blocks orders (verified, not decorative); collar bug and untested branches above |
| Database | NOT TESTED | No local PostgreSQL/Docker this session; CI-owned, consistent with project history |
| Replay | PASS | Determinism re-verified this pass; stale fixtures found and regenerated |
| API | CONDITIONAL | Health/build verified; `DATABASE_URL` enforcement gap under live modes is a documented P1 |
| WebSocket | CONDITIONAL | Label/dataMode honesty fixed and live-verified; no sequence-gap/reconnect-storm live drill this pass |
| Casual | PASS | Screenshot-verified, price-domain consistent, ErrorBoundary added |
| Analyst | PASS | Static audit clean (no dead controls, no fabricated analytics); ErrorBoundary added |
| Quant | PASS | Correctly scoped and labeled; static audit clean |
| Performance | PASS | Benchmarks re-run, orders of magnitude of headroom; dedup fix measured and verified |
| Memory | NOT TESTED | No local ASan/UBSan; CI-owned |
| Recovery | CONDITIONAL | Shutdown/STALE-flush/sink fixes made and unit-verified; no live kill-and-restart drill performed this pass |
| Observability | CONDITIONAL | Metrics/logging verified present and structured; alerting exists but isn't wired to any running process (P1) |
| Documentation | CONDITIONAL | This audit's docs are new and accurate; one pre-existing doc/reality mismatch (`TickerStrip.tsx` claimed integrated in `BUILD_LOG.md`, isn't) was found and left uncorrected this pass |

## Final decision

**READY FOR LIVE-SHADOW**, conditioned on the following before starting a
real collection run:

1. **Confirm this commit's CI passes**, specifically the PostgreSQL 16
   migration/seed job and the `sanitizers` job -- these are the established
   substitute for the database and memory-safety verification this session
   could not perform locally (no Docker, no local ASan/UBSan), exactly as
   every prior phase of this project has relied on CI for the same reason.
2. **Set a real `CULT_CASCADE_HASH_SECRET`** in your `.env` -- both the
   worker and the Docker Compose `live-shadow` profile now refuse to start
   without one (fixed this pass), but confirm you're setting a genuine
   secret, not reusing any value that appears in this repo's history.
3. **Follow `docs/operations/live-shadow-runbook.md`'s first-10-minutes and
   first-hour checklists**, since several of this pass's fixes (STALE-state
   DB flush timing, clean socket shutdown, per-sink failure isolation) are
   verified by code reading and unit/property tests but have not yet been
   observed against a real, live-running process.
4. Treat the documented P1s (price collar for market orders, unwired
   runtime alerting, the API's `DATABASE_URL` enforcement gap) as items to
   fix before either an unattended 72-hour campaign or any future
   live-market consideration -- none of them block starting supervised
   live-shadow collection today.

### Startup sequence (from this repository's actual scripts; nothing invented)

```bash
# 1. Set a real secret in .env: CULT_CASCADE_HASH_SECRET=<long random value>

# 2. Bring up PostgreSQL and run migrations
docker compose up -d
npm run db:migrate

# 3a. Either run the full Docker profile (starts Postgres + runs migrations
#     + starts the worker in live-shadow, all gated):
docker compose --profile live-shadow up --build

# 3b. ...or run the worker directly against the same database:
CULT_DATA_MODE=live-shadow DATABASE_URL=postgresql://cult:cult@localhost:5432/cult npm run worker

# 4. Optionally start the API/web for dashboards during collection:
npm run dev

# 5. One-time pre-flight (optional, no persistence): confirm connectivity
#    before a sustained run:
npm run smoke:live
```

`live-market` remains unavailable unless `CULT_LIVE_MARKET_ACK` and
`CULT_LIVE_SHADOW_VALIDATED_HOURS >= 72` are both deliberately set --
nothing in this startup sequence sets them, and nothing in the codebase
sets them implicitly.
