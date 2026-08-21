# CULT Expression Index methodology — V0

V0 uses deterministic synthetic observations. It proves the calculation contract; it is not a measurement of the live internet.

An eligible observation is a public document accepted by a documented source sampler. For expression *e*, platform *p*, and window *t*, `N(p,t)` is eligible documents and `n(e,p,t)` is documents containing the expression. Presence is binary per document, so repeated emoji do not inflate prevalence.

`usage_per_million(e,p,t) = 1,000,000 × n(e,p,t) / N(p,t)`

Platforms are calculated separately. The official aggregate uses published fixed weights over platform log changes, never raw pooled collection volume:

`r(e,t) = Σ weight(p) × log((u(e,p,t)+ε)/(u(e,p,t-1)+ε))`

The chain-linked reference begins at 1,000: `index(t) = index(t-1) × exp(r(e,t))`. Market price is separate and may carry a premium or discount.

Future COIP source adapters must document eligibility, sampler, language/context buckets, platform weighting, rate limits, missingness, revisions, bot/author concentration, and source stability. A missing source is excluded and the remaining published weights are renormalized; the gap is flagged. Historical values are revised only under a versioned, published correction policy.

Confidence combines effective sample size, source coverage, missingness, cross-platform agreement, and concentration diagnostics. Block/platform bootstrap intervals replace naive independent-binomial claims. External rankings may be checked against licensed or publicly published benchmarks but are not silently ingested.
