import { beforeEach, describe, expect, it, vi } from "vitest";

interface FakeConnection {
  publish: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  duplicate?: () => FakeConnection;
  emit(event: string, ...args: unknown[]): void;
  errorListeners(): number;
}

let duplicates: FakeConnection[] = [];
let constructed: FakeConnection[] = [];

function fakeConnection(withDuplicate = false): FakeConnection {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const connection: FakeConnection = {
    publish: vi.fn(async () => 1),
    subscribe: vi.fn(async () => 1),
    unsubscribe: vi.fn(async () => 1),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      const set = listeners.get(event) ?? [];
      set.push(cb);
      listeners.set(event, set);
      return connection;
    }),
    off: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      const set = listeners.get(event) ?? [];
      listeners.set(
        event,
        set.filter((entry) => entry !== cb),
      );
      return connection;
    }),
    quit: vi.fn(async () => "OK"),
    emit(event, ...args) {
      for (const cb of listeners.get(event) ?? []) cb(...args);
    },
    errorListeners() {
      return (listeners.get("error") ?? []).length;
    },
  };
  if (withDuplicate) {
    connection.duplicate = () => {
      const copy = fakeConnection();
      duplicates.push(copy);
      return copy;
    };
  }
  return connection;
}

vi.mock("ioredis", () => ({
  default: vi.fn(() => {
    const connection = fakeConnection();
    constructed.push(connection);
    return connection;
  }),
}));

import { decodeEnvelope, decodePayload, encodeEnvelope, encodePayload } from "../runtime/envelope";
import { createPublisher } from "../runtime/publish";
import { createPublisher as createPublisherClient } from "../runtime/redis-publisher";

/** The body @flowpanel/core 0.2 published, byte for byte (ad6afa7 runtime/publish.ts). */
function bodyAt02(payload: unknown): string {
  return payload === undefined ? "" : JSON.stringify(payload);
}

beforeEach(() => {
  duplicates = [];
  constructed = [];
});

function messageHandler(connection: FakeConnection): (channel: string, raw: string) => void {
  const call = connection.on.mock.calls.find((c) => c[0] === "message");
  expect(call).toBeDefined();
  return call?.[1] as (channel: string, raw: string) => void;
}

describe("envelope", () => {
  it("round-trips a payload and omits the key when there is none", () => {
    expect(encodeEnvelope("orders", { id: 7 })).toBe('{"channel":"orders","payload":{"id":7}}');
    expect(encodeEnvelope("orders", undefined)).toBe('{"channel":"orders"}');
    expect(decodeEnvelope(encodeEnvelope("orders", { id: 7 }))).toEqual({
      channel: "orders",
      payload: { id: 7 },
    });
    expect(decodeEnvelope(encodeEnvelope("orders", undefined))).toEqual({
      channel: "orders",
      payload: undefined,
    });
  });

  it("returns null for anything that is not a channelled envelope", () => {
    expect(decodeEnvelope("not json")).toBeNull();
    expect(decodeEnvelope('{"payload":1}')).toBeNull();
    expect(decodeEnvelope("[]")).toBeNull();
    expect(decodeEnvelope("null")).toBeNull();
  });

  it("is the SSE frame only: the transport body stays the bare payload", () => {
    expect(encodePayload("orders", { id: 7 })).toBe(bodyAt02({ id: 7 }));
    expect(encodePayload("orders", undefined)).toBe(bodyAt02(undefined));
    expect(decodePayload(bodyAt02({ id: 7 }))).toEqual({ id: 7 });
    expect(decodePayload(bodyAt02(undefined))).toBeUndefined();
    expect(decodePayload("not json")).toBe("not json");
  });
});

