import { describe, expect, it } from "vitest";
import {
  attributionCredit,
  createPhase4Demo,
  evaluateAlerts,
  marketDataSufficiency,
  resolveDataMode,
} from "@cult/hft-engine";

describe("Phase 4 event-to-market contract", () => {
  it("gates live-market behind acknowledgement and 72 shadow hours", () => {
    expect(resolveDataMode({})).toBe("synthetic");
    expect(() => resolveDataMode({ CULT_DATA_MODE: "live-market" })).toThrow(
      /acknowledgement/,
    );
    expect(() =>
      resolveDataMode({
        CULT_DATA_MODE: "live-market",
        CULT_LIVE_MARKET_ACK: "I_ACKNOWLEDGE_EXPERIMENTAL",
        CULT_LIVE_SHADOW_VALIDATED_HOURS: "71",
      }),
    ).toThrow(/72/);
    expect(
      resolveDataMode({
        CULT_DATA_MODE: "live-market",
        CULT_LIVE_MARKET_ACK: "I_ACKNOWLEDGE_EXPERIMENTAL",
        CULT_LIVE_SHADOW_VALIDATED_HOURS: "72",
      }),
    ).toBe("live-market");
  });

  it("preserves full and fractional multi-expression attribution", () => {
    expect(attributionCredit(2, "FULL")).toBe(1);
    expect(attributionCredit(2, "FRACTIONAL")).toBe(0.5);
  });

  it("replays the Great Cry Shock deterministically", () => {
    const first = createPhase4Demo("great-cry", 42),
      second = createPhase4Demo("great-cry", 42);
    expect(first.manifest.outputHash).toBe(second.manifest.outputHash);
    expect(first.marketTape.some((event) => event.type === "TRADE")).toBe(true);
    expect(first.state.creationFlow).toBe(first.state.prevalenceDocuments);
    expect(first.state.likeFlow).toBeGreaterThan(0);
  });

  it("distinguishes broad adoption from concentrated and spam-like shocks", () => {
    const broad = createPhase4Demo("great-cry"),
      celebrity = createPhase4Demo("celebrity"),
      spam = createPhase4Demo("spam");
    expect(broad.state.effectiveCascades).toBeGreaterThan(
      celebrity.state.effectiveCascades,
    );
    expect(celebrity.state.cascadeHhi).toBeGreaterThan(broad.state.cascadeHhi);
    expect(spam.state.reference).toBeLessThan(celebrity.state.reference);
  });

  it("derives data-liquidity recommendations from arrival statistics", () => {
    const result = marketDataSufficiency([
      0n,
      500_000_000n,
      1_000_000_000n,
      1_500_000_000n,
      2_000_000_000n,
    ]);
    expect(result.recommendedTier).toBe("TIER_1_HFT_ELIGIBLE");
    expect(result.fano).toBeGreaterThanOrEqual(0);
  });

  it("emits versioned operational alerts without treating them as orders", () => {
    const result = evaluateAlerts(
      {
        referenceZ: 4,
        amplificationZ: 5,
        propagationZ: 1,
        basisPercent: 0.03,
        totalDepth: 50,
        marginUtilization: 0.4,
        sourceHealth: "HEALTHY",
        halted: false,
      },
      {
        methodologyVersion: "CULT-ALERTS-1",
        referenceZ: 3,
        amplificationZ: 4,
        propagationZ: 4,
        basisPercent: 0.02,
        minimumDepth: 100,
        maximumMarginUtilization: 0.8,
      },
    );
    expect(result.alerts).toEqual([
      "REFERENCE_SHOCK",
      "AMPLIFICATION_SHOCK",
      "BASIS_DISLOCATION",
      "LIQUIDITY_COLLAPSE",
    ]);
  });
});
