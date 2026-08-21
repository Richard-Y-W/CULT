# CULT

> We measure and trade how the internet expresses itself.

CULT is a simulated market for emoji, emoticons, acronyms, slang, and reaction phrases. It is not a prediction market, cryptocurrency, real-money exchange, measure of humanity, or claim to observe the whole internet. The joke is the underlying asset; the measurement and accounting are intended to withstand inspection.

## Exact current state

| Classification      | Available now                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **LIVE**            | Authorized public Bluesky Jetstream collector; 30-emoji Unicode 17.0 registry; aggregate-only one-minute content/language strata; source lag/health and author concentration; calibration-gated standardization and official-close commands. Requires `CULT_DATA_MODE=live` and PostgreSQL.                                                      |
| **SYNTHETIC**       | Default deterministic 365-day product; Casual trading, reference/market charts, portfolio, leaderboard, curated indexes, semantic/platform decomposition, pair analysis, and momentum backtest.                                                                                                                                                  |
| **EXPERIMENTAL**    | Phase 3 research engine: standardization, Wilson/block-bootstrap uncertainty, seasonality, signal/noise, EWMA, market factors, residual/pair/event/IC diagnostics, walk-forward splits, index weighting, portfolio tails/costs, delayed C++ backtests, virtual liquidity/margin, immutable Parquet snapshots, and guarded Report 001 generation. |
| **NOT IMPLEMENTED** | A completed 7+ day empirical dataset/report, cross-platform index, production PCA/ADF scheduling, semantic classifier, production identity/billing, full PostgreSQL trading repositories, real money, or derivatives.                                                                                                                            |

Empirical Phase 2 output is explicitly **COIP coverage: 1 source / PROVISIONAL**. Semantic inference never enters the reference count.

## Quick start

Requires Node 20+.

```bash
npm run setup
npm run dev
```

Open http://localhost:5173. The local Analyst demo account begins with 10,000 CULT. API health is http://localhost:4100/health. Synthetic mode is the safe deterministic default.

PostgreSQL infrastructure:

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
```

Generate and verify data:

```bash
npm run generate:unicode
npm run generate:synthetic
npm run worker
npm run replay -- data/replays/bluesky/2026-08-21.jsonl
npm run calibrate:standardization -- CAL-2026-09 2026-08-01T00:00:00Z 2026-09-01T00:00:00Z
npm run close:official -- 2026-09-01
```

`npm run worker` consumes the recorded fixture in default synthetic mode. Live collection is explicit:

```bash
CULT_DATA_MODE=live DATABASE_URL=postgresql://cult:cult@localhost:5432/cult npm run worker
```

`npm run smoke:live` optionally validates one public Jetstream event without persistence or printing its text/actor identifier. It is manual and never part of CI.

The live worker stores aggregate observations, watermarks, and health—not handles, profiles, DIDs, or post bodies.

## C++ quant core

```bash
cmake -S cpp -B build/cpp -DCMAKE_BUILD_TYPE=Release
cmake --build build/cpp
ctest --test-dir build/cpp --output-on-failure
build/cpp/cult_benchmarks 1000000
build/cpp/cult_benchmarks 1000000 100
npm run test:differential
```

Targets are `cult_core`, `cult_expression`, `cult_analytics`, `cult_index`, `cult_market`, and `cult_backtest`. TypeScript remains the product layer and golden implementation while native calls migrate behind parity tests. Optional Node-API and Python build instructions are in [native bindings](docs/architecture/native-bindings.md).

## Quality commands

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run generate:synthetic
npm run smoke       # while npm run dev is running
```

The test suite includes market accounting, indexes, analytics, Unicode edge cases, hostile UTF-8 properties, ingestion fixtures, deterministic replay, backtest look-ahead protection, and C++/TypeScript differential checks. CI additionally runs PostgreSQL migration/seed, GCC, Clang, and ASan/UBSan jobs without live network dependencies.

## Architecture

```text
public events → validation → Unicode registry → window aggregates
             → source/quality diagnostics → reference index
             → analytics + simulated market → Casual / Analyst UI
```

The market depends on the measurement system; the measurement system does not depend on the market. PostgreSQL is the live system of record, JSONL is aggregate replay, Parquet is the research interchange format, C++ is compute, Python is research, and TypeScript is product/API.

Start with [COIP methodology](docs/methodology/coip.md), [standardization](docs/methodology/standardization.md), [data dictionary](docs/data-dictionary.md), [signal dictionary](docs/research/signal-dictionary.md), [Phase 3 audit](docs/audits/phase3-starting-state.md), [known limitations](docs/KNOWN_LIMITATIONS.md), and [roadmap](ROADMAP.md).

CULT currency has no cash value, redemption, transfer, prize, blockchain, or financial return.
