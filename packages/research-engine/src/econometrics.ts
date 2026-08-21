import {
  covariance,
  mean,
  pearson,
  sampleVariance,
  sampleVolatility,
  singleFactorRegression,
  spearman,
} from "./statistics.js";

export function leadLag(left: number[], right: number[], maximumLag: number) {
  if (left.length !== right.length || maximumLag < 0)
    throw new RangeError("lead/lag inputs must align");
  return Array.from({ length: maximumLag * 2 + 1 }, (_, index) => {
    const lag = index - maximumLag,
      leftSlice =
        lag >= 0
          ? left.slice(0, left.length - lag || undefined)
          : left.slice(-lag),
      rightSlice =
        lag >= 0 ? right.slice(lag) : right.slice(0, right.length + lag);
    return {
      lag,
      correlation:
        leftSlice.length >= 3 ? pearson(leftSlice, rightSlice) : null,
      observations: leftSlice.length,
    };
  });
}

export function pairSpread(leftLogLevel: number[], rightLogLevel: number[]) {
  if (leftLogLevel.length !== rightLogLevel.length || leftLogLevel.length < 3)
    throw new RangeError("pair levels must align");
  const rightVariance = sampleVariance(rightLogLevel),
    hedgeRatio = rightVariance
      ? covariance(leftLogLevel, rightLogLevel) / rightVariance
      : 0,
    intercept = mean(leftLogLevel) - hedgeRatio * mean(rightLogLevel),
    spread = leftLogLevel.map(
      (value, index) => value - intercept - hedgeRatio * rightLogLevel[index]!,
    );
  return { hedgeRatio, intercept, spread };
}

export function meanReversionHalfLife(spread: number[]) {
  if (spread.length < 4)
    return { lambda: null, halfLife: null, meanReverting: false };
  const lagged = spread.slice(0, -1),
    changes = spread.slice(1).map((value, index) => value - lagged[index]!),
    variance = sampleVariance(lagged),
    lambda = variance ? covariance(changes, lagged) / variance : 0;
  return {
    lambda,
    halfLife:
      lambda < 0 && lambda > -1 ? Math.log(0.5) / Math.log1p(lambda) : null,
    meanReverting: lambda < 0 && lambda > -1,
  };
}

export function pairDiagnostics(leftLevel: number[], rightLevel: number[]) {
  if (
    leftLevel.some((value) => value <= 0) ||
    rightLevel.some((value) => value <= 0)
  )
    throw new RangeError("pair log levels must be positive");
  const model = pairSpread(leftLevel.map(Math.log), rightLevel.map(Math.log));
  return { ...model, ...meanReversionHalfLife(model.spread) };
}

export function residualCorrelation(
  left: number[],
  right: number[],
  market: number[],
) {
  const leftResiduals = singleFactorRegression(left, market).residuals,
    rightResiduals = singleFactorRegression(right, market).residuals;
  return pearson(leftResiduals, rightResiduals);
}

export interface EventStudyInput {
  expressionReturns: number[];
  marketReturns?: number[];
  estimationEnd: number;
  eventStart: number;
  eventEnd: number;
}

export function eventStudy(input: EventStudyInput) {
  const {
    expressionReturns,
    marketReturns,
    estimationEnd,
    eventStart,
    eventEnd,
  } = input;
  if (
    estimationEnd < 3 ||
    eventStart <= estimationEnd ||
    eventEnd < eventStart ||
    eventEnd >= expressionReturns.length ||
    (marketReturns && marketReturns.length !== expressionReturns.length)
  )
    throw new RangeError("invalid event-study windows");
  let expected: (index: number) => number;
  if (marketReturns) {
    const model = singleFactorRegression(
      expressionReturns.slice(0, estimationEnd),
      marketReturns.slice(0, estimationEnd),
    );
    expected = (index) => model.alpha + model.beta * marketReturns[index]!;
  } else {
    const baseline = mean(expressionReturns.slice(0, estimationEnd));
    expected = () => baseline;
  }
  const abnormalReturns = [];
  for (let index = eventStart; index <= eventEnd; index++)
    abnormalReturns.push(expressionReturns[index]! - expected(index));
  return {
    abnormalReturns,
    cumulativeAbnormalReturn: abnormalReturns.reduce((a, b) => a + b, 0),
  };
}

export function informationCoefficient(
  signal: number[],
  forwardReturn: number[],
) {
  if (signal.length !== forwardReturn.length || signal.length < 3)
    throw new RangeError("IC inputs must align");
  return {
    pearson: pearson(signal, forwardReturn),
    rank: spearman(signal, forwardReturn),
  };
}

export function neweyWestMeanStandardError(
  values: number[],
  maximumLag: number,
) {
  if (values.length < 2 || maximumLag < 0 || maximumLag >= values.length)
    throw new RangeError("invalid HAC sample or lag");
  const centered = values.map((value) => value - mean(values)),
    n = values.length;
  let longRunVariance =
    centered.reduce((sum, value) => sum + value * value, 0) / n;
  for (let lag = 1; lag <= maximumLag; lag++) {
    const weight = 1 - lag / (maximumLag + 1);
    let gamma = 0;
    for (let index = lag; index < n; index++)
      gamma += centered[index]! * centered[index - lag]!;
    longRunVariance += 2 * weight * (gamma / n);
  }
  return Math.sqrt(Math.max(0, longRunVariance) / n);
}

export function priceDiscoveryRegression(
  premium: number[],
  futureReferenceReturn: number[],
) {
  const model = singleFactorRegression(futureReferenceReturn, premium),
    rmse = Math.sqrt(
      model.residuals.reduce((sum, value) => sum + value * value, 0) /
        model.residuals.length,
    );
  return {
    ...model,
    rmse,
    correlation: pearson(premium, futureReferenceReturn),
  };
}

export function forecastMetrics(actual: number[], predicted: number[]) {
  if (actual.length !== predicted.length || !actual.length)
    throw new RangeError("forecast arrays must align");
  const errors = actual.map((value, index) => value - predicted[index]!),
    actualMean = mean(actual),
    totalSquares = actual.reduce(
      (sum, value) => sum + (value - actualMean) ** 2,
      0,
    ),
    residualSquares = errors.reduce((sum, value) => sum + value * value, 0);
  return {
    mae: mean(errors.map(Math.abs)),
    rmse: Math.sqrt(residualSquares / errors.length),
    rSquared: totalSquares ? 1 - residualSquares / totalSquares : 0,
    rankCorrelation: spearman(actual, predicted),
    directionalAccuracy:
      actual.filter((value, index) =>
        value === 0
          ? predicted[index] === 0
          : Math.sign(value) === Math.sign(predicted[index]!),
      ).length / actual.length,
    errorVolatility: sampleVolatility(errors),
  };
}
