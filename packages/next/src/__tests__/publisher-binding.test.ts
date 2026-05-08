import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@flowpanel/core", async () => {
  const actual = await vi.importActual<typeof import("@flowpanel/core")>("@flowpanel/core");
  return {
    ...actual,
    createPublisher: vi.fn(actual.createPublisher),
  };
});

import { createPublisher, type ResolvedAdminConfig } from "@flowpanel/core";
import { bindPublisher, publish } from "../runtime/publish.js";

function fakeConfig(realtime?: unknown): ResolvedAdminConfig {
  return {
    realtime,
    resourcesByName: new Map(),
    dashboardsByPath: new Map(),
    __resolved: true,
    adapter: {} as never,
    auth: {} as never,
  } as never;
}

describe("bindPublisher", () => {
  beforeEach(() => {
    vi.mocked(createPublisher).mockClear();
  });

  it("creates a memory publisher when config.realtime is unset", () => {
    const cfg = fakeConfig(undefined);
    bindPublisher(cfg);
    expect(createPublisher).toHaveBeenCalledWith({ driver: "memory" });
  });

  it("honors config.realtime when provided", () => {
    const cfg = fakeConfig({ driver: "redis", url: "redis://x:6379" });
    bindPublisher(cfg);
    expect(createPublisher).toHaveBeenCalledWith({ driver: "redis", url: "redis://x:6379" });
  });

  it("is idempotent for the same config object", () => {
    const cfg = fakeConfig(undefined);
    bindPublisher(cfg);
    bindPublisher(cfg);
    // Might be called once on the first bind, and never again for identical config.
    expect(vi.mocked(createPublisher).mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("publish routes through the bound publisher without error", async () => {
    const cfg = fakeConfig(undefined);
    bindPublisher(cfg);
    await expect(publish("x", { a: 1 })).resolves.toBeUndefined();
  });
});
