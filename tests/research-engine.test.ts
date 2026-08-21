import { describe, expect, it } from "vitest";
import {
  aggregateCounts,
  autocorrelation,
  bufferedSelection,
  calibrateFixedWeights,
  countWeightedPrevalence,
  dataQualityVector,
  drawdownAnalysis,
  ewmaLambda,
  explicitHorizonLogReturn,
  informationCoefficient,
  leadLag,
  liquidityDiagnostics,
  marketFactors,
  marketReferenceMetrics,
  movingBlockBootstrapMean,
  meanReversionHalfLife,
  multipleTesting,
  neutralize,
  pairSpread,
  prevalenceFromCounts,
  quantilePortfolio,
  researchWeights,
  seasonalBaselines,
  seasonalSurprise,
  signalNoiseDiagnostics,
  standardizedPrevalence,
  transactionCost,
  valueAtRiskAndExpectedShortfall,
  walkForwardSplits,
  wilsonInterval,
} from "@cult/research-engine";

describe("Phase 3 measurement", () => {
  it("retains raw endpoints while Jeffreys smoothing stays finite", () => {
    const zero = prevalenceFromCounts(0, 10),
      all = prevalenceFromCounts(10, 10, 15),
      large = prevalenceFromCounts(10_000, 1_000_000);
    expect(zero.rawProbability).toBe(0);
    expect(zero.smoothedProbability).toBeCloseTo(0.5 / 11, 14);
    expect(all.rawProbability).toBe(1);
    expect(all.smoothedProbability).toBeCloseTo(10.5 / 11, 14);
    expect(all.intensityWhenPresent).toBe(1.5);
    expect(large.smoothedProbability).toBeCloseTo(large.rawProbability, 6);
  });

  it("creates count-weighted closes instead of averaging minute percentages", () => {
    const rows = [
      {
        timestamp: "2026-08-21T00:00:00Z",
        contentBucket: "ORIGINAL" as const,
        languageBucket: "ALL",
        eligibleDocuments: 10,
        expressionDocuments: 5,
        occurrenceCount: 5,
      },
      {
        timestamp: "2026-08-21T00:01:00Z",
        contentBucket: "ORIGINAL" as const,
        languageBucket: "ALL",
        eligibleDocuments: 990,
        expressionDocuments: 0,
        occurrenceCount: 0,
      },
    ];
    expect(aggregateCounts(rows).eligibleDocuments).toBe(1000);
    expect(countWeightedPrevalence(rows).rawProbability).toBe(0.005);
  });

  it("standardizes only against explicit fixed weights", () => {
    const weights = calibrateFixedWeights({ ORIGINAL: 80, REPLY: 20 });
    expect(weights).toEqual({ ORIGINAL: 0.8, REPLY: 0.2 });
    expect(
      standardizedPrevalence(
        [
          { key: "ORIGINAL", expressionDocuments: 10, eligibleDocuments: 100 },
          { key: "REPLY", expressionDocuments: 10, eligibleDocuments: 20 },
        ],
        weights,
      )?.probability,
    ).toBeCloseTo(0.18);
    expect(
      standardizedPrevalence(
        [{ key: "ORIGINAL", expressionDocuments: 10, eligibleDocuments: 100 }],
        weights,
      ),
    ).toBeNull();
  });

  it("returns Wilson uncertainty and exact-boundary horizon returns", () => {
    const interval = wilsonInterval(10, 100);
    expect(interval.lower).toBeLessThan(0.1);
    expect(interval.upper).toBeGreaterThan(0.1);
    expect(
      explicitHorizonLogReturn(
        [
          { timestamp: "2026-08-21T00:00:00Z", value: 100 },
          { timestamp: "2026-08-21T01:00:00Z", value: 110 },
        ],
        "2026-08-21T00:00:00Z",
        "2026-08-21T01:00:00Z",
      ),
    ).toBeCloseTo(Math.log(1.1));
  });

  it("computes empirical liquidity diagnostics without hidden tiers", () => {
    expect(liquidityDiagnostics([10, 20], [0, 2, 0, 4])).toEqual({
      averageDailyDocuments: 15,
      medianDailyDocuments: 15,
      medianHourlyDocuments: 1,
      zeroWindowFrequency: 0.5,
      activeWindowFraction: 0.5,
    });
  });

  it("keeps seasonal and block-bootstrap diagnostics deterministic", () => {
    const rows = Array.from({ length: 8 }, (_, week) => ({
      timestamp: new Date(Date.UTC(2026, 0, 5 + week * 7, 12)).toISOString(),
      value: 100 + week,
    }));
    const cells = seasonalBaselines(rows);
    expect(seasonalSurprise(rows.at(-1)!.timestamp, 110, cells).status).toBe(
      "AVAILABLE",
    );
    expect(movingBlockBootstrapMean([1, 2, 3, 4, 5], 2, 100, 42)).toEqual(
      movingBlockBootstrapMean([1, 2, 3, 4, 5], 2, 100, 42),
    );
    expect(
      signalNoiseDiagnostics([0, 1, 2], [1, 2, 3], [0.2, 0.1, 0.05])
        .zeroFraction,
    ).toBeCloseTo(1 / 3);
  });

  it("exposes unavailable quality components instead of inventing a probability", () => {
    expect(
      dataQualityVector({
        eligibleDocuments: 500,
        targetDocuments: 1000,
        activeSources: 1,
        targetSources: 4,
        authorHhi: 0.1,
      }),
    ).toEqual({
      sampleAdequacy: 0.5,
      sourceCoverage: 0.25,
      sourceHealth: null,
      crossSourceAgreement: null,
      concentration: 0.9,
      missingness: null,
      composite: null,
    });
  });
});

