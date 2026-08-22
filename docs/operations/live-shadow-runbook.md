# Live-shadow operational runbook

For the operator running the first (and every subsequent) real
`CULT_DATA_MODE=live-shadow` collection campaign. Written as part of the
Phase 5.5 pre-live readiness audit (`docs/audits/pre-live-readiness.md`) --
read that document for the evidence behind every check below.

`live-shadow` collects and measures. It never drives the simulated market
(ADR-016, ADR-018) -- nothing here turns on `live-market`.

## Before you start

- [ ] `CULT_CASCADE_HASH_SECRET` is set in `.env` to a long random value you
      control -- **not** left unset. As of this audit, both the worker and
      the shipped `docker compose --profile live-shadow` config fail closed
      (refuse to start) if it's missing, but confirm it's a real secret, not
      a placeholder you copied from an example.
- [ ] `DATABASE_URL` points at a reachable PostgreSQL instance.
- [ ] Migrations are current: `npm run db:migrate` (or the compose
      profile's `migrate` service, which runs automatically before the
      worker starts). There is no automatic migration-completeness check at
      worker startup -- a missing migration currently surfaces only as a
      generic "Bluesky stream error" retry loop on the first write, not a
      clear diagnostic (documented, unfixed gap -- see the main audit,
      §68-69). Run migrations explicitly and confirm they succeeded before
      starting the worker.
- [ ] `CULT_DATA_MODE=live-shadow` is set (not `live-market` -- that
      requires a separate, deliberate acknowledgement and a 72-hour
      validated-hours floor; see ADR-018).
- [ ] You are **not** also setting `CULT_LIVE_MARKET_ACK` or
      `CULT_LIVE_SHADOW_VALIDATED_HOURS` unless you specifically intend to
      leave those set for a future live-market decision -- they have no
      effect under `live-shadow` but leaving them set is exactly the kind
      of stale-config drift the main audit's adversarial gate review
      flagged as the realistic way `live-market` could activate later by
      accident.
- [ ] The API process (`apps/api`) also has `DATABASE_URL` set if you want
      its data endpoints (not just `/health`) to reflect live-shadow data
      rather than silently falling back to synthetic-labeled responses --
      the API does **not** currently fail closed on a missing
      `DATABASE_URL` under live modes the way the worker does (documented,
      unfixed gap -- see the main audit, §61-67). Check `/health`'s
      `dataMode` field against what a data endpoint actually returns before
      trusting the dashboard.

## Startup order

