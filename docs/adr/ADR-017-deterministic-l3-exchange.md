# ADR-017 — Deterministic single-threaded L3 exchange

Status: accepted, 2026-08-21.

CULT-X uses integer ticks/quantities, price-time priority, signed 64-bit nanosecond logical time, and a serial matching loop. Determinism and auditability take priority over claimed production-exchange speed. Parallelism belongs across independent instruments/runs before concurrency enters one book.
