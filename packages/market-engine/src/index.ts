import type { LedgerEntry, Order, OrderSide, Position } from "@cult/shared";
const minor = (n: number) => BigInt(Math.round(n * 100));
export interface Quote {
  assetId: string;
  side: OrderSide;
  price: number;
  fee: number;
  expiresAt: string;
}
export interface SubmitOrder {
  userId: string;
  assetId: string;
  side: OrderSide;
  quantity: number;
}
export interface ExecutionEngine {
  quote(assetId: string, side: OrderSide, quantity: number): Quote;
  submitOrder(input: SubmitOrder): Order;
  cancelOrder(orderId: string): boolean;
}
export class SimulatedMarket implements ExecutionEngine {
  readonly orders: Order[] = [];
  readonly ledger: LedgerEntry[] = [];
  readonly positions = new Map<string, Position>();
  private sequence = 0;
  constructor(
    public cashMinor = minor(10_000),
    private readonly prices: Record<string, number>,
    private readonly feeRate = 0.001,
    private readonly userId = "demo",
  ) {
    this.ledger.push(
      this.entry("INITIAL_GRANT", this.cashMinor, "account-open"),
    );
  }
  private entry(
    type: LedgerEntry["type"],
    amountMinor: bigint,
    referenceId: string,
  ): LedgerEntry {
    return {
      id: `led_${++this.sequence}`,
      accountId: this.userId,
      type,
      amountMinor,
      referenceId,
      createdAt: new Date().toISOString(),
    };
  }
  quote(assetId: string, side: OrderSide, quantity: number): Quote {
    const mid = this.prices[assetId];
    if (!mid || quantity <= 0 || !Number.isFinite(quantity))
      throw new Error("Invalid quote request");
    const slip = Math.min(0.005, quantity / 100000),
      direction = side === "BUY" || side === "COVER" ? 1 : -1,
      price = Number((mid * (1 + direction * slip)).toFixed(2));
    return {
      assetId,
      side,
      price,
      fee: Number((price * quantity * this.feeRate).toFixed(2)),
      expiresAt: new Date(Date.now() + 10_000).toISOString(),
    };
  }
  submitOrder(input: SubmitOrder): Order {
    const q = this.quote(input.assetId, input.side, input.quantity),
      pos = this.positions.get(input.assetId) ?? {
        assetId: input.assetId,
        quantity: 0,
        averageEntryPrice: 0,
        realizedPnl: 0,
      };
    if (input.side === "SELL" && pos.quantity < input.quantity)
      throw new Error("Insufficient long position");
    if (input.side === "COVER" && -pos.quantity < input.quantity)
      throw new Error("Insufficient short position");
    const cashFlow =
        q.price *
        input.quantity *
        (input.side === "BUY" || input.side === "COVER" ? -1 : 1),
      required = minor(Math.max(0, -cashFlow) + q.fee);
    if (required > this.cashMinor) throw new Error("Insufficient CULT balance");
    const signed =
        input.quantity *
        (input.side === "BUY" || input.side === "COVER" ? 1 : -1),
      oldQty = pos.quantity,
      newQty = oldQty + signed;
    let avg = pos.averageEntryPrice,
      realized = pos.realizedPnl;
    const increases = Math.sign(signed) === Math.sign(oldQty) || oldQty === 0;
    if (increases)
      avg =
        (Math.abs(oldQty) * avg + Math.abs(signed) * q.price) /
        Math.abs(newQty);
    else {
      const closed = Math.min(Math.abs(oldQty), Math.abs(signed));
      realized += closed * (q.price - avg) * Math.sign(oldQty);
      if (newQty === 0) avg = 0;
      else if (Math.sign(newQty) !== Math.sign(oldQty)) avg = q.price;
    }
    const id = `ord_${++this.sequence}`,
      at = new Date().toISOString(),
      order: Order = {
        id,
        userId: input.userId,
        assetId: input.assetId,
        side: input.side,
        quantity: input.quantity,
        price: q.price,
        fee: q.fee,
        status: "FILLED",
        submittedAt: at,
        filledAt: at,
      };
    this.cashMinor += minor(cashFlow - q.fee);
    this.ledger.push(
      this.entry(
        cashFlow < 0 ? "TRADE_DEBIT" : "TRADE_CREDIT",
        minor(cashFlow),
        id,
      ),
      this.entry("TRADING_FEE", minor(-q.fee), id),
    );
    this.positions.set(input.assetId, {
      ...pos,
      quantity: newQty,
      averageEntryPrice: avg,
      realizedPnl: realized,
    });
    this.orders.push(order);
    return order;
  }
  cancelOrder(orderId: string) {
    const order = this.orders.find((x) => x.id === orderId);
    if (!order || order.status !== "PENDING") return false;
    order.status = "CANCELLED";
    return true;
  }
  get cash() {
    return Number(this.cashMinor) / 100;
  }
  portfolio() {
    const positions = [...this.positions.values()]
      .filter((x) => x.quantity !== 0)
      .map((p) => {
        const mark = this.prices[p.assetId] ?? 0;
        return {
          ...p,
          currentMark: mark,
          marketValue: p.quantity * mark,
          unrealizedPnl: p.quantity * (mark - p.averageEntryPrice),
          portfolioWeight: 0,
        };
      });
    const value = this.cash + positions.reduce((s, p) => s + p.marketValue, 0),
      gross = positions.reduce((s, p) => s + Math.abs(p.marketValue), 0),
      net = positions.reduce((s, p) => s + p.marketValue, 0);
    return {
      cash: this.cash,
      value,
      grossExposure: gross,
      netExposure: net,
      realizedPnl: positions.reduce((s, p) => s + p.realizedPnl, 0),
      unrealizedPnl: positions.reduce((s, p) => s + p.unrealizedPnl, 0),
      positions: positions.map((p) => ({
        ...p,
        portfolioWeight: value ? p.marketValue / value : 0,
      })),
    };
  }
  bailout() {
    if (this.portfolio().value >= 100)
      throw new Error("Portfolio is not bankrupt");
    const amount = minor(500);
    this.cashMinor += amount;
    this.ledger.push(this.entry("BAILOUT", amount, "margin-call"));
  }
}

