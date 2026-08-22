import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import pg from "pg";
import type { AggregateBatch } from "./types.js";
export interface AggregateSink {
  write(batch: AggregateBatch): Promise<void>;
  close(): Promise<void>;
}
export class ReplaySink implements AggregateSink {
  constructor(private readonly path: string) {}
  async write(batch: AggregateBatch) {
    await mkdir(dirname(this.path), { recursive: true });
    await appendFile(this.path, `${JSON.stringify(batch)}\n`);
  }
  async close() {}
}
export class PostgresAggregateSink implements AggregateSink {
  private readonly db;
  constructor(connectionString: string) {
    this.db = new pg.Client({ connectionString });
    // pg.Client emits 'error' on an unexpected connection loss (dropped
    // backend, network blip); an unhandled EventEmitter 'error' crashes the
    // process with a raw, unstructured exception. Log it in the same
    // structured shape as the rest of the worker, then exit deliberately --
    // under `restart: unless-stopped` this reconnects with clean diagnostics
    // instead of an opaque uncaught-exception crash.
    this.db.on("error", (error) => {
      console.error(
        JSON.stringify({
          level: "error",
          message: "database connection error",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      process.exit(1);
    });
  }
  async connect() {
    await this.db.connect();
  }
  async write(batch: AggregateBatch) {
    await this.db.query("BEGIN");
    try {
      for (const o of batch.observations)
        await this.db.query(
          `INSERT INTO expression_observations_v3(expression_id,platform_id,content_bucket,language_bucket,window_start,window_end,observed_at,arrival_mode,eligible_documents,expression_documents,occurrence_count,intensity_when_present,unique_author_estimate,raw_prevalence,smoothed_prevalence,largest_author_share,top_ten_author_share,author_hhi,effective_authors,documents_per_effective_author,source_health,methodology_version,source_version,expression_registry_version) VALUES($1,'BLUESKY',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) ON CONFLICT(expression_id,platform_id,content_bucket,language_bucket,window_start,methodology_version,source_version,expression_registry_version) DO UPDATE SET window_end=excluded.window_end,observed_at=excluded.observed_at,arrival_mode=excluded.arrival_mode,eligible_documents=excluded.eligible_documents,expression_documents=excluded.expression_documents,occurrence_count=excluded.occurrence_count,intensity_when_present=excluded.intensity_when_present,unique_author_estimate=excluded.unique_author_estimate,raw_prevalence=excluded.raw_prevalence,smoothed_prevalence=excluded.smoothed_prevalence,largest_author_share=excluded.largest_author_share,top_ten_author_share=excluded.top_ten_author_share,author_hhi=excluded.author_hhi,effective_authors=excluded.effective_authors,documents_per_effective_author=excluded.documents_per_effective_author,source_health=excluded.source_health`,
          [
            o.expressionId,
            o.contentBucket,
            o.languageBucket,
            o.windowStart,
            o.windowEnd,
            batch.observedAt,
            o.arrivalMode,
            o.eligibleDocuments,
            o.expressionDocuments,
            o.occurrenceCount,
            o.intensityWhenPresent,
            o.uniqueAuthorEstimate,
            o.rawPrevalence,
            o.smoothedPrevalence,
            o.largestAuthorShare,
            o.topTenAuthorShare,
            o.authorHhi,
            o.effectiveAuthors,
            o.documentsPerEffectiveAuthor,
            o.sourceHealth,
            o.methodologyVersion,
            o.sourceVersion,
            o.expressionRegistryVersion,
          ],
        );
      await this.db.query(
        `INSERT INTO source_watermarks(source_id,cursor,last_event_at,updated_at) VALUES('BLUESKY',$1,$2,now()) ON CONFLICT(source_id) DO UPDATE SET cursor=excluded.cursor,last_event_at=excluded.last_event_at,updated_at=now()`,
        [
          String(batch.cursor),
          batch.health.lastEventTimestampMs
            ? new Date(batch.health.lastEventTimestampMs)
            : null,
        ],
      );
      await this.db.query(
        `INSERT INTO source_health_snapshots_v2(source_id,observed_at,state,last_event_at,last_receive_at,stream_lag_ms,lag_p50_ms,lag_p95_ms,lag_p99_ms,events_per_minute,parse_errors,duplicate_events,reconnect_count,source_version,mapped_engagement_events,eligible_engagement_events) VALUES('BLUESKY',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'BLUESKY-JETSTREAM-1',$13,$14)`,
        [
          batch.observedAt,
          batch.health.state,
          batch.health.lastEventTimestampMs
            ? new Date(batch.health.lastEventTimestampMs)
            : null,
          batch.health.lastReceiveTimestampMs
            ? new Date(batch.health.lastReceiveTimestampMs)
            : null,
          batch.health.streamLagMs,
          batch.health.lagP50Ms,
          batch.health.lagP95Ms,
          batch.health.lagP99Ms,
          batch.health.eventsPerMinute,
          batch.health.parseErrors,
          batch.health.duplicateEvents,
          batch.health.reconnectCount,
          batch.health.mappedEngagementEvents,
          batch.health.eligibleEngagementEvents,
        ],
      );
      await this.db.query("COMMIT");
    } catch (error) {
      await this.db.query("ROLLBACK");
      throw error;
    }
  }
  async close() {
    await this.db.end();
  }
}
export class CompositeSink implements AggregateSink {
  constructor(private readonly sinks: AggregateSink[]) {}
  async write(batch: AggregateBatch) {
    // Attempt every sink even if one fails, so (for example) a transient
    // PostgreSQL outage does not also prevent the local durable ReplaySink
    // append -- the aggregate window would otherwise be lost from both the
    // database and disk with no recovery path. Only throw once all sinks
    // have been attempted, and only if every one of them failed.
    const errors: unknown[] = [];
    for (const sink of this.sinks) {
      try {
        await sink.write(batch);
      } catch (error) {
        errors.push(error);
        console.error(
          JSON.stringify({
            level: "error",
            message: "sink write failed",
            sink: sink.constructor.name,
            windowStart: batch.windowStart,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
    if (errors.length === this.sinks.length && errors.length > 0)
      throw errors[0];
  }
  async close() {
    for (const sink of this.sinks) await sink.close();
  }
}
export const writeCheckpoint = async (path: string, cursor: number) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    JSON.stringify({
      source: "BLUESKY",
      cursor,
      updatedAt: new Date().toISOString(),
    }),
  );
};
