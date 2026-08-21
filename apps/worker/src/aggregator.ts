import { createHmac, randomBytes } from "node:crypto";
import {
  authorConcentration,
  jeffreysPrevalence,
} from "@cult/expression-engine";
import type {
  AggregateBatch,
  AggregateObservation,
  ContentBucket,
  ParsedDocument,
  SourceHealth,
} from "./types.js";
type EligibleBucket = Exclude<ContentBucket, "REPOST" | "INELIGIBLE">;
interface ExpressionState {
  documents: number;
  occurrences: number;
  authors: Map<string, number>;
}
interface BucketState {
  eligible: number;
  expressions: Map<string, ExpressionState>;
}
const languageBucket = (langs: string[]) => {
  const candidate = langs[0]?.trim().toLowerCase();
  if (!candidate || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(candidate))
    return "und";
  return candidate.split("-")[0]!;
};
const percentile = (values: number[], probability: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(probability * sorted.length))
  ]!;
};
export class MinuteAggregator {
  private windowStart: number | null = null;
  private cursor = 0;
  private key = randomBytes(32);
  private buckets = new Map<string, BucketState>();
  private lags: number[] = [];
  constructor(private readonly registryIds: string[]) {
    for (const bucket of ["ORIGINAL", "REPLY", "QUOTE"] as EligibleBucket[])
      this.buckets.set(`${bucket}|ALL`, {
        eligible: 0,
        expressions: new Map(),
      });
  }
  add(document: ParsedDocument) {
    if (
      !document.eligible ||
      document.bucket === "REPOST" ||
      document.bucket === "INELIGIBLE"
    )
      return;
    const start = Math.floor(document.eventAtMs / 60_000) * 60_000;
    if (this.windowStart === null) this.windowStart = start;
    if (start !== this.windowStart)
      throw new Error(
        "Document belongs to a different minute; flush the current window first",
      );
    this.cursor = Math.max(this.cursor, document.cursor);
    this.lags.push(Math.max(0, document.receivedAtMs - document.eventAtMs));
    const actor = createHmac("sha256", this.key)
      .update(document.actorId)
      .digest("hex");
    for (const language of ["ALL", languageBucket(document.langs)]) {
      const key = `${document.bucket}|${language}`,
        state = this.buckets.get(key) ?? {
          eligible: 0,
          expressions: new Map(),
        };
      state.eligible++;
      for (const match of document.matches) {
        const expression = state.expressions.get(match.expressionId) ?? {
          documents: 0,
          occurrences: 0,
          authors: new Map(),
        };
        expression.documents++;
        expression.occurrences += match.occurrences;
        expression.authors.set(actor, (expression.authors.get(actor) ?? 0) + 1);
        state.expressions.set(match.expressionId, expression);
      }
      this.buckets.set(key, state);
    }
  }
  currentWindowStart() {
    return this.windowStart;
  }
  flush(health: SourceHealth): AggregateBatch | null {
    if (this.windowStart === null) return null;
    const end = this.windowStart + 60_000,
      observations: AggregateObservation[] = [];
    for (const [stratum, state] of this.buckets) {
      const [bucket, language] = stratum.split("|") as [EligibleBucket, string];
      for (const expressionId of this.registryIds) {
        const expression = state.expressions.get(expressionId),
          prevalence = jeffreysPrevalence(
            expression?.documents ?? 0,
            state.eligible,
          ),
          concentration = authorConcentration([
            ...(expression?.authors.values() ?? []),
          ]);
        observations.push({
          expressionId,
          platform: "Bluesky",
          contentBucket: bucket,
          languageBucket: language,
          windowStart: new Date(this.windowStart).toISOString(),
          windowEnd: new Date(end).toISOString(),
          eligibleDocuments: state.eligible,
          expressionDocuments: expression?.documents ?? 0,
          occurrenceCount: expression?.occurrences ?? 0,
          intensityWhenPresent: expression?.documents
            ? expression.occurrences / expression.documents
            : 0,
          uniqueAuthorEstimate: concentration.uniqueAuthors,
          rawPrevalence: prevalence.rawPerMillion,
          smoothedPrevalence: prevalence.smoothedPerMillion,
          largestAuthorShare: concentration.largestAuthorShare,
          topTenAuthorShare: concentration.topTenAuthorShare,
          effectiveAuthors: concentration.effectiveAuthors,
          authorHhi:
            concentration.effectiveAuthors > 0
              ? 1 / concentration.effectiveAuthors
              : 0,
          documentsPerEffectiveAuthor:
            concentration.effectiveAuthors > 0
              ? concentration.documents / concentration.effectiveAuthors
              : 0,
          arrivalMode: health.state === "BACKFILLING" ? "BACKFILLED" : "LIVE",
          sourceHealth: health.state,
          methodologyVersion: "COIP-1.1",
          sourceVersion: "BLUESKY-JETSTREAM-1",
          expressionRegistryVersion: "EMOJI-17.0-CULT-V1",
        });
      }
    }
    const batchHealth = {
      ...health,
      lagP50Ms: percentile(this.lags, 0.5),
      lagP95Ms: percentile(this.lags, 0.95),
      lagP99Ms: percentile(this.lags, 0.99),
    };
    const batch = {
      source: "BLUESKY" as const,
      windowStart: new Date(this.windowStart).toISOString(),
      windowEnd: new Date(end).toISOString(),
      cursor: this.cursor,
      observedAt: new Date().toISOString(),
      health: batchHealth,
      observations,
    };
    this.windowStart = null;
    this.cursor = 0;
    this.key = randomBytes(32);
    this.lags = [];
    for (const state of this.buckets.values()) {
      state.eligible = 0;
      state.expressions.clear();
    }
    return batch;
  }
}
