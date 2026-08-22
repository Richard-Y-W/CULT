# Cascade methodology

A cascade is a privacy-safe internal graph rooted in an expression-bearing creation. Snapshots retain internal root/parent identifiers, size, depth, breadth, lifetime, last event time, and decayed attention. They do not require durable handles or profiles.

Depth is computed recursively — `depth(child) = depth(parent) + 1` for arbitrary reply/quote/reply chains (`cult::expression::BehaviorAccumulator::apply`, `cpp/src/expression/behavior.cpp`) — not a has-any-parent cap. When an event's parent lies outside the observed window (e.g. its own creation was never seen), depth falls back to one level below an implicit, unobserved root; this is a documented approximation, not silent miscounting. `BehaviorAccumulator::cascades(expression_id)` exposes per-cascade `size`, `depth`, `breadth`, `lifetime_ns`, and `branching_factor` (edges ÷ posts with at least one child; `0.0`, not fabricated, when fewer than two posts or no observed edges exist).

For active cascade attention shares `s_j`:

```text
HHI = Σ s_j²
effective cascades = 1 / HHI
```

Largest, top-five, and top-ten shares diagnose concentration. A broad shock and one viral post can have similar total engagement but different effective cascades. Concentration is a diagnostic/down-weighting input; CULT does not silently censor authors using an opaque bot score.
