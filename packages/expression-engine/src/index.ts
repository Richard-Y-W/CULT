import { normalizedEntropy } from "@cult/analytics";
export interface ExpressionDataSource<T = unknown> {
  fetchBatch(cursor?: string): Promise<T[]>;
  normalize(raw: T): unknown;
  validate(raw: T): boolean;
}
const phraseAliases: Record<string, string> = {
  "were cooked": "we're cooked",
  "we are cooked": "we're cooked",
  "we’re cooked": "we're cooked",
  "we are so back": "we're so back",
  "were so back": "we're so back",
  "we’re so back": "we're so back",
};
export function normalizeExpression(input: string) {
  let value = input
    .normalize("NFC")
    .replace(/[\uFE0E\uFE0F]/g, "")
    .trim();
  if (/[a-z]/i.test(value))
    value = value.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
  return phraseAliases[value] ?? value;
}
export const canonicalId = (input: string) =>
  `expr_${
    normalizeExpression(input)
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_|_$/g, "")
      .toLowerCase() ||
    Array.from(normalizeExpression(input))
      .map((x) => x.codePointAt(0)?.toString(16))
      .join("_")
  }`;
export const usagePerMillion = (
  expressionDocs: number,
  eligibleDocs: number,
) => (eligibleDocs > 0 ? (expressionDocs / eligibleDocs) * 1_000_000 : 0);
export const velocity = (values: number[]) =>
  values.length < 2 ? 0 : values.at(-1)! - values.at(-2)!;
export const acceleration = (values: number[]) =>
  values.length < 3
    ? 0
    : values.at(-1)! - values.at(-2)! - (values.at(-2)! - values.at(-3)!);
export const breadth = (changes: number[]) =>
  changes.length
    ? Math.max(
        changes.filter((x) => x > 0).length,
        changes.filter((x) => x < 0).length,
      ) / changes.length
    : 0;
export const persistence = (changes: number[]) =>
  changes.length
    ? Math.abs(changes.reduce((s, x) => s + Math.sign(x), 0)) / changes.length
    : 0;
export const semanticEntropy = (labels: Record<string, number>) =>
  normalizedEntropy(Object.values(labels));
export interface Phase2Prevalence {
  rawProbability: number;
  rawPerMillion: number;
  smoothedProbability: number;
  smoothedPerMillion: number;
}
export function jeffreysPrevalence(
  expressionDocuments: number,
  eligibleDocuments: number,
): Phase2Prevalence {
  if (
    !Number.isSafeInteger(expressionDocuments) ||
    !Number.isSafeInteger(eligibleDocuments) ||
    expressionDocuments < 0 ||
    eligibleDocuments < 0 ||
    expressionDocuments > eligibleDocuments
  )
    throw new Error(
      "Document counts must be nonnegative safe integers with expressionDocuments <= eligibleDocuments",
    );
  if (eligibleDocuments === 0)
    return {
      rawProbability: 0,
      rawPerMillion: 0,
      smoothedProbability: 0,
      smoothedPerMillion: 0,
    };
  const rawProbability = expressionDocuments / eligibleDocuments,
    smoothedProbability = (expressionDocuments + 0.5) / (eligibleDocuments + 1);
  return {
    rawProbability,
    rawPerMillion: rawProbability * 1_000_000,
    smoothedProbability,
    smoothedPerMillion: smoothedProbability * 1_000_000,
  };
}
export const logPrevalenceReturn = (current: number, previous: number) => {
  if (current <= 0 || previous <= 0)
    throw new Error("Smoothed probabilities must be positive");
  return Math.log(current / previous);
};
export interface Phase2Signals {
  velocity: number;
  acceleration: number;
  breadth: number;
  signedBreadth: number;
  persistence: number;
  persistenceStrength: number;
}
export function phase2Signals(
  platformReturns: number[],
  platformWeights: number[],
  recentAggregateReturns: number[],
  previousVelocity: number,
): Phase2Signals {
  if (
    !platformReturns.length ||
    platformReturns.length !== platformWeights.length
  )
    throw new Error(
      "Platform returns and weights must be non-empty and aligned",
    );
  const total = platformWeights.reduce((s, w) => {
    if (w < 0) throw new Error("Platform weights must be nonnegative");
    return s + w;
  }, 0);
  if (total <= 0) throw new Error("Platform weights must sum positive");
  let velocity = 0,
    breadth = 0,
    signedBreadth = 0;
  platformReturns.forEach((r, i) => {
    const weight = platformWeights[i]! / total;
    velocity += weight * r;
    if (r > 0) breadth += weight;
    signedBreadth += weight * Math.sign(r);
  });
  const persistence = recentAggregateReturns.length
    ? recentAggregateReturns.reduce((s, r) => s + Math.sign(r), 0) /
      recentAggregateReturns.length
    : 0;
  return {
    velocity,
    acceleration: velocity - previousVelocity,
    breadth,
    signedBreadth,
    persistence,
    persistenceStrength: Math.abs(persistence),
  };
}
export interface AuthorConcentration {
  documents: number;
  uniqueAuthors: number;
  largestAuthorShare: number;
  topTenAuthorShare: number;
  effectiveAuthors: number;
}
export function authorConcentration(counts: number[]): AuthorConcentration {
  if (counts.some((x) => !Number.isSafeInteger(x) || x < 0))
    throw new Error("Author counts must be nonnegative safe integers");
  const sorted = [...counts].sort((a, b) => b - a),
    documents = sorted.reduce((a, b) => a + b, 0);
  if (!documents)
    return {
      documents: 0,
      uniqueAuthors: 0,
      largestAuthorShare: 0,
      topTenAuthorShare: 0,
      effectiveAuthors: 0,
    };
  const squares = sorted.reduce((s, x) => s + x * x, 0);
  return {
    documents,
    uniqueAuthors: sorted.length,
    largestAuthorShare: sorted[0]! / documents,
    topTenAuthorShare:
      sorted.slice(0, 10).reduce((a, b) => a + b, 0) / documents,
    effectiveAuthors: (documents * documents) / squares,
  };
}
export { generateSynthetic } from "./synthetic.js";
export type { SyntheticDataset } from "./synthetic.js";
export { EmojiRegistry } from "./emoji-registry.js";
export type {
  EmojiRegistryAsset,
  EmojiRegistryData,
  EmojiMatch,
} from "./emoji-registry.js";
