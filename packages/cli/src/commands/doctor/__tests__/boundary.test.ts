import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkBoundary } from "../boundary";

const FIXTURE = (name: string) => resolve(__dirname, "fixtures", name);

describe("checkBoundary", () => {
  it("ok fixture: config has server-only, no leaks", async () => {
    const res = await checkBoundary({ cwd: FIXTURE("ok") });
    expect(res.configPath).toBe("src/flowpanel.ts");
    expect(res.hasServerOnly).toBe(true);
    expect(res.leaks).toEqual([]);
  });

  it("missing-guard fixture: hasServerOnly = false", async () => {
    const res = await checkBoundary({ cwd: FIXTURE("missing-guard") });
    expect(res.configPath).toBe("src/flowpanel.ts");
    expect(res.hasServerOnly).toBe(false);
    expect(res.leaks).toEqual([]);
  });

  it("leak fixture: detects client → helper → config chain", async () => {
    const res = await checkBoundary({ cwd: FIXTURE("leak") });
    expect(res.hasServerOnly).toBe(true);
    expect(res.leaks).toHaveLength(1);
    const leak = res.leaks[0];
    if (!leak) throw new Error("expected one leak");
    expect(leak.from).toBe("app/Dashboard.client.tsx");
    // Chain must include the helper and end on the config.
    expect(leak.chain.some((p) => p.endsWith("helper.ts"))).toBe(true);
    expect(leak.chain.at(-1)).toBe("src/flowpanel.ts");
  });

  it("returns configPath: null when no config file exists", async () => {
    const res = await checkBoundary({ cwd: resolve(__dirname, "fixtures") });
    expect(res.configPath).toBeNull();
    expect(res.hasServerOnly).toBe(false);
    expect(res.leaks).toEqual([]);
  });
});
