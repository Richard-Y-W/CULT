import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ParsedBehaviorEvent } from "./types.js";

/**
 * Writes the privacy-safe expression-event JSONL tape. Identities on
 * `ParsedBehaviorEvent` (`cascadeUri`/`parentCascadeUri`/`recordUri`) are
 * already HMAC digests produced by `AttributionStore` — this writer passes
 * them through rather than hashing again, so a cascade's id stays stable
 * across a worker restart (same shared secret, same digest).
 */
export class BehaviorTapeWriter {
  constructor(private readonly path: string) {}
  async write(events: ParsedBehaviorEvent[]) {
    if (!events.length) return;
    await mkdir(dirname(this.path), { recursive: true });
    const lines = events.map((event) =>
      JSON.stringify({
        id: event.eventId,
        eventTimeNs: String(BigInt(event.eventAtMs) * 1_000_000n),
        receiveTimeNs: String(BigInt(event.receivedAtMs) * 1_000_000n),
        sourceId: "BLUESKY",
        expressionIds: event.expressionIds,
        type: event.type,
        engagement: {
          likes: event.type === "LIKE" ? 1 : 0,
          reposts: event.type === "REPOST" ? 1 : 0,
          quotes: event.type === "QUOTE" ? 1 : 0,
          replies: event.type === "REPLY" ? 1 : 0,
        },
        cascadeId: event.cascadeUri,
        ...(event.parentCascadeUri
          ? { parentCascadeId: event.parentCascadeUri }
          : {}),
        recordId: event.recordUri,
        arrivalMode: event.arrivalMode,
        isBackfill: event.arrivalMode === "BACKFILLED",
        methodologyVersion: "CULT-BEHAVIOR-1",
        sourceVersion: "BLUESKY-JETSTREAM-1",
        expressionRegistryVersion: "EMOJI-17.0-CULT-V1",
      }),
    );
    await appendFile(this.path, `${lines.join("\n")}\n`, "utf8");
  }
}
