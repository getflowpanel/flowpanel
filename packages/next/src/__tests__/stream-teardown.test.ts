import type { ResolvedAdminConfig } from "@flowpanel/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const disposeSpies: Array<ReturnType<typeof vi.fn>> = [];
const subscribeSpy = vi.fn((_channel: string, _handler: (payload: unknown) => void) => {
  const dispose = vi.fn();
  disposeSpies.push(dispose);
  return dispose;
});
vi.mock("../runtime/publish.js", () => ({
  bindPublisher: vi.fn(),
  subscribe: (channel: string, handler: (payload: unknown) => void) =>
    subscribeSpy(channel, handler),
}));

import { stream } from "../stream.js";

function makeConfig(overrides: Partial<ResolvedAdminConfig> = {}): ResolvedAdminConfig {
  return {
    auth: {
      session: async () => ({ user: { id: "u1", role: "admin" } }),
      role: () => "admin",
    },
    resourcesByName: new Map(),
    ...overrides,
  } as ResolvedAdminConfig;
}

describe("stream() — teardown", () => {
  beforeEach(() => {
    subscribeSpy.mockClear();
    disposeSpies.length = 0;
  });

  it("unsubscribes every channel and clears the heartbeat when the client cancels", async () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    try {
      const config = makeConfig();
      const req = new Request("http://localhost/stream?channel=resource.users&channel=other");
      const res = await stream(config)(req);
      const reader = res.body!.getReader();
      await reader.read(); // ready handshake

      expect(disposeSpies).toHaveLength(2);
      for (const d of disposeSpies) expect(d).not.toHaveBeenCalled();

      await reader.cancel();

      for (const d of disposeSpies) expect(d).toHaveBeenCalledOnce();
      expect(clearIntervalSpy).toHaveBeenCalled();
    } finally {
      clearIntervalSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("closes the stream and never subscribes when the client disconnected during auth", async () => {
    const ac = new AbortController();
    const config = makeConfig({
      auth: {
        // Simulate a disconnect landing while `session()` is still pending — by the time
        // start() runs, req.signal.aborted is already true.
        session: async () => {
          ac.abort();
          return { user: { id: "u1", role: "admin" } };
        },
        role: () => "admin",
      },
    });
    const req = new Request("http://localhost/stream?channel=resource.users", {
      signal: ac.signal,
    });

    const res = await stream(config)(req);
    const { done, value } = await res.body!.getReader().read();

    // No "ready" handshake was ever enqueued — the stream closed before start() did anything.
    expect(done).toBe(true);
    expect(value).toBeUndefined();
    expect(subscribeSpy).not.toHaveBeenCalled();
  });

  it("closes the stream when the first enqueue fails", async () => {
    // Forces controller.enqueue()'s argument to throw, exercising safeEnqueue's catch without
    // needing to fake the platform ReadableStream itself.
    const encodeSpy = vi.spyOn(TextEncoder.prototype, "encode").mockImplementationOnce(() => {
      throw new Error("boom");
    });
    try {
      const config = makeConfig();
      const req = new Request("http://localhost/stream");

      const res = await stream(config)(req);
      const { done, value } = await res.body!.getReader().read();

      expect(done).toBe(true);
      expect(value).toBeUndefined();
    } finally {
      encodeSpy.mockRestore();
    }
  });
});
