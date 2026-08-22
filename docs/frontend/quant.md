# Quant mode (`/quant`)

## Purpose

Investigate *how* the market moved (spec §158): what happened at event time, what signal fired, how L2 changed, microprice, OFI, queue/risk, why an order filled the way it did. Bloomberg-dense — deliberately the opposite typography/density choice from Analyst's clean TradingView-style sans-serif; Quant is monospace-heavy, tight-grid, small tiles, because that density is explicitly allowed here (spec §44) where it was explicitly *not* wanted in Analyst.

## Two honestly-separated sections

Quant mixes two genuinely different data sources, and the page says so out loud rather than blurring them together:

- **LIVE** (green badge): the real WebSocket tick stream, 1Hz, all 19 assets — the same feed Casual/Analyst use. This section can never be faked; it either has real ticks or it visibly says so.
- **FIXED SCENARIO REPLAY** (grey badge): the canonical "Great Cry Shock" run from the Phase 4.1-hardened C++/TS pipeline (`packages/hft-engine`, `cpp/src/exchange/simulator.cpp`) — a real, deterministic, already-computed result of `signal → agent → latency → pre-trade risk → CULT-X`, served from `/api/v1/quant/*`. It is explicitly labeled **not live** — it's one historical run, not a live venue you can trade against, because that's what it actually is (`createPhase4Demo("great-cry")`, computed once at server startup). Currently only exists for CRY; other tickers show an honest note rather than fabricated scenario data.

## What's built

- **Live candles** (`components/CandleChart.tsx`, `realtime/candles.ts`): real OHLC bucketed from actually-observed WS ticks (open/high/low/close are all genuine values within each 10-second bucket) — not synthesized. This is honestly possible *only* for the live session window; there's no intraday history before the browser connected, so it starts empty and fills in as real ticks arrive. Answered directly: yes, candlesticks are possible, but only where real sub-daily observations exist.
- **Live universe heatmap**: same real component Analyst uses, all 19 assets, live WS-driven.
- **Expression Tape / Signal Tape / Market Tape (Time & Sales)**: the three real event tapes from the Great Cry Shock run, virtualized-ish scrollable lists, each new row gets a brief flash-in (500ms, fades, honors `prefers-reduced-motion`) — motion communicating "this is a stream," not decoration.
- **L2 Order Book**: a real depth ladder (BID / PRICE / ASK) from the scenario's actual post-run book snapshot.
- **Microstructure**: bid/ask/mid/microprice/spread/L1 & L5 imbalance/trade imbalance/OFI — all real `MicrostructureSnapshot` fields, not recomputed in the frontend.
- **Pre-Trade Risk**: the actual `PreTradeRisk::check` decision (`ACCEPT`/etc.), state, gross/net exposure, leverage, margin utilization — this is the literal Phase 4.1 hardening output (the same pipeline that replaced the old information→order shortcut), not a mockup.
- **Latency model**: feed/process/order/cancel timings from the scenario's configured `LatencyModel`.
- **Behavior/Cascades**: amplification, propagation, cascade HHI, effective cascades, breadth, data-liquidity tier — from the real `BehaviorState`.
- **Watchlist**: same live sidebar as Analyst, mode-aware (stays in Quant when you switch assets).

## What's not built yet

- **No interactive order entry.** The HFT engine's real live path (`SimulationHandle`) has no HTTP/WS exposure yet (see `docs/architecture/native-bindings.md`), and the Great Cry Shock fixture is a fixed historical result, not a live venue. A "submit order" button here would either be fake or would silently replay the same fixed scenario regardless of input — both violate the no-dead-controls/no-fake-metrics rules, so it's left out rather than faked. Wiring real interactive HFT (replay controller, strategy parameter controls, live order submission against `SimulationHandle`) is the next real backend+frontend project, not a UI-only add.
- **Depth heatmap** (spec §53, x=time/y=price/intensity=liquidity): the scenario only exposes one post-run depth *snapshot*, not a time series, so a genuine time×price heatmap isn't honestly buildable from current data. The L2 ladder above is the honest equivalent of what the data actually supports.
- Agent ecology view, replay controller, scenario selector, workspace persistence/dockable panels, P&L attribution waterfall, lead/lag and signal heatmaps, PCA/factor surfaces (§45-46, §63-83) — all still open.
