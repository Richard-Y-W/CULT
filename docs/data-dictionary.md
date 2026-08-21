# CULT data dictionary

All timestamps are UTC. `event_time` is source time, `receive_time` is collector arrival, `window_start/end` are aggregation boundaries, and `close_date` is the UTC official day.

| Field                                      | Type / units                              | Meaning                                                | Class                              |
| ------------------------------------------ | ----------------------------------------- | ------------------------------------------------------ | ---------------------------------- |
| expression_id                              | stable string                             | Registry-independent asset identity                    | raw key                            |
| platform_id                                | string                                    | COIP source                                            | raw key                            |
| content_bucket                             | enum                                      | ORIGINAL, REPLY, QUOTE                                 | raw stratum                        |
| language_bucket                            | BCP-47 primary tag or `und`; `ALL` rollup | Declared-language stratum                              | raw stratum                        |
| eligible_documents                         | uint64 documents                          | Documents satisfying eligibility                       | raw sufficient statistic           |
| expression_documents                       | uint64 documents                          | Eligible documents containing expression at least once | raw sufficient statistic           |
| occurrence_count                           | uint64 occurrences                        | All matched canonical occurrences                      | raw diagnostic                     |
| unique_author_estimate                     | count                                     | Window-scoped ephemeral-hash cardinality               | diagnostic                         |
| largest_author_share / top_10_author_share | [0,1]                                     | Author document concentration                          | diagnostic                         |
| author_hhi                                 | [0,1]                                     | Sum of squared author document shares                  | derived diagnostic                 |
| effective_authors                          | count                                     | `(sum c)^2 / sum(c^2)`                                 | derived diagnostic                 |
| raw_prevalence                             | UPM                                       | `1e6*n/N`; null when denominator invalid               | derived transparent                |
| smoothed_prevalence                        | UPM                                       | `1e6*(n+0.5)/(N+1)`                                    | derived REF-JEFFREYS-1             |
| intensity_when_present                     | occurrences/document                      | `occurrence_count/expression_documents`                | research diagnostic                |
| reference_index                            | index points                              | Chain-linked reference, base 1000                      | derived official/indicative        |
| market_price                               | CULT index points                         | Simulated execution market                             | simulated; never measurement input |
| methodology_version                        | string                                    | Exact formula contract                                 | provenance                         |
| source_version                             | string                                    | Adapter/eligibility contract                           | provenance                         |
| expression_registry_version                | string                                    | Unicode/canonicalization contract                      | provenance                         |
| arrival_mode                               | enum                                      | LIVE or BACKFILLED                                     | provenance                         |
| source_health                              | enum                                      | HEALTHY, DEGRADED, STALE, DISCONNECTED, BACKFILLING    | quality                            |
| lag_p50/p95/p99_ms                         | milliseconds                              | Receive minus event time                               | quality                            |
| is_final                                   | boolean                                   | Meets close finalization requirements                  | publication                        |
| revision_number / reason                   | integer / text                            | Auditable correction state                             | publication                        |

Monetary account and ledger amounts use PostgreSQL numeric/minor-unit integers, never binary floating point. Research Parquet schemas and hashes live in each immutable dataset manifest.
