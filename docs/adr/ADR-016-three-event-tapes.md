# ADR-016 — Three independent event tapes

Status: accepted, 2026-08-21.

Expression, signal, and market events are stored and replayed separately. Public engagement cannot directly become market order flow, and simulated trading cannot modify measurement. This preserves provenance and permits agent/latency experiments against the same underlying tape.
