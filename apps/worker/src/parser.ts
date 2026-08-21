import { createHash } from "node:crypto";
import { z } from "zod";
import { EmojiRegistry } from "@cult/expression-engine";
import type { ContentBucket, ParsedDocument } from "./types.js";
const eventSchema = z.object({
  did: z.string().min(1),
  time_us: z.number().int().nonnegative(),
  kind: z.string(),
  commit: z
    .object({
      operation: z.string(),
      collection: z.string(),
      rkey: z.string(),
      cid: z.string().optional(),
      record: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});
export class EventDeduplicator {
  private readonly ids = new Map<string, number>();
  constructor(private readonly retentionMs = 3_600_000) {}
  seen(id: string, now: number) {
    for (const [key, expires] of this.ids)
      if (expires <= now) this.ids.delete(key);
    if (this.ids.has(id)) return true;
    this.ids.set(id, now + this.retentionMs);
    return false;
  }
}
export class BlueskyEventParser {
  constructor(
    private readonly registry: EmojiRegistry,
    private readonly deduplicator = new EventDeduplicator(),
  ) {}
  parse(
    raw: string,
    receivedAtMs = Date.now(),
  ): { document?: ParsedDocument; duplicate: boolean; malformed: boolean } {
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      return { duplicate: false, malformed: true };
    }
    const result = eventSchema.safeParse(decoded);
    if (!result.success) return { duplicate: false, malformed: true };
    const event = result.data,
      commit = event.commit;
    if (event.kind !== "commit" || !commit)
      return { duplicate: false, malformed: false };
    const id = createHash("sha256")
      .update(
        `${event.did}/${commit.collection}/${commit.rkey}/${commit.cid ?? commit.operation}`,
      )
      .digest("hex");
    if (this.deduplicator.seen(id, receivedAtMs))
      return { duplicate: true, malformed: false };
    if (commit.collection === "app.bsky.feed.repost")
      return {
        document: {
          eventId: id,
          cursor: event.time_us,
          receivedAtMs,
          eventAtMs: Math.floor(event.time_us / 1000),
          actorId: event.did,
          text: "",
          langs: [],
          bucket: "REPOST",
          eligible: false,
          matches: [],
        },
        duplicate: false,
        malformed: false,
      };
    if (
      commit.collection !== "app.bsky.feed.post" ||
      commit.operation !== "create" ||
      !commit.record
    )
      return { duplicate: false, malformed: false };
    const text =
      typeof commit.record.text === "string" ? commit.record.text : "";
    const reply = commit.record.reply !== undefined,
      embed = commit.record.embed as Record<string, unknown> | undefined,
      embedType = embed?.["$type"];
    const quote =
      embedType === "app.bsky.embed.record" ||
      embedType === "app.bsky.embed.recordWithMedia";
    const bucket: ContentBucket = reply
        ? "REPLY"
        : quote
          ? "QUOTE"
          : "ORIGINAL",
      langs = Array.isArray(commit.record.langs)
        ? commit.record.langs
            .filter((x): x is string => typeof x === "string")
            .slice(0, 3)
        : [];
    return {
      document: {
        eventId: id,
        cursor: event.time_us,
        receivedAtMs,
        eventAtMs: Math.floor(event.time_us / 1000),
        actorId: event.did,
        text,
        langs,
        bucket,
        eligible: true,
        matches: this.registry.extract(text),
      },
      duplicate: false,
      malformed: false,
    };
  }
}
