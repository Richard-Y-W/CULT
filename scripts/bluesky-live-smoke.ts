import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import WebSocket from "ws";
import { BlueskyEventParser } from "../apps/worker/src/parser.js";
import {
  EmojiRegistry,
  type EmojiRegistryData,
} from "../packages/expression-engine/src/emoji-registry.js";

const endpoint =
  process.env.BLUESKY_JETSTREAM_URL ??
  "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";
const timeoutMs = Number(process.env.CULT_LIVE_SMOKE_TIMEOUT_MS ?? 20_000);
const registryData = JSON.parse(
  await readFile(
    resolve("data/reference/unicode/cult-emoji-registry-v1.json"),
    "utf8",
  ),
) as EmojiRegistryData;
const registry = new EmojiRegistry(registryData);
const parser = new BlueskyEventParser(registry);
const socket = new WebSocket(endpoint);
let completed = false;

const timeout = setTimeout(() => {
  socket.close();
  console.error(JSON.stringify({ status: "timeout", timeoutMs }));
  process.exitCode = 1;
}, timeoutMs);

socket.on("message", (payload) => {
  if (completed) return;
  const result = parser.parse(payload.toString());
  if (!result.document) return;
  completed = true;
  clearTimeout(timeout);
  console.log(
    JSON.stringify({
      status: "ok",
      source: "BLUESKY",
      contentBucket: result.document.bucket,
      emojiExpressionsDetected: result.document.matches.length,
      cursor: result.document.cursor,
      retainedText: false,
      retainedActorIdentifier: false,
    }),
  );
  socket.close();
});

socket.on("error", (error) => {
  clearTimeout(timeout);
  console.error(JSON.stringify({ status: "error", message: error.message }));
  process.exitCode = 1;
});
