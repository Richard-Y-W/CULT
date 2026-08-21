# Prevalence — REF-JEFFREYS-1

For expression *e*, platform *p*, and window *t*, let `n` be eligible documents containing the expression and `N` all eligible documents. Raw prevalence is:

```text
raw uses/million = 1,000,000 × n / N
```

This is document prevalence, not character frequency. CULT also stores occurrence count for intensity analysis.

Log changes use Jeffreys smoothing rather than an unexplained epsilon:

```text
p_tilde = (n + 1/2) / (N + 1)
smoothed uses/million = 1,000,000 × p_tilde
r_t = log(p_tilde_t / p_tilde_(t-1))
```

The half-count corresponds to the Jeffreys Beta(1/2, 1/2) prior and gives finite values at zero while its influence diminishes with sample size. Both raw and smoothed statistics are published. `N=0` produces no valid window, not a fabricated zero observation.

Velocity is the weighted change in log-smoothed prevalence. Acceleration is current minus previous velocity. Positive breadth is the active-source weight with positive return; signed breadth is the weight-summed sign. Directional persistence is the mean sign of recent aggregate returns in `[-1, 1]`.
