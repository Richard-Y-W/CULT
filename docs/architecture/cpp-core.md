# C++ quantitative core

CULT uses C++20 for compute, TypeScript for product/API orchestration, Python for research, and SQL for persistence. The existing TypeScript algorithms remain golden implementations until deterministic differential tests establish parity.

Targets are modular: `cult_core` owns IDs/types; `cult_expression` owns prevalence and registry extraction; `cult_analytics` owns online/rolling statistics; `cult_index` chain-links references and quality components; `cult_market` models virtual liquidity/risk; `cult_backtest` supplies time-bounded `DataView` simulation.

Rolling mean, variance, covariance, correlation, beta, EWMA, and prevalence update incrementally without slicing whole windows. Compact numeric IDs cross hot paths. Exotic SIMD, lock-free queues, and distributed systems are deliberately absent until profiling warrants them.

Build with:

```bash
cmake -S cpp -B build/cpp -DCMAKE_BUILD_TYPE=Release
cmake --build build/cpp
ctest --test-dir build/cpp --output-on-failure
```

`CULT_ENABLE_SANITIZERS=ON` enables ASan/UBSan with supported GCC/Clang toolchains.
