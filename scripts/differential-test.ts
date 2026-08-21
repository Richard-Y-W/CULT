import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  beta,
  correlation,
  covariance,
  drawdown,
  momentum,
  normalizedEntropy,
  volatility,
  zScore,
} from "@cult/analytics";
import { jeffreysPrevalence, phase2Signals } from "@cult/expression-engine";

const candidates = ["build/cpp/cult_golden.exe", "build/cpp/cult_golden"];
const executable = candidates
  .map((candidate) => resolve(candidate))
  .find((candidate) => existsSync(candidate));
if (!executable)
  throw new Error(
    "C++ golden executable missing. Run npm run cpp:configure and npm run cpp:build first.",
  );
const native = Object.fromEntries(
  execFileSync(executable, { encoding: "utf8" })
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const [key, value] = line.split("=");
      return [key!, Number(value)];
    }),
);
const values = [100, 110, 121, 115, 130],
  a = [0.1, 0.2, -0.1, 0.3],
  b = [0.2, 0.4, -0.2, 0.6];
const entropy = [0.34, 0.25, 0.18, 0.1, 0.08, 0.05],
  prevalence = jeffreysPrevalence(10, 1000);
const signals = phase2Signals(
  [0.1, -0.05, 0.02],
  [0.5, 0.3, 0.2],
  [0.1, 0.2, -0.1],
  0.03,
);
const expected: Record<string, number> = {
  momentum: momentum(values, 3),
  volatility: volatility(a),
  covariance: covariance(a, b),
  correlation: correlation(a, b),
  beta: beta(a, b),
  drawdown: drawdown(values).max,
  zscore: zScore(130, values),
  entropy: normalizedEntropy(entropy),
  raw_prevalence: prevalence.rawPerMillion,
  smoothed_probability: prevalence.smoothedProbability,
  velocity: signals.velocity,
  acceleration: signals.acceleration,
  breadth: signals.breadth,
  signed_breadth: signals.signedBreadth,
  persistence: signals.persistence,
  reference: 1080,
};
const absoluteTolerance = 1e-11,
  relativeTolerance = 1e-10;
for (const [name, value] of Object.entries(expected)) {
  const actual = native[name];
  if (actual === undefined)
    throw new Error(`Native golden output missing ${name}`);
  const tolerance = absoluteTolerance + relativeTolerance * Math.abs(value);
  if (Math.abs(actual - value) > tolerance)
    throw new Error(
      `${name} parity failed: TypeScript=${value}, C++=${actual}, tolerance=${tolerance}`,
    );
}
console.log(
  `Differential parity passed for ${Object.keys(expected).length} metrics (abs ${absoluteTolerance}, rel ${relativeTolerance}).`,
);
