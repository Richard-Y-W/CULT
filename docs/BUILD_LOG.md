# Build log

## 2026-08-21 — Phase 4 expression-event and exchange laboratory

- Audited and froze the Phase 3 baseline at `21f65fd`; 44 TypeScript tests, lint, typecheck, build, GCC C++ 2/2 tests, 25 parity metrics, synthetic generation, worker fixture, and corrected-path aggregate replay passed. Docker/PostgreSQL remained unavailable locally.
- Added separate expression, signal, and market event contracts with nanosecond logical time, multi-expression attribution, incremental engagement components, privacy-safe cascades, decayed amplification, propagation, breadth/concentration, inter-arrival/Fano/burstiness diagnostics, and experimental data-liquidity tiers.
- Extended the Bluesky live-shadow adapter to authorized post/like/repost collections. Strong-reference linkage is transient and emits only opaque HMAC record/cascade IDs; handles, DIDs, AT URIs, post text, and profiles are not persisted.
- Added the modular native `cult_tape`, `cult_behavior`, and `cult_exchange` paths: deterministic scheduler; integer L3 price-time book; price-time priority; partial fills; exact queue position; limit/market, IOC/FOK/post-only, cancel/replace; STP; L1/L2/L3; state snapshot/restore; microprice, imbalance, OFI, trade imbalance, markout/effective spread; latency distributions; pre-trade risk; kill/halt and reopening-price primitives.
- Added a trusted local `HftStrategy` boundary, simple inventory-skew market maker, reference-arbitrage response, TWAP/VWAP-like schedules, execution quality, and deterministic market-making challenge harness. No arbitrary uploaded code is executed.
- Added Great Cry, Celebrity, and spam-like synthetic event-to-market scenarios, SHA-256 replay artifacts, a generated comparison report, native CLI, 50,000-operation randomized book property test, and Quant monitor/tape/depth/flow/cascade/risk/heatmap API contracts without redesigning the frontend.
- Added migration `004_phase4_event_exchange.sql`, simulation provenance/run schemas, JSON-to-Parquet tape exporter, three ADRs, Phase 4 architecture/methodology/research/Quant docs, expanded signal/data/finance dictionaries, and explicit live-market gates.
- Measured the Release GCC 13.2 in-memory native benchmark at one million cycles: 2.52M insert/cancel, 3.09M replace, 2.18M match cycles per second; exact scope/caveats are in `docs/performance/README.md`.
- Known limitations: no durable live-shadow validation, PostgreSQL Phase 4 repositories are not fully activated, no production WebSocket transport, compact demos do not generate complete markout curves, and full simulator/agent checkpoint serialization remains future work.
- Next recommended step: feature freeze and frontend Phase 4.5 after final CI verification; then run a 72-hour-to-seven-day shadow campaign before considering any live-market activation.

## 2026-08-21 — Foundation and domain architecture

- Implemented npm workspace topology, strict TypeScript references, Docker PostgreSQL, environment template, and command surface.
- Added shared asset/schema types and 19 seeded expressions.
- Chose a modular monolith and documented objective/semantic separation and execution abstraction.
- Tests were added in this phase and passed in the final verification entry below.
- Limitation: repository adapters intentionally deferred behind the V0 schema.

## 2026-08-21 — Data and quantitative engines

- Added deterministic 365-day × 19-expression × 4-platform generator with trends, momentum, mean reversion, volatility clustering, shared regime pressure, platform biases, seven event shocks, and semantic drift.
- Added returns, volatility, beta/correlation, drawdown, z-score, entropy, weights/caps, immutable compositions, and three strategy interfaces/examples.
- Added integer-cent ledger execution with BUY/SELL/SHORT/COVER, average cost, realized/unrealized P&L, fees, and bailout boundary.
- Tests added for accounting, analytics, normalization, reproducibility, look-ahead boundaries, and index immutability.

## 2026-08-21 — Product vertical slice

- Added validated API routes, health/logging, dev account/session, assets, histories, platforms, semantics, portfolio, orders, indexes, leaderboard, pair/correlation analysis, events, research, and backtest.
- Built responsive Casual Mode and materially distinct Analyst terminal with functional trading and strategy run.
- Added PostgreSQL migration covering core tables and seed/migration scripts.
- Known limitations are tracked separately. Next recommended step: verification, persistence adapters, then an authorized COIP source research spike.

## 2026-08-21 — Documentation

- Added product vision, two-mode philosophy, expression/semantic/index/portfolio methodologies, architecture/data-flow/accounting diagrams, API guide, six ADRs, roadmap, and explicit limitations.
- Setup commands in README are subject to the final verification pass below.

## 2026-08-21 — Verification and correction

