# CULT data worker

The worker runs in deterministic `synthetic` mode by default. `CULT_DATA_MODE=live` connects to the authorized public Bluesky Jetstream endpoint, requires `DATABASE_URL`, processes post text transiently, persists aggregate windows and source state, and writes aggregate-only replay batches. See the source methodology before operating live mode.
