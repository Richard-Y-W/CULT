import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { EmojiRegistry, type EmojiRegistryData } from "@cult/expression-engine";
import { resolveDataMode } from "@cult/hft-engine";
import { BlueskyEventParser } from "./parser.js";
import { MinuteAggregator } from "./aggregator.js";
import { BehaviorTapeWriter } from "./behavior-tape.js";
import { AttributionStore } from "./attribution.js";
import {
  CompositeSink,
  PostgresAggregateSink,
  ReplaySink,
  writeCheckpoint,
  type AggregateSink,
} from "./sink.js";
import type { SourceHealth } from "./types.js";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url)),
  fromRoot = (path: string) => resolve(repoRoot, path);
const mode = resolveDataMode(process.env),
  liveSource = mode === "live-shadow" || mode === "live-market";
const registryData = JSON.parse(
  await readFile(
    fromRoot("data/reference/unicode/cult-emoji-registry-v1.json"),
    "utf8",
  ),
) as EmojiRegistryData;
const attribution = new AttributionStore({
  secret: process.env.CULT_CASCADE_HASH_SECRET,
  retentionDays: process.env.CULT_ATTRIBUTION_RETENTION_DAYS
    ? Number(process.env.CULT_ATTRIBUTION_RETENTION_DAYS)
    : 14,
  databaseUrl: liveSource ? process.env.DATABASE_URL : undefined,
});
const registry = new EmojiRegistry(registryData),
  parser = new BlueskyEventParser(registry, undefined, attribution),
  aggregator = new MinuteAggregator(
    registryData.assets.map((asset) => asset.id),
  );
const behaviorWriter = liveSource
  ? new BehaviorTapeWriter(
      fromRoot(
        process.env.CULT_BEHAVIOR_TAPE_PATH ??
          `data/replays/expression-events/${new Date().toISOString().slice(0, 10)}.jsonl`,
      ),
    )
  : null;
const health: SourceHealth = {
  source: "BLUESKY",
  state: "DISCONNECTED",
  lastEventTimestampMs: null,
  lastReceiveTimestampMs: null,
  streamLagMs: null,
  eventsPerMinute: 0,
  parseErrors: 0,
  duplicateEvents: 0,
  reconnectCount: 0,
  lagP50Ms: null,
  lagP95Ms: null,
  lagP99Ms: null,
  mappedEngagementEvents: 0,
  eligibleEngagementEvents: 0,
};
let receivedThisMinute = 0,
  stopping = false,
  sink: AggregateSink,
  activeSocket: WebSocket | null = null,
  lastCursor = 0;
