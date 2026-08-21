export type WeightingMethod =
  | "EQUAL"
  | "PREVALENCE"
  | "SQRT_PREVALENCE"
  | "INVERSE_VOLATILITY";

export function researchWeights(
  values: number[],
  method: WeightingMethod,
  cap = 1,
) {
  if (
    !values.length ||
    values.some((value) => value < 0) ||
    cap <= 0 ||
    cap > 1
  )
    throw new RangeError("invalid research weighting inputs");
  let raw = values.map((value) => value);
  if (method === "EQUAL") raw = values.map(() => 1);
  else if (method === "SQRT_PREVALENCE") raw = values.map(Math.sqrt);
  else if (method === "INVERSE_VOLATILITY")
    raw = values.map((value) => (value > 0 ? 1 / value : 0));
  if (raw.reduce((a, b) => a + b, 0) === 0)
    throw new RangeError("weight signal has no eligible mass");
  let weights = raw.map((value) => value / raw.reduce((a, b) => a + b, 0));
  for (let iteration = 0; iteration < values.length + 1; iteration++) {
    const excess = weights.reduce(
      (sum, weight) => sum + Math.max(0, weight - cap),
      0,
    );
    if (excess < 1e-12) break;
    weights = weights.map((weight) => Math.min(weight, cap));
    const uncapped = weights
        .map((weight, index) => ({ weight, index }))
        .filter(({ weight }) => weight < cap - 1e-12),
      base = uncapped.reduce((sum, item) => sum + item.weight, 0);
    if (!uncapped.length || base === 0)
      throw new RangeError("cap is infeasible for constituent count");
    for (const item of uncapped)
      weights[item.index]! += excess * (item.weight / base);
  }
  return weights;
}

export function indexDiagnostics(oldWeights: number[], newWeights: number[]) {
  if (oldWeights.length !== newWeights.length || !newWeights.length)
    throw new RangeError("index compositions must align");
  const hhi = newWeights.reduce((sum, value) => sum + value * value, 0);
  return {
    hhi,
    effectiveConstituentCount: hhi ? 1 / hhi : 0,
    rebalanceTurnover:
      0.5 *
      newWeights.reduce(
        (sum, value, index) => sum + Math.abs(value - oldWeights[index]!),
        0,
      ),
  };
}

export function bufferedSelection(
  rankedIds: string[],
  existingIds: string[],
  targetCount: number,
  entryRank: number,
  exitRank: number,
) {
  if (entryRank > exitRank || targetCount <= 0)
    throw new RangeError("invalid index buffer rules");
  const ranks = new Map(rankedIds.map((id, index) => [id, index + 1])),
    retained = existingIds.filter(
      (id) => (ranks.get(id) ?? Infinity) <= exitRank,
    ),
    entrants = rankedIds.filter(
      (id) =>
        !retained.includes(id) && (ranks.get(id) ?? Infinity) <= entryRank,
    ),
    selected = [...retained, ...entrants].slice(0, targetCount);
  for (const id of rankedIds)
    if (selected.length < targetCount && !selected.includes(id))
      selected.push(id);
  return selected;
}
