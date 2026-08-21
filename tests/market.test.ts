import { describe, expect, it } from "vitest";
import {
  evaluateRisk,
  SimulatedMarket,
  VirtualLiquidityProvider,
} from "@cult/market-engine";
describe("market accounting", () => {
  it("buys, sells, marks P&L, charges fees, and balances its cash ledger", () => {
    const m = new SimulatedMarket(1_000_000n, { cry: 100 }, 0.001);
    const buy = m.submitOrder({
      userId: "demo",
      assetId: "cry",
      side: "BUY",
      quantity: 10,
    });
    expect(m.cash).toBeCloseTo(10000 - buy.price * 10 - buy.fee);
    expect(m.portfolio().positions[0]!.quantity).toBe(10);
    const sell = m.submitOrder({
      userId: "demo",
      assetId: "cry",
      side: "SELL",
      quantity: 4,
    });
    expect(m.portfolio().positions[0]!.realizedPnl).toBeCloseTo(
      4 * (sell.price - buy.price),
    );
    expect(m.ledger.reduce((s, e) => s + e.amountMinor, 0n)).toBe(m.cashMinor);
  });
  it("shorts and covers with correct exposure", () => {
    const m = new SimulatedMarket(1_000_000n, { skull: 50 });
    m.submitOrder({
      userId: "demo",
      assetId: "skull",
      side: "SHORT",
      quantity: 5,
    });
    expect(m.portfolio().netExposure).toBe(-250);
    m.submitOrder({
      userId: "demo",
      assetId: "skull",
      side: "COVER",
      quantity: 5,
    });
    expect(m.portfolio().positions).toHaveLength(0);
  });
  it("rejects invalid balances and position closes", () => {
    const m = new SimulatedMarket(1000n, { x: 100 });
    expect(() =>
      m.submitOrder({ userId: "demo", assetId: "x", side: "BUY", quantity: 1 }),
    ).toThrow("Insufficient");
    expect(() =>
      m.submitOrder({
        userId: "demo",
        assetId: "x",
        side: "SELL",
        quantity: 1,
      }),
    ).toThrow("Insufficient long");
  });
});

describe("virtual liquidity and margin", () => {
  it("mean reverts premium and responds to order flow deterministically", () => {
    const maker = new VirtualLiquidityProvider({
      meanReversion: 0.2,
      orderFlowImpact: 0.1,
      shockVolatility: 0,
      baseHalfSpread: 0.001,
      volatilitySpread: 0.01,
      illiquiditySpread: 0.1,
      dataRiskSpread: 0.01,
      inventorySkew: 0,
    });
    const state = {
      reference: 100,
      logPremium: 0.1,
      referenceVolatility: 0.2,
      dataQuality: 0.9,
      virtualLiquidity: 10_000,
      inventory: 0,
    };
    expect(maker.update(state, 0, 0).logPremium).toBeCloseTo(0.08);
    expect(maker.update(state, 100, 0).logPremium).toBeCloseTo(0.18);
    expect(maker.impact(100, 10_000)).toBeCloseTo(0.01);
  });
  it("keeps margin states distinct", () => {
    const policy = {
      initialMargin: 0.5,
      maintenanceMargin: 0.25,
      maximumGrossLeverage: 2,
      maximumNetLeverage: 1.5,
      concentrationLimit: 1,
      liquidationEquity: 100,
    };
    expect(evaluateRisk(1000, 1000, 500, 500, policy)).toBe("OK");
    expect(evaluateRisk(1000, 2500, 500, 500, policy)).toBe("MARGIN_CALL");
    expect(evaluateRisk(200, 1000, 0, 100, policy)).toBe("FORCED_DELEVERAGING");
    expect(evaluateRisk(50, 1000, 0, 100, policy)).toBe("LIQUIDATION");
    expect(evaluateRisk(0, 0, 0, 0, policy)).toBe("BANKRUPTCY");
  });
});
