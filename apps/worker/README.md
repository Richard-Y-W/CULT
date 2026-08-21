# CULT data worker

The worker runs in deterministic `synthetic` mode by default. `replay` remains offline. `CULT_DATA_MODE=live-shadow` connects to the authorized public Bluesky Jetstream endpoint, requires `DATABASE_URL`, processes post text and AT URIs transiently, persists aggregate windows/source state, and writes privacy-safe behavior plus aggregate replay tapes. It subscribes to post, like, and repost collections; engagement is attributed only when the referenced expression-bearing post exists in the transient map.

`live-market` is disabled unless the explicit acknowledgement and 72-hour validation gate are present. Connecting the collector never activates it. See the Bluesky source and live-shadow methodologies before operation.

## Docker live-shadow collection

Set a stable `CULT_CASCADE_HASH_SECRET` in `.env`, then run:

```bash
docker compose --profile live-shadow up --build
```

The profile starts PostgreSQL, applies all migrations once, and then starts the collector in `live-shadow`. Aggregate observations and source health are durable in PostgreSQL. Privacy-safe expression/behavior replay tapes and the Jetstream checkpoint live in the `cult_live_data` Docker volume. Restarting resumes from the checkpoint with a five-second overlap; database uniqueness and parser deduplication protect aggregate state.

Stop without deleting history:

```bash
docker compose --profile live-shadow down
```

Delete the named volumes only when you intentionally want to erase collected history. `live-market` is never enabled by this profile.
