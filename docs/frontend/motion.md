# Motion

Tokens: `--motion-fast` (120ms), `--motion-normal` (200ms), `--motion-slow` (320ms), defined in `apps/web/src/styles/tokens.css` and collapsed to 0ms under `prefers-reduced-motion: reduce`.

> Animations interpolate visual state only and never create synthetic observations.

Concretely: `apps/web/src/components/useAnimatedNumber.ts` tweens the *rendered* text of a price between its previous and current authoritative value over a short duration, using `requestAnimationFrame`. The authoritative value itself (in `realtime/marketStore.ts`) updates immediately and is never delayed or smoothed — a hover, a refresh, or any consumer that reads the store directly always sees the true latest value, never an intermediate animated one. No component invents a data point that the server didn't send; the animation only decides how quickly a number's *display* catches up to a value that already changed.

The same principle will apply to any future chart/heatmap smoothing: interpolate the pixels, never the underlying series.

## What's implemented

- Price number tweening (`useAnimatedNumber`), used on the Casual asset page's market price.
- Price-change tint flash (`usePriceFlash`): a brief (250ms) positive/negative background tint on the price figure when it changes, then clears — not a permanent flashing state.
- `PriceChart` appends real points incrementally rather than redrawing — no interpolation needed there since `lightweight-charts` handles its own rendering.

## What's not implemented yet

- L2 book cell transitions (spec §103) — no L2 book exists yet (Quant mode is unbuilt).
