import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EmojiRegistry, type EmojiRegistryData } from "@cult/expression-engine";
import {
  BlueskyEventParser,
  MinuteAggregator,
  type SourceHealth,
} from "@cult/worker";
const registryData = JSON.parse(
    readFileSync("data/reference/unicode/cult-emoji-registry-v1.json", "utf8"),
  ) as EmojiRegistryData,
  lines = readFileSync("data/fixtures/bluesky-jetstream.jsonl", "utf8")
    .split(/\r?\n/)
    .filter(Boolean),
  health: SourceHealth = {
    source: "BLUESKY",
    state: "HEALTHY",
    lastEventTimestampMs: 1777000007000,
    lastReceiveTimestampMs: 1777000060000,
    streamLagMs: 53000,
    eventsPerMinute: 8,
    parseErrors: 1,
    duplicateEvents: 1,
    reconnectCount: 0,
  };
describe("Bluesky aggregate-first ingestion", () => {
  it("classifies original, reply, quote and pure repost eligibility", () => {
    const parser = new BlueskyEventParser(new EmojiRegistry(registryData));
    expect(parser.parse(lines[0]!).document?.bucket).toBe("ORIGINAL");
    expect(parser.parse(lines[1]!).document?.bucket).toBe("REPLY");
    expect(parser.parse(lines[2]!).document?.bucket).toBe("QUOTE");
    const repost = parser.parse(lines[3]!).document;
    expect(repost?.bucket).toBe("REPOST");
    expect(repost?.eligible).toBe(false);
  });
  it("rejects malformed events and deduplicates idempotently", () => {
    const parser = new BlueskyEventParser(new EmojiRegistry(registryData));
    expect(parser.parse("not-json").malformed).toBe(true);
    expect(parser.parse(lines[0]!).duplicate).toBe(false);
    expect(parser.parse(lines[0]!).duplicate).toBe(true);
  });
  it("aggregates binary document presence, intensity, denominators and concentration", () => {
    const parser = new BlueskyEventParser(new EmojiRegistry(registryData)),
      aggregator = new MinuteAggregator(registryData.assets.map((x) => x.id));
    for (const line of lines) {
      const parsed = parser.parse(line, 1777000060000);
      if (parsed.document) aggregator.add(parsed.document);
    }
    const batch = aggregator.flush(health)!;
    const joy = batch.observations.find(
      (x) => x.expressionId === "expr_joy" && x.contentBucket === "ORIGINAL",
    )!;
    expect(joy.eligibleDocuments).toBe(5);
    expect(joy.expressionDocuments).toBe(2);
    expect(joy.occurrenceCount).toBe(6);
    expect(joy.uniqueAuthorEstimate).toBe(2);
    expect(joy.rawPrevalence).toBe(400000);
    expect(joy.sourceVersion).toBe("BLUESKY-JETSTREAM-1");
    const pray = batch.observations.find(
      (x) => x.expressionId === "expr_pray" && x.contentBucket === "REPLY",
    )!;
    expect(pray.expressionDocuments).toBe(1);
    expect(pray.largestAuthorShare).toBe(1);
  });
  it("never exposes actor identifiers or raw text in persisted aggregate shape", () => {
    const parser = new BlueskyEventParser(new EmojiRegistry(registryData)),
      aggregator = new MinuteAggregator(registryData.assets.map((x) => x.id)),
      doc = parser.parse(lines[0]!).document!;
    aggregator.add(doc);
    const serialized = JSON.stringify(aggregator.flush(health));
    expect(serialized).not.toContain("did:plc:alice");
    expect(serialized).not.toContain("committee remains calm");
  });
});
