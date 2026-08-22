# Build log

## 2026-08-21 — Price-scale unification + synthetic volatility recalibration

Two real bugs identified from direct comparison of Analyst/Quant screenshots, fixed before any further HFT/live-data work:

- **Price-scale mismatch**: the Great Cry Shock scenario's L2 book was seeded at a hardcoded ~1000 ticks regardless of the selected instrument's actual price — so Analyst/Casual showed CRY at ~8,421-8,496 while Quant's MID/μPX simultaneously showed ~1001.5, two disconnected price universes for the same asset. Fixed by adding a `reference_price`/`referencePrice` parameter to `run_great_cry_shock` (C++, `cpp/src/exchange/simulator.cpp`) and `createPhase4Demo` (TS, `packages/hft-engine/src/index.ts`) — the book, reference/basis calculation, and pre-trade-risk account/exposure limits (which had to scale proportionally too, or leverage checks would misfire at a different price scale) now all derive from the instrument's actual current price. `apps/api/src/server.ts` passes CRY's real `marketPrice` (the same value `SimulatedMarket` trades against) when constructing the scenario at startup. The 1000.0/1000 default is preserved so existing unit/scenario fixtures (`cpp/tests`, `tests/phase4-hft.test.ts`) keep working unchanged. Verified end-to-end: `/api/v1/quant/assets/CRY/flow` midpoint (8428.5) now matches `/api/v1/assets/CRY` marketPrice (8428.07) to within a tick.
- **Synthetic index over-volatility**: the daily-return generator (`packages/expression-engine/src/synthetic.ts`) clamped its per-day log-return to ±16-18% with AR(0.6) persistence that compounded shocks across days — large double-digit daily moves were routine, not rare, which both geometrically explodes a chain-linked index over a year and desensitizes "a big move happened" as a signal. Recalibrated: smaller base volatility, much weaker persistence (0.6→0.2), and an explicit rare-jump term (~1%/day probability, 5-12% magnitude) separating "genuine shock" from "routine noise" instead of relying on a huge clamp ceiling to produce big moves. Also reduced `packages/shared/src/assets.ts`'s hardcoded per-asset `dailyChange` seed constants (previously 0.4-18.2%, now 0.2-6.4%), since those feed both the "today" badges and the live WS engine's `previousClose` baseline. Verified against the reference-index formula (log-return chain-linking, base-1000 level) unchanged — only the calibration changed, not the methodology. Measured post-fix distribution: 74.8% of asset-days under 1% move, 98.6% under 3%, only 1.0% in the 6-15% "major shock" band, 0% ever reaching 15%+ — matching the target "quiet most of the time, genuine rare shocks" distribution.
- Both fixes are explicitly documented as scenario/calibration assumptions to be replaced once real Bluesky history exists, not a claim about actual emoji dynamics.
- Verified: full C++ `ctest`, `tsc -b`, `npm run lint`, `npm run build`, `npm test` (52 tests), `npm run test:differential` (25 metrics) all pass.

## 2026-08-21 — Quant mode: Bloomberg-dense, real HFT data, real candles

Built out Quant mode (previously a placeholder) using data that already existed in the Phase 4.1-hardened backend but had no UI: the `/api/v1/quant/*` routes serving the canonical "Great Cry Shock" scenario (real expression/signal/market tapes, L2 depth snapshot, microstructure, and — notably — the actual `PreTradeRisk::check` decision from the pipeline that replaced the old information→order shortcut).

