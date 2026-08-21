# Expression reference index

The reference index describes observed expression prevalence; the simulated market price describes user positioning. Settlement measurement never depends on the market or semantic inference.

For active source weights summing to one:

```text
r(e,t) = Σ_p w_p × log(p_tilde(e,p,t) / p_tilde(e,p,t-1))
I(e,0) = 1000
I(e,t) = I(e,t-1) × exp(r(e,t))
```

In COIP-1.1, Bluesky’s effective weight is 1. An **indicative intraday index** may update each minute and carries source-health flags. An **official daily close** uses a fixed UTC day and records `is_final`, methodology version, registry version, source version, and revision number. Missing or unhealthy source windows are flagged rather than silently imputed.

Market/reference premium is `market / reference - 1`. It is a CULT-native speculative signal, not part of the reference calculation.
