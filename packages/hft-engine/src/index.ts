import { createHash } from "node:crypto";

export type CultDataMode =
  | "synthetic"
  | "replay"
  | "live-shadow"
  | "live-market";
export type ExpressionEventType =
  | "CREATE"
  | "LIKE"
  | "REPOST"
  | "REPLY"
  | "QUOTE"
  | "DELETE"
  | "OTHER";
export type SignalType =
  | "PREVALENCE_SHOCK"
  | "AMPLIFICATION_SHOCK"
  | "PROPAGATION_SHOCK"
  | "CONCENTRATION_WARNING"
  | "ATTENTION_BLOCK";
export type AlertType =
  | "REFERENCE_SHOCK"
  | "AMPLIFICATION_SHOCK"
  | "PROPAGATION_SHOCK"
  | "VOLATILITY_SHOCK"
  | "BASIS_DISLOCATION"
  | "LIQUIDITY_COLLAPSE"
  | "DATA_SOURCE_DEGRADED"
  | "MARGIN_CALL"
  | "HALT";
export interface AlertThresholds {
  methodologyVersion: string;
  referenceZ: number;
  amplificationZ: number;
  propagationZ: number;
  basisPercent: number;
  minimumDepth: number;
  maximumMarginUtilization: number;
}
export interface FeedEnvelope<T> {
  schemaVersion: "CULT-FEED-1";
  channel:
    | "reference"
    | "signals"
    | "trades"
    | "depth"
    | "orders"
    | "events"
    | "risk";
  sequence: number;
  publishedTimeNs: string;
  payload: T;
}

export interface ExpressionTapeEvent {
  id: number;
  eventTimeNs: string;
  receiveTimeNs: string;
  sourceId: string;
  expressionIds: string[];
  type: ExpressionEventType;
  cascadeId: number;
  engagement: {
    likes: number;
    reposts: number;
    quotes: number;
    replies: number;
  };
  isBackfill: boolean;
}
export interface SignalTapeEvent {
  id: number;
  eventTimeNs: string;
  expressionId: string;
  type: SignalType;
  value: number;
  zScore: number;
  methodologyVersion: "CULT-BEHAVIOR-1";
}
export interface MarketTapeEvent {
  sequence: number;
  exchangeTimeNs: string;
  type: "ORDER_ACCEPTED" | "BOOK_UPDATE" | "TRADE" | "CANCEL";
  orderId: number;
  contraOrderId?: number;
  priceTicks: number;
  quantity: number;
  aggressorSide?: "BUY" | "SELL";
}
export interface Heatmap<
  TX extends string | number = string,
  TY extends string | number = string,
> {
  x: TX[];
  y: TY[];
  values: number[][];
  units: string;
  timestamp: string;
  methodology: string;
}
export interface Phase4Scenario {
  manifest: {
    runId: string;
    dataset: string;
    scenario: string;
    seed: number;
    exchangeConfig: "CULT-X-1";
    signalMethodology: "CULT-BEHAVIOR-1";
    mode: "SYNTHETIC";
    outputHash: string;
  };
  expressionTape: ExpressionTapeEvent[];
  signalTape: SignalTapeEvent[];
  marketTape: MarketTapeEvent[];
  state: {
    expression: string;
    reference: number;
    market: number;
    basisPercent: number;
    prevalenceDocuments: number;
    creationFlow: number;
    likeFlow: number;
    repostFlow: number;
    quoteFlow: number;
    replyFlow: number;
    amplification: number;
    propagation: number;
    cascadeHhi: number;
    effectiveCascades: number;
    breadth: number;
    dataLiquidityTier: string;
  };
  microstructure: {
    bid: number;
    ask: number;
    midpoint: number;
    spreadTicks: number;
    microprice: number;
    imbalanceL1: number;
    imbalanceL5: number;
    tradeImbalance: number;
    ofi: number;
    depth: Array<{ side: "BID" | "ASK"; priceTicks: number; quantity: number }>;
  };
  risk: {
    state: "NORMAL";
    killed: false;
    grossExposure: number;
    netExposure: number;
    leverage: number;
    marginUtilization: number;
  };
  heatmaps: Record<string, Heatmap>;
}

