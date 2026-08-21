import type { EmojiMatch } from "@cult/expression-engine";
export type ContentBucket =
  | "ORIGINAL"
  | "REPLY"
  | "QUOTE"
  | "REPOST"
  | "INELIGIBLE";
export type HealthState =
  | "HEALTHY"
  | "DEGRADED"
  | "STALE"
  | "DISCONNECTED"
  | "BACKFILLING";
export interface ParsedDocument {
  eventId: string;
  cursor: number;
  receivedAtMs: number;
  eventAtMs: number;
  actorId: string;
  text: string;
  langs: string[];
  bucket: ContentBucket;
  eligible: boolean;
  matches: EmojiMatch[];
}
export interface SourceHealth {
  source: "BLUESKY";
  state: HealthState;
  lastEventTimestampMs: number | null;
  lastReceiveTimestampMs: number | null;
  streamLagMs: number | null;
  eventsPerMinute: number;
  parseErrors: number;
  duplicateEvents: number;
  reconnectCount: number;
}
export interface AggregateObservation {
  expressionId: string;
  platform: "Bluesky";
  contentBucket: Exclude<ContentBucket, "REPOST" | "INELIGIBLE">;
  windowStart: string;
  windowEnd: string;
  eligibleDocuments: number;
  expressionDocuments: number;
  occurrenceCount: number;
  uniqueAuthorEstimate: number;
  rawPrevalence: number;
  smoothedPrevalence: number;
  largestAuthorShare: number;
  topTenAuthorShare: number;
  effectiveAuthors: number;
  sourceHealth: HealthState;
  methodologyVersion: "COIP-1";
  sourceVersion: "BLUESKY-JETSTREAM-1";
  expressionRegistryVersion: "EMOJI-17.0-CULT-V1";
}
export interface AggregateBatch {
  source: "BLUESKY";
  windowStart: string;
  windowEnd: string;
  cursor: number;
  health: SourceHealth;
  observations: AggregateObservation[];
}
