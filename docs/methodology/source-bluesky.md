# Bluesky source — BSKY-JETSTREAM-1

CULT consumes the documented public Jetstream WebSocket stream with `wantedCollections=app.bsky.feed.post`. The default public endpoint is configurable. Jetstream provides simplified JSON and a microsecond cursor; reconnect uses a short cursor rewind plus event-hash deduplication so at-least-once replay does not double-count.

Eligible record handling follows the `app.bsky.feed.post` lexicon: original text, reply text, and quote-post text are bucketed separately; a pure repost is not an eligible new document. Malformed events, non-create operations, and non-post collections do not enter the denominator.

The collector validates, deduplicates, extracts registered expressions, aggregates one-minute windows, checkpoints the cursor, records lag/health, and reconnects with bounded exponential backoff. It persists counts and ephemeral-author concentration only—not handles, profiles, DIDs, or post bodies. Raw text exists only during parsing.

Tests use recorded synthetic protocol fixtures and never require the live service. Live operation is explicit with `CULT_DATA_MODE=live` and requires PostgreSQL. Source references: [Bluesky Jetstream](https://github.com/bluesky-social/jetstream) and [post lexicon](https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/post.json).