export function resolveDataMode(environment: NodeJS.ProcessEnv): CultDataMode {
  const mode = environment.CULT_DATA_MODE ?? "synthetic";
  if (!["synthetic", "replay", "live-shadow", "live-market"].includes(mode))
    throw new Error(`Unsupported CULT_DATA_MODE: ${mode}`);
  if (mode === "live-market") {
    if (environment.CULT_LIVE_MARKET_ACK !== "I_ACKNOWLEDGE_EXPERIMENTAL")
      throw new Error(
        "live-market requires explicit experimental acknowledgement",
      );
    const hours = Number(environment.CULT_LIVE_SHADOW_VALIDATED_HOURS ?? 0);
    if (hours < 72)
      throw new Error(
        "live-market requires at least 72 validated live-shadow hours",
      );
  }
  return mode as CultDataMode;
}

const round = (value: number, places = 6) => Number(value.toFixed(places));
export function attributionCredit(
  expressionCount: number,
  mode: "FULL" | "FRACTIONAL",
) {
  if (expressionCount < 1)
    throw new RangeError("expression set cannot be empty");
  return mode === "FULL" ? 1 : 1 / expressionCount;
}

export function createPhase4Demo(
  kind: "great-cry" | "celebrity" | "spam" = "great-cry",
  seed = 20260821,
): Phase4Scenario {
  const broad = kind === "great-cry",
    spam = kind === "spam",
    posts = broad ? 80 : 10,
    cascades = broad ? 80 : 1,
    engagementScale = broad ? 10 : 80,
    expressionTape: ExpressionTapeEvent[] = [];
  for (let index = 0; index < posts; index++) {
    const base = BigInt(index) * 1_000_000_000n,
      cascadeId = broad ? index + 1 : 1;
    expressionTape.push({
      id: expressionTape.length + 1,
      eventTimeNs: base.toString(),
      receiveTimeNs: (base + 1_000_000n).toString(),
      sourceId: "SYNTHETIC",
      expressionIds: ["expr_crying_face"],
      type: "CREATE",
      cascadeId,
      engagement: { likes: 0, reposts: 0, quotes: 0, replies: 0 },
      isBackfill: false,
    });
    expressionTape.push({
      id: expressionTape.length + 1,
      eventTimeNs: (base + 100_000_000n).toString(),
      receiveTimeNs: (base + 101_000_000n).toString(),
      sourceId: "SYNTHETIC",
      expressionIds: ["expr_crying_face"],
      type: "REPOST",
      cascadeId,
      engagement: {
        likes: engagementScale,
        reposts: Math.floor(engagementScale / 2),
        quotes: Math.floor(engagementScale / 4),
        replies: Math.floor(engagementScale / 3),
      },
      isBackfill: false,
    });
  }
  const likeFlow = posts * engagementScale,
    repostFlow = posts * Math.floor(engagementScale / 2),
    quoteFlow = posts * Math.floor(engagementScale / 4),
    replyFlow = posts * Math.floor(engagementScale / 3),
    amplification =
      posts *
      (Math.log1p(engagementScale) +
        3 * Math.log1p(Math.floor(engagementScale / 2)) +
        4 * Math.log1p(Math.floor(engagementScale / 4)) +
        2 * Math.log1p(Math.floor(engagementScale / 3))),
    cascadeHhi = 1 / cascades,
    quality = spam ? 0.01 : broad ? 1 - cascadeHhi : 0.15,
    information = Math.log1p(amplification) * quality,
    reference = 1000 + Math.min(20, information),
    marketTape: MarketTapeEvent[] = [],
    depth: Phase4Scenario["microstructure"]["depth"] = [];
  let sequence = 0,
    orderId = 0;
  for (let level = 1; level <= 5; level++) {
    for (const side of ["BID", "ASK"] as const) {
      const priceTicks = side === "BID" ? 1001 - level : 1001 + level;
      depth.push({ side, priceTicks, quantity: 1000 });
      marketTape.push({
        sequence: ++sequence,
        exchangeTimeNs: "0",
        type: "ORDER_ACCEPTED",
        orderId: ++orderId,
        priceTicks,
        quantity: 1000,
      });
      marketTape.push({
        sequence: ++sequence,
        exchangeTimeNs: "0",
        type: "BOOK_UPDATE",
        orderId,
        priceTicks,
        quantity: 1000,
      });
    }
  }
  const aggressiveQuantity = Math.floor(
      Math.max(100, Math.min(3500, information * 180)),
    ),
    time = (BigInt(posts) * 1_000_000_000n + 5_000_000n).toString();
  marketTape.push({
    sequence: ++sequence,
    exchangeTimeNs: time,
    type: "ORDER_ACCEPTED",
    orderId: ++orderId,
    priceTicks: 0,
    quantity: aggressiveQuantity,
  });
  let remainder = aggressiveQuantity;
  for (const level of depth.filter((item) => item.side === "ASK")) {
    if (!remainder) break;
    const quantity = Math.min(level.quantity, remainder);
    marketTape.push({
      sequence: ++sequence,
      exchangeTimeNs: time,
      type: "TRADE",
      orderId,
      contraOrderId: depth.indexOf(level) + 1,
      priceTicks: level.priceTicks,
      quantity,
      aggressorSide: "BUY",
    });
    level.quantity -= quantity;
    remainder -= quantity;
  }
  const activeAsks = depth.filter(
      (item) => item.side === "ASK" && item.quantity > 0,
    ),
    bestBid = 1000,
    bestAsk = activeAsks[0]?.priceTicks ?? 1006,
    bidSize = 1000,
    askSize = activeAsks[0]?.quantity ?? 0,
    midpoint = (bestBid + bestAsk) / 2,
    microprice =
      askSize + bidSize
        ? (bestAsk * bidSize + bestBid * askSize) / (askSize + bidSize)
        : midpoint,
    signalTape: SignalTapeEvent[] = [
      {
        id: 1,
        eventTimeNs: time,
        expressionId: "expr_crying_face",
        type: "PREVALENCE_SHOCK",
        value: posts,
        zScore: broad ? 3.2 : 1.1,
        methodologyVersion: "CULT-BEHAVIOR-1",
      },
      {
        id: 2,
        eventTimeNs: time,
        expressionId: "expr_crying_face",
        type: "AMPLIFICATION_SHOCK",
        value: round(amplification),
        zScore: spam ? 2.1 : 5.2,
        methodologyVersion: "CULT-BEHAVIOR-1",
      },
      {
        id: 3,
        eventTimeNs: time,
        expressionId: "expr_crying_face",
        type: broad ? "ATTENTION_BLOCK" : "CONCENTRATION_WARNING",
        value: quality,
        zScore: broad ? 4.8 : 6.1,
        methodologyVersion: "CULT-BEHAVIOR-1",
      },
    ],
    partial = {
      expressionTape,
      signalTape,
      marketTape,
      state: {
        expression: "expr_crying_face",
        reference: round(reference),
        market: midpoint,
        basisPercent: round(midpoint / reference - 1),
        prevalenceDocuments: posts,
        creationFlow: posts,
        likeFlow,
        repostFlow,
        quoteFlow,
        replyFlow,
        amplification: round(amplification),
        propagation: round((repostFlow + quoteFlow) / posts),
        cascadeHhi: round(cascadeHhi),
        effectiveCascades: cascades,
        breadth: posts,
        dataLiquidityTier: broad ? "TIER_2_FAST" : "TIER_3_INTRADAY",
      },
      microstructure: {
        bid: bestBid,
        ask: bestAsk,
        midpoint,
        spreadTicks: bestAsk - bestBid,
        microprice: round(microprice),
        imbalanceL1: round(
          (bidSize - askSize) / Math.max(1, bidSize + askSize),
        ),
        imbalanceL5: 0,
        tradeImbalance: 1,
        ofi: aggressiveQuantity,
        depth,
      },
      risk: {
        state: "NORMAL" as const,
        killed: false as const,
        grossExposure: aggressiveQuantity * midpoint,
        netExposure: aggressiveQuantity * midpoint,
        leverage: round((aggressiveQuantity * midpoint) / 10_000_000),
        marginUtilization: round(
          (aggressiveQuantity * midpoint * 0.3) / 10_000_000,
        ),
      },
      heatmaps: {
        depth: {
          x: depth.map((item) => String(item.priceTicks)),
          y: ["quantity"],
          values: [depth.map((item) => item.quantity)],
          units: "lots",
          timestamp: time,
          methodology: "CULT-X-1",
        },
        signals: {
          x: ["PREV", "AMP", "PROP", "CONC"],
          y: ["CRY"],
          values: [
            [
              posts,
              amplification,
              (repostFlow + quoteFlow) / posts,
              cascadeHhi,
            ],
          ],
          units: "mixed; see signal dictionary",
          timestamp: time,
          methodology: "CULT-BEHAVIOR-1",
        },
      },
    },
    outputHash = createHash("sha256")
      .update(JSON.stringify(partial))
      .digest("hex");
  return {
    manifest: {
      runId: `phase4-${kind}-${seed}`,
      dataset: `CULT-SYNTHETIC-EVENTS-${seed}`,
      scenario: kind,
      seed,
      exchangeConfig: "CULT-X-1",
      signalMethodology: "CULT-BEHAVIOR-1",
      mode: "SYNTHETIC",
      outputHash,
    },
    ...partial,
  };
}

