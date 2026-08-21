# Performance

Benchmarks are executable measurements, not product claims:

```bash
cmake --build build/cpp --config Release
build/cpp/cult_benchmarks 1000000
build/cpp/cult_benchmarks 10000000
```

The benchmark covers incremental rolling mean/variance/covariance plus prevalence, expression matching, and reference-index updates. It uses deterministic seed `20260821`; output includes elapsed seconds and operations/second.

## 2026-08-21 local run

- Compiler: GCC 13.2.0, C++20, Release, Ninja, Windows x86-64.
- Hardware details were not reliably exposed by the managed environment and are therefore not invented.
- 1M: streaming analytics/prevalence 70.72M ops/s; expression-matching documents 1.04M/s; reference updates 9.26M/s.
- 10M: streaming analytics/prevalence 69.07M ops/s; expression-matching documents 0.67M/s; reference updates 5.45M/s.

The synthetic matching document contains repeated emoji and the small benchmark registry contains three assets; results are not a capacity promise for the full registry or production stream. Re-run on target hardware before planning. Allocations and peak RSS are not yet measured.
