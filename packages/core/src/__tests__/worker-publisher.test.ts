import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface MockConnection {
  url: string;
  publish: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
}

const constructed: MockConnection[] = [];

vi.mock("ioredis", () => ({
  default: vi.fn((url: string) => {
    const connection: MockConnection = {
      url,
      publish: vi.fn(async () => 1),
      subscribe: vi.fn(async () => 1),
      unsubscribe: vi.fn(async () => 1),
      on: vi.fn(),
      off: vi.fn(),
      quit: vi.fn(async () => "OK"),
    };
    constructed.push(connection);
    return connection;
  }),
}));

import { createRedisPublisher } from "../runtime/redis-publisher";
import { createPublisher } from "../runtime/worker-publisher";

const refused = Object.assign(new Error("connect ECONNREFUSED redis://cache:6379"), {
  code: "ECONNREFUSED",
});

function failingClient() {
  return {
    publish: vi.fn(async () => {
      throw refused;
    }),
    on: vi.fn(),
    off: vi.fn(),
  };
}

function workingClient() {
  return { publish: vi.fn(async () => 1), on: vi.fn(), off: vi.fn() };
}

beforeEach(() => {
  constructed.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createPublisher — a worker's publisher", () => {
  it("resolves on a Redis error and hands it to onError with the channel", async () => {
    const onError = vi.fn();
    const events = createPublisher({ redis: failingClient(), onError });
    await expect(events.publish("pipeline", { n: 1 })).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(refused, "pipeline");
  });

  it("logs one redacted line per error kind when no onError is given", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const events = createPublisher({ redis: failingClient() });
    await events.publish("pipeline");
    await events.resource("orders", { id: 1 });
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]?.[0])).toContain("ECONNREFUSED");
    expect(String(error.mock.calls[0]?.[0])).not.toContain("redis://cache");
  });

  it("still throws after close(), which is a bug in the caller", async () => {
    const events = createPublisher({ redis: failingClient(), onError: vi.fn() });
    await events.close();
    await expect(events.publish("pipeline")).rejects.toThrow("closed");
  });

  it("still rejects a payload JSON cannot carry", async () => {
    const events = createPublisher({ redis: workingClient(), onError: vi.fn() });
    await expect(events.publish("pipeline", { n: 1n })).rejects.toThrow();
  });

  it("tells a resource's open pages that its rows changed", async () => {
    const client = workingClient();
    const events = createPublisher({ redis: client, keyPrefix: "app" });
    await events.resource("user", { id: 1 });
    await events.resource("orders", { action: "delete", id: "o-7" });
    await events.resource("runs");
    expect(client.publish.mock.calls).toEqual([
      ["app:resource.user", JSON.stringify({ action: "update", id: 1 })],
      ["app:resource.orders", JSON.stringify({ action: "delete", id: "o-7" })],
      ["app:resource.runs", JSON.stringify({ action: "update" })],
    ]);
  });

  it("takes the admin's own realtime options", async () => {
    const events = createPublisher({
      driver: "redis",
      url: "redis://cache:6379",
      keyPrefix: "radar-production",
    });
    await events.resource("user", { id: "u1" });
    expect(constructed).toHaveLength(1);
    expect(constructed[0]?.url).toBe("redis://cache:6379");
    expect(constructed[0]?.publish).toHaveBeenCalledWith(
      "radar-production:resource.user",
      JSON.stringify({ action: "update", id: "u1" }),
    );
    await events.close();
    expect(constructed[0]?.quit).toHaveBeenCalledTimes(1);
  });
});

describe("createRedisPublisher — a client whose duplicate() cannot subscribe", () => {
  it("opens its own subscriber from url instead of using the duplicate", async () => {
    const client = { ...workingClient(), duplicate: () => ({ publish: vi.fn() }) };
    const publisher = createRedisPublisher({ client, url: "redis://cache:6379" });
    publisher.subscribe("pipeline", () => {});
    await vi.waitFor(() =>
      expect(constructed[0]?.subscribe).toHaveBeenCalledWith("flowpanel:pipeline"),
    );
    expect(constructed).toHaveLength(1);
    await publisher.close();
  });

  it("tells a resource's pages through the admin transport too", async () => {
    const client = workingClient();
    const publisher = createRedisPublisher({ client });
    await publisher.resource("orders", { action: "create", id: 3 });
    expect(client.publish).toHaveBeenCalledWith(
      "flowpanel:resource.orders",
      JSON.stringify({ action: "create", id: 3 }),
    );
  });
});
