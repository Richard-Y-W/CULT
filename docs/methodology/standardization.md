# Prevalence standardization

`STANDARDIZATION-1` preserves four distinct outputs: raw, content-standardized, language-standardized, and fully standardized prevalence. It never overwrites raw sufficient statistics.

For stratum `s`, `p(e,s,t)=n(e,s,t)/N(s,t)`. A standardized estimate is `sum(alpha[s] * p(e,s,t))`, where nonnegative fixed weights sum to one. Missing required strata produce `N/A`; they are not silently renormalized. The full variant uses fixed joint content-language weights.

Weights are calibrated from observed eligible-document denominators over a declared period of at least 30 days with at least 95% minute-window coverage. They are stored with an ID and effective dates. The calibration script derives weights from sample composition; it does not choose weights to minimize volatility or improve charts. Before calibration the status is `CALIBRATING` and adjusted values remain null.

Content buckets are `ORIGINAL`, `REPLY`, and `QUOTE`. Pure reposts without new text are ineligible. Language is the normalized primary declared language tag; absent, malformed, or uncertain language is `und`. Language detection is not inferred from private attributes.

Raw, content, language, and full variants are empirical alternatives. Selection of an official standardized series requires diagnostics covering volatility, stability, composition sensitivity, missingness, and event responsiveness plus methodology change control.
