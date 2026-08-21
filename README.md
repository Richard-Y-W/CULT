# CULT

> We trade how the internet expresses itself.

CULT is a simulated market for expressions: emoji, emoticons, acronyms, slang, and short reaction phrases. It is not a prediction market, meme-stock clone, cryptocurrency, or measure of what humanity feels. V0 is a working, synthetic-data vertical slice with fake currency and no financial value.

## Current state

The Casual experience includes live-style expression cards, reference index versus market price, annotated history, BUY/SHORT tickets, portfolio P&L, cultural indexes, and a time-weighted-return leaderboard. `/terminal` adds platform and semantic decomposition, momentum, volatility, correlations, pair statistics, and a functional momentum backtest. The API and domain packages are typed; accounting is ledger-based; PostgreSQL has a complete initial schema. Runtime state is intentionally in-memory in V0, while database migrations establish the persistence contract.

## Quick start

Requires Node 20+.

```bash
npm run setup
npm run dev
```

Open http://localhost:5173. The local account `demo@cult.local` is pre-authenticated with the `ANALYST` tier and 10,000 CULT. API health is at http://localhost:4100/health.

Optional PostgreSQL:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
```

Docker Desktop (or another running Docker daemon) must be available for the Compose command. V0’s demo runtime does not require PostgreSQL; see known limitations for the persistence status.

Quality commands:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run generate:synthetic
npm run smoke # while npm run dev is running
```

`generate:synthetic` writes the deterministic dataset to `data/synthetic/market-v0.json` using seed `20260821`.

## Architecture

This npm-workspaces monorepo contains:

- `apps/web`: React/Vite Casual and Analyst experiences
- `apps/api`: versioned Node HTTP API, validation, dev session, and demo runtime
- `packages/expression-engine`: normalization, objective metrics, semantic interface, synthetic generator
- `packages/market-engine`: quotes, fills, positions, short accounting, fees, and append-only ledger
- `packages/index-engine`: weights, caps, immutable compositions, and index values
- `packages/analytics`: returns, risk statistics, pairs, and backtests
- `packages/db`: PostgreSQL migration and exact-money conversion boundary

The core boundary is inviolable: observed usage produces the Expression Index; semantic inference is analysis only; users transact at a separate simulated Market Price.

## Screenshots

Screenshots will be added after the first visual QA pass. The application itself is the authoritative V0 demo.

Read [system overview](docs/architecture/system-overview.md), [methodology](docs/methodology/expression-index.md), [known limitations](docs/KNOWN_LIMITATIONS.md), and [roadmap](ROADMAP.md).
