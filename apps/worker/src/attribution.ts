import { createHmac, randomBytes } from "node:crypto";
import pg from "pg";

export type ArrivalMode = "LIVE" | "BACKFILLED" | "UNATTRIBUTED";
export type PostContentType = "ORIGINAL" | "REPLY" | "QUOTE";

interface CachedAttribution {
  expressionIds: string[];
  cascadeRootId: string;
  origin: "LIVE" | "RESTORED";
}
export interface AttributionResolution {
  recordId: string;
  hit: CachedAttribution | undefined;
}

const DAY_MS = 86_400_000;

/**
 * Durable, privacy-safe post -> expression attribution.
 *
 * Every post/cascade identity is an HMAC-SHA256 digest of the underlying
 * at:// URI, never the raw URI. The in-memory cache is the hot path for the
 * synchronous parser; `restore()` warm-starts it from Postgres on startup so
 * engagement referencing a post created before this process started (or in a
 * prior process) can still resolve, up to `retentionDays`.
 */
export class AttributionStore {
  private readonly key: Buffer;
  readonly durable: boolean;
  private readonly retentionMs: number;
  private readonly cache = new Map<string, CachedAttribution>();
  private readonly pool?: pg.Pool;
  private readonly pending: Promise<unknown>[] = [];
  mappedEngagementEvents = 0;
  eligibleEngagementEvents = 0;

  constructor(options: {
    secret?: string | undefined;
    retentionDays?: number | undefined;
    databaseUrl?: string | undefined;
  }) {
    this.retentionMs = (options.retentionDays ?? 14) * DAY_MS;
    if (options.secret) {
      this.key = Buffer.from(options.secret);
      this.durable = Boolean(options.databaseUrl);
      if (this.durable)
        this.pool = new pg.Pool({ connectionString: options.databaseUrl });
    } else {
      // A live/durable deployment (databaseUrl set) that silently degraded
      // to a random per-process key would (a) make record_id/cascade_root_id
      // unrecoverable across restarts -- defeating the entire warm-start
      // design -- and (b) silently disable durable writes entirely
      // (recordPost's `this.durable && this.pool` guard below would never
      // fire), collapsing mappedEngagementRate to 0 with no hard failure.
      // Fail closed instead of warn-and-degrade, matching the live-shadow
      // safety gate's "fail closed" requirement.
      if (options.databaseUrl)
        throw new Error(
          "CULT_CASCADE_HASH_SECRET is required for a live/durable deployment (DATABASE_URL is set); refusing to start with a random per-process key",
        );
      this.key = randomBytes(32);
      this.durable = false;
    }
  }

  hash(value: string): string {
    return createHmac("sha256", this.key).update(value).digest("hex");
  }

  recordPost(
    recordUri: string,
    expressionIds: string[],
    cascadeRootUri: string,
    contentType: PostContentType,
    createdAtMs: number,
  ): string {
    const recordId = this.hash(recordUri),
      cascadeRootId = this.hash(cascadeRootUri);
    this.cache.set(recordId, { expressionIds, cascadeRootId, origin: "LIVE" });
    if (this.durable && this.pool) {
      const expiresAt = new Date(createdAtMs + this.retentionMs);
      this.pending.push(
        this.pool
          .query(
            `INSERT INTO post_attribution_map(record_id,expression_ids,cascade_root_id,content_type,created_at,expires_at)
             VALUES($1,$2,$3,$4,$5,$6)
             ON CONFLICT(record_id) DO UPDATE SET
               expression_ids=excluded.expression_ids,
               cascade_root_id=excluded.cascade_root_id,
               content_type=excluded.content_type`,
            [
              recordId,
              expressionIds,
              cascadeRootId,
              contentType,
              new Date(createdAtMs),
              expiresAt,
            ],
          )
          .catch((error) =>
            console.error(
              JSON.stringify({
                level: "error",
                message: "post attribution durable write failed",
                error: error instanceof Error ? error.message : String(error),
              }),
            ),
          ),
      );
    }
    return recordId;
  }

  forgetPost(recordUri: string) {
    const recordId = this.hash(recordUri);
    this.cache.delete(recordId);
    // Without this, restore() would re-load the durable row on the next
    // warm-start and resurrect attribution for a post this process was
    // explicitly told to forget (e.g. on DELETE), resolving post-restart
    // engagement against a post that no longer exists.
    if (this.durable && this.pool)
      this.pending.push(
        this.pool
          .query(`DELETE FROM post_attribution_map WHERE record_id = $1`, [
            recordId,
          ])
          .catch((error) =>
            console.error(
              JSON.stringify({
                level: "error",
                message: "post attribution durable delete failed",
                error: error instanceof Error ? error.message : String(error),
              }),
            ),
          ),
      );
  }

  resolve(uri: string): AttributionResolution {
    const recordId = this.hash(uri);
    return { recordId, hit: this.cache.get(recordId) };
  }

  /** Loads non-expired durable rows into the in-memory cache. Returns the row count restored. */
  async restore(): Promise<number> {
    if (!this.durable || !this.pool) return 0;
    const result = await this.pool.query<{
      record_id: string;
      expression_ids: string[];
      cascade_root_id: string;
    }>(
      `SELECT record_id, expression_ids, cascade_root_id FROM post_attribution_map WHERE expires_at > now()`,
    );
    for (const row of result.rows)
      this.cache.set(row.record_id, {
        expressionIds: row.expression_ids,
        cascadeRootId: row.cascade_root_id,
        origin: "RESTORED",
      });
    return result.rowCount ?? 0;
  }

  /** Deletes durable rows past retention. Returns the row count removed. */
  async cleanupExpired(): Promise<number> {
    if (!this.durable || !this.pool) return 0;
    const result = await this.pool.query(
      `DELETE FROM post_attribution_map WHERE expires_at <= now()`,
    );
    return result.rowCount ?? 0;
  }

  async flushPending() {
    await Promise.allSettled(this.pending.splice(0));
  }

  async close() {
    await this.flushPending();
    await this.pool?.end();
  }
}
