# Deterministic replay

The collector’s durable replay unit is the aggregate batch, not surveillance-grade raw events. This is enough to reproduce prevalence, reference-index, data-quality, and most signal calculations while respecting CULT’s retention policy.

```bash
npm run worker                         # synthetic recorded fixture by default
npm run replay -- data/replays/bluesky/2026-08-21.jsonl
```

Replay sorts observations deterministically, applies Jeffreys smoothing and chain-linking, and emits a SHA-256 checksum. Tests run the same capture twice and require identical output. The format supports regression tests, incident analysis, research, and benchmarks without reconnecting to Bluesky.

Live raw-protocol debugging fixtures must be minimal, synthetic or properly authorized, and may never become the default historical store.
