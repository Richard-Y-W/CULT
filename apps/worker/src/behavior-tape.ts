import { createHmac, randomBytes } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ParsedBehaviorEvent } from "./types.js";

export class BehaviorTapeWriter {
  private readonly key: Buffer;
  constructor(
    private readonly path: string,
    secret = process.env.CULT_CASCADE_HASH_SECRET,
  ) {
    this.key = secret ? Buffer.from(secret) : randomBytes(32);
  }
  private opaque(value: string) {
    return createHmac("sha256", this.key).update(value).digest("hex");
  }
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
        cascadeId: this.opaque(event.cascadeUri),
        ...(event.parentCascadeUri
          ? { parentCascadeId: this.opaque(event.parentCascadeUri) }
          : {}),
        recordId: this.opaque(event.recordUri),
        isBackfill: false,
        methodologyVersion: "CULT-BEHAVIOR-1",
        sourceVersion: "BLUESKY-JETSTREAM-1",
        expressionRegistryVersion: "EMOJI-17.0-CULT-V1",
      }),
    );
    await appendFile(this.path, `${lines.join("\n")}\n`, "utf8");
  }
}
