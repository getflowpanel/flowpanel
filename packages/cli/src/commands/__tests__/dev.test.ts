import { describe, expect, it } from "vitest";

describe("dev command module", () => {
  it("imports without throwing", async () => {
    await expect(import("../dev.js")).resolves.toBeDefined();
  });

  it("pipeWithPrefix is exported", async () => {
    const mod = await import("../dev.js");
    expect(typeof mod.pipeWithPrefix).toBe("function");
  });
});
