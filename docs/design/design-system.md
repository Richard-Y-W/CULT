# Design system

Tokens live in `apps/web/src/styles/tokens.css` as CSS variables. Components reference tokens, never literal colors/spacing/durations. This document explains what each group is for and when to reach for it; it is not a duplicate of the CSS file.

## Typography

- `--font-ui` (DM Sans) for interface text and labels.
- `--font-mono` (IBM Plex Mono) for prices, tickers, timestamps, and anything Quant/Analyst-dense — financial software reads as precise when numbers are monospaced and aligned.
- `--font-display` (Instrument Serif) is reserved for large editorial moments (Casual hero, expression-of-the-day) — not for dashboards or panels.
- Apply `.cult-numeric` to any container of price/quantity/P&L text so digits don't shift width as they change (`font-variant-numeric: tabular-nums`).

## Color

- Surfaces (`--bg-primary/secondary/tertiary`) and borders (`--border-subtle/strong`) are neutral by design — CULT does not use gradients or glassmorphism for structure.
- `--positive`/`--negative` are the buy/sell and price-direction convention only. They must never be reused for data-quality or system status.
- Data quality / system health uses `--informational`/`--warning`/--critical` instead — HIGH/MEDIUM/LOW/DEGRADED get their own visual language, not a repurposed green/red.
- `.cult-dark` remaps the surface/border/text tokens to the dark palette; apply it to the Quant/Analyst root rather than hardcoding a second set of colors per component.

## Spacing & density

8 steps, 4px base (`--space-1` … `--space-8`). Casual can be roomier; Analyst/Quant lean toward the smaller steps for information density. Don't invent one-off pixel values.

## Radii & elevation

`--radius-sm`/`--radius-md` are intentionally small — this is financial software, not a SaaS marketing page; no giant rounded rectangles. `--elevation-1` is the one shadow token; if a component needs more visual separation, use a border (`--border-subtle`) before reaching for a second shadow.

## Motion

`--motion-fast` (120ms) for micro-feedback (price tint flash, button press), `--motion-normal` (200ms) for panel/route transitions, `--motion-slow` (320ms) for larger layout changes. All respect `prefers-reduced-motion` (durations collapse to 0ms). Motion interpolates *presentation* only — the authoritative value updates immediately underneath; see `apps/web/src/realtime/marketStore.ts` for the authoritative-vs-displayed-value split this implies.

## What NOT to do

No gradients as decoration, no glassmorphism, no giant border-radii, no card-grid-for-everything, no glow effects, no rainbow status colors, no gradient text, no emoji-as-decoration (emoji are the *assets being traded* — they earn their place; they are not UI chrome). If a screen could swap 😭 for TSLA and look like a generic fintech template, the design isn't distinct enough yet.
