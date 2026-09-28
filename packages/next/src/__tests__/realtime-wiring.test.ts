import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..");
const RAW =
  /realtime \? \{ realtime: |channels=\{(?:dashboard|widget|options|w\.options)\.realtime\}/;

describe("realtime wiring", () => {
  it("turns every realtime option into channels before it reaches a client", () => {
    const raw = globSync("**/*.{ts,tsx}", { cwd: SRC })
      .filter((file) => !file.includes("__tests__"))
      .filter((file) => RAW.test(readFileSync(join(SRC, file), "utf8")));
    expect(
      raw,
      "pass realtime through realtimeProp() or realtimeChannels() (wave D Ruling 3)",
    ).toEqual([]);
  });
});
