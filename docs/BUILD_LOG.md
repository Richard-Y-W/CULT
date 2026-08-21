# Build log

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