export function marketDataSufficiency(
  eventTimesNs: bigint[],
  windowNs = 1_000_000_000n,
) {
  if (eventTimesNs.length < 2)
    return {
      status: "INSUFFICIENT_HISTORY",
      eventRatePerSecond: 0,
      medianInterarrivalSeconds: null,
      zeroWindowProbability: null,
      fano: null,
      burstiness: null,
      recommendedTier: "INSUFFICIENT",
    };
  const ordered = [...eventTimesNs].sort((a, b) => (a < b ? -1 : 1)),
    intervals = ordered
      .slice(1)
      .map((time, index) => Number(time - ordered[index]!) / 1e9)
      .sort((a, b) => a - b),
    median = intervals[Math.floor(intervals.length / 2)]!,
    buckets = Array.from(
      { length: Number((ordered.at(-1)! - ordered[0]!) / windowNs) + 1 },
      () => 0,
    );
  for (const time of ordered)
    buckets[Number((time - ordered[0]!) / windowNs)]!++;
  const mean = buckets.reduce((a, b) => a + b, 0) / buckets.length,
    variance =
      buckets.length > 1
        ? buckets.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
          (buckets.length - 1)
        : 0,
    intervalMean = intervals.reduce((a, b) => a + b, 0) / intervals.length,
    intervalVariance =
      intervals.length > 1
        ? intervals.reduce(
            (sum, value) => sum + (value - intervalMean) ** 2,
            0,
          ) /
          (intervals.length - 1)
        : 0,
    sigma = Math.sqrt(intervalVariance),
    zero = buckets.filter((value) => value === 0).length / buckets.length,
    tier =
      median <= 1 && zero <= 0.5
        ? "TIER_1_HFT_ELIGIBLE"
        : median <= 15
          ? "TIER_2_FAST"
          : median <= 300
            ? "TIER_3_INTRADAY"
            : "TIER_4_SLOW";
  return {
    status: "EXPERIMENTAL",
    eventRatePerSecond: 1 / intervalMean,
    medianInterarrivalSeconds: median,
    zeroWindowProbability: zero,
    fano: mean ? variance / mean : 0,
    burstiness:
      sigma + intervalMean
        ? (sigma - intervalMean) / (sigma + intervalMean)
        : 0,
    recommendedTier: tier,
  };
}

