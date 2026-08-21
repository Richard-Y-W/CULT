import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EmojiRegistry, type EmojiRegistryData } from "@cult/expression-engine";
const data = JSON.parse(
    readFileSync("data/reference/unicode/cult-emoji-registry-v1.json", "utf8"),
  ) as EmojiRegistryData,
  registry = new EmojiRegistry(data);
describe("Unicode Emoji Registry V1", () => {
  it("is pinned to Emoji 17.0 with thirty assets", () => {
    expect(data.registry_version).toBe("EMOJI-17.0-CULT-V1");
    expect(data.assets).toHaveLength(30);
  });
  it("counts document presence once while retaining repetition intensity", () => {
    const result = registry.extract("committee findings: 😂😂😂😂😂");
    expect(result).toHaveLength(1);
    expect(result[0]!.occurrences).toBe(5);
    expect(registry.documentPresence("😂😂😂")).toEqual(["expr_joy"]);
  });
  it("aggregates variation selector forms but retains raw forms", () => {
    const result = registry.extract("❤ ❤️");
    expect(result).toHaveLength(1);
    expect(result[0]!.expressionId).toBe("expr_heart");
    expect(new Set(result[0]!.rawForms).size).toBe(2);
  });
  it("aggregates skin-tone variants hierarchically", () => {
    const result = registry.extract("🙏 🙏🏿 👍🏻");
    expect(result.map((x) => x.expressionId)).toEqual([
      "expr_pray",
      "expr_thumbsup",
    ]);
    expect(result[0]!.occurrences).toBe(2);
  });
  it("recognizes mixed emoji and ignores hostile or malformed text safely", () => {
    expect(() =>
      registry.extract(`x\uD800${"́".repeat(1000)}👀📈`),
    ).not.toThrow();
    expect(registry.documentPresence("x 👀📈")).toEqual([
      "expr_eyes",
      "expr_chart_up",
    ]);
  });
});
