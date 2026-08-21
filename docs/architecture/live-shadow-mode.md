# Live shadow mode

`CULT_DATA_MODE` accepts `synthetic`, `replay`, `live-shadow`, and `live-market`. Synthetic is the default. `live-shadow` may ingest authorized Bluesky events, derive expression/signal tapes, and run an internal simulated market, but every output is labelled **SHADOW / EXPERIMENTAL / NOT AUTHORITATIVE**.

`live-market` refuses startup unless `CULT_LIVE_MARKET_ACK=I_ACKNOWLEDGE_EXPERIMENTAL` and `CULT_LIVE_SHADOW_VALIDATED_HOURS>=72`. This is a technical floor, not automatic approval; seven days is preferred. Validation covers ordering, duplicates, lag, Unicode, cascade integrity, signal ranges, reference behavior, halts, and risk. Source degradation may freeze reference-sensitive agents, widen synthetic liquidity, or halt an instrument according to versioned configuration.

Connecting a collector never activates live-market. No real money, broker, or real exchange route exists.

The supported durable local deployment is `docker compose --profile live-shadow up --build`. The profile runs PostgreSQL, a one-shot migration container, and the Jetstream worker. A named volume preserves privacy-safe event tapes and cursor checkpoints across container replacement; PostgreSQL preserves aggregate and source-health history. The profile hard-codes `CULT_DATA_MODE=live-shadow` and cannot enable the market gate.
