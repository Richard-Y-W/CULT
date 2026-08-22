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
    | "market"
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

/** One instrument's tradeable price, broadcast on the "market" channel. */
export interface MarketTickPayload {
  assetId: string;
  ticker: string;
  price: number;
  bid: number;
  ask: number;
  changePercent: number;
  dataMode: CultDataMode;
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
    // Outcome of the real pre-trade risk check the agent's order passed
    // through before reaching the (synthetic) matching path -- mirrors
    // cult::exchange::PreTradeRisk::check on the C++ side. "ACCEPT" unless
    // a caller deliberately tightens riskLimits below the scenario's
    // default-sized simulated desk.
    decision: RiskDecision;
    grossExposure: number;
    netExposure: number;
    leverage: number;
    marginUtilization: number;
  };
  heatmaps: Record<string, Heatmap>;
}

export type RiskDecision =
  | "ACCEPT"
  | "ORDER_SIZE"
  | "POSITION"
  | "EXPOSURE"
  | "LEVERAGE"
  | "COLLAR";
export interface PreTradeLimits {
  maximumOrderSize: number;
  maximumPosition: number;
  maximumGrossExposure: number;
  maximumLeverage: number;
  collarTicks: number;
}
const defaultRiskLimits: PreTradeLimits = {
  maximumOrderSize: 10_000,
  maximumPosition: 50_000,
  // Sized for this simulated venue's desk, not a universal production
  // default: covers the sizing formula's max notional so an ordinary shock
  // clears risk, while a caller can pass a tighter PreTradeLimits to
  // exercise an actual rejection.
  maximumGrossExposure: 5_000_000,
  maximumLeverage: 3.0,
  collarTicks: 100,
};
function preTradeRiskCheck(
  side: "BUY" | "SELL",
  quantity: number,
  priceTicks: number,
  midpointTicks: number,
  account: { position: number; equity: number },
  limits: PreTradeLimits,
): RiskDecision {
  if (quantity > limits.maximumOrderSize) return "ORDER_SIZE";
  const signedQuantity = side === "BUY" ? quantity : -quantity;
  if (Math.abs(account.position + signedQuantity) > limits.maximumPosition)
    return "POSITION";
  const price = priceTicks || midpointTicks;
  if (Math.abs(price - midpointTicks) > limits.collarTicks) return "COLLAR";
  const proposed = Math.abs(
    (account.position + signedQuantity) * midpointTicks,
  );
  if (proposed > limits.maximumGrossExposure) return "EXPOSURE";
  if (account.equity <= 0 || proposed / account.equity > limits.maximumLeverage)
    return "LEVERAGE";
  return "ACCEPT";
}
/** Deterministic per-(seed,tag) latency sample in ns -- reproducible, not a fixed constant. */
function deterministicLatencyNs(
  seed: number,
  tag: string,
  baseNs: number,
  jitterNs: number,
): bigint {
  const hash = createHash("sha256").update(`${seed}:${tag}`).digest();
  const jitter = jitterNs > 0 ? hash.readUInt32BE(0) % jitterNs : 0;
  return BigInt(baseNs + jitter);
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

// `referencePrice` seeds the book around the actual current price of the
// selected instrument -- the 1000 default exists only so isolated
// unit/scenario callers keep working unchanged (see the matching comment
// on cpp's run_great_cry_shock); a product caller must pass the real
// current market/reference price so this scenario's book/microstructure
// share the same price scale as the rest of the product.
export function createPhase4Demo(
  kind: "great-cry" | "celebrity" | "spam" = "great-cry",
  seed = 20260821,
  riskLimits: PreTradeLimits = defaultRiskLimits,
  referencePrice = 1000,
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
    // Book is centered on the instrument's actual current price, not a
    // hardcoded fixture value -- see the referencePrice parameter comment.
    basePriceTicks = Math.round(referencePrice),
    reference = referencePrice + Math.min(referencePrice * 0.02, information),
    marketTape: MarketTapeEvent[] = [],
    depth: Phase4Scenario["microstructure"]["depth"] = [];
  let sequence = 0,
    orderId = 0;
  for (let level = 1; level <= 5; level++) {
    for (const side of ["BID", "ASK"] as const) {
      const priceTicks =
        side === "BID" ? basePriceTicks - level : basePriceTicks + level;
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
  // AGENT RECEIVES SIGNAL (the amplification-shock signal derived from the
  // behavior engine above), after AGENT LATENCY -- the agent does not act
  // on `information` directly the instant it is computed.
  const decisionTimeNs = BigInt(posts) * 1_000_000_000n,
    agentLatencyNs = deterministicLatencyNs(seed, "agent", 2_000_000, 500_000),
    agentReceiveTimeNs = decisionTimeNs + agentLatencyNs;
  // STRATEGY DECISION: sizing math is unchanged from the prior shortcut,
  // but it now lives behind an agent reacting to a signal rather than
  // information flowing straight into an order.
  const aggressiveQuantity = Math.floor(
    Math.max(100, Math.min(3500, information * 180)),
  );
  // ORDER LATENCY, then PRE-TRADE RISK, before the order reaches the book.
  const orderLatencyNs = deterministicLatencyNs(
      seed,
      "order",
      3_000_000,
      500_000,
    ),
    time = (agentReceiveTimeNs + orderLatencyNs + 5_000_000n).toString(),
    // Account equity and the dollar (not ratio) risk limit scale with
    // referencePrice so leverage/margin checks behave the same regardless
    // of which instrument's actual price this scenario was seeded with --
    // see the matching comment in cpp/src/exchange/simulator.cpp.
    priceScale = referencePrice / 1000,
    account = { position: 0, equity: 2_000_000 * priceScale },
    scaledRiskLimits = {
      ...riskLimits,
      maximumGrossExposure: riskLimits.maximumGrossExposure * priceScale,
    },
    preTradeMidpoint = basePriceTicks - 0.5,
    riskDecision = preTradeRiskCheck(
      "BUY",
      aggressiveQuantity,
      0,
      preTradeMidpoint,
      account,
      scaledRiskLimits,
    );
  if (riskDecision === "ACCEPT") {
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
  }
  const filledQuantity =
      riskDecision === "ACCEPT" ? aggressiveQuantity : 0,
    activeAsks = depth.filter(
      (item) => item.side === "ASK" && item.quantity > 0,
    ),
    activeBids = depth.filter(
      (item) => item.side === "BID" && item.quantity > 0,
    ),
    bestBid = activeBids[0]?.priceTicks ?? basePriceTicks - 1,
    bestAsk = activeAsks[0]?.priceTicks ?? basePriceTicks + 5,
    bidSize = activeBids[0]?.quantity ?? 1000,
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
        ofi: filledQuantity,
        depth,
      },
      risk: {
        state: "NORMAL" as const,
        killed: false as const,
        decision: riskDecision,
        grossExposure: filledQuantity * midpoint,
        netExposure: filledQuantity * midpoint,
        leverage: round((filledQuantity * midpoint) / 10_000_000),
        marginUtilization: round(
          (filledQuantity * midpoint * 0.3) / 10_000_000,
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
