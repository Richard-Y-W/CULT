# Native bindings

The intended API path is C++ library → coarse Node-API call → typed TypeScript wrapper → HTTP API. One boundary call computes a bundle; CULT does not cross languages once per scalar. `cpp/bindings/node/addon.cpp` currently exposes `computeRollingAnalytics(series)`. `packages/analytics/src/native.ts` feature-detects the optional module while the tested TypeScript golden path remains active.

Build the optional module with a supported Node development toolchain:

```bash
cmake -S cpp -B build/node -DCULT_BUILD_NODE_BINDING=ON -DNODE_INCLUDE_DIR=/path/to/node/include
cmake --build build/node
```

The current Windows development image has GCC but lacks Node development headers/import libraries, so its native addon is not built locally. Linux CI builds the boundary. This limitation does not affect the C++ libraries or differential CLI.

Python uses the same libraries through `cpp/bindings/python/module.cpp` and pybind11. `pip install ./python` builds `_cult_quant`; notebooks remain research clients rather than production compute services.