describe("createPublisher — publish-only client", () => {
  it("opens exactly one connection for a publish-only process", async () => {
    const client = createPublisherClient({ redis: "redis://localhost:6379" });
    await client.publish("orders", { id: 1 });
    await client.publish("orders", { id: 2 });

    expect(constructed).toHaveLength(1);
    expect(constructed[0]?.publish).toHaveBeenCalledTimes(2);
  });

  it("writes the same body 0.2 wrote, on the same prefixed wire channel", async () => {
    const client = createPublisherClient({ redis: "redis://localhost:6379", keyPrefix: "acme" });
    await client.publish(client.channelFor("orders"), { action: "update" });
    await client.publish("ticks");

    expect(constructed[0]?.publish).toHaveBeenNthCalledWith(
      1,
      "acme:resource.orders",
      bodyAt02({ action: "update" }),
    );
    expect(constructed[0]?.publish).toHaveBeenNthCalledWith(2, "acme:ticks", bodyAt02(undefined));
  });

  it("opens nothing, and duplicates nothing, before the first publish", () => {
    const host = fakeConnection(true);
    createPublisherClient({ redis: "redis://localhost:6379" });
    createPublisherClient({ redis: host });

    expect(constructed).toHaveLength(0);
    expect(duplicates).toHaveLength(0);
    expect(host.publish).not.toHaveBeenCalled();
  });

  it("uses the host's client instead of opening its own", async () => {
    const host = fakeConnection(true);
    const client = createPublisherClient({ redis: host });
    await client.publish("orders", { id: 1 });

    expect(constructed).toHaveLength(0);
    expect(host.publish).toHaveBeenCalledTimes(1);
  });

  it("close() is idempotent and leaves the host's client open", async () => {
    const host = fakeConnection(true);
    const client = createPublisherClient({ redis: host });
    await client.publish("orders", { id: 1 });

    await client.close();
    await client.close();

    expect(host.quit).not.toHaveBeenCalled();
    await expect(client.publish("orders", { id: 2 })).rejects.toThrow(/closed/);
  });

  it("close() quits every connection it opened itself, once", async () => {
    const client = createPublisherClient({ redis: "redis://localhost:6379" });
    await client.publish("orders", { id: 1 });
    await client.close();
    await client.close();

    expect(constructed[0]?.quit).toHaveBeenCalledTimes(1);
  });
});

