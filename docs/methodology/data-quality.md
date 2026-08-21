# Data-quality diagnostics — DQ-1

The data-quality score is an operational composite, not a confidence probability. Its displayed components are sample adequacy, source coverage, source health, cross-source agreement, author concentration, and missingness. An unavailable component is `N/A`, never a convenient perfect score.

COIP-1 cannot measure cross-source agreement and has only one-source coverage. Empirical results therefore remain provisional. The C++ composite averages available bounded components and reports which were unavailable; the UI does not display a score until inputs are sufficiently populated.

Author diagnostics include approximate unique authors, largest-author share, top-ten-author share, and effective authors:

```text
N_eff = (Σ_a c_a)^2 / Σ_a c_a^2
```

This detects concentration; it is not a bot classifier. CULT does not quietly censor authors using an opaque score. Actor identifiers are HMACed with an ephemeral per-window key and discarded after aggregation.

Source health states are `HEALTHY`, `DEGRADED`, `STALE`, `DISCONNECTED`, and `BACKFILLING`. Metrics include event/receive timestamps, lag, event rate, parse errors, duplicates, and reconnects. Baseline proportion intervals are diagnostic; time/platform block-bootstrap infrastructure is required before stronger historical uncertainty claims.
