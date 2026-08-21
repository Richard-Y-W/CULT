export interface CountObservation {
  timestamp: string;
  contentBucket: "ORIGINAL" | "REPLY" | "QUOTE";
  languageBucket: string;
  eligibleDocuments: number;
  expressionDocuments: number;
  occurrenceCount: number;
}

export interface PrevalenceEstimate {
  eligibleDocuments: number;
  expressionDocuments: number;
  occurrenceCount: number;
  rawProbability: number;
  rawPerMillion: number;
  smoothedProbability: number;
  smoothedPerMillion: number;
  intensityWhenPresent: number;
}

export function prevalenceFromCounts(
  expressionDocuments: number,
  eligibleDocuments: number,
  occurrenceCount = expressionDocuments,
): PrevalenceEstimate {
  if (
    !Number.isSafeInteger(eligibleDocuments) ||
    !Number.isSafeInteger(expressionDocuments) ||
    !Number.isSafeInteger(occurrenceCount) ||
    eligibleDocuments < 0 ||
    expressionDocuments < 0 ||
    expressionDocuments > eligibleDocuments ||
    occurrenceCount < expressionDocuments
  )
    throw new RangeError("invalid document sufficient statistics");
  const rawProbability = eligibleDocuments
      ? expressionDocuments / eligibleDocuments
      : 0,
    smoothedProbability = (expressionDocuments + 0.5) / (eligibleDocuments + 1);
  return {
    eligibleDocuments,
    expressionDocuments,
    occurrenceCount,
    rawProbability,
    rawPerMillion: rawProbability * 1_000_000,
    smoothedProbability,
    smoothedPerMillion: smoothedProbability * 1_000_000,
    intensityWhenPresent: expressionDocuments
      ? occurrenceCount / expressionDocuments
      : 0,
  };
}

export function aggregateCounts(rows: CountObservation[]) {
  return rows.reduce(
    (total, row) => {
      prevalenceFromCounts(
        row.expressionDocuments,
        row.eligibleDocuments,
        row.occurrenceCount,
      );
      total.eligibleDocuments += row.eligibleDocuments;
      total.expressionDocuments += row.expressionDocuments;
      total.occurrenceCount += row.occurrenceCount;
      return total;
    },
    { eligibleDocuments: 0, expressionDocuments: 0, occurrenceCount: 0 },
  );
}

export function countWeightedPrevalence(rows: CountObservation[]) {
  const counts = aggregateCounts(rows);
  return prevalenceFromCounts(
    counts.expressionDocuments,
    counts.eligibleDocuments,
    counts.occurrenceCount,
  );
}

export function wilsonInterval(
  expressionDocuments: number,
  eligibleDocuments: number,
  z = 1.959963984540054,
) {
  prevalenceFromCounts(expressionDocuments, eligibleDocuments);
  if (!eligibleDocuments) return { lower: 0, upper: 1, level: 0.95 };
  const p = expressionDocuments / eligibleDocuments,
    z2 = z * z,
    denominator = 1 + z2 / eligibleDocuments,
    center = (p + z2 / (2 * eligibleDocuments)) / denominator,
    radius =
      (z / denominator) *
      Math.sqrt(
        (p * (1 - p)) / eligibleDocuments +
          z2 / (4 * eligibleDocuments * eligibleDocuments),
      );
  return {
    lower: Math.max(0, center - radius),
    upper: Math.min(1, center + radius),
    level: 0.95,
  };
}

export interface StandardizationStratum {
  key: string;
  expressionDocuments: number;
  eligibleDocuments: number;
}

export function standardizedPrevalence(
  strata: StandardizationStratum[],
  fixedWeights: Record<string, number>,
) {
  const weightSum = Object.values(fixedWeights).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1) > 1e-10)
    throw new RangeError("standardization weights must sum to one");
  const byKey = new Map(strata.map((row) => [row.key, row]));
  let probability = 0;
  for (const [key, weight] of Object.entries(fixedWeights)) {
    if (weight < 0) throw new RangeError("weights must be nonnegative");
    const row = byKey.get(key);
    if (!row || row.eligibleDocuments === 0) return null;
    probability += weight * (row.expressionDocuments / row.eligibleDocuments);
  }
  return { probability, perMillion: probability * 1_000_000 };
}