export function evaluateAlerts(
  input: {
    referenceZ: number;
    amplificationZ: number;
    propagationZ: number;
    basisPercent: number;
    totalDepth: number;
    marginUtilization: number;
    sourceHealth: "HEALTHY" | "DEGRADED" | "STALE" | "DISCONNECTED";
    halted: boolean;
  },
  thresholds: AlertThresholds,
) {
  const alerts: AlertType[] = [];
  if (Math.abs(input.referenceZ) >= thresholds.referenceZ)
    alerts.push("REFERENCE_SHOCK");
  if (Math.abs(input.amplificationZ) >= thresholds.amplificationZ)
    alerts.push("AMPLIFICATION_SHOCK");
  if (Math.abs(input.propagationZ) >= thresholds.propagationZ)
    alerts.push("PROPAGATION_SHOCK");
  if (Math.abs(input.basisPercent) >= thresholds.basisPercent)
    alerts.push("BASIS_DISLOCATION");
  if (input.totalDepth < thresholds.minimumDepth)
    alerts.push("LIQUIDITY_COLLAPSE");
  if (input.sourceHealth !== "HEALTHY") alerts.push("DATA_SOURCE_DEGRADED");
  if (input.marginUtilization >= thresholds.maximumMarginUtilization)
    alerts.push("MARGIN_CALL");
  if (input.halted) alerts.push("HALT");
  return { alerts, methodologyVersion: thresholds.methodologyVersion };
}
