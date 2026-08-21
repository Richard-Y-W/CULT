import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPhase4Demo } from "@cult/hft-engine";

const root = resolve(import.meta.dirname, ".."),
  output = resolve(root, "data/synthetic/phase4"),
  results = resolve(root, "research/results");
await mkdir(output, { recursive: true });
await mkdir(results, { recursive: true });
for (const scenario of ["great-cry", "celebrity", "spam"] as const) {
  const run = createPhase4Demo(scenario);
  await writeFile(
    resolve(output, `${scenario}.json`),
    `${JSON.stringify(run, null, 2)}\n`,
  );
}
const broad = createPhase4Demo("great-cry"),
  concentrated = createPhase4Demo("celebrity"),
  spam = createPhase4Demo("spam");
await writeFile(
  resolve(results, "phase4-expression-market-demo.md"),
  `# Phase 4 expression-to-market demonstration\n\nClassification: **SYNTHETIC / EXPERIMENTAL**  \nDataset: \`${broad.manifest.dataset}\`  \nMethodologies: \`CULT-BEHAVIOR-1\`, \`CULT-X-1\`\n\n| Scenario | Reference | Market | Basis | Amplification | Cascade HHI | Effective cascades | Trades | Replay hash |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n| Great Cry Shock | ${broad.state.reference} | ${broad.state.market} | ${(100 * broad.state.basisPercent).toFixed(2)}% | ${broad.state.amplification} | ${broad.state.cascadeHhi} | ${broad.state.effectiveCascades} | ${broad.marketTape.filter((event) => event.type === "TRADE").length} | \`${broad.manifest.outputHash}\` |\n| Celebrity shock | ${concentrated.state.reference} | ${concentrated.state.market} | ${(100 * concentrated.state.basisPercent).toFixed(2)}% | ${concentrated.state.amplification} | ${concentrated.state.cascadeHhi} | ${concentrated.state.effectiveCascades} | ${concentrated.marketTape.filter((event) => event.type === "TRADE").length} | \`${concentrated.manifest.outputHash}\` |\n| Spam-like shock | ${spam.state.reference} | ${spam.state.market} | ${(100 * spam.state.basisPercent).toFixed(2)}% | ${spam.state.amplification} | ${spam.state.cascadeHhi} | ${spam.state.effectiveCascades} | ${spam.marketTape.filter((event) => event.type === "TRADE").length} | \`${spam.manifest.outputHash}\` |\n\nThe scenarios deliberately separate document presence from engagement. Equal-looking engagement is down-weighted by breadth/concentration quality in the spam-like case. These are controlled simulator results, not empirical Bluesky findings.\n`,
);
console.log(
  JSON.stringify({
    scenarios: 3,
    output,
    report: resolve(results, "phase4-expression-market-demo.md"),
    greatCryHash: broad.manifest.outputHash,
  }),
);
