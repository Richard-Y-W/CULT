# Data-quality diagnostics — DQ-1

Data quality is first a vector: sample adequacy, source coverage, source health, cross-source agreement, author concentration, and missingness. An unavailable component is `N/A`, never a convenient perfect score. A future composite would be an operational score—not a confidence probability—and requires separately published weights.

COIP-1.1 cannot measure cross-source agreement and has only one-source coverage. Empirical results therefore remain provisional. Phase 3 deliberately returns `composite: null`; it does not average whichever convenient components happen to exist.

Author diagnostics include approximate unique authors, largest-author share, top-ten-author share, and effective authors:

```text
N_eff = (Σ_a c_a)^2 / Σ_a c_a^2
```

This detects concentration; it is not a bot classifier. CULT does not quietly censor authors using an opaque score. Actor identifiers are HMACed with an ephemeral per-window key and discarded after aggregation.

Source health states are `HEALTHY`, `DEGRADED`, `STALE`, `DISCONNECTED`, and `BACKFILLING`. Metrics include event/receive timestamps, p50/p95/p99 lag, event rate, parse errors, duplicates, and reconnects. Wilson proportion intervals and deterministic moving-block bootstrap infrastructure are implemented. A block interval is not materialized for every live tick, and stronger historical uncertainty still requires an empirically selected block length.
