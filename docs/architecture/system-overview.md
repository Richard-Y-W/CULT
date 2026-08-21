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
  J[Bluesky Jetstream] --> W[Live worker]
  W --> E
  W --> I
  W --> DB
```

The product/API remains a TypeScript modular monolith. Live measurements flow through an aggregate-only worker into PostgreSQL; default demo trading remains memory-backed. Quantitative primitives are migrating behind parity tests into modular C++20 libraries, with coarse Node-API and Python research boundaries. Domain packages have no UI dependencies.

The dependency direction is strict: sources create objective aggregates and references; analytics and the simulated market consume them. Semantic inference and user trading can never alter official expression counts.
