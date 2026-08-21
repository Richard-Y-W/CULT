# Phase 3 starting-state audit

Audited 2026-08-21 at commit `e45e324` after inspecting every app/package, migrations, worker, synthetic generator, C++ core, API, tests, UI routes, ADRs, methodology, roadmap, build log, and limitations.

## Verified baseline

- The synthetic Casual and Analyst vertical slice built successfully.
- TypeScript: 27 tests, lint, typecheck, and production build passed.
- C++: configure/build and 2 CTest programs passed.
- Differential harness: 16 TypeScript/C++ metrics passed within declared tolerances.
- Phase 2 provided a 30-expression Unicode registry, recorded Jetstream fixtures, one-minute Bluesky aggregation, replay, Node/Python bindings, PostgreSQL contracts, and a provisional one-source reference index.

## Material gaps at audit

- Live aggregates did not retain language strata and API reads still targeted the Phase 2 table.
- Official daily closes, fixed-period standardization calibration, and immutable dataset snapshots were contracts rather than complete workflows.
- Statistical coverage stopped before broad market internals, HAC inference, factor diagnostics, quantiles, tail risk, and cost decomposition.
- The C++ backtester let a close-derived signal execute at that same close.
- No empirical report could enforce a minimum-history policy.

## Behavioral contracts retained

Document presence—not occurrence count—defines official prevalence. Raw UPM remains observable and unsmoothed; Jeffreys smoothing is used only where zeros make ratios unstable. Market price and reference index are independent. TypeScript remains the product/API layer and C++ the production compute layer. Live operation remains explicit and CI never depends on a network stream.

## Data caveat

No durable 7-day live dataset existed in the repository at audit time. Consequently no Phase 3 empirical conclusion is justified from the repository alone.
