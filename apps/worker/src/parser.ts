import { createHash } from "node:crypto";
import { z } from "zod";
import { EmojiRegistry } from "@cult/expression-engine";
import { AttributionStore } from "./attribution.js";
import type {
  ContentBucket,
  ParsedBehaviorEvent,
  ParsedDocument,
} from "./types.js";
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
  // Sustained live traffic can hold an hour's worth of ids (hundreds of
  // thousands under real Jetstream volume); scanning the whole map on every
  // single event made this O(n) per call, i.e. effectively O(n^2) over an
  // hour. `Map` preserves insertion order and `now` is non-decreasing in
  // the live path (receivedAtMs defaults to Date.now()), so with a fixed
  // retentionMs, expiry order equals insertion order -- prune from the
  // front and stop at the first still-live entry (amortized O(1)).
  seen(id: string, now: number) {
    for (const [key, expires] of this.ids) {
      if (expires > now) break;
      this.ids.delete(key);
    }
    if (this.ids.has(id)) return true;
    this.ids.set(id, now + this.retentionMs);
    return false;
  }
}
export class BlueskyEventParser {
  constructor(
    private readonly registry: EmojiRegistry,
    private readonly deduplicator = new EventDeduplicator(),
    readonly attribution = new AttributionStore({}),
  ) {}
  parse(
    raw: string,
    receivedAtMs = Date.now(),
  ): {
    document?: ParsedDocument;
    behaviorEvents: ParsedBehaviorEvent[];
    duplicate: boolean;
    malformed: boolean;
  } {
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      return { behaviorEvents: [], duplicate: false, malformed: true };
    }
    const result = eventSchema.safeParse(decoded);
    if (!result.success)
      return { behaviorEvents: [], duplicate: false, malformed: true };
    const event = result.data,
      commit = event.commit;
    if (event.kind !== "commit" || !commit)
      return { behaviorEvents: [], duplicate: false, malformed: false };
    const id = createHash("sha256")
      .update(
        `${event.did}/${commit.collection}/${commit.rkey}/${commit.cid ?? commit.operation}`,
      )
      .digest("hex");
    if (this.deduplicator.seen(id, receivedAtMs))
      return { behaviorEvents: [], duplicate: true, malformed: false };
    const recordUri = `at://${event.did}/${commit.collection}/${commit.rkey}`,
      eventAtMs = Math.floor(event.time_us / 1000),
      behaviorEvents: ParsedBehaviorEvent[] = [],
      strongRefUri = (value: unknown) => {
        if (!value || typeof value !== "object") return undefined;
        const uri = (value as Record<string, unknown>).uri;
        return typeof uri === "string" ? uri : undefined;
      };
    if (
      commit.operation === "delete" &&
      commit.collection === "app.bsky.feed.post"
    ) {
      const resolved = this.attribution.resolve(recordUri);
      if (resolved.hit?.expressionIds.length)
        behaviorEvents.push({
          eventId: id,
          cursor: event.time_us,
          eventAtMs,
          receivedAtMs,
          actorId: event.did,
          expressionIds: resolved.hit.expressionIds,
          type: "DELETE",
          cascadeUri: resolved.hit.cascadeRootId,
          recordUri: resolved.recordId,
          arrivalMode: resolved.hit.origin === "RESTORED" ? "BACKFILLED" : "LIVE",
        });
      this.attribution.forgetPost(recordUri);
      return { behaviorEvents, duplicate: false, malformed: false };
    }
    if (
      commit.operation === "create" &&
      (commit.collection === "app.bsky.feed.like" ||
        commit.collection === "app.bsky.feed.repost") &&
      commit.record
    ) {
      const subjectUri = strongRefUri(commit.record.subject);
      if (subjectUri) {
        this.attribution.eligibleEngagementEvents++;
        const resolved = this.attribution.resolve(subjectUri);
        if (resolved.hit?.expressionIds.length) {
          this.attribution.mappedEngagementEvents++;
          behaviorEvents.push({
            eventId: id,
            cursor: event.time_us,
            eventAtMs,
            receivedAtMs,
            actorId: event.did,
            expressionIds: resolved.hit.expressionIds,
            type:
              commit.collection === "app.bsky.feed.like" ? "LIKE" : "REPOST",
            cascadeUri: resolved.hit.cascadeRootId,
            parentCascadeUri: resolved.recordId,
            recordUri: this.attribution.hash(recordUri),
            arrivalMode:
              resolved.hit.origin === "RESTORED" ? "BACKFILLED" : "LIVE",
          });
        }
      }
      if (commit.collection === "app.bsky.feed.like")
        return { behaviorEvents, duplicate: false, malformed: false };
    }
    if (commit.collection === "app.bsky.feed.repost")
      return {
        document: {
          eventId: id,
          cursor: event.time_us,
          receivedAtMs,
          eventAtMs,
          actorId: event.did,
          text: "",
          langs: [],
          bucket: "REPOST",
          eligible: false,
          matches: [],
        },
        behaviorEvents,
        duplicate: false,
        malformed: false,
      };
    if (
      commit.collection !== "app.bsky.feed.post" ||
      commit.operation !== "create" ||
      !commit.record
    )
      return { behaviorEvents, duplicate: false, malformed: false };
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
        : [],
      matches = this.registry.extract(text),
      expressionIds = matches.map((match) => match.expressionId),
      replyRecord = commit.record.reply as Record<string, unknown> | undefined,
      replyRoot = strongRefUri(replyRecord?.root),
      replyParent = strongRefUri(replyRecord?.parent),
      embedRecord = embed?.record,
      quoteTarget = strongRefUri(
        embedRecord && typeof embedRecord === "object"
          ? ((embedRecord as Record<string, unknown>).record ?? embedRecord)
          : undefined,
      ),
      cascadeUri = replyRoot ?? recordUri;
    const recordId = this.attribution.recordPost(
      recordUri,
      expressionIds,
      cascadeUri,
      bucket as "ORIGINAL" | "REPLY" | "QUOTE",
      eventAtMs,
    );
    if (expressionIds.length)
      behaviorEvents.push({
        eventId: id,
        cursor: event.time_us,
        eventAtMs,
        receivedAtMs,
        actorId: event.did,
        expressionIds,
        type: "CREATE",
        cascadeUri: this.attribution.hash(cascadeUri),
        ...(replyParent
          ? { parentCascadeUri: this.attribution.hash(replyParent) }
          : {}),
        recordUri: recordId,
        arrivalMode: "LIVE",
      });
    const engagementTarget = replyParent ?? quoteTarget;
    if (engagementTarget) {
      this.attribution.eligibleEngagementEvents++;
      const resolved = this.attribution.resolve(engagementTarget);
      if (resolved.hit?.expressionIds.length) {
        this.attribution.mappedEngagementEvents++;
        behaviorEvents.push({
          eventId: `${id}:engagement`,
          cursor: event.time_us,
          eventAtMs,
          receivedAtMs,
          actorId: event.did,
          expressionIds: resolved.hit.expressionIds,
          type: replyParent ? "REPLY" : "QUOTE",
          cascadeUri: resolved.hit.cascadeRootId,
          parentCascadeUri: resolved.recordId,
          recordUri: recordId,
          arrivalMode:
            resolved.hit.origin === "RESTORED" ? "BACKFILLED" : "LIVE",
        });
      }
    }
    return {
      document: {
        eventId: id,
        cursor: event.time_us,
        receivedAtMs,
        eventAtMs,
        actorId: event.did,
        text,
        langs,
        bucket,
        eligible: true,
        matches,
      },
      behaviorEvents,
      duplicate: false,
      malformed: false,
    };
  }
}
