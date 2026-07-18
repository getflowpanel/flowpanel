import type { Adapter, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { defineAdmin, queue, resource } from "@flowpanel/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { drawerActionRoute } from "../drawer/drawer-route.js";
import { parseActionBody } from "../drawer/parse-action-body.js";
import { handlers } from "../handlers.js";
import { buildNav, resourceNavName } from "../runtime/nav.js";

// ─────────────────────────────────────────────────────────────────────────────
// nav.ts: Drizzle Symbol(BaseName) branch + queueItems group
// ─────────────────────────────────────────────────────────────────────────────

describe("resourceNavName — Drizzle Symbol(BaseName) fallback", () => {
  it("falls back to Symbol(drizzle:BaseName) when other lookups fail", () => {
    const ref: Record<string | symbol, unknown> = {};
    // Drizzle 0.30+ stamps the table name on this symbol.
    const sym = Symbol("drizzle:BaseName");
    (ref as Record<symbol, unknown>)[sym] = "shipments";
    expect(resourceNavName({ ref, options: {} })).toBe("shipments");
  });

  it("throws on non-string Symbol(drizzle:BaseName) values, not a 'resource' fallback", () => {
    const ref: Record<string | symbol, unknown> = {};
    const sym = Symbol("drizzle:BaseName");
    (ref as Record<symbol, unknown>)[sym] = 42;
    expect(() => resourceNavName({ ref, options: {} })).toThrow(/name/i);
  });

  it("throws when ref is null, not a 'resource' fallback", () => {
    expect(() => resourceNavName({ ref: null, options: {} })).toThrow(/name/i);
  });
});

describe("buildNav — Queues group", () => {
  const fakeAdapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
    inferSchema: () => ({}) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
  it("appends a Queues group when queues are registered", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "admin" },
      queues: [queue({ name: "scraper" }, { label: "Scraper", boardUrl: "/b" })],
    });
    const nav = buildNav(cfg);
    const queuesGroup = nav.find((g) => g.label === "Queues");
    expect(queuesGroup).toBeDefined();
    expect(queuesGroup?.items).toEqual([{ label: "Scraper", href: "/admin/queues/scraper" }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// publish.ts: publishResource + subscribe entry points
// ─────────────────────────────────────────────────────────────────────────────

describe("runtime/publish.ts — publishResource + subscribe", () => {
  it("publishResource fans out on channel resource.<name> and reaches subscribers", async () => {
    // Import fresh so we always pick up the most recently bound publisher.
    const mod = await import("../runtime/publish.js");
    const got: unknown[] = [];
    const off = mod.subscribe("resource.users", (payload) => {
      got.push(payload);
    });
    await mod.publishResource("users", { action: "update", id: "u1" });
    expect(got).toEqual([{ action: "update", id: "u1" }]);
    off();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parse-action-body.ts: malformed form-data / json branches
// ─────────────────────────────────────────────────────────────────────────────

describe("parseActionBody — content-type branches", () => {
  it("returns {} when content-type is missing", async () => {
    const req = new Request("http://localhost/x", { method: "POST", body: "raw" });
    expect(await parseActionBody(req)).toEqual({});
  });

  it("treats malformed form-data as empty input", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "multipart/form-data" }, // no boundary → throws
      body: "x=1",
    });
    expect(await parseActionBody(req)).toEqual({});
  });

  it("treats malformed JSON body as empty input", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    expect(await parseActionBody(req)).toEqual({});
  });

  it("parses x-www-form-urlencoded body", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "k=v&n=1",
    });
    expect(await parseActionBody(req)).toEqual({ k: "v", n: "1" });
  });

  it("parses application/json body", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    });
    expect(await parseActionBody(req)).toEqual({ a: 1 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// drawer-route.ts: 403 (auth fail) + 404 (row missing) in drawerActionRoute
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function adapterWithGet(getReturn: Record<string, unknown> | null): Adapter {
  return {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
    inferSchema: () => ({}) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => getReturn,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
}

describe("drawerActionRoute — auth/row edge cases", () => {
  it("returns 403 when resource.requireRole fails", async () => {
    const r: ResourceConfig = {
      __kind: "resource",
      ref: { __name: "jobs" },
      options: {
        columns: [],
        requireRole: "admin",
        drawer: {
          actions: [{ key: "x", label: "X", run: async () => ({ ok: true }) }],
        },
      },
    } as never;
    const config: ResolvedAdminConfig = {
      adapter: adapterWithGet({ id: "1" }),
      auth: { session: async () => null, role: () => "user" },
      resources: [r],
      resourcesByName: new Map([["jobs", r]]),
      dashboardsByPath: new Map(),
      __resolved: true,
    } as never;
    const handler = drawerActionRoute(config);
    const res = await handler(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ resource: "jobs", id: "1", action: "x" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the row is not found", async () => {
    const r: ResourceConfig = {
      __kind: "resource",
      ref: { __name: "jobs" },
      options: {
        columns: [],
        drawer: {
          actions: [{ key: "x", label: "X", run: async () => ({ ok: true }) }],
        },
      },
    } as never;
    const config: ResolvedAdminConfig = {
      adapter: adapterWithGet(null),
      auth: { session: async () => null, role: () => "admin" },
      resources: [r],
      resourcesByName: new Map([["jobs", r]]),
      dashboardsByPath: new Map(),
      __resolved: true,
    } as never;
    const handler = drawerActionRoute(config);
    const res = await handler(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ resource: "jobs", id: "missing", action: "x" }),
    });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handlers.ts: route-segment empty guards
// ─────────────────────────────────────────────────────────────────────────────

describe("handlers — additional length-mismatch routes return 404", () => {
  const fakeAdapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
    inferSchema: () => ({}) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
  function cfg() {
    return defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [resource({ __name: "users" }, { columns: [] })],
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST with route.length=2 falls through to 404", async () => {
    const { POST } = handlers(cfg());
    const res = await POST(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ route: ["users", "u1"] }),
    });
    expect(res.status).toBe(404);
  });
});
