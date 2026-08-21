# Data formats

PostgreSQL is the system of record. Timestamps are UTC `timestamptz`; counts are 64-bit integers; monetary and published reference values use `numeric`; methodology/source/registry versions are explicit strings. Base observations are one-minute aggregates and can later be time-partitioned without changing their logical key.

Replay JSONL is aggregate-only and canonicalized for deterministic checksums. Each line is a flushed batch containing window metadata and expression rows. It deliberately contains no post text, handle, DID, or profile data.

Research exports use Parquet/Arrow-compatible columns: timestamp, expression ID, platform ID, content bucket, counts, prevalence, quality components, and version fields. Parquet is an interoperability output, not the transactional source of truth. Schemas evolve additively and carry a schema/methodology version.
