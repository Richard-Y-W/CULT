# Frontend

`apps/web` (React 19 + Vite + `react-router-dom`). This document describes what actually exists; see `docs/BUILD_LOG.md` for the change history and the mode docs (`casual.md`/`analyst.md`/`quant.md`) for what each mode does and doesn't cover yet.

## Architecture

```
apps/web/src/
  app/         Shell.tsx -- global nav, mode switcher, connection indicator, search
  pages/       one file per route (Home, Asset, Portfolio, Leaderboard, IndexPage, Analyst, Quant)
  components/  reusable pieces (PriceChart, Spark, Change, InfoTip, useAnimatedNumber)
  realtime/    connectionManager.ts (WebSocket lifecycle), marketStore.ts (Zustand)
  lib/api.ts   REST fetch helper + formatting (money/pct)
  styles/      tokens.css (design tokens), shell.css (new-component styles)
```

The frontend never computes financial math. Every number rendered comes from a REST response or a WebSocket payload; the only client-side arithmetic is presentation (percentage formatting, price interpolation for animation — see `motion.md`).

## State

Two kinds of state, kept deliberately separate (spec §12):

- **REST/slow state**: `lib/api.ts`'s `useApi` hook, one fetch per page/section. No caching layer beyond React state — traffic is low enough that it isn't needed yet.
- **Realtime/high-frequency state**: `realtime/marketStore.ts`, a Zustand store. Components subscribe with selectors (`useInstrument(assetId)`, `usePriceHistory(assetId)`, `useConnectionState()`) so a tick for one asset only re-renders the components actually showing that asset, not the whole page.

## WebSockets

See `realtime.md`. One endpoint today: `/ws` on the API server, one channel (`"market"`). `ensureRealtimeConnected()` (called once, from `Shell`) owns the singleton `ConnectionManager`.

## Charts

`lightweight-charts` (canvas-based) is the one charting library, used by `components/PriceChart.tsx`. It appends points incrementally rather than recreating the chart, and exposes `LIVE ●` panning-resume behavior (spec §10). Non-price sparklines (index history, correlation-adjacent small series) use the hand-rolled `Spark` SVG polyline — deliberately not a second charting library, since it's a 20-line component with no interactivity needs. Canvas/WebGL for the depth heatmap and large correlation matrices is not built yet (Quant mode is unbuilt).

## Modes

`/trade` (Casual), `/analyst`, `/quant` — see the mode docs. The mode switcher and routes exist; content is filled in per the priority order in `docs/BUILD_LOG.md`, not all at once.

## Design system

`docs/design/design-system.md` + `apps/web/src/styles/tokens.css`. No hardcoded colors in code written since that doc was added; the original `styles.css` (ported Casual/Analyst layout CSS) still has literal hex values and is being migrated incrementally as pages are touched, not rewritten wholesale.

## Performance

Selectors (above) avoid whole-app re-renders on every tick. Chart history is capped at 600 points client-side (`MAX_HISTORY_POINTS` in `marketStore.ts`) — long history is a server concern, not a browser-memory one. No virtualization exists yet because there's no long list/table that needs it yet (Quant's tapes will need it when built).

## Testing

None yet at the frontend layer (no component/E2E tests). This is a known gap — see `docs/KNOWN_LIMITATIONS.md`. Backend/engine tests (`npm test`) cover the C++/TS domain logic the frontend renders.
