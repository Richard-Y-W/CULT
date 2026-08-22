# Roadmap

## Phase 1 — Synthetic market simulator — COMPLETE

Working two-mode UI, deterministic expression panel, reference/market separation, fake-currency execution, portfolio marks, indexes, analytics, pairs, backtest, PostgreSQL contract, and methodology docs. Next: persist API transactions, finish production authentication, add full SELL/COVER UI, and visual/accessibility QA.

## Phase 1.5 — C++ core migration and parity — WORKING VERTICAL SLICE

C++20 modular compute core, native golden CLI, deterministic parity tests, hostile-Unicode tests, benchmarks, Node-API boundary, pybind11 surface, backtest V2, and virtual liquidity/risk primitives are implemented. Next: activate coarse native calls in the API after each endpoint gains parity and operational packaging.

## Phase 2 — Bluesky live emoji panel — WORKING VERTICAL SLICE

Authorized Jetstream adapter, pinned 30-emoji Unicode 17.0 registry, minute aggregation, privacy-conscious author concentration, PostgreSQL observation sink, checkpoint/health, deterministic replay, and Analyst reference/data panel are implemented. Remaining: run a durable collection campaign, finalize daily-close job, and migrate demo trading repositories to PostgreSQL.

## Phase 2.5 — Reference/data-quality hardening — WORKING VERTICAL SLICE

Official close finalization, calibration-gated content/language standardization, Wilson and deterministic moving-block intervals, explicit quality vectors, seasonality baselines, and signal/noise diagnostics are implemented. Remaining: operate against 7–30 days of durable data, schedule finalization, and validate thresholds/benchmarks empirically.

## Phase 3 — Quantitative research engine — WORKING VERTICAL SLICE

Research primitives now cover broad market internals, EWMA/momentum/volatility, factor residuals, pair and event diagnostics, HAC-compatible Python research, PCA, IC/quantiles, multiple-testing correction, purged walk-forward splits, tail risk, explicit costs, delayed C++ execution, virtual liquidity/margin, immutable Parquet snapshots, and guarded report generation. Remaining: collect sufficient history, produce registered experiment outputs, add full ADF/PCA/lead-lag batch orchestration, and publish Report 001 only when eligible.

## Phase 4 — Expression event tape and deterministic exchange laboratory — WORKING VERTICAL SLICE

Three independent tapes, engagement/cascade diagnostics, data-liquidity study primitives, deterministic nanosecond scheduler, integer L3 CULT-X book, exact queue position, core order types/STP, latency, microstructure, risk/halts, strategy/execution SDK, native scenarios, property tests, benchmark suite, replay hashes, PostgreSQL contracts, privacy-safe Bluesky engagement linkage, and read-only Quant APIs are implemented. Remaining validation: durable 72-hour/7-day live-shadow campaign, real signal-range study, event-tape PostgreSQL repository activation (the `expression_events`/`cascade_snapshots` tables, not the live worker's aggregate/attribution stores below), authenticated WebSocket transport, complete agent ecology/markout series, and empirical threshold calibration.

## Phase 4.1 — Live/integration hardening — COMPLETE as part of Phase 5

Durable, privacy-safe post → expression attribution (`post_attribution_map`, HMAC-keyed, 14-day default retention) survives worker restarts, warm-starts on startup, and reports a measured `mappedEngagementRate` rather than dropping unresolved engagement silently. Cascade depth is computed recursively instead of capped at a boolean has-any-parent check. The canonical Great Cry Shock scenario (TS and C++) routes an amplification signal through an agent, sampled agent/order latency, and a real pre-trade risk check (previously implemented but never called) before an order reaches the book, instead of converting the information score directly into an order. A coarse, header-only C++ simulation facade (`SimulationHandle`) replaces ad-hoc per-scalar access for replay/L1/L2/tape/risk state. Not done in this pass: Node-API/pybind11 exposure of that facade (needs build tooling this image lacks), `expression_events`/`cascade_snapshots` population by the live worker, and the durable 72-hour/7-day live-shadow campaign itself — see [known limitations](docs/KNOWN_LIMITATIONS.md).

## Phase 4.5 — PRODUCT FREEZE / FRONTEND — NEXT

No new major backend concepts. Focus on onboarding, simple expression cards/charts, BUY/SHORT, portfolio, indexes, leaderboard, mobile/accessibility, then carefully expose Analyst and Quant data without compromising five-second comprehension.

## Phase 5 — Cross-platform panel and semantic research

Add permitted Mastodon and stratified YouTube samples after Bluesky is statistically characterized; publish fixed panel weights, missing-source behavior, effective sample sizes, block-bootstrap intervals, and external validation. Separately research versioned, calibrated context classifiers, uncertainty, semantic drift, and strict objective-oracle isolation. Reddit waits for authorized access.

## Phase 6 — Expressions beyond emoji

Explicit phrase/alias methodologies, language-aware eligibility, acronyms and emoticons.

## Phase 7 — User-created cultural indexes

Versioned eligibility, selection, caps, immutable rebalance histories, creator/read-only publication, and methodology classification.

## Phase 8 — Advanced quant terminal

Data-quality history, event studies, sparse relationships at larger universes, factor/regime research, and export controls.

## Phase 9 — Strategy ecosystem

Native strategy SDK, reproducible data views, larger backtest jobs, and research-grade diagnostics.

## Phase 10 — Research and reputation

Publishing and transparent simulated track records without real-money rewards.

## Phase 11 — API/data product

Versioned aggregate/reference exports and documented API access subject to source terms and privacy policy.

Custom cultural indexes and publishing; advanced terminal/event studies; strategy ecosystem; research publishing/reputation; documented API and data exports.

Potential later simulated instruments include expression futures, binary contracts, options, factor portfolios, and structured baskets. None proceed before the reference methodology and legal/product boundaries are mature. CEV currently means realized expression volatility; it is not an implied-volatility index.
