import type { ResolvedAdminConfig, ResourceConfig, Session } from "@flowpanel/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const subscribeSpy = vi.fn((_channel: string, _handler: (payload: unknown) => void) => () => {});
vi.mock("../runtime/publish", () => ({
  bindPublisher: vi.fn(),
  subscribe: (channel: string, handler: (payload: unknown) => void) =>
    subscribeSpy(channel, handler),
}));

import { stream } from "../stream";

function roleFromUser(s: Session | null): string {
  return (s as { user?: { role?: string } } | null)?.user?.role ?? "guest";
}

function makeResource(_name: string, read?: string | string[]): ResourceConfig {
  return {
    __kind: "resource",
    ref: {},
    options: { ...(read !== undefined ? { access: { read } } : {}) },
  } as unknown as ResourceConfig;
}

const DECLARED = Object.fromEntries(
  [
    "custom",
    "foo",
    "x",
    "other",
    "ok-channel",
    ...Array.from({ length: 40 }, (_, i) => `ch-${i}`),
  ].map((name) => [name, {}]),
);

function makeConfig(overrides: Partial<ResolvedAdminConfig> = {}): ResolvedAdminConfig {
  return {
    auth: {
      session: async () => ({ user: { id: "u1", role: "guest" } }),
      role: roleFromUser,
    },
    resourcesByName: new Map(),
    realtime: { driver: "memory", channels: DECLARED },
    ...overrides,
  } as ResolvedAdminConfig;
}

describe("stream() — authentication", () => {
  it("returns 403 when session() is null and auth.access is set", async () => {
    const config = makeConfig({
      auth: { session: async () => null, role: () => "guest", access: "admin" },
    } as never);
    const res = await stream(config)(new Request("http://localhost/stream"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });

  it("returns 403 when the session's role doesn't satisfy admin-wide access", async () => {
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "viewer" } }),
        role: roleFromUser,
        access: "admin",
      },
    } as never);
    const res = await stream(config)(new Request("http://localhost/stream"));
    expect(res.status).toBe(403);
  });

  it("allows the connection when auth.access is unset (no admin-wide policy)", async () => {
    const config = makeConfig();
    const res = await stream(config)(new Request("http://localhost/stream"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    await res.body?.cancel();
  });

  it("allows the connection when the role satisfies admin-wide access", async () => {
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "admin" } }),
        role: roleFromUser,
        access: "admin",
      },
    } as never);
    const res = await stream(config)(new Request("http://localhost/stream"));
    expect(res.status).toBe(200);
    await res.body?.cancel();
  });
});

describe("stream() — channel validation", () => {
  beforeEach(() => {
    subscribeSpy.mockClear();
  });

  it("drops channels with characters outside the allowed pattern", async () => {
    const config = makeConfig();
    const req = new Request(
      `http://localhost/stream?channel=${encodeURIComponent("resource.users; DROP")}&channel=ok-channel`,
    );
    const res = await stream(config)(req);
    const reader = res.body!.getReader();
    await reader.read(); // ready handshake
    const subscribed = subscribeSpy.mock.calls.map((c) => c[0]);
    expect(subscribed).toEqual(["ok-channel"]);
    await reader.cancel();
  });

  it("caps the number of channels a single connection can subscribe to", async () => {
    const config = makeConfig();
    const url = new URL("http://localhost/stream");
    for (let i = 0; i < 40; i++) url.searchParams.append("channel", `ch-${i}`);
    const res = await stream(config)(new Request(url));
    expect(res.status).toBe(200);
    expect(subscribeSpy.mock.calls.length).toBe(25);
    await res.body?.cancel();
  });

  it("rejects a resource.<name> channel when the resource's read access fails", async () => {
    const resourcesByName = new Map<string, ResourceConfig>([
      ["billing", makeResource("billing", "finance")],
    ]);
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "staff" } }),
        role: roleFromUser,
      },
      resourcesByName,
    } as never);
    const req = new Request("http://localhost/stream?channel=resource.billing");
    const res = await stream(config)(req);
    expect(res.status).toBe(200); // connection itself succeeds — the channel is just dropped
    expect(subscribeSpy).not.toHaveBeenCalled();
    await res.body?.cancel();
  });

  it("allows a resource.<name> channel when the resource's read access passes", async () => {
    const resourcesByName = new Map<string, ResourceConfig>([
      ["billing", makeResource("billing", "finance")],
    ]);
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "finance" } }),
        role: roleFromUser,
      },
      resourcesByName,
    } as never);
    const req = new Request("http://localhost/stream?channel=resource.billing");
    const res = await stream(config)(req);
    expect(res.status).toBe(200);
    expect(subscribeSpy.mock.calls.map((c) => c[0])).toEqual(["resource.billing"]);
    await res.body?.cancel();
  });

  it("passes through resource.<name> channels for resources with no access rule", async () => {
    const resourcesByName = new Map<string, ResourceConfig>([["users", makeResource("users")]]);
    const config = makeConfig({ resourcesByName });
    const req = new Request("http://localhost/stream?channel=resource.users");
    const res = await stream(config)(req);
    expect(res.status).toBe(200);
    expect(subscribeSpy.mock.calls.map((c) => c[0])).toEqual(["resource.users"]);
    await res.body?.cancel();
  });
  it("drops a resource.<name> channel for a resource the config does not register", async () => {
    const res = await stream(makeConfig())(
      new Request("http://localhost/stream?channel=resource.ghost&channel=ok-channel"),
    );
    expect(res.status).toBe(200);
    expect(subscribeSpy.mock.calls.map((c) => c[0])).toEqual(["ok-channel"]);
    await res.body?.cancel();
  });

  it("sends a tenant-scoped resource's event without its row id or data", async () => {
    const scoped = {
      __kind: "resource",
      ref: {},
      options: { scope: (_scope: unknown, query: unknown) => query },
    } as unknown as ResourceConfig;
    const config = makeConfig({
      resourcesByName: new Map<string, ResourceConfig>([
        ["orders", scoped],
        ["users", makeResource("users")],
      ]),
    });
    const res = await stream(config)(
      new Request("http://localhost/stream?channel=resource.orders&channel=resource.users"),
    );
    const reader = res.body!.getReader();
    await reader.read();
    const handlers = new Map(
      subscribeSpy.mock.calls.map(([channel, handler]) => [channel, handler]),
    );
    handlers.get("resource.orders")?.({ action: "update", id: "o-1", row: { total: 5 } });
    handlers.get("resource.users")?.({ action: "update", id: "u-1" });
    const text = new TextDecoder();
    const frames = [
      text.decode((await reader.read()).value),
      text.decode((await reader.read()).value),
    ];
    expect(frames[0]).toContain('"payload":{"action":"update"}');
    expect(frames[0]).not.toContain("o-1");
    expect(frames[1]).toContain('"id":"u-1"');
    await reader.cancel();
  });

  it("rejects a resource.<name> channel the resource's access map closes to the caller", async () => {
    const gated = {
      __kind: "resource",
      ref: {},
      options: { access: { read: "admin" } },
    } as unknown as ResourceConfig;
    const config = makeConfig({
      auth: { session: async () => ({ user: { id: "u1", role: "viewer" } }), role: roleFromUser },
      resourcesByName: new Map<string, ResourceConfig>([["payroll", gated]]),
    } as never);
    const res = await stream(config)(
      new Request("http://localhost/stream?channel=resource.payroll"),
    );
    expect(res.status).toBe(200);
    expect(subscribeSpy.mock.calls.map((c) => c[0])).toEqual([]);
    await res.body?.cancel();
  });
});