export interface TimedLevel {
  timestamp: string;
  value: number;
}

export function explicitHorizonLogReturn(
  levels: TimedLevel[],
  startTimestamp: string,
  endTimestamp: string,
) {
  const values = new Map(levels.map((point) => [point.timestamp, point.value])),
    start = values.get(startTimestamp),
    end = values.get(endTimestamp);
  if (start === undefined || end === undefined)
    throw new RangeError("both explicit horizon boundaries are required");
  if (start <= 0 || end <= 0)
    throw new RangeError("log-return levels must be positive");
  if (Date.parse(endTimestamp) <= Date.parse(startTimestamp))
    throw new RangeError("end boundary must follow start boundary");
  return Math.log(end) - Math.log(start);
}

export interface LiquidityDiagnostics {
  averageDailyDocuments: number;
  medianDailyDocuments: number;
  medianHourlyDocuments: number;
  zeroWindowFrequency: number;
  activeWindowFraction: number;
}

const median = (values: number[]) => {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b),
    middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]!
    : (ordered[middle - 1]! + ordered[middle]!) / 2;
};

export function liquidityDiagnostics(
  dailyExpressionDocuments: number[],
  hourlyExpressionDocuments: number[],
): LiquidityDiagnostics {
  if (
    [...dailyExpressionDocuments, ...hourlyExpressionDocuments].some(
      (value) => !Number.isSafeInteger(value) || value < 0,
    )
  )
    throw new RangeError("liquidity counts must be nonnegative integers");
  const zero = hourlyExpressionDocuments.filter((value) => value === 0).length,
    zeroWindowFrequency = hourlyExpressionDocuments.length
      ? zero / hourlyExpressionDocuments.length
      : 1;
  return {
    averageDailyDocuments: dailyExpressionDocuments.length
      ? dailyExpressionDocuments.reduce((a, b) => a + b, 0) /
        dailyExpressionDocuments.length
      : 0,
    medianDailyDocuments: median(dailyExpressionDocuments),
    medianHourlyDocuments: median(hourlyExpressionDocuments),
    zeroWindowFrequency,
    activeWindowFraction: 1 - zeroWindowFrequency,
  };
}

export function calibrateFixedWeights(countsByStratum: Record<string, number>) {
  const total = Object.values(countsByStratum).reduce((a, b) => a + b, 0);
  if (total <= 0)
    throw new RangeError("calibration requires eligible documents");
  return Object.fromEntries(
    Object.entries(countsByStratum).map(([key, count]) => {
      if (!Number.isSafeInteger(count) || count < 0)
        throw new RangeError("calibration counts must be nonnegative integers");
      return [key, count / total];
    }),
  );
}

export interface DataQualityVector {
  sampleAdequacy: number | null;
  sourceCoverage: number | null;
  sourceHealth: number | null;
  crossSourceAgreement: number | null;
  concentration: number | null;
  missingness: number | null;
  composite: null;
}

export function dataQualityVector(input: {
  eligibleDocuments?: number;
  targetDocuments?: number;
  activeSources?: number;
  targetSources?: number;
  healthyWindowFraction?: number;
  agreement?: number;
  authorHhi?: number;
  missingWindowFraction?: number;
}): DataQualityVector {
  const ratio = (value?: number, target?: number) =>
    value === undefined || target === undefined || target <= 0
      ? null
      : Math.max(0, Math.min(1, value / target));
  return {
    sampleAdequacy: ratio(input.eligibleDocuments, input.targetDocuments),
    sourceCoverage: ratio(input.activeSources, input.targetSources),
    sourceHealth: input.healthyWindowFraction ?? null,
    crossSourceAgreement: input.agreement ?? null,
    concentration:
      input.authorHhi === undefined ? null : Math.max(0, 1 - input.authorHhi),
    missingness:
      input.missingWindowFraction === undefined
        ? null
        : Math.max(0, 1 - input.missingWindowFraction),
    composite: null,
  };
}
