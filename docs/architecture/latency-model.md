# Latency model

Agent reaction time is the sum of separately configured feed, processing, order, and (for changes) cancel/replace latency. Supported sampled distributions are constant, uniform jitter, lognormal, and empirical values. Each stochastic agent owns an independent seeded RNG stream.

```text
signal publish <= agent receive <= decision <= exchange accept
```

The scheduler rejects events placed in its past and resolves equal timestamps by insertion sequence. This permits stale quotes and adverse selection: a signal may change before a market maker's cancellation reaches CULT-X. Source ingestion lag (`receive_time-event_time`) remains distinct from simulated network latency.
