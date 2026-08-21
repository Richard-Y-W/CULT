import { mean, sampleVolatility } from "./statistics.js";

const quantile = (values: number[], probability: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b),
    position = (sorted.length - 1) * probability,
    lower = Math.floor(position),
    fraction = position - lower;
  return (
    sorted[lower]! +
    fraction * ((sorted[lower + 1] ?? sorted[lower]!) - sorted[lower]!)
  );
};

export function valueAtRiskAndExpectedShortfall(
  returns: number[],
  confidence: 0.95 | 0.99,
) {
  if (!returns.length) return { valueAtRisk: 0, expectedShortfall: 0 };
  const cutoff = quantile(returns, 1 - confidence),
    tail = returns.filter((value) => value <= cutoff);
  return {
    valueAtRisk: -cutoff,
    expectedShortfall: -mean(tail),
  };
}

export function drawdownAnalysis(equity: number[]) {
  let peak = -Infinity,
    maximumDrawdown = 0,
    currentDuration = 0,
    maximumDuration = 0,
    lastRecoveryIndex: number | null = null;
  const series = equity.map((value, index) => {
    if (value >= peak) {
      peak = value;
      if (currentDuration > 0) lastRecoveryIndex = index;
      currentDuration = 0;
    } else {
      currentDuration++;
      maximumDuration = Math.max(maximumDuration, currentDuration);
    }
    const drawdown = peak > 0 ? value / peak - 1 : 0;
    maximumDrawdown = Math.min(maximumDrawdown, drawdown);
    return drawdown;
  });
  return {
    series,
    maximumDrawdown,
    maximumDuration,
    currentDuration,
    lastRecoveryIndex,
  };
}

export function portfolioRatios(
  returns: number[],
  benchmarkReturns: number[],
  equity: number[],
  periodsPerYear = 365,
) {
  if (!(periodsPerYear > 0)) throw new RangeError("period convention required");
  const volatility = sampleVolatility(returns),
    downside = Math.sqrt(mean(returns.map((value) => Math.min(value, 0) ** 2))),
    active = returns.map(
      (value, index) => value - (benchmarkReturns[index] ?? 0),
    ),
    trackingError = sampleVolatility(active),
    drawdown = drawdownAnalysis(equity),
    annualReturn = mean(returns) * periodsPerYear;
  return {
    sharpeLike:
      volatility > 0
        ? (mean(returns) / volatility) * Math.sqrt(periodsPerYear)
        : 0,
    sortino:
      downside > 0 ? (mean(returns) / downside) * Math.sqrt(periodsPerYear) : 0,
    informationRatio:
      trackingError > 0
        ? (mean(active) / trackingError) * Math.sqrt(periodsPerYear)
        : 0,
    calmar:
      drawdown.maximumDrawdown < 0
        ? annualReturn / Math.abs(drawdown.maximumDrawdown)
        : 0,
    ...drawdown,
  };
}

export interface TransactionCostInput {
  quantity: number;
  price: number;
  commissionRate: number;
  halfSpreadRate: number;
  volatility: number;
  liquidity: number;
  impactEta: number;
  impactExponent: number;
}

export function transactionCost(input: TransactionCostInput) {
  if (
    input.liquidity <= 0 ||
    input.price <= 0 ||
    input.impactExponent <= 0 ||
    [
      input.commissionRate,
      input.halfSpreadRate,
      input.volatility,
      input.impactEta,
    ].some((value) => value < 0)
  )
    throw new RangeError("invalid transaction-cost parameters");
  const notional = Math.abs(input.quantity * input.price),
    commission = notional * input.commissionRate,
    spread = notional * input.halfSpreadRate,
    impactRate =
      input.impactEta *
      input.volatility *
      (Math.abs(input.quantity) / input.liquidity) ** input.impactExponent,
    impact = notional * impactRate;
  return { commission, spread, impact, total: commission + spread + impact };
}

export function exposureSnapshot(
  cash: number,
  quantities: number[],
  marketPrices: number[],
) {
  if (quantities.length !== marketPrices.length)
    throw new RangeError("positions and marks must align");
  const values = quantities.map(
      (quantity, index) => quantity * marketPrices[index]!,
    ),
    grossExposure = values.reduce((sum, value) => sum + Math.abs(value), 0),
    netExposure = values.reduce((sum, value) => sum + value, 0),
    longExposure = values.reduce((sum, value) => sum + Math.max(0, value), 0),
    shortExposure = values.reduce(
      (sum, value) => sum + Math.abs(Math.min(0, value)),
      0,
    ),
    equity = cash + netExposure;
  return {
    cash,
    equity,
    grossExposure,
    netExposure,
    longExposure,
    shortExposure,
    grossLeverage: equity > 0 ? grossExposure / equity : Infinity,
    netLeverage: equity > 0 ? netExposure / equity : Infinity,
    concentration:
      equity > 0
        ? Math.max(0, ...values.map((value) => Math.abs(value))) / equity
        : Infinity,
  };
}

export function marketReferenceMetrics(market: number[], reference: number[]) {
  if (
    market.length !== reference.length ||
    !market.length ||
    reference.some((x) => x <= 0)
  )
    throw new RangeError("market/reference series must align and be positive");
  const premium = market.map((value, index) => value / reference[index]! - 1),
    latest = premium.at(-1)!,
    average = mean(premium),
    volatility = sampleVolatility(premium);
  return {
    premium,
    basis: market.map((value, index) => value - reference[index]!),
    latestPremium: latest,
    premiumZScore: volatility ? (latest - average) / volatility : 0,
    premiumVolatility: volatility,
  };
}

export function orderFlowImbalance(buyVolume: number, sellVolume: number) {
  if (buyVolume < 0 || sellVolume < 0)
    throw new RangeError("order-flow volumes must be nonnegative");
  const total = buyVolume + sellVolume;
  return total ? (buyVolume - sellVolume) / total : 0;
}