describe("createPublisher — redis driver connections", () => {
  it("attaches an error handler to every connection and swallows what it receives", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const publisher = createPublisher({ driver: "redis", url: "redis://localhost:6379" });
    await publisher.publish("orders", { id: 1 });
    publisher.subscribe("orders", () => {});
    await vi.waitFor(() => {
      expect(constructed).toHaveLength(2);
    });

    for (const connection of constructed) {
      expect(connection.on.mock.calls.some((c) => c[0] === "error")).toBe(true);
      expect(() => {
        connection.emit("error", Object.assign(new Error("boom"), { code: "ECONNREFUSED" }));
      }).not.toThrow();
    }

    error.mockRestore();
  });

  it("logs one line per error kind rather than one per error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const publisher = createPublisher({ driver: "redis", url: "redis://localhost:6379" });
    await publisher.publish("orders", { id: 1 });
    const connection = constructed[0] as FakeConnection;

    connection.emit("error", Object.assign(new Error("a"), { code: "ECONNREFUSED" }));
    connection.emit("error", Object.assign(new Error("b"), { code: "ECONNREFUSED" }));
    expect(error).toHaveBeenCalledTimes(1);

    connection.emit("error", Object.assign(new Error("c"), { code: "ETIMEDOUT" }));
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it("creates the subscriber connection lazily, only on the first subscribe", async () => {
    const publisher = createPublisher({ driver: "redis", url: "redis://localhost:6379" });
    await publisher.publish("orders", { id: 1 });
    expect(constructed).toHaveLength(1);

    publisher.subscribe("orders", () => {});
    await vi.waitFor(() => {
      expect(constructed).toHaveLength(2);
    });
    expect(constructed[1]?.subscribe).toHaveBeenCalledWith("flowpanel:orders");
  });

  it("duplicates the host's client for the subscriber connection", async () => {
    const host = fakeConnection(true);
    const publisher = createPublisher({ driver: "redis", client: host });
    publisher.subscribe("orders", () => {});
    await vi.waitFor(() => {
      expect(duplicates).toHaveLength(1);
    });

    expect(constructed).toHaveLength(0);
    expect(duplicates[0]?.subscribe).toHaveBeenCalledWith("flowpanel:orders");
  });

  it("delivers a 0.2 body on the logical channel and unsubscribes with the last handler", async () => {
    const publisher = createPublisher({ driver: "redis", url: "redis://localhost:6379" });
    const received: unknown[] = [];
    const off = publisher.subscribe("resource.orders", (payload) => received.push(payload));
    await vi.waitFor(() => {
      expect(constructed).toHaveLength(1);
    });

    const onMessage = messageHandler(constructed[0] as FakeConnection);
    onMessage("flowpanel:resource.orders", bodyAt02({ action: "create" }));
    onMessage("flowpanel:resource.orders", bodyAt02(undefined));
    onMessage("flowpanel:resource.orders", "not json");
    expect(received).toEqual([{ action: "create" }, undefined, "not json"]);

    off();
    expect(constructed[0]?.unsubscribe).toHaveBeenCalledWith("flowpanel:resource.orders");
  });

  it("stays inert after close(): subscribe opens nothing and hands back a no-op disposer", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const host = fakeConnection(true);
    const publisher = createPublisher({ driver: "redis", client: host });
    await publisher.close?.();

    const off = publisher.subscribe("orders", () => {});
    off();

    expect(duplicates).toHaveLength(0);
    expect(constructed).toHaveLength(0);
    await expect(publisher.publish("orders", { id: 1 })).rejects.toThrow(/closed/);
    warn.mockRestore();
  });

  it("removes the error listeners it put on a host client", async () => {
    const host = fakeConnection(true);
    const publisher = createPublisher({ driver: "redis", client: host });
    publisher.subscribe("orders", () => {});
    await vi.waitFor(() => {
      expect(duplicates).toHaveLength(1);
    });
    expect(host.errorListeners()).toBe(1);

    await publisher.close?.();

    expect(host.errorListeners()).toBe(0);
    expect(duplicates[0]?.errorListeners()).toBe(0);
  });

  it("redacts a connection string out of a logged error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const publisher = createPublisher({ driver: "redis", url: "redis://localhost:6379" });
    await publisher.publish("orders", { id: 1 });

    const connection = constructed[0] as FakeConnection;
    connection.emit(
      "error",
      Object.assign(new Error("Invalid URL: redis://user:s3cr3t@cache.internal:6379"), {
        code: "ERR_INVALID_URL",
        input: "redis://user:s3cr3t@cache.internal:6379",
      }),
    );

    const logged = error.mock.calls.flat().join(" ");
    expect(logged).not.toContain("s3cr3t");
    expect(logged).toContain("<redis url>");
    error.mockRestore();
  });

  it("explains itself when neither url nor client is configured", () => {
    expect(() => createPublisher({ driver: "redis" })).toThrow(/url/);
  });

  it("explains itself when a client without duplicate() has to subscribe", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = fakeConnection();
    const publisher = createPublisher({ driver: "redis", client: host });
    publisher.subscribe("orders", () => {});

    await vi.waitFor(() => {
      expect(error).toHaveBeenCalled();
    });
    expect(String(error.mock.calls[0])).toMatch(/duplicate/);
    error.mockRestore();
  });
});

describe("createPublisher — memory driver", () => {
  it("delivers through the same body Redis would carry", async () => {
    const publisher = createPublisher({ driver: "memory" });
    const received: unknown[] = [];
    const off = publisher.subscribe("x", (payload) => received.push(payload));

    await publisher.publish("x", { at: new Date("2026-09-20T00:00:00.000Z") });
    await publisher.publish("x", undefined);
    off();
    await publisher.publish("x", { a: 2 });

    expect(received).toEqual([{ at: "2026-09-20T00:00:00.000Z" }, undefined]);
  });

  it("rejects an unserializable payload whether or not anything is subscribed", async () => {
    const publisher = createPublisher({ driver: "memory" });

    await expect(publisher.publish("orders", { n: 1n })).rejects.toThrow(
      /realtime payload for channel "orders" is not JSON-serializable: .*BigInt/,
    );

    publisher.subscribe("orders", () => {});
    await expect(publisher.publish("orders", { n: 1n })).rejects.toThrow(/not JSON-serializable/);
  });

  it("closes, and says so instead of accepting a publish that reaches nobody", async () => {
    const publisher = createPublisher({ driver: "memory" });
    const received: unknown[] = [];
    publisher.subscribe("x", (payload) => received.push(payload));

    await publisher.close?.();
    const off = publisher.subscribe("x", (payload) => received.push(payload));
    off();

    await expect(publisher.publish("x", { a: 1 })).rejects.toThrow(/closed/);
    expect(received).toEqual([]);
  });
});