- **Candlesticks, answered honestly**: added `realtime/candles.ts` (buckets real observed WS ticks into OHLC — open/high/low/close are genuine values, never invented) and `components/CandleChart.tsx` (lightweight-charts `CandlestickSeries`). This only works for the live session window since there's no intraday history before the browser connected; the panel says so and starts empty rather than backfilling with fabricated history.
- **Two data sources, clearly separated**: a green "● LIVE" section (real WS ticks, candles, universe heatmap) and a grey "◼ FIXED SCENARIO REPLAY" section (the Great Cry Shock run, explicitly labeled not-live, since it's one deterministic historical computation from server startup, not an interactive venue) — spec §15/§129's data-mode-honesty requirement applied at the section level, not just a badge.
- **Panels, all real data, none fabricated**: L2 order book ladder, microstructure (spread/microprice/L1+L5 imbalance/OFI), pre-trade risk (decision/exposure/leverage/margin), latency model, behavior/cascades (amplification/propagation/HHI/liquidity tier), plus the three event tapes with a real per-row mount animation (500ms flash, honors `prefers-reduced-motion`) communicating "this is a stream."
- **No interactive order entry.** Deliberately omitted: the HFT engine has no live HTTP/WS exposure (`SimulationHandle` is C++-only per Phase 4.1), and the scenario is a fixed historical result — a "submit order" control here would necessarily be fake or a no-op, which the no-dead-controls rule forbids. Documented as the actual next backend+frontend project rather than faked.
- **Real bug caught and fixed during this build**: `lib/api.ts`'s `request()` helper unwraps a top-level `data` envelope (`j.data ?? j`); five of the new panels (L2 book, microstructure, risk, latency, behavior) were written expecting a `{data: ...}` wrapper on top of that already-unwrapped value, so they rendered empty. Fixed by reading the unwrapped value directly; verified via screenshot before/after.
- Verified: WebSocket server independently checked healthy via a raw `ws` client (sequence numbers confirmed continuously incrementing past 53,000+) after a screenshot showed a spurious "DISCONNECTED" — traced to resource contention from many concurrent headless-Chrome verification screenshots in one session, not a product bug. Full `tsc -b`, `npm run lint`, `npm run build`, `npm test` (52 tests) all pass.

## 2026-08-21 — Analyst visual pass: actually TradingView, not "dark terminal"

The previous restructure was TradingView-shaped (chart + watchlist + tabs) but still looked wrong — direct feedback: "ugly, nothing like TradingView." Root causes, identified by comparing panel-by-panel against a real TradingView screenshot rather than going on vibes:

- **Typography**: every label was set in IBM Plex Mono, including panel titles, tab labels, and watchlist names — reads as a DOS/hacker terminal, not a charting app. Switched chrome/labels to DM Sans; monospace is now reserved for actual numeric values (prices, percentages, stats, correlation cells) via one combined selector in `styles.css`.
- **Palette**: near-black/green-tinted background (`#0d100e`) replaced with TradingView's actual dark blue-grey (`#131722` base, `#161a25` panels, `#2a2e39` borders, `#2962ff` accent, `#089981`/`#f23645` up/down) — applied consistently across `styles.css`'s `.terminal` rules, `shell.css`'s Analyst-specific rules, `PriceChart` (new `dark` prop), `ScatterPlot`, and the correlation matrix cell colors.
- **Chart**: switched from a plain `LineSeries` to `AreaSeries` with a gradient fill (`components/PriceChart.tsx`) — the standard TradingView-style treatment for a non-candlestick line chart. (True candlesticks would need OHLC data we don't have per period; synthesizing fake highs/lows to look like candles would violate the no-fabricated-data rule, so this stays an area chart, honestly.)
- **Heatmap tiles**: were near-fully-saturated neon green/red blocks ("Wordle tiles"). Muted the fill opacity range and switched to the TradingView up/down hex values so intensity still tracks real daily change but reads as a professional sector map, not a crypto-casino grid.
- **Real bug**: `Watchlist` rows showed each asset's full `canonicalExpression` in a fixed-width slot; for phrase-type assets ("we're cooked", "we're so back") this wrapped and collided with the ticker text next to it — same root cause the heatmap tiles had already been fixed for, just not applied to the watchlist. Replaced with TradingView's actual pattern: a small colored badge (the emoji for EMOJI-type assets, a deterministic colored letter tile for PHRASE/ACRONYM/SLANG assets) that can't overflow.
- Verified via headless Chrome screenshots at a settled load state (confirmed empty-chart/zero-heatmap captures earlier in this session were a screenshot-timing race, not a product bug, by re-capturing with more wait time). Full `tsc -b`, `npm run lint`, `npm run build`, `npm test` (52 tests) pass.

## 2026-08-21 — Analyst restructure: TradingView-style, not Bloomberg-cosplay

Direct feedback: Bloomberg-style density was reserved for Quant (deferred); Analyst should read as a TradingView-style single-instrument workstation instead — which is actually closer to what the original spec asked for (§30 explicitly says "not Bloomberg cosplay").

- Fixed a real bug: `lightweight-charts`' TradingView attribution watermark was showing on every chart. Disabled via `layout.attributionLogo: false`.
- Removed the Bloomberg-style scrolling ticker tape and the scroll-to-anchor rail from Analyst; replaced with a real live `Watchlist` sidebar (`components/Watchlist.tsx`, all 19 assets, live WS prices, click to switch instrument) and a tab strip for secondary panels (previously a stacked grid of 8 tiles requiring 6+ screens of scroll).
- Main view is now chart-first: the daily reference-index history renders through the real `PriceChart` (pan/zoom/live) instead of the static `Spark` SVG, with key stats (momentum/vol/beta) directly beneath it — the TradingView "symbol + chart + key stats" pattern.
- Added two more real analyst tools, both explicitly requested and both genuinely useful, not decorative: `UniverseHeatmap` (all 19 assets, tile color from real daily change — the classic sector/market-map view) and `ScatterPlot` (cross-sectional 30D volatility vs. 30D momentum across the universe, fetched from each asset's own analytics, click a point to open that expression). Expanded the correlation matrix from 9 to all 10 tickers the backend provides.
- Re-themed the terminal's brand/chrome color from a hacker-green (`#aaff70`) to a cooler blue (`#4fa3ff`), keeping green/red strictly for price direction — closer to TradingView's palette than the previous everything-is-green look.
- Fixed a real layout bug introduced mid-session: the new "Trade →" CTA was absolutely-positioned on top of the price display, producing garbled overlapping text. Fixed by making it a normal flex sibling instead.
- Fixed heatmap tiles for non-emoji (PHRASE/ACRONYM/SLANG) assets: showing the full phrase as large tile text caused wrapping/overlap with the ticker beneath it; now only true emoji assets get the large-glyph treatment.
- Verified via headless Chrome screenshots (still no interactive DevTools this session) — caught both real bugs above this way, and confirmed a page-load-timing false negative (an empty chart/heatmap on one capture) was a screenshot-race artifact, not a product bug, by re-capturing with more settle time. Full `tsc -b`, `npm run lint`, `npm run build`, `npm test` (52 tests) all pass.

## 2026-08-21 — Visual pass: Casual "moving thing," Analyst density

Direct visual feedback (screenshots compared against Kalshi/Bloomberg references):

- Fixed a real bug in `Spark`: the SVG had no explicit height, so it stretched to fill its container width at the viewBox's 400:220 aspect ratio — rendering ~900px tall instead of the intended 220px. This alone was the single biggest cause of "too much whitespace, not dense enough" across Home, Asset, and Analyst.
- Tuned `MarketTickEngine`'s `VirtualLiquidityProvider` parameters (`apps/api/src/realtime.ts`): meanReversion 0.015→0.08, orderFlowImpact 0.02→0.006, shockVolatility 0.4→0.015, shock probability 2%→0.4%/tick. The prior settings made price/reference basis an effectively-unbounded random walk over a long-running session (observed a 74% divergence after ~30 minutes uptime); the market/reference basis is now a stationary, bounded process regardless of session length.
- Casual home: replaced the static marketing-copy hero with a live "Trending Now" featured-market panel (biggest mover, real live chart, real price) — addressing "no big moving thing in the center" relative to Kalshi's featured-market pattern.
- Analyst: added a Bloomberg-style live ticker tape strip (`components/TickerStrip.tsx`) across the top; widened `.term-grid` from a fixed 2-column to `repeat(auto-fit, minmax(320px,1fr))` so wide screens pack 3 columns instead of 2; tightened panel padding, grid gaps, and the overview chart height. The page now shows all 8 panels in roughly one viewport at 1800×1100 instead of requiring 6+ screens of scrolling.
- Verified: full `tsc -b`, `npm run lint`, `npm test` (52 tests) pass. Visually verified via headless Chrome screenshots (no interactive DevTools access this session) of Home and Analyst before/after.

## 2026-08-21 — Phase 5 Casual/Analyst polish + frontend docs

- Casual asset chart: real Market/Reference toggle and 1H/1D/1W/1M/ALL ranges (1H from the live WS tick history, longer ranges from the REST daily series; Reference's 1H tab is disabled with an explanation rather than faked, since no live reference tick source exists). `InfoTip` component explains MARKET vs REFERENCE inline (spec §29).
- Casual order ticket: replaced the single fill-or-error message with a real state machine (`sending`/`filled`/`rejected`), each showing the actual server response — never an instant "trade complete" claim.
- Casual home: asset cards now sorted by real |daily change| ("what's moving") instead of arbitrary array order; added a Biggest Movers gainers/losers list and surfaced each index's real `methodologyClassification` (Curated/Rules-based/Data-driven/Experimental) badge, which existed in the type and data but was previously unused in the UI.
- Analyst: added an Expression Events panel using `/assets/:ticker/history`'s `events` field (real per-asset dataset events, previously fetched and discarded), explicitly labeled as dataset narrative events rather than live signal-tape events.
- Added a price-change tint flash (`components/usePriceFlash.ts`, spec §9) — 250ms, then clears, never a permanent flash.
- Added `docs/frontend/{README,casual,analyst,quant,realtime,motion}.md`, each describing what's actually built vs. explicitly still missing (Quant mode's doc is intentionally almost entirely a gap list, matching its unbuilt UI).
- Verified: full `tsc -b`, `npm run lint`, `npm run build`, `npm test` (52 tests) all pass; new/changed files confirmed to transform cleanly through the Vite dev server. No browser/DevTools access this session.

## 2026-08-21 — Phase 5 foundation: design tokens, realtime pipe, app shell

- Added `apps/web/src/styles/tokens.css` (CSS variable design tokens: surfaces, borders, text, semantic status, spacing, radii, elevation, motion) and `docs/design/design-system.md`. Existing hardcoded-hex styling is left in place for now but new components are built exclusively on tokens.
- Added a real WebSocket price feed: `apps/api/src/realtime.ts` attaches a `/ws` endpoint to the existing `http.Server`, broadcasting `FeedEnvelope<MarketTickPayload>` (`packages/hft-engine`, new `"market"` channel) once per second for all 19 assets, driven by the existing, already-tested `VirtualLiquidityProvider` (`packages/market-engine`) rather than inventing new price math. Every message carries `dataMode` (`SYNTHETIC` by default) and a monotonic sequence number; heartbeat/stale-socket cleanup included.
- Added a frontend realtime layer: `ConnectionManager` (`apps/web/src/realtime/connectionManager.ts`, reconnect with backoff, staleness detection, per-channel sequence-gap flagging) and a Zustand `marketStore` (`apps/web/src/realtime/marketStore.ts`, normalized per-asset ticks + capped 600-point history, selector-based subscriptions).
- Replaced the fabricated client-side sparkline noise (`Math.sin(...)`) on the Casual home page with the real WS-driven series, and rebuilt the asset page (`apps/web/src/pages/Asset.tsx`) around a `lightweight-charts`-based `PriceChart` (`apps/web/src/components/PriceChart.tsx`) that appends points incrementally, distinguishes authoritative vs. displayed (animated) price, and shows a LIVE resume control instead of auto-snapping when the viewer has panned away.
- Rebuilt the app shell (`apps/web/src/app/Shell.tsx`) with `react-router-dom`: `/trade`, `/analyst`, `/quant` mode switcher, connection/data-mode indicator, and a working `/` `Ctrl/Cmd+K` asset search. Split the former single 925-line `main.tsx` into `pages/`/`components/`/`realtime/`/`lib/` modules.
- Ported the existing Casual (Home/Asset/Portfolio/Leaderboard/Index) and Analyst (former "Terminal") pages onto the new router/tokens rather than discarding their real, REST-backed functionality. While in the Analyst page, removed a non-functional 12-item workspace rail (only "Overview" ever did anything) and a decorative, unwired command input — replaced with a trimmed rail wired to real section anchors and a command input that actually navigates on Enter, per the no-dead-controls requirement. Quant mode ships as one honestly-labeled "not built yet" screen rather than a populated-looking placeholder.
- Verified: WebSocket connection manually exercised end-to-end (25 sequential ticks across all 19 assets, correct `dataMode`/sequencing observed), all REST endpoints the new pages call return 200, every new/changed source file transforms cleanly through the Vite dev server, full monorepo `tsc -b`, `npm test` (52 tests), `npm run lint`, and `npm run build` all pass. No browser/DevTools access was available this session, so interactive/visual verification (click-through, LIVE-button pan behavior, mobile layout) was not performed and remains outstanding.
- Known limitations: full Casual home/portfolio/leaderboard/index redesign, Quant mode content, command palette beyond search, watchlist, notifications, workspace persistence, and delta-channel (L2) sequence-gap snapshot recovery are all still outstanding — see the plan's explicit scope-deferral list.

## 2026-08-21 — Phase 4.1 live/integration hardening

- Made post → expression attribution durable across worker restarts: `post_attribution_map` (migration `005_phase4_1_attribution.sql`, HMAC-keyed record/cascade-root identities, default 14-day retention via `CULT_ATTRIBUTION_RETENTION_DAYS`), a new `AttributionStore` (`apps/worker/src/attribution.ts`) replacing the parser's raw-URI in-memory maps, warm-start restore on startup, and periodic expiry cleanup.
- Added a measured engagement-attribution coverage metric (`mappedEngagementEvents`/`eligibleEngagementEvents` on `SourceHealth`, persisted to `source_health_snapshots_v2`, exposed as `mappedEngagementRate` on `GET /api/v1/data/status`) instead of silently dropping unresolved likes/reposts/replies/quotes.
- Fixed cascade depth (`cpp/src/expression/behavior.cpp`) from a has-any-parent boolean capped at 2 to true `depth(child) = depth(parent) + 1` recursion over arbitrary reply/quote chains; added `BehaviorAccumulator::cascades()` exposing per-cascade size/depth/breadth/lifetime/branching_factor.
- Replaced the Great Cry Shock scenario's direct information → order conversion (both C++ `run_great_cry_shock` and the TypeScript `createPhase4Demo` parity implementation) with the documented pipeline: a real `SignalEvent`, an `EventDrivenAgent` reacting to it after sampled agent latency, `PreTradeRisk::check` (previously implemented, never called) after sampled order latency, and only then an order reaching the book. Fixed `ScenarioReport.signal_events`, previously a hardcoded `3U`, to the real signal-tape count.
- Added a coarse, header-only C++ simulation facade (`cult::exchange::SimulationHandle`, `cpp/include/cult/exchange/simulation_api.hpp`) wrapping `LimitOrderBook`/`BehaviorAccumulator` for replay/L1/L2/tape/microstructure/risk access; Node-API/pybind11 exposure deliberately deferred (cannot be compile-verified on this Windows image).
- Verified: full C++ test suite (`ctest`, including new recursive-depth, pre-trade-risk-rejection, and `SimulationHandle` coverage), full `npm test` (52 tests), `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:differential` (25 metrics), and both `npm run hft:demo` / `npm run replay:hft` (deterministic, unchanged output hash for the accept path).
- Updated `docs/architecture/live-ingestion.md`, `docs/methodology/engagement.md`, `docs/methodology/cascades.md`, `docs/architecture/native-bindings.md`, `docs/architecture/hft-simulator.md`, `ROADMAP.md`, and `docs/KNOWN_LIMITATIONS.md` to match.
- Known limitations: `expression_events`/`cascade_snapshots` are still not written by the live TypeScript worker (only the C++/Python scenario path touches them); no 72-hour/7-day live-shadow campaign has been run; `SimulationHandle` has no Node/Python binding yet.

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

## 2026-08-21 — Dockerized Bluesky live-shadow runbook

- Added a dedicated Node 20 worker image and opt-in Compose `live-shadow` profile. It starts PostgreSQL, runs migrations to completion, and only then starts the Jetstream collector with `CULT_DATA_MODE=live-shadow` fixed in the container configuration.
- Added a persistent `cult_live_data` volume for aggregate replay tapes, privacy-safe behavior events, and cursor checkpoints. The checkpoint path is now configurable without changing the local default.
- `docker compose --profile live-shadow config`, TypeScript lint/typecheck, and all 51 tests passed. An actual container build/start could not run because Docker Desktop's server daemon remains unavailable on this machine.
- `live-market` remains disabled; this deployment profile cannot turn it on.
