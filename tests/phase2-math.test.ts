import { describe, expect, it } from "vitest";
import {
  authorConcentration,
  jeffreysPrevalence,
  logPrevalenceReturn,
  phase2Signals,
} from "@cult/expression-engine";
describe("Phase 2 reference mathematics", () => {
  it("stores raw and Jeffreys-smoothed prevalence", () => {
    const p = jeffreysPrevalence(10, 1000);
    expect(p.rawPerMillion).toBe(10000);
    expect(p.smoothedProbability).toBeCloseTo(10.5 / 1001);
    expect(() => jeffreysPrevalence(11, 10)).toThrow();
  });
  it("uses log changes without arbitrary epsilon", () =>
    expect(logPrevalenceReturn(0.02, 0.01)).toBeCloseTo(Math.log(2)));
  it("retains direction in breadth and persistence", () => {
    const s = phase2Signals(
      [0.1, -0.05, 0.02],
      [0.5, 0.3, 0.2],
      [0.1, 0.2, -0.1],
      0.03,
    );
    expect(s.velocity).toBeCloseTo(0.039);
    expect(s.acceleration).toBeCloseTo(0.009);
    expect(s.breadth).toBeCloseTo(0.7);
    expect(s.signedBreadth).toBeCloseTo(0.4);
    expect(s.persistence).toBeCloseTo(1 / 3);
  });
  it("reports concentration without opaque bot classification", () => {
    const c = authorConcentration([5, 3, 2]);
    expect(c.largestAuthorShare).toBe(0.5);
    expect(c.topTenAuthorShare).toBe(1);
    expect(c.effectiveAuthors).toBeCloseTo(100 / 38);
  });
});
