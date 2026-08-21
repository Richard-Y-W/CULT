# ADR-008: Retain TypeScript as product and golden layer

Status: Accepted — 2026-08-21

TypeScript remains responsible for React, HTTP, schemas, and orchestration. Existing deterministic calculations remain golden references until differential tests establish native parity; they are not deleted merely because C++ equivalents exist.
