# Local C++ HFT strategy SDK

The trusted local interface is `cult::exchange::HftStrategy`:

```cpp
on_market_data(event, context)
on_signal(event, context)
on_fill(fill, context)
```

The context exposes simulation time, permitted market/reference data, cash, inventory, and an order sink. The path is strategy -> pre-trade risk -> configured order latency -> exchange. A strategy cannot inspect future replay events. Each stochastic strategy receives an independent deterministic RNG stream.

This is not a hosted arbitrary-code service. Future public competitions require isolation such as containers/WASM, quotas, and a separate security review.
