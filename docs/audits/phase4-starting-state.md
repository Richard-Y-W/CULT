# Phase 4 starting-state audit

Audit date: 2026-08-21  
Baseline: `21f65fd` (`fix-clang-signed-iterator-offset`) on `main`

## Scope inspected

The audit covered all tracked applications, packages, C++ targets and bindings, database migrations, scripts, tests, fixtures, configuration, ADRs, product/architecture/methodology/research documentation, the build log, roadmap, and known limitations. Phase 3 remains the behavioral contract; its TypeScript paths are retained while event-level compute is added in C++.

## Verified behavior

- Casual and Analyst product code still builds against the deterministic 365-day synthetic dataset.
- The primary API preserves separate expression-reference and simulated-market values, fake-currency accounting, research routes, and explicit synthetic/live provenance.
- The Bluesky worker validates Jetstream records, excludes pure reposts from document eligibility, buckets original/reply/quote text, matches the pinned Unicode registry, aggregates one-minute sufficient statistics, uses transient author hashes, checkpoints, and emits replayable aggregate JSONL.
- PostgreSQL migrations define core product state plus Phase 2/3 source, observation, methodology, close, calibration, and research-snapshot contracts. Product trading requests still use process-local demo state.
- The C++20 core contains modular expression, analytics, index, virtual-market/risk, and time-bounded backtest targets. It does not yet contain an event scheduler, L3 order book, event tapes, exchange latency, or HFT strategy SDK.
- Research definitions cover prevalence, returns, seasonality, market factors, factor residuals, pairs, event studies, IC, portfolio risk, and cost-aware next-bar backtesting. No durable 7-day live dataset or eligible empirical Report 001 exists.

## Baseline verification

| Check                       | Result                                                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm ci`                    | Passed; 284 packages audited, 0 vulnerabilities                                                                  |
| `npm test`                  | Passed: 44/44 tests in 9 files                                                                                   |
| `npm run lint`              | Passed                                                                                                           |
| `npm run typecheck`         | Passed                                                                                                           |
| `npm run build`             | Passed; web bundle 209.96 kB JS / 65.56 kB gzip                                                                  |
| GCC C++20 configure/build   | Passed with GCC 13.2 / Ninja                                                                                     |
| CTest                       | Passed: 2/2 suites                                                                                               |
| `npm run test:differential` | Passed: 25 metrics at abs `1e-11`, rel `1e-10`                                                                   |
| synthetic generator         | Passed: 19 assets, 27,740 platform observations, 7 events                                                        |
| recorded worker fixture     | Passed                                                                                                           |
| aggregate replay            | Passed: 4 batches, 360 observations, checksum `9893fec99b32b097e5b1999c3e3a7c82600145efe592501579d7fb77517900e2` |
| PostgreSQL migration        | Not run locally: Docker client is present but its daemon is unavailable                                          |

The first replay invocation used a nonexistent path and failed with `ENOENT`; rerunning with the worker's documented dated path succeeded. This was an invocation error, not a replay defect.

## Current mathematical boundary

Official prevalence is document presence. Engagement is not represented. Jeffreys smoothing is used for low-count return/index calculations while raw prevalence remains unchanged. The chain-linked reference is measurement-derived and independent of the simulated market. Existing `OFI` is a coarse simulated signed-flow ratio, not order-book OFI; Phase 4 must rename/separate those concepts.

## Phase 4 gaps and technical debt

- No expression, signal, or market event tape with nanosecond logical time.
- No engagement deltas, privacy-safe cascades, amplification, propagation, cascade concentration, or arrival-process diagnostics.
- No deterministic L3 price-time-priority matching engine, queue position, order lifecycle, L1/L2/L3 feed, exact aggressor sign, or microstructure analytics.
- No latency scheduler, feed/order/cancel delay, stale-quote mechanics, agent SDK, HFT scenarios, execution algorithms, or competition runner.
- No event-level exchange persistence, replay manifest, snapshot/restore, Phase 4 database schema, or Quant data endpoints.
- Existing virtual liquidity and margin functions are bar/state primitives, not exchange acceptance or portfolio-ledger risk controls.
- Live mode is a binary `synthetic|live` choice. It must become `synthetic|replay|live-shadow|live-market`, with live-market denied unless an explicit validation gate is satisfied.
- Docker/PostgreSQL cannot be verified on this host until Docker Desktop's Linux daemon is running. CI remains the authoritative migration check.

## Phase 4 implementation contract

Phase 4 will preserve Phase 3 APIs and TypeScript golden behavior while adding one complete deterministic path:

```text
expression event -> behavior state -> signal event -> delayed agent decision
-> pre-trade risk -> L3 order book -> fills/market tape -> analytics/replay hash
```

The default remains synthetic. Live public events may enter shadow processing only by explicit configuration; live-market activation requires a separate acknowledgement and recorded validation evidence. No public frontend redesign is in scope.
