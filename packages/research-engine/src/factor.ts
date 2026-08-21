import {
  mean,
  pearson,
  robustZScore,
  sampleVolatility,
  spearman,
} from "./statistics.js";

export function winsorize(values: number[], lower = 0.01, upper = 0.99) {
  if (!(lower >= 0 && lower < upper && upper <= 1))
    throw new RangeError("invalid winsorization percentiles");
  const sorted = [...values].sort((a, b) => a - b),
    low = sorted[Math.floor((sorted.length - 1) * lower)] ?? 0,
    high = sorted[Math.ceil((sorted.length - 1) * upper)] ?? 0;
  return values.map((value) => Math.max(low, Math.min(high, value)));
}

export function crossSectionalZScores(values: number[], robust = false) {
  if (robust) return values.map((value) => robustZScore(value, values));
  const average = mean(values),
    deviation = sampleVolatility(values);
  return values.map((value) => (deviation ? (value - average) / deviation : 0));
}

function solve(matrix: number[][], target: number[]) {
  const n = target.length,
    augmented = matrix.map((row, index) => [...row, target[index]!]);
  for (let pivot = 0; pivot < n; pivot++) {
    let best = pivot;
    for (let row = pivot + 1; row < n; row++)
      if (
        Math.abs(augmented[row]![pivot]!) > Math.abs(augmented[best]![pivot]!)
      )
        best = row;
    [augmented[pivot], augmented[best]] = [augmented[best]!, augmented[pivot]!];
    const divisor = augmented[pivot]![pivot]!;
    if (Math.abs(divisor) < 1e-12)
      throw new RangeError("singular regression design");
    for (let column = pivot; column <= n; column++)
      augmented[pivot]![column] = augmented[pivot]![column]! / divisor;
    for (let row = 0; row < n; row++) {
      if (row === pivot) continue;
      const factor = augmented[row]![pivot]!;
      for (let column = pivot; column <= n; column++)
        augmented[row]![column] =
          augmented[row]![column]! - factor * augmented[pivot]![column]!;
    }
  }
  return augmented.map((row) => row[n]!);
}

export function neutralize(signal: number[], controls: number[][]) {
  if (controls.some((column) => column.length !== signal.length))
    throw new RangeError("neutralization inputs must align");
  const design = signal.map((_, row) => [
      1,
      ...controls.map((column) => column[row]!),
    ]),
    columns = design[0]?.length ?? 0,
    xtx = Array.from({ length: columns }, (_, i) =>
      Array.from({ length: columns }, (_, j) =>
        design.reduce((sum, row) => sum + row[i]! * row[j]!, 0),
      ),
    ),
    xty = Array.from({ length: columns }, (_, i) =>
      design.reduce((sum, row, index) => sum + row[i]! * signal[index]!, 0),
    ),
    coefficients = solve(xtx, xty),
    residuals = signal.map(
      (value, index) =>
        value -
        design[index]!.reduce(
          (sum, item, column) => sum + item * coefficients[column]!,
          0,
        ),
    );
  return { coefficients, residuals };
}

export function quantilePortfolio(
  signal: number[],
  forwardReturns: number[],
  quantiles = 5,
) {
  if (
    signal.length !== forwardReturns.length ||
    signal.length < quantiles ||
    quantiles < 2
  )
    throw new RangeError("invalid quantile portfolio inputs");
  const ranked = signal
      .map((value, index) => ({ value, forwardReturn: forwardReturns[index]! }))
      .sort((a, b) => a.value - b.value),
    buckets = Array.from({ length: quantiles }, () => [] as number[]);
  ranked.forEach((item, index) =>
    buckets[
      Math.min(quantiles - 1, Math.floor((index * quantiles) / ranked.length))
    ]!.push(item.forwardReturn),
  );
  const returns = buckets.map(mean);
  return { quantileReturns: returns, longShort: returns.at(-1)! - returns[0]! };
}

export function multipleTesting(pValues: number[], alpha = 0.05) {
  if (pValues.some((value) => value < 0 || value > 1))
    throw new RangeError("p-values must be probabilities");
  const bonferroniThreshold = pValues.length ? alpha / pValues.length : 0,
    ordered = pValues
      .map((value, index) => ({ value, index }))
      .sort((a, b) => a.value - b.value);
  let largestAcceptedRank = 0;
  ordered.forEach((item, rank) => {
    if (item.value <= ((rank + 1) / pValues.length) * alpha)
      largestAcceptedRank = rank + 1;
  });
  const bhAccepted = new Set(
    ordered.slice(0, largestAcceptedRank).map((item) => item.index),
  );
  return pValues.map((pValue, index) => ({
    pValue,
    bonferroniSignificant: pValue <= bonferroniThreshold,
    benjaminiHochbergSignificant: bhAccepted.has(index),
  }));
}

export interface WalkForwardSplit {
  train: number[];
  test: number[];
}

export function walkForwardSplits(
  observations: number,
  trainLength: number,
  testLength: number,
  step = testLength,
  purge = 0,
  embargo = 0,
): WalkForwardSplit[] {
  if (
    observations <= 0 ||
    trainLength <= 0 ||
    testLength <= 0 ||
    step <= 0 ||
    purge < 0 ||
    embargo < 0
  )
    throw new RangeError("walk-forward lengths must be valid");
  const splits: WalkForwardSplit[] = [];
  for (
    let trainStart = 0;
    trainStart + trainLength + purge + testLength <= observations;
    trainStart += step
  ) {
    const trainEnd = trainStart + trainLength,
      testStart = trainEnd + purge,
      testEnd = testStart + testLength;
    splits.push({
      train: Array.from({ length: trainLength }, (_, i) => trainStart + i),
      test: Array.from({ length: testLength }, (_, i) => testStart + i),
    });
    trainStart += embargo;
  }
  return splits;
}

export function signalDecay(signals: number[][], futureReturns: number[][]) {
  if (signals.length !== futureReturns.length)
    throw new RangeError("decay inputs must align by horizon");
  return signals.map((signal, index) => ({
    horizon: index,
    pearsonIc: pearson(signal, futureReturns[index]!),
    rankIc: spearman(signal, futureReturns[index]!),
  }));
}
