# Native bindings

The intended API path is C++ library → coarse Node-API call → typed TypeScript wrapper → HTTP API. One boundary call computes a bundle; CULT does not cross languages once per scalar. `cpp/bindings/node/addon.cpp` currently exposes `computeRollingAnalytics(series)`. `packages/analytics/src/native.ts` feature-detects the optional module while the tested TypeScript golden path remains active.

Build the optional module with a supported Node development toolchain:

```bash
cmake -S cpp -B build/node -DCULT_BUILD_NODE_BINDING=ON -DNODE_INCLUDE_DIR=/path/to/node/include
cmake --build build/node
```

The current Windows development image has GCC but lacks Node development headers/import libraries, so its native addon is not built locally. Linux CI builds the boundary. This limitation does not affect the C++ libraries or differential CLI.

Python uses the same libraries through `cpp/bindings/python/module.cpp` and pybind11. `pip install ./python` builds `_cult_quant`; notebooks remain research clients rather than production compute services.

## Coarse simulation API (C++, header-only)

`cpp/include/cult/exchange/simulation_api.hpp` (`cult::exchange::SimulationHandle`) is a coarse-grained facade over one instrument's `LimitOrderBook` and `BehaviorAccumulator`: `load_replay`/`run`/`pause`/`resume`/`step`, `instrument_state`/`l1`/`l2`, `trade_tape`/`expression_tape`/`signal_tape`, `microstructure_metrics`, `evaluate_risk`, and `agent_metrics`. It wraps existing types and adds no new simulation math — it exists so a future product/binding layer can cross the native boundary once per batch operation instead of once per scalar, matching this document's stated design intent. It is exercised directly by `cpp/tests/test_main.cpp`.

**Not yet done:** Node-API and pybind11 exposure of `SimulationHandle` itself. Unlike `computeRollingAnalytics` (a stateless free function), binding a stateful object requires `napi_wrap`/handle-lifetime management on the Node side, which cannot be compiled or verified on this development image (no Node headers, as above). Rather than ship unverified binding glue, that wiring is deferred until Node/Python build tooling is available to compile-check it — most naturally alongside the frontend work that would first consume it. `getCorrelationMatrix`/`getHeatmapDataset`-equivalents are also not implemented; they belong with the Analyst/Quant frontend work that would define their expected shape.
