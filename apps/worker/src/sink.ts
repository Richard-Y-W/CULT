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
  }
  async connect() {
    await this.db.connect();
  }
  async write(batch: AggregateBatch) {
    await this.db.query("BEGIN");
    try {
      for (const o of batch.observations)
        await this.db.query(
          `INSERT INTO expression_observations_v2(expression_id,platform_id,content_bucket,window_start,window_end,eligible_documents,expression_documents,occurrence_count,unique_author_estimate,raw_prevalence,smoothed_prevalence,largest_author_share,top_ten_author_share,effective_authors,source_health,methodology_version,source_version,expression_registry_version) VALUES($1,'BLUESKY',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT(expression_id,platform_id,content_bucket,window_start,methodology_version,source_version,expression_registry_version) DO UPDATE SET eligible_documents=excluded.eligible_documents,expression_documents=excluded.expression_documents,occurrence_count=excluded.occurrence_count,unique_author_estimate=excluded.unique_author_estimate,raw_prevalence=excluded.raw_prevalence,smoothed_prevalence=excluded.smoothed_prevalence,largest_author_share=excluded.largest_author_share,top_ten_author_share=excluded.top_ten_author_share,effective_authors=excluded.effective_authors,source_health=excluded.source_health`,
          [
            o.expressionId,
            o.contentBucket,
            o.windowStart,
            o.windowEnd,
            o.eligibleDocuments,
            o.expressionDocuments,
            o.occurrenceCount,
            o.uniqueAuthorEstimate,
            o.rawPrevalence,
            o.smoothedPrevalence,
            o.largestAuthorShare,
            o.topTenAuthorShare,
            o.effectiveAuthors,
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
        `INSERT INTO source_health_snapshots(source_id,observed_at,state,last_event_at,last_receive_at,stream_lag_ms,events_per_minute,parse_errors,duplicate_events,reconnect_count,source_version) VALUES('BLUESKY',now(),$1,$2,$3,$4,$5,$6,$7,$8,'BLUESKY-JETSTREAM-1')`,
        [
          batch.health.state,
          batch.health.lastEventTimestampMs
            ? new Date(batch.health.lastEventTimestampMs)
            : null,
          batch.health.lastReceiveTimestampMs
            ? new Date(batch.health.lastReceiveTimestampMs)
            : null,
          batch.health.streamLagMs,
          batch.health.eventsPerMinute,
          batch.health.parseErrors,
          batch.health.duplicateEvents,
          batch.health.reconnectCount,
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
    for (const sink of this.sinks) await sink.write(batch);
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
