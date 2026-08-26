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

function makeResource(_name: string, requireRole?: string | string[]): ResourceConfig {
  return {
    __kind: "resource",
    ref: {},
    options: { ...(requireRole !== undefined ? { requireRole } : {}) },
  } as unknown as ResourceConfig;
}

function makeConfig(overrides: Partial<ResolvedAdminConfig> = {}): ResolvedAdminConfig {
  return {
    auth: {
      session: async () => ({ user: { id: "u1", role: "guest" } }),
      role: roleFromUser,
    },
    resourcesByName: new Map(),
    ...overrides,
  } as ResolvedAdminConfig;
}

describe("stream() — authentication", () => {
  it("returns 403 when session() is null and requireRole is set", async () => {
    const config = makeConfig({
      auth: { session: async () => null, role: () => "guest", requireRole: "admin" },
    } as never);
    const res = await stream(config)(new Request("http://localhost/stream"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "Forbidden" });
  });

  it("returns 403 when the session's role doesn't satisfy admin-wide requireRole", async () => {
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "viewer" } }),
        role: roleFromUser,
        requireRole: "admin",
      },
    } as never);
    const res = await stream(config)(new Request("http://localhost/stream"));
    expect(res.status).toBe(403);
  });

  it("allows the connection when requireRole is unset (no admin-wide policy)", async () => {
    const config = makeConfig();
    const res = await stream(config)(new Request("http://localhost/stream"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    await res.body?.cancel();
  });

  it("allows the connection when the role satisfies admin-wide requireRole", async () => {
    const config = makeConfig({
      auth: {
        session: async () => ({ user: { id: "u1", role: "admin" } }),
        role: roleFromUser,
        requireRole: "admin",
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

  it("rejects a resource.<name> channel when the resource's own requireRole fails", async () => {
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

  it("allows a resource.<name> channel when the resource's requireRole passes", async () => {
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

  it("passes through resource.<name> channels for resources with no requireRole", async () => {
    const resourcesByName = new Map<string, ResourceConfig>([["users", makeResource("users")]]);
    const config = makeConfig({ resourcesByName });
    const req = new Request("http://localhost/stream?channel=resource.users");
    const res = await stream(config)(req);
    expect(res.status).toBe(200);
    expect(subscribeSpy.mock.calls.map((c) => c[0])).toEqual(["resource.users"]);
    await res.body?.cancel();
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
