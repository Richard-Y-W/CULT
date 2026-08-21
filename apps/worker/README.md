# CULT data worker

The worker runs in deterministic `synthetic` mode by default. `replay` remains offline. `CULT_DATA_MODE=live-shadow` connects to the authorized public Bluesky Jetstream endpoint, requires `DATABASE_URL`, processes post text and AT URIs transiently, persists aggregate windows/source state, and writes privacy-safe behavior plus aggregate replay tapes. It subscribes to post, like, and repost collections; engagement is attributed only when the referenced expression-bearing post exists in the transient map.

`live-market` is disabled unless the explicit acknowledgement and 72-hour validation gate are present. Connecting the collector never activates it. See the Bluesky source and live-shadow methodologies before operation.
