# Realtime data flow

## Transport

`apps/api/src/realtime.ts` attaches a WebSocket server to the existing `http.Server` at `/ws` (no separate port). One channel exists today: `"market"`. Messages are `FeedEnvelope<T>` (`packages/hft-engine/src/index.ts`): `{ schemaVersion: "CULT-FEED-1", channel, sequence, publishedTimeNs, payload }`.

## Snapshot vs. stream

There is no snapshot/subscribe handshake yet — every client that connects starts receiving the next tick for every asset, once per second (`MarketTickEngine`, `apps/api/src/realtime.ts`). This is sufficient for the one channel that exists because each `market` message carries the full current state for its asset (not a delta), so a client that connects mid-stream is fully caught up within one tick interval. A future delta-based channel (e.g. L2 depth) will need a real snapshot-on-subscribe handshake before it can rely on this pattern — see "Sequence gaps" below.

## Sequence numbers

Each broadcast message carries a server-assigned monotonic `sequence` (one counter per server process, shared across channels today). `apps/web/src/realtime/connectionManager.ts` tracks the last sequence seen *per channel* and flags the connection `DEGRADED` if a gap is detected.

## Sequence gaps

For the `market` channel (full-state, not delta), a gap self-heals on the next tick — nothing is corrupted, since nothing is being incrementally applied. **This is not true in general.** When a delta-based channel (L2 depth, in particular) is added, a detected gap must trigger: mark the local book invalid → request a snapshot → apply it → replay any buffered deltas → return to `CONNECTED`. That machinery does not exist yet; `connectionManager.ts` only detects and surfaces the gap today (spec §14's full recovery loop is future work, tracked in `docs/frontend/quant.md`).

## Connection states

`CONNECTED | DEGRADED | RECONNECTING | DISCONNECTED`, computed in `connectionManager.ts`:

- `DEGRADED`: no message received for >8s, or a sequence gap was detected.
- `DISCONNECTED` → `RECONNECTING`: socket closed unexpectedly; retried with exponential backoff (500ms, doubling, capped at 15s).
- The manager force-closes and reconnects if no message arrives for >30s even if the socket itself hasn't errored (a silently-hung connection looks the same as no connection to the user).

## Interpolation vs. truth

The store (`marketStore.ts`) holds only authoritative values — whatever the server last sent. Visual smoothing (`components/useAnimatedNumber.ts`) happens at render time, in the component, and never mutates the store. See `motion.md`.

## Data mode

Every `market` message carries `dataMode` (`synthetic | replay | live-shadow | live-market`, from `resolveDataMode`), so the client always knows whether what it's rendering is real. The shell's connection indicator does not currently surface `dataMode` distinctly from connection health — that's a known gap (spec §15's per-mode badge treatment across Casual/Analyst/Quant is not yet implemented).