- Generated 19 assets, 27,740 platform observations, and seven annotated events with seed `20260821`.
- Corrected caller-owned index composition freezing, exact optional Unicode typing, web project declarations, benchmark beta calculation, and backtest liquidation of constituents leaving the target basket.
- `npm test`: 13/13 tests passed across four files.
- `npm run lint`, `npm run typecheck`, and `npm run build`: passed. Vite produced a 207.77 kB JavaScript bundle (65.03 kB gzip).
- `npm run smoke`: live API and browser passed; BUY CRY and SHORT JOY produced two portfolio positions; the deterministic momentum run returned 213.74%, −49.80% maximum drawdown, and 198 trades.
- `npm audit --audit-level=moderate`: zero vulnerabilities after upgrading Vite to 6.4.3.
- PostgreSQL container verification could not run because Docker Desktop's Linux daemon was not running. Compose configuration and SQL remain supplied but are not claimed as executed in this environment.
- Next recommended step: wire request repositories to PostgreSQL and repeat migration/seed verification with Docker available.

## 2026-08-21 — Phase 2 audit and trustworthy-underlying vertical slice

- Audited every tracked application, package, migration, test, ADR, methodology, roadmap, and limitation; recorded the actual baseline in `docs/audits/phase2-starting-state.md`. The starting TypeScript pipeline was green.
- Added modular C++20 targets for streaming analytics, expression metrics/registry matching, reference indexes, virtual liquidity/risk, and a time-bounded backtester. Added native tests, deterministic hostile-UTF-8 property tests, a golden CLI, and measured benchmarks.
- Preserved TypeScript as the golden/product layer. Differential tests compare 16 deterministic metrics at explicit absolute/relative tolerances. Added coarse Node-API and pybind11 boundaries without routing hot requests through JSON subprocesses.
- Pinned official Unicode Emoji 17.0 inputs with recorded SHA-256 checksums, generated a reviewed 30-asset/51-sequence registry, and tested repetition, variation selectors, skin tones, ZWJ sequences, flags, malformed surrogates, and combining input.
- Implemented an explicit-mode Bluesky Jetstream worker: validation, original/reply/quote classification, repost exclusion, event deduplication, minute aggregation, ephemeral HMAC author concentration, cursor checkpoint, source health, reconnect/backoff, aggregate-only PostgreSQL and JSONL sinks, and deterministic replay.
- Added migration `002_phase2_measurement.sql` for methodology versions, source state, provenance-bearing observations, reference snapshots, official-close revisions, and index classifications. Current baskets are exposed as CURATED.
- Added Analyst reference/market/premium and data-quality fields. Synthetic and live modes are visibly distinguished; unavailable metrics remain N/A.
- Added Python PCA, lead/lag, CULT-wide factor, and CEV research utilities; CEV is explicitly realized rather than option-implied volatility.
- Added CI for TypeScript, PostgreSQL migrations, GCC/Clang, C++ tests, differential tests, Node-API compile, and ASan/UBSan. Live network access is never required by CI.
- Verification: TypeScript lint/typecheck/build passed; 27/27 tests passed; 16-metric differential parity passed; C++ 2/2 tests passed. GCC 13.2 Release split benchmarks measured 1M and 10M operations; exact results and caveats are in `docs/performance/README.md`.
- Known limitations: demo trading persistence and native endpoint activation remain incomplete; this machine lacks binding development headers; Docker/PostgreSQL and live-network smoke tests still require environmental verification.
- Next recommended step: finish final verification, run an authorized durable collection with PostgreSQL, and use that history to calibrate close/quality/seasonality policies before adding a second source.

