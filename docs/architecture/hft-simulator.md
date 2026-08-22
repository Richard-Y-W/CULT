# Deterministic HFT simulator

Phase 4 adds a single-threaded deterministic exchange clock in signed 64-bit nanoseconds. This is a logical simulation clock—not a claim that the public expression reference updates at nanosecond frequency. Independent instruments or runs may later execute in parallel; one book remains serial to preserve reproducibility.

```text
expression tape -> behavior state -> signal tape -> feed latency
-> agent processing -> order latency -> pre-trade risk -> CULT-X
-> fills/book events -> microstructure/risk analytics
```

The local C++ SDK is trusted research code. CULT does not execute arbitrary uploaded strategy binaries. Synthetic scenarios may possess a latent true state; live/replay scenarios never expose future information.

The canonical scenarios are Great Cry Shock (broad adoption), Celebrity Shock (one concentrated cascade), and spam-like shock (high concentration/low informational weight). They are controlled experiments, not Bluesky findings.

`run_great_cry_shock` (`cpp/src/exchange/simulator.cpp`) and its TypeScript parity implementation `createPhase4Demo` (`packages/hft-engine/src/index.ts`) now follow the pipeline above literally: the behavior engine's amplification output becomes a real `SignalEvent`, an `EventDrivenAgent` (`cult::exchange::strategy.hpp`) reacts to it after a sampled agent-latency delay, its order intent passes through `PreTradeRisk::check` (real limit/collar/leverage checks, previously implemented but never called) after a sampled order-latency delay, and only an accepted order reaches the book. Both scenario functions accept an optional `risk_limits`/`riskLimits` override so a caller can exercise an actual rejection; the default limits are sized for this scenario's simulated desk, not a universal production config.
