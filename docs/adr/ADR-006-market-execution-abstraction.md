# ADR-006: Market execution abstraction

Status: accepted. V0 immediately fills a deterministic quote with fees and bounded slippage behind `ExecutionEngine`; future matching or AMM logic does not change order callers or accounting invariants.
