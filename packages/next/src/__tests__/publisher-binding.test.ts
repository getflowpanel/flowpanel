import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@flowpanel/core", async () => {
  const actual = await vi.importActual<typeof import("@flowpanel/core")>("@flowpanel/core");
  return {
    ...actual,
    createPublisher: vi.fn(actual.createPublisher),
  };
});

import { createPublisher, type ResolvedAdminConfig } from "@flowpanel/core";
import { bindPublisher, publish, resetPublisherForTests, subscribe } from "../runtime/publish.js";

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
    resetPublisherForTests();
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
    expect(createPublisher).toHaveBeenCalledTimes(1);
  });

  it("publish routes through the bound publisher without error", async () => {
    const cfg = fakeConfig(undefined);
    bindPublisher(cfg);
    await expect(publish("x", { a: 1 })).resolves.toBeUndefined();
  });

  // Regression coverage for the cross-tab realtime bug: Next.js compiles
  // every route handler (`stream/route.ts`, the `[...route]/route.ts`
  // catch-all, `instrumentation.ts`, …) into its own webpack bundle, so the
  // SAME logical `ResolvedAdminConfig` singleton comes back as a DIFFERENT
  // object per bundle — confirmed by instrumenting a real `next dev` server
  // (bindPublisher logged distinct config identities across route bundles
  // within a single process). `bindPublisher` must not treat "a different
  // object" as "a different runtime config" — doing so replaces the shared
  // publisher and orphans every subscriber already registered on the old
  // one, which is exactly how a drawer action's `publishResource(...)`
  // could succeed (200 OK) while every other tab's `<DataTable
  // realtime="resource.users">` never re-fetches.
  it("keeps the first-bound publisher across a later bind with a different config object", () => {
    const cfgFromStreamBundle = fakeConfig({ driver: "memory" });
    const cfgFromCatchAllBundle = fakeConfig({ driver: "memory" });
    expect(cfgFromStreamBundle).not.toBe(cfgFromCatchAllBundle);

    bindPublisher(cfgFromStreamBundle);
    bindPublisher(cfgFromCatchAllBundle);

    expect(createPublisher).toHaveBeenCalledTimes(1);
  });

  it("warns once when publish() runs before bindPublisher in this process", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await publish("resource.users", { action: "update" });
    await publish("resource.users", { action: "update" });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/bindPublisher/);
    warn.mockRestore();
  });

  it("does not warn when bindPublisher ran first", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    bindPublisher(fakeConfig(undefined));
    await publish("resource.users", { action: "update" });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("a subscriber registered before a cross-bundle bind still receives published events", async () => {
    const cfgFromStreamBundle = fakeConfig({ driver: "memory" });
    const cfgFromCatchAllBundle = fakeConfig({ driver: "memory" });

    bindPublisher(cfgFromStreamBundle);
    const received: unknown[] = [];
    const unsubscribe = subscribe("resource.users", (payload) => received.push(payload));

    // A sibling route bundle binds with its OWN config object instance —
    // this must not silently swap the publisher out from under `subscribe`.
    bindPublisher(cfgFromCatchAllBundle);
    await publish("resource.users", { action: "update" });

    expect(received).toEqual([{ action: "update" }]);
    unsubscribe();
  });
});