## 2026-08-21 — Phase 2 final local verification

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:differential` passed. The web bundle was 209.85 kB JavaScript (65.56 kB gzip); 27 TypeScript tests and 16 differential metrics passed.
- Release C++ configure/build passed; CTest passed both the quantitative suite and 10,000-case hostile-Unicode property suite.
- Split Release benchmarks completed at 1M and 10M operations; exact measured output is recorded in `docs/performance/README.md`.
- Unicode generation reproduced 30 assets/51 sequences; synthetic generation reproduced 19 assets/27,740 platform observations/seven events; recorded worker ingestion and deterministic aggregate replay passed.
- The live application smoke passed health, web rendering, BUY, SHORT, portfolio, and momentum backtest. The data-status and CRY reference-metrics endpoints returned explicit SYNTHETIC provenance and no fabricated quality score.
- The manual privacy-safe live connectivity smoke successfully parsed a current public Bluesky Jetstream quote-post event, reported protocol metadata only, and retained/printed neither text nor actor identifier. Full live persistence was not run because PostgreSQL was unavailable.
- Python research modules passed Python 3.13 bytecode compilation. Dependencies/native pybind11 module were not installed in this environment.
- Docker Compose configuration validated, but Docker’s server daemon was unavailable; PostgreSQL migrations/seed and live collector persistence were therefore not executed locally. CI is configured to run migrations against PostgreSQL 16.
- The sanitizer configuration compiled objects but could not link because this Strawberry GCC distribution lacks `libasan` and `libubsan`. Linux CI owns ASan/UBSan execution. No local Clang toolchain or Node development headers were present, so those toolchain/native-addon jobs are also not claimed as local passes.

## 2026-08-21 — Phase 3 quantitative research vertical slice

- Audited the Phase 2 baseline at `e45e324`; recorded verified behavior and gaps in `docs/audits/phase3-starting-state.md`.
- Added language plus content strata, intensity, author HHI/effective-author diagnostics, arrival mode, lag percentiles, and provenance-bearing PostgreSQL V3 aggregates. API live reads now use V3.
- Added calibration-gated standardization and official UTC close commands. Closes count-weight raw documents, reject incomplete days by default, chain-link from the prior close, and refuse overwrite of final history.
- Added a typed research engine for Jeffreys/raw prevalence, Wilson intervals, deterministic block bootstrap, signal/noise, robust seasonality, EWMA, volatility/momentum, market breadth/dispersion/entropy/concentration, factor residuals, pairs, event studies, IC/quantiles, multiple-testing correction, purged walk-forward splits, portfolio tails/costs, and rigorous index weights/buffers.
- Expanded C++ streaming analytics and differential parity to 25 metrics. Corrected C++ backtest timing to next-bar-by-default and added explicit commission/spread/impact/borrow/funding costs, VaR/ES, and drawdown duration.
- Added a configurable virtual liquidity provider and distinct OK/margin-call/deleveraging/liquidation/bankruptcy states without changing the existing product execution path.
- Added Python econometrics/factor/snapshot modules, immutable Parquet manifests, a 14-question experiment registry, structured daily summary, and Report 001 generator that withholds inference under seven days.
- Added versioned methodology change control, standardization methodology, field/signal dictionaries, finance-analogy boundaries, and read-only research APIs.
- Verification so far: 42/42 TypeScript tests, C++ 2/2, 25 differential metrics, TypeScript lint and typecheck passed. Final build/database/replay/benchmark/live checks follow in the final verification entry.

## 2026-08-21 — Phase 3 final local verification

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:differential`, and `npm audit --audit-level=moderate` passed. The final suite contains 44 TypeScript tests; differential parity covers 25 metrics; npm reported zero known vulnerabilities.
- Release C++ rebuilt successfully and both CTest programs passed. Python and research scripts passed Python 3.13 bytecode compilation; Python research dependencies/native binding were not installed for runtime execution.
- Synthetic generation reproduced 19 assets, 27,740 platform observations, and seven events. Fixture worker ingestion, deterministic aggregate replay, application health/web, BUY, SHORT, portfolio, and backtest smoke tests passed.
- The privacy-safe live smoke parsed a current public Bluesky reply and retained neither text nor actor identifier. This connectivity check did not persist a production collection.
- Measured dense rolling-pair benchmarks covered 30, 100, and 1,000 synthetic expressions. Exact timings and caveats are recorded in `docs/performance/README.md`; no memory/allocation result is invented.
- Docker CLI was available but the Docker server daemon was not running. PostgreSQL migration `003_phase3_research_engine.sql`, calibration, and close commands were therefore not executed locally and are left to PostgreSQL CI verification.

## 2026-08-21 — Phase 3 CI correction

- GitHub's PostgreSQL 16 TypeScript job passed migration 003, seed, lint, typecheck, 44 tests, and production build. ASan/UBSan and hostile-Unicode jobs passed.
- Clang 18 correctly rejected an implicit unsigned iterator offset conversion in expected-shortfall calculation under `-Wsign-conversion -Werror`. Reproduced it in WSL, replaced it with an explicit `std::ptrdiff_t` boundary, then rebuilt and passed both C++ suites under Clang 18 and local GCC.

## 2026-08-21 — Phase 4 final local verification

- `npm test` passed 51 tests across 10 files. `npm run lint`, `npm run typecheck`, `npm run build`, and the 25-metric TypeScript/C++ differential suite passed. The production web artifact remained 209.96 kB JavaScript (65.56 kB gzip); Phase 4 did not redesign the frontend.
- Clang 18 Release and GCC 13.3 with AddressSanitizer/UndefinedBehaviorSanitizer each built every native target and passed all three CTest programs. These include the quantitative suite, hostile-Unicode property suite, and 50,000-operation randomized order-book invariant suite.
- The live application smoke passed health, BUY, SHORT, portfolio, backtest, and browser checks. Quant market monitor, CRY tape, and heatmap endpoints returned HTTP 200. The local processes were stopped after verification.
- The Great Cry replay reconstructed 160 expression events, three signal events, and 23 market events with deterministic SHA-256 output `46c328627c5369504e66ee30b765825ad4fc28cec95becff32909e962efdb49b`.
- The Parquet export smoke wrote five versioned tables and a manifest under the ignored build directory. The optional public Bluesky connectivity smoke parsed a current reply while retaining neither source text nor actor identity.
- Docker Desktop's server daemon was not running, so migration 004 was not executed against local PostgreSQL. CI remains responsible for the PostgreSQL 16 migration check; this local run does not claim it passed.
- ESLint was updated to ignore all generated CMake `build` trees after the final multi-toolchain matrix exposed CMake files named `compiler_depend.ts`.
- Phase 4 backend feature expansion is frozen. The next recommended phase is 4.5 product/frontend work, followed by a measured 72-hour minimum live-shadow campaign before any explicit live-market consideration.
