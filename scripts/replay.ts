import { readFile } from "node:fs/promises";
import {
  jeffreysPrevalence,
  logPrevalenceReturn,
} from "@cult/expression-engine";
import type { AggregateBatch } from "@cult/worker";
const path =
    process.argv[2] ??
    `data/replays/bluesky/${new Date().toISOString().slice(0, 10)}.jsonl`,
  text = await readFile(path, "utf8"),
  batches = text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AggregateBatch)
    .sort((a, b) => a.windowStart.localeCompare(b.windowStart));
const previousProbability = new Map<string, number>(),
  indexValue = new Map<string, number>();
let observationCount = 0;
const snapshots: {
  expressionId: string;
  windowStart: string;
  rawPrevalence: number;
  smoothedPrevalence: number;
  referenceIndex: number;
  status: "PROVISIONAL";
  methodologyVersion: string;
}[] = [];
for (const batch of batches) {
  const ids = [
    ...new Set(batch.observations.map((x) => x.expressionId)),
  ].sort();
  for (const id of ids) {
    const rows = batch.observations.filter((x) => x.expressionId === id),
      eligible = rows.reduce((s, x) => s + x.eligibleDocuments, 0),
      expressed = rows.reduce((s, x) => s + x.expressionDocuments, 0),
      p = jeffreysPrevalence(expressed, eligible),
      previous = previousProbability.get(id),
      priorIndex = indexValue.get(id) ?? 1000,
      next =
        previous && p.smoothedProbability > 0
          ? priorIndex *
            Math.exp(logPrevalenceReturn(p.smoothedProbability, previous))
          : priorIndex;
    previousProbability.set(id, p.smoothedProbability);
    indexValue.set(id, next);
    snapshots.push({
      expressionId: id,
      windowStart: batch.windowStart,
      rawPrevalence: p.rawPerMillion,
      smoothedPrevalence: p.smoothedPerMillion,
      referenceIndex: next,
      status: "PROVISIONAL",
      methodologyVersion: "REF-JEFFREYS-1",
    });
    observationCount += rows.length;
  }
}
const checksum = await import("node:crypto").then(({ createHash }) =>
  createHash("sha256").update(JSON.stringify(snapshots)).digest("hex"),
);
console.log(
  JSON.stringify({
    source: "BLUESKY",
    batches: batches.length,
    aggregateObservations: observationCount,
    referenceSnapshots: snapshots.length,
    firstWindow: batches[0]?.windowStart,
    lastWindow: batches.at(-1)?.windowEnd,
    methodologyVersion: "REF-JEFFREYS-1",
    registryVersion: "EMOJI-17.0-CULT-V1",
    checksum,
  }),
);
