export const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

export function sampleVariance(values: number[]) {
  if (values.length < 2) return 0;
  let runningMean = 0,
    m2 = 0,
    count = 0;
  for (const value of values) {
    count++;
    const delta = value - runningMean;
    runningMean += delta / count;
    m2 += delta * (value - runningMean);
  }
  return m2 / (count - 1);
}

export const sampleVolatility = (values: number[]) =>
  Math.sqrt(sampleVariance(values));

export function covariance(left: number[], right: number[]) {
  if (left.length !== right.length || left.length < 2) return 0;
  const leftMean = mean(left),
    rightMean = mean(right);
  return (
    left.reduce(
      (sum, value, index) =>
        sum + (value - leftMean) * (right[index]! - rightMean),
      0,
    ) /
    (left.length - 1)
  );
}

export function pearson(left: number[], right: number[]) {
  const denominator = sampleVolatility(left) * sampleVolatility(right);
  return denominator ? covariance(left, right) / denominator : 0;
}

const ranks = (values: number[]) => {
  const ordered = values
      .map((value, index) => ({ value, index }))
      .sort((a, b) => a.value - b.value),
    output = new Array<number>(values.length);
  for (let start = 0; start < ordered.length; ) {
    let end = start + 1;
    while (
      end < ordered.length &&
      ordered[end]!.value === ordered[start]!.value
    )
      end++;
    const rank = (start + end - 1) / 2 + 1;
    for (let index = start; index < end; index++)
      output[ordered[index]!.index] = rank;
    start = end;
  }
  return output;
};

export const spearman = (left: number[], right: number[]) =>
  left.length === right.length ? pearson(ranks(left), ranks(right)) : 0;

export const ewmaLambda = (halfLife: number) => {
  if (!(halfLife > 0)) throw new RangeError("half-life must be positive");
  return 2 ** (-1 / halfLife);
};

export function ewmaSeries(values: number[], halfLife: number) {
  if (!values.length) return [];
  const lambda = ewmaLambda(halfLife),
    output = [values[0]!];
  for (let index = 1; index < values.length; index++)
    output.push(lambda * output[index - 1]! + (1 - lambda) * values[index]!);
  return output;
}

export function ewmaVariance(values: number[], halfLife: number) {
  if (!values.length) return [];
  const lambda = ewmaLambda(halfLife),
    output = [0];
  let currentMean = values[0]!,
    currentVariance = 0;
  for (let index = 1; index < values.length; index++) {
    const innovation = values[index]! - currentMean;
    currentVariance =
      lambda * currentVariance + (1 - lambda) * innovation * innovation;
    currentMean = lambda * currentMean + (1 - lambda) * values[index]!;
    output.push(currentVariance);
  }
  return output;
}

export function realizedVolatility(returns: number[], scale = 1) {
  if (!(scale > 0)) throw new RangeError("volatility scale must be positive");
  return Math.sqrt(
    scale * returns.reduce((sum, value) => sum + value * value, 0),
  );
}

export const volatilityOfVolatility = (realized: number[]) =>
  sampleVolatility(realized);

export const cumulativeMomentum = (returns: number[], lookback: number) =>
  returns.slice(-lookback).reduce((a, b) => a + b, 0);

export function exponentiallyWeightedMomentum(
  returns: number[],
  lookback: number,
  halfLife: number,
) {
  const lambda = ewmaLambda(halfLife),
    selected = returns.slice(-lookback);
  return selected.reduce(
    (sum, value, index) =>
      sum + value * lambda ** (selected.length - index - 1),
    0,
  );
}

export function riskAdjustedMomentum(
  returns: number[],
  lookback: number,
  denominatorFloor: number,
) {
  if (!(denominatorFloor > 0))
    throw new RangeError("denominator floor must be explicit and positive");
  return (
    cumulativeMomentum(returns, lookback) /
    Math.max(realizedVolatility(returns.slice(-lookback)), denominatorFloor)
  );
}

export function autocorrelation(values: number[], lag: number) {
  if (lag <= 0 || values.length <= lag) return 0;
  return pearson(values.slice(lag), values.slice(0, -lag));
}

export function autocorrelationFunction(values: number[], maximumLag: number) {
  return Array.from({ length: maximumLag }, (_, index) => ({
    lag: index + 1,
    correlation: autocorrelation(values, index + 1),
    approximate95Band: values.length ? 1.96 / Math.sqrt(values.length) : 1,
  }));
}

export function ljungBoxStatistic(values: number[], lags: number) {
  if (values.length <= lags || lags < 1)
    throw new RangeError("Ljung-Box requires more observations than lags");
  const n = values.length;
  let statistic = 0;
  for (let lag = 1; lag <= lags; lag++) {
    const rho = autocorrelation(values, lag);
    statistic += (rho * rho) / (n - lag);
  }
  return { statistic: n * (n + 2) * statistic, degreesOfFreedom: lags };
}

export function robustZScore(value: number, history: number[]) {
  if (!history.length) return 0;
  const ordered = [...history].sort((a, b) => a - b),
    middle = Math.floor(ordered.length / 2),
    median =
      ordered.length % 2
        ? ordered[middle]!
        : (ordered[middle - 1]! + ordered[middle]!) / 2,
    deviations = ordered
      .map((item) => Math.abs(item - median))
      .sort((a, b) => a - b),
    mad =
      deviations.length % 2
        ? deviations[middle]!
        : (deviations[middle - 1]! + deviations[middle]!) / 2;
  return mad ? (0.6744897501960817 * (value - median)) / mad : 0;
}

export function singleFactorRegression(asset: number[], market: number[]) {
  if (asset.length !== market.length || asset.length < 3)
    throw new RangeError("factor regression requires aligned observations");
  const marketVariance = sampleVariance(market),
    beta = marketVariance ? covariance(asset, market) / marketVariance : 0,
    alpha = mean(asset) - beta * mean(market),
    residuals = asset.map(
      (value, index) => value - alpha - beta * market[index]!,
    );
  return { alpha, beta, residuals };
}

export function marketFactors(returns: number[], weights: number[]) {
  if (returns.length !== weights.length || !returns.length)
    throw new RangeError("market factor inputs must align");
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || weights.some((weight) => weight < 0))
    throw new RangeError("market weights must be nonnegative and nonzero");
  const normalized = weights.map((weight) => weight / total),
    marketReturn = returns.reduce(
      (sum, value, index) => sum + value * normalized[index]!,
      0,
    ),
    dispersion = Math.sqrt(
      returns.reduce(
        (sum, value, index) =>
          sum + normalized[index]! * (value - marketReturn) ** 2,
        0,
      ),
    ),
    shares = [...normalized].sort((a, b) => b - a),
    hhi = normalized.reduce((sum, value) => sum + value * value, 0),
    entropy = -normalized.reduce(
      (sum, value) => sum + (value > 0 ? value * Math.log(value) : 0),
      0,
    );
  return {
    marketReturn,
    dispersion,
    breadth: returns.filter((value) => value > 0).length / returns.length,
    advances: returns.filter((value) => value > 0).length,
    declines: returns.filter((value) => value < 0).length,
    advanceDeclineRatio:
      returns.filter((value) => value > 0).length /
      Math.max(1, returns.filter((value) => value < 0).length),
    hhi,
    effectiveExpressionCount: hhi ? 1 / hhi : 0,
    normalizedEntropy:
      normalized.length > 1 ? entropy / Math.log(normalized.length) : 0,
    topFiveConcentration: shares.slice(0, 5).reduce((a, b) => a + b, 0),
  };
}
