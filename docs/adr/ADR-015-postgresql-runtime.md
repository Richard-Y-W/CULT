# ADR-015: PostgreSQL persistent runtime

Status: Accepted — 2026-08-21

PostgreSQL is the durable store for accounts, ledger, orders, positions, source state, aggregates, references, and revisions. It is sufficient for Phase 2 and avoids premature ClickHouse/Kafka infrastructure. Synthetic in-memory state remains a deterministic demo mode, not the live-data store.
