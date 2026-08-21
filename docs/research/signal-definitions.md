# Signal definitions

- **Raw prevalence:** documents containing the expression per million eligible documents.
- **Smoothed prevalence:** Jeffreys-smoothed prevalence used for finite log changes.
- **Velocity:** weighted change in log-smoothed prevalence.
- **Acceleration:** velocity minus previous velocity.
- **Positive breadth:** source weight with positive return, from 0 to 1.
- **Signed breadth:** weight-summed direction, from −1 to 1.
- **Directional persistence:** mean return sign over a trailing window.
- **Persistence strength:** absolute directional persistence.
- **Seasonal surprise:** standardized log prevalence relative to expression × source × hour × weekday history; `INSUFFICIENT_HISTORY` until stable baselines exist.
- **Semantic entropy:** normalized Shannon entropy after validating and normalizing nonnegative semantic weights. It is analytical only.
- **Market/reference premium:** `market/reference - 1`.
- **Shock:** standardized reference return relative to a documented trailing or robust baseline. It detects anomalies and does not assign causes.

All windows, annualization conventions, and methodology versions must accompany exported values.
