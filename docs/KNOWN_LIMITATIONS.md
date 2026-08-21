# Known limitations

- All usage, semantic labels, events, prices, and platform statistics are synthetic.
- No live public-source ingestion or claim about the real internet is made.
- API runtime state is process-local and resets on restart; PostgreSQL adapters are not wired to requests yet.
- The initial PostgreSQL migration and seed scripts were not executed in this build environment because its Docker daemon was unavailable; they require a live PostgreSQL 16 instance for verification.
- Authentication is a development cookie/account, not production identity infrastructure.
- Execution is immediate against a simulated quote; no order book, borrow availability, market impact, or concurrency control.
- Backtests use daily synthetic closes, three bundled strategies at package level, and no borrow costs. The UI runs momentum only.
- Cultural baskets contain fewer constituents than their names imply; custom indexes have a schema boundary but no editor yet.
- Semantic labels are synthetic, English-oriented examples and support no demographic inference.
- No billing, prizes, redemption, transfers, blockchain, payments, derivatives, export, or real-money functionality.
- No production rate limiter, Redis, TimescaleDB, ClickHouse, scraping fleet, or large-scale analytics store.
- UI charts are dependency-light SVG polylines and have limited interaction/accessibility.
