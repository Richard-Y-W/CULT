import {
  ASSETS,
  PLATFORMS,
  round,
  type MarketPoint,
  type Observation,
  type Platform,
  type SemanticPoint,
} from "@cult/shared";
import { semanticEntropy, usagePerMillion } from "./index.js";
export interface SyntheticDataset {
  generatedAt: string;
  seed: number;
  assets: typeof ASSETS;
  history: Record<string, MarketPoint[]>;
  observations: Observation[];
  semantics: Record<string, SemanticPoint[]>;
  events: { day: number; timestamp: string; title: string; assets: string[] }[];
}
class Rng {
  constructor(private s: number) {}
  next() {
    this.s = (this.s * 1664525 + 1013904223) >>> 0;
    return this.s / 4294967296;
  }
  normal() {
    return (
      Math.sqrt(-2 * Math.log(Math.max(this.next(), 1e-9))) *
      Math.cos(2 * Math.PI * this.next())
    );
  }
}
const EVENTS = [
  {
    day: 40,
    title: "Legacy laughter enters structural decline",
    assets: ["expr_joy"],
  },
  {
    day: 85,
    title: "Crying Face overtakes legacy laughter",
    assets: ["expr_crying_face", "expr_joy"],
  },
  {
    day: 120,
    title: "Viral disbelief cycle",
    assets: ["expr_skull", "expr_mind"],
  },
  {
    day: 175,
    title: "Wilted Flower enters high-volatility regime",
    assets: ["expr_wilt"],
  },
  {
    day: 220,
    title: "Synthetic hype event",
    assets: ["expr_fire", "expr_rocket"],
  },
  {
    day: 260,
    title: "Doom regime repricing",
    assets: ["expr_cooked", "expr_over", "expr_l"],
  },
  {
    day: 300,
    title: "BRAINROT20 constituent rebalance",
    assets: ["expr_cooked", "expr_skull", "expr_lmao"],
  },
];
const semanticBase: Record<string, Record<string, number>> = {
  expr_crying_face: {
    humor: 0.34,
    sadness: 0.25,
    disbelief: 0.18,
    affection: 0.1,
    irony: 0.08,
    other: 0.05,
  },
  expr_skull: {
    humor: 0.42,
    sadness: 0.05,
    disbelief: 0.2,
    irony: 0.24,
    fear: 0.04,
    other: 0.05,
  },
  expr_heart: {
    affection: 0.72,
    optimism: 0.12,
    humor: 0.04,
    irony: 0.03,
    sadness: 0.04,
    other: 0.05,
  },
  expr_cooked: {
    pessimism: 0.43,
    humor: 0.24,
    fear: 0.11,
    irony: 0.14,
    anger: 0.03,
    other: 0.05,
  },
};
export function generateSynthetic(
  seed = 20260821,
  days = 365,
): SyntheticDataset {
  const rng = new Rng(seed),
    start = new Date("2025-08-22T00:00:00.000Z"),
    history: Record<string, MarketPoint[]> = {},
    semantics: Record<string, SemanticPoint[]> = {},
    observations: Observation[] = [];
  const global: number[] = [];
  let g = 0;
  for (let d = 0; d < days; d++) {
    g = 0.82 * g + rng.normal() * 0.012;
    global.push(g);
  }
  for (const [ai, asset] of ASSETS.entries()) {
    const points: MarketPoint[] = [],
      sem: SemanticPoint[] = [];
    let level = 1000 * (0.65 + ai * 0.035),
      momentum = 0,
      variance = 0.008;
    const platformLevels: Record<Platform, number> = {
      Reddit: level * 1.15,
      YouTube: level * 1.3,
      Bluesky: level * 0.72,
      Forum: level * 0.9,
    };
    for (let d = 0; d < days; d++) {
      const timestamp = new Date(start.getTime() + d * 86400000).toISOString(),
        event = EVENTS.find((e) => e.day === d && e.assets.includes(asset.id));
      variance = 0.88 * variance + 0.12 * Math.abs(rng.normal() * 0.018);
      if (asset.id === "expr_wilt" && d > 175) variance *= 1.012;
      momentum =
        0.6 * momentum +
        (asset.id === "expr_joy"
          ? -0.0007
          : asset.id === "expr_skull"
            ? 0.00055
            : asset.id === "expr_heart"
              ? 0.0001
              : 0.00025) +
        global[d]! * 0.2 +
        rng.normal() * variance +
        (event?.title.includes("hype")
          ? 0.12
          : event?.title.includes("Doom")
            ? 0.08
            : event?.title.includes("overtakes")
              ? asset.id === "expr_crying_face"
                ? 0.09
                : -0.06
              : event?.title.includes("disbelief")
                ? 0.1
                : 0);
      momentum = Math.max(-0.16, Math.min(0.18, momentum));
      level = Math.max(20, level * Math.exp(momentum));
      const indexValue = level,
        marketPrice =
          indexValue *
          (1 + 0.025 * Math.sin(d / 13 + ai) + 0.012 * rng.normal());
      points.push({
        timestamp,
        indexValue: round(indexValue, 2),
        marketPrice: round(marketPrice, 2),
        ...(event ? { event: event.title } : {}),
      });
      const platformChanges: number[] = [];
      for (const platform of PLATFORMS) {
        const bias = {
            Reddit: 1.06,
            YouTube: 0.98,
            Bluesky: 1.12,
            Forum: 0.86,
          }[platform],
          prev = platformLevels[platform],
          next = Math.max(
            5,
            prev * Math.exp(momentum * bias + rng.normal() * 0.025),
          );
        platformLevels[platform] = next;
        platformChanges.push(next - prev);
        const eligible = 100000 + Math.floor(rng.next() * 400000),
          count = Math.max(0, Math.round((next / 1e6) * eligible));
        observations.push({
          expressionId: asset.id,
          timestamp,
          platform,
          usageCount: count,
          eligibleDocumentCount: eligible,
          uniqueUserEstimate: Math.round(count * (0.72 + rng.next() * 0.18)),
          normalizedUsage: round(usagePerMillion(count, eligible), 2),
          velocity: round(next - prev, 2),
          acceleration: 0,
          breadth: 0,
        });
      }
      const relevant = observations.slice(-4);
      for (const obs of relevant)
        obs.breadth = round(
          Math.max(
            platformChanges.filter((x) => x > 0).length,
            platformChanges.filter((x) => x < 0).length,
          ) / 4,
          2,
        );
      const base = semanticBase[asset.id] ?? {
          humor: 0.2,
          sadness: 0.12,
          irony: 0.12,
          affection: 0.12,
          hype: 0.16,
          pessimism: 0.12,
          other: 0.16,
        },
        drift = asset.id === "expr_crying_face" ? (d / (days - 1)) * 0.1 : 0;
      const labels = { ...base };
      if (drift) {
        labels.humor = (labels.humor ?? 0) + drift;
        labels.sadness = (labels.sadness ?? 0) - drift;
      }
      const noisy = Object.fromEntries(
          Object.entries(labels).map(([k, v]) => [
            k,
            Math.max(0.005, v + rng.normal() * 0.006),
          ]),
        ),
        sum = Object.values(noisy).reduce((a, b) => a + b, 0);
      for (const k in noisy) noisy[k] = noisy[k]! / sum;
      sem.push({
        expressionId: asset.id,
        timestamp,
        labels: Object.fromEntries(
          Object.entries(noisy).map(([k, v]) => [k, round(v, 4)]),
        ),
        entropy: round(semanticEntropy(noisy), 4),
      });
    }
    const factor =
      asset.currentIndexValue /
      (points.at(-1)?.indexValue ?? asset.currentIndexValue);
    for (const point of points) {
      point.indexValue = round(point.indexValue * factor, 2);
      point.marketPrice = round(point.marketPrice * factor, 2);
    }
    history[asset.id] = points;
    semantics[asset.id] = sem;
  }
  return {
    generatedAt: new Date(start.getTime() + days * 86400000).toISOString(),
    seed,
    assets: ASSETS,
    history,
    observations,
    semantics,
    events: EVENTS.map((e) => ({
      ...e,
      timestamp: new Date(start.getTime() + e.day * 86400000).toISOString(),
    })),
  };
}
