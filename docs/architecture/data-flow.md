# Data flow

```mermaid
flowchart LR
  S[Public source / synthetic generator] --> I[Ingestion adapter]
  I --> N[Canonical normalization]
  N --> G[Aggregate document counts]
  G --> O[Objective Expression Index]
  G --> Q[Quality / confidence]
  N --> M[Semantic inference]
  O --> A[Analytics and indexes]
  M --> A
  O --> X[Simulated market]
  X --> U[User portfolio]
```

Raw future sources implement `ExpressionDataSource.fetchBatch`, `normalize`, and `validate`. Aggregates are hour × platform × expression × language × context. The intended persistence surface stores counts and approximate distinct-author statistics rather than a surveillance archive of usernames and post bodies.
