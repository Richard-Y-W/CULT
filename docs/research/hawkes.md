# Self-excitation research boundary

Phase 4 records the sufficient event times needed to investigate univariate and multivariate Hawkes models:

```text
λ_i(t) = μ_i(t) + Σ_j Σ_(t_k<t) α_ij exp(-β_ij(t-t_k))
```

No production Hawkes calibration is enabled. Before use, fits require enough events, stability/branching-ratio checks, time-varying baseline comparisons, holdout likelihood, and comparison with Poisson/negative-binomial alternatives. Cross terms are called cross-excitation, never causality. Expression-event excitation and simulated market-order excitation are separate processes.
