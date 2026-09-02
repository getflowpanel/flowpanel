import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("package entry", () => {
  it("does not reach board.ts, whose module scope imports express", async () => {
    const entry = await readFile(new URL("../index.ts", import.meta.url), "utf8");
    expect(entry).not.toMatch(/board/);
  });

  it("exports the adapter only — the board lives at ./board", async () => {
    const mod = await import("../index");
    expect(Object.keys(mod)).toEqual(["bullmqAdapter"]);
  });
});
