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
    const rows = batch.observations.filter(
        (x) =>
          x.expressionId === id &&
          (x.languageBucket === undefined || x.languageBucket === "ALL"),
      ),
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
const daily = new Map<
  string,
  {
    eligible: number;
    expressed: number;
    occurrences: number;
    windows: Set<string>;
  }
>();
for (const batch of batches)
  for (const row of batch.observations) {
    if (row.languageBucket !== undefined && row.languageBucket !== "ALL")
      continue;
    const key = `${row.expressionId}|${batch.windowStart.slice(0, 10)}`,
      state = daily.get(key) ?? {
        eligible: 0,
        expressed: 0,
        occurrences: 0,
        windows: new Set<string>(),
      };
    state.eligible += row.eligibleDocuments;
    state.expressed += row.expressionDocuments;
    state.occurrences += row.occurrenceCount;
    state.windows.add(batch.windowStart);
    daily.set(key, state);
  }
const dailyCloses = [...daily.entries()].map(([key, state]) => {
  const [expressionId, closeDate] = key.split("|"),
    prevalence = jeffreysPrevalence(state.expressed, state.eligible);
  return {
    expressionId,
    closeDate,
    eligibleDocuments: state.eligible,
    expressionDocuments: state.expressed,
    rawPrevalence: prevalence.rawPerMillion,
    smoothedPrevalence: prevalence.smoothedPerMillion,
    observedWindows: state.windows.size,
    isFinal: state.windows.size === 1440,
  };
});
const checksum = await import("node:crypto").then(({ createHash }) =>
  createHash("sha256")
    .update(JSON.stringify({ snapshots, dailyCloses }))
    .digest("hex"),
);
console.log(
  JSON.stringify({
    source: "BLUESKY",
    batches: batches.length,
    aggregateObservations: observationCount,
    referenceSnapshots: snapshots.length,
    dailyCloseCandidates: dailyCloses.length,
    finalDailyCloses: dailyCloses.filter((close) => close.isFinal).length,
    firstWindow: batches[0]?.windowStart,
    lastWindow: batches.at(-1)?.windowEnd,
    methodologyVersion: "REF-JEFFREYS-1",
    registryVersion: "EMOJI-17.0-CULT-V1",
    checksum,
  }),
);
