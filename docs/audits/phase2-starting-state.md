# Phase 2 starting-state audit

Audit date: 2026-08-21  
Baseline commit: `865459fb68baa5a97eba87649d6f4d3cbd3a6352`

## Scope inspected

The audit covered every tracked application, package, test, script, migration, root configuration file, product/methodology/architecture document, ADR, the roadmap, build log, and known limitations. Generated build output and `node_modules` were excluded because they are reproducible artifacts.

## Verified behavior

- `npm install`: lockfile current; 278 packages audited; zero known vulnerabilities.
- `npm test`: 13 tests passed across analytics, expression, index, and market packages.
- `npm run lint`: passed.
- `npm run typecheck`: passed under the repository's strict project-reference configuration.
- `npm run build`: API and all domain packages compiled; the Vite production build completed.
- `npm run generate:synthetic`: deterministically produced 19 assets, 27,740 platform observations, and seven events from seed `20260821`.
- PostgreSQL was not verified during the baseline audit because the local Docker daemon was unavailable in the preceding V0 verification. This remains an environmental limitation, not a claimed pass.

## Applications and API boundaries

`apps/web` is a single React/Vite client. Casual Mode implements markets, assets, trade entry, portfolio, leaderboard, and curated indexes. `/terminal` implements the Analyst surface with history, platform/semantic summaries, correlation, one fixed pair, and one momentum backtest. Charts are dependency-light SVG polylines.

`apps/api` is a modular but single-file Node HTTP server. Zod validates account and order payloads. It exposes assets/history/platforms/semantics, indexes, portfolio/orders, leaderboard, pair/correlation analytics, backtests, events, research, a development session, and `/health`. Runtime users, orders, positions, balances, and generated observations are process-local. Authentication is a fixed development cookie/account.

`apps/worker` and `apps/terminal` are documented extraction boundaries, not independently running applications.

## Domain packages

- `@cult/shared`: compact DTOs, 19 seeded assets, four synthetic platform names, and common enums. DTOs expose one unversioned `confidence` number.
- `@cult/analytics`: vector-based returns, momentum, sample volatility, covariance, correlation, beta, drawdown, z-score, entropy, three example strategies, and a target-weight backtest. Rolling operations allocate slices; no incremental estimators exist.
- `@cult/expression-engine`: NFC normalization, removal of variation selectors, a small phrase-alias map, prevalence per million, raw-difference velocity/acceleration, unsigned majority breadth, absolute persistence, semantic entropy, and the synthetic generator. It does not implement grapheme segmentation or an emoji registry.
- `@cult/index-engine`: four weighting modes, iterative caps, index values, immutable compositions, and six curated demo indexes. Their labels do not yet distinguish curated from quantitative methodology.
- `@cult/market-engine`: integer-cent cash ledger, immediate quotes/fills, long/short position accounting, fees, portfolio marks, and a bailout method. Shorts generate spendable cash without margin, borrow, leverage, or concentration controls.
- `@cult/db`: money conversion helpers and a single PostgreSQL migration contract. Request handlers do not use it.

## Current mathematical contracts

- Raw prevalence is `1,000,000 × expression_documents / eligible_documents` and document presence is intended to be binary.
- Documentation defines platform aggregation using log changes plus an unspecified epsilon, then a base-1,000 chain link. Runtime synthetic history does not implement a formal source-window reference-index pipeline.
- Velocity is a raw level difference; acceleration is the difference of raw differences. Breadth is the larger fraction of positive or negative platform changes and therefore loses direction. Persistence is the absolute mean sign and also loses direction.
- Volatility is sample standard deviation; API values are annualized using `sqrt(365)`. Correlation is Pearson and beta is covariance divided by benchmark variance.
- Semantic entropy filters zero weights but assumes already normalized probabilities.
- Index caps and compositions are tested, but the six published baskets are curated and smaller than their names suggest.
- Backtesting passes history sliced only through the current bar, preventing future observation access, but allocates/copies per bar and omits borrow costs, missing-data policy, inactive membership, and richer risk metrics.

## Synthetic-data assumptions

The generator produces 365 daily observations for 19 assets and four fictionalized platform series. It combines an autoregressive global shock, asset drift, momentum, stochastic volatility, platform biases, deterministic event shocks, and synthetic semantic drift. It rescales each final series to its seeded current index value. Platform observations use randomly sized eligible-document samples and rounded counts; acceleration is stored as zero. The data is useful for product and regression tests but is not empirical evidence.

## Technical debt and Phase 2 priorities

1. Preserve TypeScript as the golden behavior while introducing a modular C++20 compute core and explicit differential tolerances.
2. Replace code-point/variation-selector shortcuts with a pinned Unicode Emoji registry and sequence-aware longest-match extraction.
3. Replace ambiguous prevalence-derived signals with versioned Jeffreys smoothing, directional breadth/persistence, source health, and component data-quality diagnostics.
4. Establish aggregate-first Bluesky Jetstream ingestion with idempotency, checkpoint/replay, transient text, and privacy-conscious author concentration.
5. Wire PostgreSQL runtime repositories before treating live observations as durable.
6. Separate provisional indicative windows, immutable official closes, and auditable revisions.
7. Add native/Python boundaries only around coarse-grained compute; do not delete TypeScript paths until parity is measured.
