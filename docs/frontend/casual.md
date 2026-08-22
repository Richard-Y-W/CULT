# Casual mode (`/trade`)

## Purpose

Understand in five seconds, per spec §156: what is this, what's moving, can I buy/short it, how am I doing. Casual hides quant/analyst complexity entirely rather than showing a simplified version of it.

## What's built

- **Home** (`pages/Home.tsx`): "What's moving today" — 8 asset cards sorted by absolute daily change (not arbitrary order), each with a real sparkline once the live feed has accumulated ≥2 points for that asset (otherwise a neutral pending state, never a fabricated shape). A "Biggest movers" gainers/losers list. Cultural indexes with their real `methodologyClassification` badge (Curated/Rules-based/Data-driven/Experimental) — not decorative.
- **Asset page** (`pages/Asset.tsx`): live-streamed price via the WebSocket feed (falls back to the REST snapshot only before the socket has ticked that asset — never shows two different numbers for the same asset at once). Market/Reference chart toggle with 1H/1D/1W/1M/ALL ranges — 1H is the live tick series; longer ranges use the daily REST history; Reference has no live tick source yet, so its 1H tab is disabled with an explanation rather than silently substituting stale data. `InfoTip`s explain MARKET vs REFERENCE inline (spec §29).
- **Order ticket**: BUY/SHORT, quantity, estimated execution price and notional computed from the live authoritative price. Feedback is a real state machine (`sending` → `filled` with the actual fill price and quantity, or `rejected` with the actual server error) — never an instant "trade complete" claim, and never a fabricated "resting" state, since the backend fills immediately or rejects (no partial-fill/queue model exists in the simple execution path).
- **Portfolio, Leaderboard, Index detail**: ported from the original build, backed by real REST endpoints (`/portfolio`, `/leaderboard`, `/indexes/:ticker`).

## What's not built yet

- Portfolio summary / "interesting activity" tile on Home.
- Mobile-specific polish pass (responsive CSS exists from the original build but hasn't been re-audited against the new shell).
- Watchlist / favorites.
- Order-fill notifications.

## Explicit non-goals for this mode

Beta, Hawkes branching ratio, OFI, queue depth, and other Quant-only metrics never appear here (spec §21) — that's what Analyst/Quant are for.
