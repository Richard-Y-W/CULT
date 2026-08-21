import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { EmojiRegistry, type EmojiRegistryData } from "@cult/expression-engine";
import { resolveDataMode } from "@cult/hft-engine";
import { BlueskyEventParser } from "./parser.js";
import { MinuteAggregator } from "./aggregator.js";
import { BehaviorTapeWriter } from "./behavior-tape.js";
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
const registry = new EmojiRegistry(registryData),
  parser = new BlueskyEventParser(registry),
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
};
let receivedThisMinute = 0,
  stopping = false,
  sink: AggregateSink;
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
  const batch = aggregator.flush(health);
  if (!batch) return;
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
        socket.on("message", (data) => {
          void processMessage(data.toString()).catch(reject);
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
  if (
    health.lastReceiveTimestampMs !== null &&
    Date.now() - health.lastReceiveTimestampMs > 120_000
  )
    health.state = "STALE";
}, 60_000);
const shutdown = () => {
  stopping = true;
  clearInterval(healthTimer);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
if (liveSource) await live();
else await synthetic();
clearInterval(healthTimer);
