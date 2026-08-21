import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
describe("aggregate replay", () => {
  it("replays a captured aggregate stream deterministically", () => {
    execFileSync(
      process.execPath,
      ["--import", "tsx", "apps/worker/src/main.ts"],
      {
        env: {
          ...process.env,
          CULT_DATA_MODE: "synthetic",
          CULT_REPLAY_PATH: "data/replays/test/fixture.jsonl",
        },
      },
    );
    const run = () =>
        execFileSync(
          process.execPath,
          [
            "--import",
            "tsx",
            "scripts/replay.ts",
            "data/replays/test/fixture.jsonl",
          ],
          { encoding: "utf8" },
        ).trim(),
      first = JSON.parse(run()),
      second = JSON.parse(run());
    expect(first.checksum).toBe(second.checksum);
    expect(first.batches).toBeGreaterThan(0);
    expect(first.methodologyVersion).toBe("REF-JEFFREYS-1");
  });
});
