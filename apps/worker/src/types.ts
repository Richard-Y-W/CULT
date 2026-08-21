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
export type BehaviorEventType =
  | "CREATE"
  | "LIKE"
  | "REPOST"
  | "REPLY"
  | "QUOTE"
  | "DELETE";
export interface ParsedBehaviorEvent {
  eventId: string;
  cursor: number;
  eventAtMs: number;
  receivedAtMs: number;
  actorId: string;
  expressionIds: string[];
  type: BehaviorEventType;
  cascadeUri: string;
  parentCascadeUri?: string;
  recordUri: string;
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
  lagP50Ms: number | null;
  lagP95Ms: number | null;
  lagP99Ms: number | null;
}
export interface AggregateObservation {
  expressionId: string;
  platform: "Bluesky";
  contentBucket: Exclude<ContentBucket, "REPOST" | "INELIGIBLE">;
  languageBucket: string;
  windowStart: string;
  windowEnd: string;
  eligibleDocuments: number;
  expressionDocuments: number;
  occurrenceCount: number;
  intensityWhenPresent: number;
  uniqueAuthorEstimate: number;
  rawPrevalence: number;
  smoothedPrevalence: number;
  largestAuthorShare: number;
  topTenAuthorShare: number;
  effectiveAuthors: number;
  authorHhi: number;
  documentsPerEffectiveAuthor: number;
  arrivalMode: "LIVE" | "BACKFILLED";
  sourceHealth: HealthState;
  methodologyVersion: "COIP-1.1";
  sourceVersion: "BLUESKY-JETSTREAM-1";
  expressionRegistryVersion: "EMOJI-17.0-CULT-V1";
}
export interface AggregateBatch {
  source: "BLUESKY";
  windowStart: string;
  windowEnd: string;
  cursor: number;
  observedAt: string;
  health: SourceHealth;
  observations: AggregateObservation[];
}