describe("Phase 3 statistics and econometrics", () => {
  it("uses half-life parameterization and computes broad market internals", () => {
    expect(ewmaLambda(2) ** 2).toBeCloseTo(0.5);
    const factors = marketFactors([0.1, -0.05, 0.02], [2, 1, 1]);
    expect(factors.marketReturn).toBeCloseTo(0.0425);
    expect(factors.breadth).toBeCloseTo(2 / 3);
    expect(factors.effectiveExpressionCount).toBeCloseTo(8 / 3);
  });

  it("estimates pair hedge ratio and reports only valid mean-reversion half-life", () => {
    const pair = pairSpread([1, 2, 3, 4], [2, 4, 6, 8]);
    expect(pair.hedgeRatio).toBeCloseTo(0.5);
    const reverting = meanReversionHalfLife([1, 0.8, 0.64, 0.512, 0.4096]);
    expect(reverting.meanReverting).toBe(true);
    expect(reverting.halfLife).toBeGreaterThan(0);
    expect(meanReversionHalfLife([1, 2, 3, 4]).halfLife).toBeNull();
  });

  it("computes lagged relationships and autocorrelation explicitly", () => {
    const x = [1, 2, 3, 4, 5],
      y = [0, 1, 2, 3, 4];
    expect(leadLag(x, y, 1)).toHaveLength(3);
    expect(autocorrelation(x, 1)).toBeCloseTo(1);
  });
});

describe("Phase 3 factor and portfolio research", () => {
  it("neutralizes controls and tests quantile monotonicity", () => {
    const result = neutralize([2, 4, 6, 8, 10], [[1, 2, 3, 4, 5]]);
    expect(result.residuals.every((value) => Math.abs(value) < 1e-10)).toBe(
      true,
    );
    const quantiles = quantilePortfolio([1, 2, 3, 4, 5], [-1, 0, 1, 2, 3], 5);
    expect(quantiles.longShort).toBe(4);
    expect(informationCoefficient([1, 2, 3], [2, 4, 6]).rank).toBeCloseTo(1);
  });

  it("applies Bonferroni and Benjamini-Hochberg transparently", () => {
    const corrected = multipleTesting([0.001, 0.02, 0.2], 0.05);
    expect(corrected[0]?.bonferroniSignificant).toBe(true);
    expect(corrected[1]?.benjaminiHochbergSignificant).toBe(true);
    expect(corrected[2]?.benjaminiHochbergSignificant).toBe(false);
  });

  it("builds purged walk-forward splits", () => {
    const splits = walkForwardSplits(30, 10, 5, 5, 2, 1);
    expect(splits[0]?.train.at(-1)).toBe(9);
    expect(splits[0]?.test[0]).toBe(12);
    expect(splits[0]?.test.at(-1)).toBe(16);
  });

  it("models costs, portfolio tails, drawdowns and reference basis", () => {
    const cost = transactionCost({
      quantity: 100,
      price: 10,
      commissionRate: 0.001,
      halfSpreadRate: 0.002,
      volatility: 0.1,
      liquidity: 10_000,
      impactEta: 0.5,
      impactExponent: 0.5,
    });
    expect(cost.total).toBeGreaterThan(3);
    expect(
      valueAtRiskAndExpectedShortfall([-0.2, -0.1, 0, 0.1], 0.95)
        .expectedShortfall,
    ).toBeGreaterThanOrEqual(0.1);
    expect(drawdownAnalysis([100, 90, 80, 100]).maximumDrawdown).toBeCloseTo(
      -0.2,
    );
    expect(marketReferenceMetrics([101, 99], [100, 100]).basis).toEqual([
      1, -1,
    ]);
  });

  it("constructs capped indexes with transparent turnover and buffers", () => {
    const weights = researchWeights([100, 25, 25], "SQRT_PREVALENCE", 0.5);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(Math.max(...weights)).toBeLessThanOrEqual(0.5 + 1e-12);
    expect(
      bufferedSelection(["A", "B", "C", "D"], ["C", "D"], 2, 2, 3),
    ).toEqual(["C", "A"]);
  });
});
