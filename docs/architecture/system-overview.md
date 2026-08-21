# System overview

```mermaid
flowchart LR
  U[Casual / Analyst UI] -->|typed JSON| API[Versioned API]
  API --> M[Market engine]
  API --> A[Analytics / backtest]
  API --> E[Expression engine]
  API --> I[Index engine]
  M --> DB[(PostgreSQL)]
  E --> DB
  I --> DB
  W[Worker boundary] --> E
  W --> I
  W --> DB
```

V0 runs the API as a modular monolith. Domain packages have no UI dependencies and expose replacement boundaries for data sources and execution. Runtime demo state is memory-backed; the PostgreSQL schema is ready for repository adapters in the next phase. This choice makes the entire product runnable without pretending operational complexity is product value.
