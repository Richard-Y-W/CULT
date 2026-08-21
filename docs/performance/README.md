# Performance

Benchmarks are executable measurements, not product claims:

```bash
cmake --build build/cpp --config Release
build/cpp/cult_benchmarks 1000000
build/cpp/cult_benchmarks 10000000
build/cpp/cult_benchmarks 1000000 100
build/cpp/cult_benchmarks 100000 1000
```

The benchmark covers incremental rolling mean/variance/covariance plus prevalence, expression matching, and reference-index updates. It uses deterministic seed `20260821`; output includes elapsed seconds and operations/second.

## 2026-08-21 local run

- Compiler: GCC 13.2.0, C++20, Release, Ninja, Windows x86-64.
- Hardware details were not reliably exposed by the managed environment and are therefore not invented.
- 1M: streaming analytics/prevalence 70.72M ops/s; expression-matching documents 1.04M/s; reference updates 9.26M/s.
- 10M: streaming analytics/prevalence 69.07M ops/s; expression-matching documents 0.67M/s; reference updates 5.45M/s.

The synthetic matching document contains repeated emoji and the small benchmark registry contains three assets; results are not a capacity promise for the full registry or production stream. Re-run on target hardware before planning. Allocations and peak RSS are not yet measured.

## Phase 3 cross-sectional run (same date/toolchain)

The expanded executable updates all rolling pair states and reports actual pair updates rather than extrapolating:

| Observations | Expressions |  Pairs × bars | Streaming obs/s | Matching docs/s | Reference updates/s | Rolling pair updates/s |
| -----------: | ----------: | ------------: | --------------: | --------------: | ------------------: | ---------------------: |
|    1,000,000 |          30 |   435 × 1,000 |          46.28M |           0.96M |               8.91M |                 21.30M |
|    1,000,000 |         100 | 4,950 × 1,000 |          40.75M |           0.81M |               8.48M |                 15.59M |
|      100,000 |       1,000 | 499,500 × 100 |          46.16M |           0.67M |               6.31M |                 19.71M |

The 1,000-expression case deliberately uses only 100 bars because a full dense matrix already performs 49.95 million pair updates and consumes materially more state. This supports the planned sparse/top-K boundary at larger universes; it is not a claim that 1,000 expressions should be recomputed densely on every live tick. Timings varied because the three processes ran concurrently. Peak RSS and allocations remain unmeasured and are not estimated.