export interface LiquidityProviderConfig {
  meanReversion: number;
  orderFlowImpact: number;
  shockVolatility: number;
  baseHalfSpread: number;
  volatilitySpread: number;
  illiquiditySpread: number;
  dataRiskSpread: number;
  inventorySkew: number;
}
export interface LiquidityState {
  reference: number;
  logPremium: number;
  referenceVolatility: number;
  dataQuality: number;
  virtualLiquidity: number;
  inventory: number;
}

export class VirtualLiquidityProvider {
  constructor(readonly config: LiquidityProviderConfig) {
    if (!(config.meanReversion >= 0 && config.meanReversion <= 1))
      throw new RangeError(
        "mean reversion must keep the premium process stable",
      );
    if (Object.values(config).some((value) => !Number.isFinite(value)))
      throw new RangeError("liquidity parameters must be finite");
  }
  update(
    state: LiquidityState,
    buyVolume: number,
    sellVolume: number,
    shock = 0,
  ) {
    if (
      state.reference <= 0 ||
      state.virtualLiquidity <= 0 ||
      state.dataQuality < 0 ||
      state.dataQuality > 1
    )
      throw new RangeError("invalid liquidity state");
    const total = buyVolume + sellVolume,
      orderFlowImbalance = total ? (buyVolume - sellVolume) / total : 0,
      logPremium =
        (1 - this.config.meanReversion) * state.logPremium +
        this.config.orderFlowImpact * orderFlowImbalance +
        this.config.shockVolatility * shock,
      unskewedMid = state.reference * Math.exp(logPremium),
      mid = Math.max(
        0.01,
        unskewedMid - this.config.inventorySkew * state.inventory,
      ),
      halfSpreadRate = Math.max(
        0,
        this.config.baseHalfSpread +
          this.config.volatilitySpread * state.referenceVolatility +
          this.config.illiquiditySpread / Math.sqrt(state.virtualLiquidity) +
          this.config.dataRiskSpread * (1 - state.dataQuality),
      );
    return {
      logPremium,
      orderFlowImbalance,
      mid,
      bid: mid * (1 - halfSpreadRate),
      ask: mid * (1 + halfSpreadRate),
      halfSpreadRate,
    };
  }
  impact(quantity: number, virtualLiquidity: number) {
    if (!(virtualLiquidity > 0))
      throw new RangeError("virtual liquidity must be positive");
    return (
      this.config.orderFlowImpact *
      Math.sign(quantity) *
      Math.sqrt(Math.abs(quantity) / virtualLiquidity)
    );
  }
}

export interface MarginPolicy {
  initialMargin: number;
  maintenanceMargin: number;
  maximumGrossLeverage: number;
  maximumNetLeverage: number;
  concentrationLimit: number;
  liquidationEquity: number;
}
export type RiskState =
  | "OK"
  | "MARGIN_CALL"
  | "FORCED_DELEVERAGING"
  | "LIQUIDATION"
  | "BANKRUPTCY";
export function evaluateRisk(
  equity: number,
  grossExposure: number,
  netExposure: number,
  largestPosition: number,
  policy: MarginPolicy,
): RiskState {
  if (equity <= 0) return "BANKRUPTCY";
  if (equity <= policy.liquidationEquity) return "LIQUIDATION";
  const grossLeverage = grossExposure / equity,
    netLeverage = Math.abs(netExposure) / equity,
    concentration = Math.abs(largestPosition) / equity;
  if (equity < policy.maintenanceMargin * grossExposure)
    return "FORCED_DELEVERAGING";
  if (
    grossLeverage > policy.maximumGrossLeverage ||
    netLeverage > policy.maximumNetLeverage ||
    concentration > policy.concentrationLimit
  )
    return "MARGIN_CALL";
  return "OK";
}
