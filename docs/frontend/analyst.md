# Analyst mode (`/analyst`)

## Purpose

Explain *why* an asset moved (spec §157): is it prevalence or speculation, broad or concentrated, accelerating, is the data trustworthy, what correlates with it. TradingView-style single-instrument workstation, not Bloomberg cosplay — the spec is explicit that Analyst should avoid Bloomberg's exact branding/layout/density (§30); that wall-of-tiles density is reserved for Quant instead.

## Layout (`pages/Analyst.tsx`)

- **Symbol header**: emoji, ticker, name, REFERENCE/MARKET/BASIS, a "Trade →" link into Casual (Analyst doesn't duplicate the order ticket).
- **Main chart**: the real `PriceChart` (pan/zoom/live, not the static SVG sparkline) showing the daily reference-index history, with key stats (1D/7D/30D/90D momentum, 30D volatility, beta) directly beneath it.
- **Watchlist sidebar** (`components/Watchlist.tsx`): all 19 assets, live WS prices, click to switch instrument without leaving Analyst mode.
- **Tab strip** for secondary panels — Heatmap, Scatter, Correlations, Pairs, Events, Platforms, Semantics, Data quality, Backtest — replacing an earlier stacked-grid layout that needed 6+ screens of scrolling.

## Analyst tools, all real data

- **Heatmap** (`components/UniverseHeatmap.tsx`): all 19 assets, tile color intensity from real daily change — the classic sector/market-map view. Tile size is deliberately uniform since there's no market-cap-equivalent to size by honestly.
- **Scatter** (`components/ScatterPlot.tsx`): cross-sectional 30D volatility vs. 30D momentum across the universe, one REST call per asset's own analytics (spec §74). Click a point to open that expression.
- **Correlation matrix**: 90D Pearson, all 10 tickers the backend's `/analytics/correlation` provides.
- **Pair monitor**: CRY/SKULL ratio, correlation, z-score, relative momentum.
- **Events**: real per-asset dataset narrative events (`/assets/:ticker/history`'s `events` field), explicitly labeled as dataset events rather than live signal-tape events.
- **Platforms / Semantics / Data quality**: per-platform usage, semantic composition, and the Phase 4.1 `mappedEngagementRate` coverage metric — each independently `N/A` if the backend didn't supply it.
- **Backtest**: runs the real deterministic momentum backtest on demand.

The terminal command input navigates on Enter (`TICKER<Enter>` → `/analyst/TICKER`).

## What's not built yet

- Cascade table (spec §37) — the backend now computes real recursive depth/branching factor (`BehaviorAccumulator::cascades()`, Phase 4.1) but it isn't exposed through a REST endpoint yet.
- Signal event feed with σ-magnitude events and click-to-jump onto the chart (spec §36) — current events are dataset narrative events, not live signal-tape events.
- Explicit 😭-vs-💀 comparison view, CULT-wide market internals, Analyst portfolio/risk view (spec §38, §40, §43).
- PCA/factor surfaces (spec §75-76) — would need more live history than currently exists to be honest, per the spec's own "requires 30 days of valid history" instruction.

## Data trust

The "Data quality" tab is the honesty backbone of this mode — it's what tells an Analyst user whether to believe the other panels, per spec §41's stated purpose.