1. `docker compose up -d postgres` (or ensure your external Postgres is up).
2. `npm run db:migrate` (or let the compose `live-shadow` profile's
   `migrate` service run this — it's gated `depends_on: postgres:
   condition: service_healthy` and the worker won't start until it
   completes successfully).
3. Start the worker: `docker compose --profile live-shadow up --build`, or
   directly: `CULT_DATA_MODE=live-shadow DATABASE_URL=... npm run worker`.
4. Optionally start the API (`npm run dev -w @cult/api` or your production
   entrypoint) if you want the dashboards live during collection.

## Health checks to watch

- `GET /api/v1/data/status` -- `mappedEngagementRate`, `sourceHealth.state`,
  `eventsPerMinute`, `streamLagMs`, `duplicateEvents`, `parseErrors`.
- `GET /health` -- confirms the API's own `dataMode`; cross-check this
  against what `/api/v1/data/status` actually returns (see the
  `DATABASE_URL` gap above).
- Worker stdout: structured JSON logs on connect, checkpoint persist,
  attribution retention cleanup, and (as of this audit) a distinct
  `"health-only snapshot persisted"` line the first time the source goes
  stale, and `"sink write failed"` naming which specific sink failed if one
  does.

## Stop conditions -- abort collection if you see

Adopted directly from the audit's adversarial review (§75 of the main
audit). If any of these appear, stop the worker (`docker compose
--profile live-shadow down`, which preserves collected history), and
investigate before restarting:

- Sustained DB write failures (repeated `"sink write failed"` naming
  `PostgresAggregateSink` specifically, not just a one-off blip).
- A large, unexplained jump in `duplicateEvents` relative to
  `eventsPerMinute` (the in-memory dedup resets on every restart -- a
  reconnect storm or crash loop would show up here).
- `streamLagMs` / `lagP95Ms` growing without bound rather than staying
  roughly stable.
- `mappedEngagementRate` dropping sharply and staying down (attribution
  mapping degrading, e.g. from a secret/config change mid-run).
- Any `NaN`, negative count, or impossible value in `/api/v1/data/status`
  or `/api/v1/assets/:ticker` (none should be structurally possible per the
  reference-math audit, but this is exactly the kind of thing to watch for
  in real data the synthetic generator never produced).
- The frontend showing anything that looks like "LIVE FEED" without a
  clear, separate `DATA: LIVE SHADOW` (or equivalent) label next to it --
  this would indicate the labeling fix in this audit has regressed.
- Source health stuck at `HEALTHY` for an implausibly long silent period --
  the STALE-detection fix in this audit should catch this within ~180s
  (120s staleness threshold + up to 60s timer granularity), but confirm it
  actually does during the first hour (see below).

## First 10 minutes

- [ ] Confirm `eventsPerMinute` is non-zero and roughly stable.
- [ ] Confirm `streamLagMs` is small and not growing.
- [ ] Confirm `duplicateEvents` and `parseErrors` are near zero (some
      duplicates are expected across a reconnect; a large sustained rate is
      not).
- [ ] Confirm at least one expression match has occurred and
      `mappedEngagementRate` is no longer `null` once engagement (likes/
      reposts/replies/quotes) starts arriving for a tracked post.
- [ ] Confirm the database is actually receiving rows: query
      `expression_observations_v3`/`source_health_snapshots_v2` directly if
      you have DB access, don't rely on the API alone.
- [ ] Confirm reference-index values are moving plausibly (not flat-zero,
      not `NaN`, not an implausible jump) -- compare against the calibrated
      target distribution from the prior recalibration session
      (`docs/BUILD_LOG.md`, "Price-scale unification + synthetic volatility
      recalibration") as a rough sanity prior, while remembering real data
      is allowed to look different (§77 of the Phase 5.5 spec: no
      calibration by eyeball).

## First hour

- [ ] Memory (RSS) of the worker process is not growing without bound.
- [ ] CPU usage is stable, not climbing.
- [ ] Deliberately trigger a STALE test if you can safely pause the source
      briefly (or wait for a natural gap) and confirm `source_health_state`
      actually transitions and is visible via `/api/v1/data/status` within
      a few minutes -- this exercises the STALE-flush fix from this audit
      for the first time against real timing, not just a unit-level code
      read.
- [ ] Confirm a full worker restart (SIGTERM, or `docker compose restart`)
      resumes cleanly: checkpoint advances, no duplicate spike, warm-start
      log line (`"post attribution warm-start restored"`) reports a
      plausible restored-row count.

## 72-hour campaign (prepare, do not necessarily execute immediately)

Retain at minimum: uptime, source reconnect count, event count, expression
match count, inter-arrival distribution, mapped-engagement coverage,
cascade-depth distribution, prevalence distribution, reference-index return
distribution, and any halt/anomaly you had to investigate. Compare real
distributions against the synthetic generator's calibrated assumptions
(§76-77 of the Phase 5.5 spec) -- if reality differs, mark the synthetic
calibration for future correction; do not retroactively "fix" real data to
look like the assumption.

## Shutdown

`docker compose --profile live-shadow down` (preserves the `cult_live_data`
and `cult_postgres` volumes -- history is retained). The worker's
`shutdown()` handler (fixed in this audit to actually close the active
Jetstream socket) should exit promptly on SIGTERM rather than hanging past
the container orchestrator's grace period; if you observe it hanging,
that's a regression worth filing, not expected behavior.
