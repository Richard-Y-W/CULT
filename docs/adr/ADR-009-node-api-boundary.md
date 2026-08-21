# ADR-009: Node-API native boundary

Status: Accepted — 2026-08-21

Use Node-API rather than per-request JSON subprocesses. Expose coarse batch operations to reduce crossing overhead and preserve API composition in TypeScript. The native module is optional during parity migration and feature-detected by a typed wrapper.
