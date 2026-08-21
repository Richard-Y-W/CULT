# Known limitations

- Default product histories, semantic labels, events, prices, and four-platform statistics are synthetic. Live Bluesky aggregate collection exists but does not replace the demo history automatically.
- COIP-1 has one live source. It is a provisional Bluesky panel, not a representative cross-platform or human-population measurement.
- Trading API state is still process-local and resets on restart. The live worker persists observations, watermarks, and source health to PostgreSQL; full trading repository migration remains incomplete.
- The initial PostgreSQL migration and seed scripts were not executed in this build environment because its Docker daemon was unavailable; they require a live PostgreSQL 16 instance for verification.
- Authentication is a development cookie/account, not production identity infrastructure.
- The product execution path remains immediate. C++ virtual liquidity, impact, spread, borrow cost, leverage, margin-call, and liquidation primitives are experimental and not yet the API execution path.
- The C++ backtester enforces a time-bounded DataView and supports fees, slippage, shorts, borrow cost, exposure metrics, and a momentum strategy. The UI still runs the TypeScript synthetic momentum example.
- Cultural baskets contain fewer constituents than their names imply; custom indexes have a schema boundary but no editor yet.
- Semantic labels are synthetic, English-oriented examples and support no demographic inference. Curated semantic indexes are labelled CURATED, not empirical.
- No billing, prizes, redemption, transfers, blockchain, payments, derivatives, export, or real-money functionality.
- No production rate limiter, Redis, TimescaleDB, ClickHouse, scraping fleet, or large-scale analytics store.
- UI charts are dependency-light SVG polylines and have limited interaction/accessibility.
- Official daily-close finalization and operational revision tooling are schema/methodology contracts, not yet a scheduled production job.
- Data-quality components exist, but cross-source agreement is unavailable and the composite is withheld in one-source mode. Block-bootstrap uncertainty is designed but not yet used live.
- Optional Node-API and pybind11 source boundaries exist. This Windows image lacks Node/Python development headers, so local binding binaries were not built; CI owns the supported Linux compile path.
- C++ property testing covers deterministic hostile bytes and extreme combining input, but a coverage-guided libFuzzer corpus/job is not yet present.
