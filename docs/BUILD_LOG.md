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
