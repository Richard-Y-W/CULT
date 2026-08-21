import { mean, sampleVolatility } from "./statistics.js";

export interface SignalNoiseDiagnostics {
  observations: number;
  variance: number;
  zeroFraction: number;
  coefficientOfVariation: number | null;
  lagOneAutocorrelation: number | null;
  meanEffectiveSample: number | null;
  meanIntervalWidth: number | null;
}

export function signalNoiseDiagnostics(
  values: number[],
  effectiveSamples: (number | null)[],
  intervalWidths: (number | null)[],
): SignalNoiseDiagnostics {
  if (
    values.length !== effectiveSamples.length ||
    values.length !== intervalWidths.length
  )
    throw new RangeError("diagnostic series must align");
  const average = mean(values),
    volatility = sampleVolatility(values),
    availableEffective = effectiveSamples.filter(
      (value): value is number => value !== null,
    ),
    availableWidths = intervalWidths.filter(
      (value): value is number => value !== null,
    );
  return {
    observations: values.length,
    variance: volatility ** 2,
    zeroFraction: values.length
      ? values.filter((value) => value === 0).length / values.length
      : 0,
    coefficientOfVariation:
      average === 0 ? null : volatility / Math.abs(average),
    lagOneAutocorrelation:
      values.length > 2
        ? correlation(values.slice(1), values.slice(0, -1))
        : null,
    meanEffectiveSample: availableEffective.length
      ? mean(availableEffective)
      : null,
    meanIntervalWidth: availableWidths.length ? mean(availableWidths) : null,
  };
}

const correlation = (left: number[], right: number[]) => {
  const lm = mean(left),
    rm = mean(right);
  let covariance = 0,
    lv = 0,
    rv = 0;
  for (let index = 0; index < left.length; index++) {
    const l = left[index]! - lm,
      r = right[index]! - rm;
    covariance += l * r;
    lv += l * l;
    rv += r * r;
  }
  return lv && rv ? covariance / Math.sqrt(lv * rv) : 0;
};

export interface SeasonalObservation {
  timestamp: string;
  value: number;
}
export interface SeasonalCell {
  hour: number;
  dayOfWeek: number;
  center: number;
  scale: number;
  observations: number;
}

export function seasonalBaselines(
  rows: SeasonalObservation[],
  minimumPerCell = 8,
): SeasonalCell[] {
  const cells = new Map<string, number[]>();
  for (const row of rows) {
    const date = new Date(row.timestamp);
    if (!Number.isFinite(date.getTime()) || !(row.value > 0)) continue;
    const key = `${date.getUTCDay()}|${date.getUTCHours()}`;
    (cells.get(key) ?? (cells.set(key, []), cells.get(key)!)).push(
      Math.log(row.value),
    );
  }
  return [...cells.entries()].map(([key, values]) => {
    const [dayOfWeek, hour] = key.split("|").map(Number),
      center = median(values),
      deviations = values.map((value) => Math.abs(value - center));
    return {
      dayOfWeek: dayOfWeek!,
      hour: hour!,
      center,
      scale:
        values.length >= minimumPerCell
          ? median(deviations) / 0.6744897501960817
          : 0,
      observations: values.length,
    };
  });
}

export function seasonalSurprise(
  timestamp: string,
  value: number,
  cells: SeasonalCell[],
  minimumPerCell = 8,
) {
  const date = new Date(timestamp),
    cell = cells.find(
      (item) =>
        item.dayOfWeek === date.getUTCDay() && item.hour === date.getUTCHours(),
    );
  if (
    !cell ||
    cell.observations < minimumPerCell ||
    !(cell.scale > 0) ||
    !(value > 0)
  )
    return { status: "INSUFFICIENT_HISTORY" as const, zScore: null };
  return {
    status: "AVAILABLE" as const,
    zScore: (Math.log(value) - cell.center) / cell.scale,
  };
}

const median = (values: number[]) => {
  const ordered = [...values].sort((a, b) => a - b),
    middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]!
    : (ordered[middle - 1]! + ordered[middle]!) / 2;
};

export function movingBlockBootstrapMean(
  values: number[],
  blockLength: number,
  replications: number,
  seed = 1,
) {
  if (blockLength < 1 || blockLength > values.length || replications < 1)
    throw new RangeError("invalid block bootstrap configuration");
  let state = seed >>> 0;
  const random = () => (state = (1664525 * state + 1013904223) >>> 0) / 2 ** 32,
    estimates: number[] = [];
  for (let repetition = 0; repetition < replications; repetition++) {
    const sample: number[] = [];
    while (sample.length < values.length) {
      const start = Math.floor(random() * (values.length - blockLength + 1));
      sample.push(...values.slice(start, start + blockLength));
    }
    estimates.push(mean(sample.slice(0, values.length)));
  }
  estimates.sort((a, b) => a - b);
  const pick = (quantile: number) =>
    estimates[
      Math.min(estimates.length - 1, Math.floor(quantile * estimates.length))
    ]!;
  return {
    estimate: mean(values),
    lower: pick(0.025),
    upper: pick(0.975),
    method: "MOVING_BLOCK_BOOTSTRAP" as const,
    seed,
    replications,
    blockLength,
  };
}
