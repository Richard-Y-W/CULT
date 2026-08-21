# Data formats

PostgreSQL is the system of record. Timestamps are UTC `timestamptz`; counts are 64-bit integers; monetary and published reference values use `numeric`; methodology/source/registry versions are explicit strings. Base observations are one-minute aggregates and can later be time-partitioned without changing their logical key.

Replay JSONL is aggregate-only and canonicalized for deterministic checksums. Each line is a flushed batch containing window metadata and expression rows. It deliberately contains no post text, handle, DID, or profile data.

Research exports use Parquet/Arrow-compatible columns: timestamp, expression ID, platform ID, content bucket, counts, prevalence, quality components, and version fields. Parquet is an interoperability output, not the transactional source of truth. Schemas evolve additively and carry a schema/methodology version.

`cult-snapshot DATASET_ID START END` writes a new immutable directory and refuses an existing target. Each table has a SHA-256 hash and exact columns in `manifest.json`, alongside Git SHA, dependency versions, time range, source, registry, and methodology. Example IDs follow `CULT-BSKY-2026-08-v1`; experiments reference the ID and manifest rather than a mutable query.

Phase 3 canonical tables begin with `expression_prevalence.parquet` and `official_closes.parquet`. Derived snapshots may add `expression_returns`, `expression_signals`, `market_factors`, `quality_metrics`, and `events`. Raw post bodies, handles, and profiles are prohibited.

Phase 4 deterministic runs first emit a self-contained JSON scenario plus replay hash. `python -m cult_research.hft_export SOURCE DESTINATION` converts it to `expression_events.parquet`, `signal_events.parquet`, `market_events.parquet`, `book_snapshots.parquet`, and `agent_states.parquet`, with Zstandard compression and per-file SHA-256 hashes in `manifest.json`. PostgreSQL remains the durable live/simulation system of record; Parquet is the offline research interchange. Orders, fills, book events, risk events, and agent state have dedicated Phase 4 SQL tables even when a small synthetic fixture does not populate every table.