const replayPath = fromRoot(
  process.env.CULT_REPLAY_PATH ??
    `data/replays/bluesky/${new Date().toISOString().slice(0, 10)}.jsonl`,
);
const checkpointPath = fromRoot(
  process.env.CULT_CHECKPOINT_PATH ?? "data/checkpoints/bluesky.json",
);
if (liveSource) {
  if (!process.env.DATABASE_URL)
    throw new Error(
      `${mode} requires DATABASE_URL; live aggregates must be durable`,
    );
  const postgres = new PostgresAggregateSink(process.env.DATABASE_URL);
  await postgres.connect();
  sink = new CompositeSink([postgres, new ReplaySink(replayPath)]);
} else sink = new ReplaySink(replayPath);
async function flush() {
  health.mappedEngagementEvents = attribution.mappedEngagementEvents;
  health.eligibleEngagementEvents = attribution.eligibleEngagementEvents;
  const batch = aggregator.flush(health);
  if (!batch) return;
  lastCursor = batch.cursor;
  await sink.write(batch);
  await writeCheckpoint(
    checkpointPath,
    batch.cursor,
  );
  console.log(
    JSON.stringify({
      level: "info",
      message: "aggregate window persisted",
      windowStart: batch.windowStart,
      eligibleDocuments: batch.observations[0]?.eligibleDocuments ?? 0,
      cursor: batch.cursor,
      state: batch.health.state,
    }),
  );
}
// Persists health/watermark state with zero observations when there is no
// open aggregation window to flush -- otherwise a source that goes silent
// without an aggregate window in progress (e.g. between eligible documents)
// never gets its STALE transition written to source_health_snapshots_v2,
// and /api/v1/data/status keeps serving the last-written HEALTHY row
// indefinitely (see docs/audits/pre-live-readiness.md, "STALE never
// reaches the database" finding).
async function flushHealthOnly() {
  health.mappedEngagementEvents = attribution.mappedEngagementEvents;
  health.eligibleEngagementEvents = attribution.eligibleEngagementEvents;
  const windowStart = Math.floor(Date.now() / 60_000) * 60_000;
  await sink.write({
    source: "BLUESKY",
    windowStart: new Date(windowStart).toISOString(),
    windowEnd: new Date(windowStart + 60_000).toISOString(),
    cursor: lastCursor,
    observedAt: new Date().toISOString(),
    health,
    observations: [],
  });
  console.log(
    JSON.stringify({
      level: "info",
      message: "health-only snapshot persisted",
      state: health.state,
    }),
  );
}
async function processMessage(raw: string, receivedAt = Date.now()) {
  const result = parser.parse(raw, receivedAt);
  if (result.malformed) {
    health.parseErrors++;
    return;
  }
  if (result.duplicate) {
    health.duplicateEvents++;
    return;
  }
  if (behaviorWriter) await behaviorWriter.write(result.behaviorEvents);
  const document = result.document;
  if (!document) return;
  health.lastEventTimestampMs = document.eventAtMs;
  health.lastReceiveTimestampMs = receivedAt;
  health.streamLagMs = Math.max(0, receivedAt - document.eventAtMs);
  receivedThisMinute++;
  if (!document.eligible) return;
  const current = aggregator.currentWindowStart(),
    incoming = Math.floor(document.eventAtMs / 60_000) * 60_000;
  if (current !== null && incoming !== current) await flush();
  aggregator.add(document);
}
async function synthetic() {
  const lines = (
    await readFile(fromRoot("data/fixtures/bluesky-jetstream.jsonl"), "utf8")
  )
    .split(/\r?\n/)
    .filter(Boolean);
  health.state = "HEALTHY";
  for (const line of lines) await processMessage(line, 1_777_000_060_000);
  health.eventsPerMinute = receivedThisMinute;
  await flush();
  await sink.close();
  console.log(
    JSON.stringify({
      level: "info",
      message: "synthetic fixture aggregation complete",
      mode,
    }),
  );
}
async function live() {
  let attempt = 0;
  while (!stopping) {
    const cursor = await readFile(
      checkpointPath,
        "utf8",
      )
        .then((text) => (JSON.parse(text) as { cursor: number }).cursor)
        .catch(() => undefined),
      query = new URLSearchParams();
    for (const collection of [
      "app.bsky.feed.post",
      "app.bsky.feed.like",
      "app.bsky.feed.repost",
    ])
      query.append("wantedCollections", collection);
    if (cursor) query.set("cursor", String(Math.max(0, cursor - 5_000_000)));
    const url = `${process.env.BLUESKY_JETSTREAM_URL ?? "wss://jetstream2.us-east.bsky.network/subscribe"}?${query}`,
      socket = new WebSocket(url, { maxPayload: 1_000_000 });
    activeSocket = socket;
    try {
      await new Promise<void>((done, reject) => {
        socket.once("open", () => {
          health.state = "HEALTHY";
          attempt = 0;
          console.log(
            JSON.stringify({
              level: "info",
              message: "Bluesky Jetstream connected",
              sourceVersion: "BLUESKY-JETSTREAM-1",
            }),
          );
        });
        // Serialize message handling: `processMessage` is async, and
        // MinuteAggregator has no internal locking (it's meant to be
        // called by one caller at a time). Without this chain, back-to-back
        // WS messages could run processMessage concurrently and interleave
        // their flush()/add() calls -- observed live, running this project's
        // first sustained overnight session: two messages spanning a
        // minute boundary raced, one flushed the window while the other
        // was mid-add() for the old window, throwing "Document belongs to
        // a different minute" and killing the whole connection (forcing a
        // reconnect) each time it happened.
        let processingChain = Promise.resolve();
        socket.on("message", (data) => {
          processingChain = processingChain
            .then(() => processMessage(data.toString()))
            .catch(reject);
        });
        socket.once("error", reject);
        socket.once("close", done);
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Bluesky stream error",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      socket.close();
      activeSocket = null;
      health.state = "DISCONNECTED";
      health.reconnectCount++;
      await flush();
    }
    if (stopping) break;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt++, 5));
    await new Promise((done) => setTimeout(done, delay));
  }
  await sink.close();
}
const healthTimer = setInterval(() => {
  health.eventsPerMinute = receivedThisMinute;
  receivedThisMinute = 0;
  const wasStale = health.state === "STALE";
  if (
    health.lastReceiveTimestampMs !== null &&
    Date.now() - health.lastReceiveTimestampMs > 120_000
  )
    health.state = "STALE";
  if (health.state === "STALE" && !wasStale && liveSource) {
    void flushHealthOnly().catch((error) =>
      console.error(
        JSON.stringify({
          level: "error",
          message: "health-only snapshot failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      ),
    );
    // A WS connection can go silently half-dead (the remote end drops
    // without a TCP RST reaching us, or a middlebox swallows the close
    // frame) without ever firing 'close'/'error' -- observed live: the
    // worker logged "Bluesky Jetstream connected" then received nothing
    // for 30+ minutes while still reporting itself connected, because
    // nothing forced a reconnect. Detecting STALE and only *reporting* it
    // (above) doesn't fix a zombie socket; terminate() forces the
    // underlying connection closed so live()'s `finally`/reconnect-with-
    // backoff loop actually runs.
    activeSocket?.terminate();
  }
}, 60_000);
const attributionCleanupTimer = attribution.durable
  ? setInterval(() => {
      void attribution.cleanupExpired().catch((error) =>
        console.error(
          JSON.stringify({
            level: "error",
            message: "attribution retention cleanup failed",
            error: error instanceof Error ? error.message : String(error),
          }),
        ),
      );
    }, 3_600_000)
  : null;
const shutdown = () => {
  stopping = true;
  clearInterval(healthTimer);
  if (attributionCleanupTimer) clearInterval(attributionCleanupTimer);
  // Without this, live()'s reconnect loop only notices `stopping` after the
  // in-flight socket's own close/error promise settles -- if Jetstream
  // never sends one, SIGTERM/SIGINT would hang past a container
  // orchestrator's grace period and get SIGKILLed before the checkpoint/
  // sink flush in live()'s `finally` block runs.
  activeSocket?.close();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
if (attribution.durable) {
  const restored = await attribution.restore();
  console.log(
    JSON.stringify({
      level: "info",
      message: "post attribution warm-start restored",
      restoredPosts: restored,
    }),
  );
}
if (liveSource) await live();
else await synthetic();
clearInterval(healthTimer);
if (attributionCleanupTimer) clearInterval(attributionCleanupTimer);
await attribution.close();
