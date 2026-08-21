import { readFile } from "node:fs/promises";
import { createPhase4Demo, type Phase4Scenario } from "@cult/hft-engine";

const path = process.argv[2];
if (!path) throw new Error("usage: npm run replay:hft -- <scenario.json>");
const recorded = JSON.parse(await readFile(path, "utf8")) as Phase4Scenario,
  scenario = recorded.manifest.scenario;
if (!(["great-cry", "celebrity", "spam"] as string[]).includes(scenario))
  throw new Error(`unsupported scenario ${scenario}`);
const replayed = createPhase4Demo(
  scenario as "great-cry" | "celebrity" | "spam",
  recorded.manifest.seed,
);
if (replayed.manifest.outputHash !== recorded.manifest.outputHash)
  throw new Error(
    `replay mismatch: ${replayed.manifest.outputHash} != ${recorded.manifest.outputHash}`,
  );
console.log(
  JSON.stringify({
    scenario,
    seed: recorded.manifest.seed,
    outputHash: replayed.manifest.outputHash,
    deterministic: true,
    expressionEvents: replayed.expressionTape.length,
    signalEvents: replayed.signalTape.length,
    marketEvents: replayed.marketTape.length,
  }),
);
