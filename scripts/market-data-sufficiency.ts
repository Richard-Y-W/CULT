import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { marketDataSufficiency, type Phase4Scenario } from "@cult/hft-engine";

const input = resolve(
    process.argv[2] ?? "data/synthetic/phase4/great-cry.json",
  ),
  output = resolve(
    process.argv[3] ?? "research/results/market-data-sufficiency.json",
  ),
  run = JSON.parse(await readFile(input, "utf8")) as Phase4Scenario,
  groups = new Map<string, bigint[]>();
for (const event of run.expressionTape) {
  if (event.type !== "CREATE") continue;
  for (const expression of event.expressionIds)
    groups.set(expression, [
      ...(groups.get(expression) ?? []),
      BigInt(event.eventTimeNs),
    ]);
}
const assets = Object.fromEntries(
  [...groups].map(([expression, times]) => [
    expression,
    {
      ...marketDataSufficiency(times),
      events: times.length,
      referenceUpdateRecommendation:
        times.length < 2
          ? "INSUFFICIENT_HISTORY"
          : marketDataSufficiency(times).recommendedTier ===
              "TIER_1_HFT_ELIGIBLE"
            ? "1_SECOND"
            : "5_SECONDS_OR_SLOWER",
    },
  ]),
);
await writeFile(
  output,
  `${JSON.stringify(
    {
      classification: "SYNTHETIC_EXPERIMENTAL",
      dataset: run.manifest.dataset,
      methodologyVersion: "CULT-DATA-LIQUIDITY-1",
      assets,
      limitation:
        "Recommendations are mechanical scenario diagnostics, not calibrated live thresholds.",
    },
    null,
    2,
  )}\n`,
);
console.log(JSON.stringify({ input, output, assets: groups.size }));
