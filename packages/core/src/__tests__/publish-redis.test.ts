import { beforeEach, describe, expect, it, vi } from "vitest";

// Pub + Sub will be two separate mock instances because the adapter
// creates two ioredis clients (command + subscribed connection).
const mockPub = {
  publish: vi.fn(async (_ch: string, _payload: string) => 0),
  quit: vi.fn(async () => "OK"),
};
const mockSub = {
  subscribe: vi.fn(async (_ch: string) => 1),
  unsubscribe: vi.fn(async (_ch: string) => 1),
  on: vi.fn(),
  quit: vi.fn(async () => "OK"),
};

let callCount = 0;
vi.mock("ioredis", () => ({
  default: vi.fn(() => {
    callCount += 1;
    return callCount % 2 === 1 ? mockPub : mockSub;
  }),
}));

import { createPublisher } from "../runtime/publish";

beforeEach(() => {
  callCount = 0;
  mockPub.publish.mockClear();
  mockSub.subscribe.mockClear();
  mockSub.unsubscribe.mockClear();
  mockSub.on.mockClear();
});

describe("createPublisher — redis driver", () => {
  it("publishes JSON-encoded payload on the command connection, prefixed with the default keyPrefix", async () => {
    const p = createPublisher({ driver: "redis", url: "redis://localhost:6379" });
    await p.publish("foo", { bar: 1 });
    expect(mockPub.publish).toHaveBeenCalledWith("flowpanel:foo", JSON.stringify({ bar: 1 }));
  });

  it("subscribe creates a subscriber client and wires an 'on message' handler, using the prefixed wire channel", async () => {
    const p = createPublisher({ driver: "redis", url: "redis://localhost:6379" });
    const handler = vi.fn();
    const unsub = p.subscribe("foo", handler);
    // Wait for the fire-and-forget `load().then(sub.subscribe)` chain to settle.
    // Using vi.waitFor instead of a fixed setTimeout removes the timing flake.
    await vi.waitFor(() => {
      expect(mockSub.subscribe).toHaveBeenCalledWith("flowpanel:foo");
    });
    // Simulate incoming event by invoking the 'message' callback that was wired via on() —
    // Redis hands back the prefixed wire channel, which the publisher must strip before
    // dispatching to handlers registered under the logical ("foo") channel name.
    const onCall = mockSub.on.mock.calls.find((c) => c[0] === "message");
    expect(onCall).toBeDefined();
    const cb = onCall?.[1] as (channel: string, raw: string) => void;
    cb("flowpanel:foo", JSON.stringify({ y: 2 }));
    expect(handler).toHaveBeenCalledWith({ y: 2 });

    unsub();
    expect(mockSub.unsubscribe).toHaveBeenCalledWith("flowpanel:foo");
  });

  it("honors a custom keyPrefix on both publish and subscribe", async () => {
    const p = createPublisher({ driver: "redis", url: "redis://localhost:6379", keyPrefix: "fp" });
    const handler = vi.fn();
    p.subscribe("resource.orders", handler);
    await vi.waitFor(() => {
      expect(mockSub.subscribe).toHaveBeenCalledWith("fp:resource.orders");
    });

    await p.publish("resource.orders", { action: "create" });
    expect(mockPub.publish).toHaveBeenCalledWith(
      "fp:resource.orders",
      JSON.stringify({ action: "create" }),
    );

    const cb = mockSub.on.mock.calls.find((c) => c[0] === "message")?.[1] as (
      channel: string,
      raw: string,
    ) => void;
    cb("fp:resource.orders", JSON.stringify({ action: "create" }));
    expect(handler).toHaveBeenCalledWith({ action: "create" });
  });

  it("memory driver still works", async () => {
    const p = createPublisher({ driver: "memory" });
    const handler = vi.fn();
    const off = p.subscribe("x", handler);
    await p.publish("x", { a: 1 });
    expect(handler).toHaveBeenCalledWith({ a: 1 });
    off();
    await p.publish("x", { a: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
