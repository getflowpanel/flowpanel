import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish.js", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type {
  Adapter,
  DashboardConfig,
  ResolvedAdminConfig,
  ResourceConfig,
  RowAction,
} from "@flowpanel/core";
import { bulkActionRoute } from "../actions/bulk-action.js";
import { dashboardActionRoute } from "../actions/dashboard-action.js";
import { rowActionRoute } from "../actions/row-action.js";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
  get: async () => ({ id: "u1" }),
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const run = async () => ({ ok: true }) as const;

function makeConfig(): ResolvedAdminConfig {
  const users: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "users" },
    options: {
      columns: [],
      actions: [{ key: "ping", label: "Ping", run }] as RowAction<Record<string, unknown>>[],
      bulkActions: [{ key: "archive", label: "Archive", run }],
    },
  } as never;
  const orders: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "orders" },
    options: { columns: [] },
  } as never;
  const overview: DashboardConfig = {
    path: "/",
    label: "Overview",
    sections: [],
    actions: [{ key: "rebuild", label: "Rebuild", run }],
  };

  return {
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [users, orders],
    resourcesByName: new Map([
      ["users", users],
      ["orders", orders],
    ]),
    dashboardsByPath: new Map([["/", overview]]),
    basePath: "/admin",
    __resolved: true,
  } as never;
}

function jsonReq(body: string): Request {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

const originalEnv = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = originalEnv;
});

describe("malformed JSON body", () => {
  it("row action answers 400 invalid JSON body", async () => {
    const res = await rowActionRoute(makeConfig())(jsonReq("{ not json"), {
      params: Promise.resolve({ resource: "users", id: "u1", action: "ping" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid JSON body");
  });

  it("bulk action answers 400 invalid JSON body", async () => {
    const res = await bulkActionRoute(makeConfig())(jsonReq("{ not json"), {
      params: Promise.resolve({ resource: "users", action: "archive" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid JSON body");
  });

  it("bulk action still reports a missing ids array separately", async () => {
    const res = await bulkActionRoute(makeConfig())(jsonReq(JSON.stringify({ input: {} })), {
      params: Promise.resolve({ resource: "users", action: "archive" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/ids must be a non-empty array/);
  });

  it("dashboard action answers 400 invalid JSON body", async () => {
    const res = await dashboardActionRoute(makeConfig())(jsonReq("{ not json"), {
      params: Promise.resolve({ dashboard: "_root_", action: "rebuild" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid JSON body");
  });

  it("stays 400 in production", async () => {
    process.env.NODE_ENV = "production";
    const res = await rowActionRoute(makeConfig())(jsonReq("{ not json"), {
      params: Promise.resolve({ resource: "users", id: "u1", action: "ping" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid JSON body");
  });

  it("a well-formed body still runs the action", async () => {
    const res = await rowActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ resource: "users", id: "u1", action: "ping" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});

describe("404 messages name what was asked for, in development", () => {
  it("row action: unknown resource lists the registered ones", async () => {
    const res = await rowActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ resource: "ghost", id: "u1", action: "ping" }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe(
      'resource not found: "ghost". Registered resources: "users", "orders".',
    );
  });

  it("row action: unknown action lists the resource's action keys", async () => {
    const res = await rowActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ resource: "users", id: "u1", action: "nope" }),
    });
    expect((await res.json()).error).toBe('action not found: "nope". Registered actions: "ping".');
  });

  it("row action: a resource with no actions reports (none)", async () => {
    const res = await rowActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ resource: "orders", id: "o1", action: "nope" }),
    });
    expect((await res.json()).error).toBe('action not found: "nope". Registered actions: (none).');
  });

  it("bulk action: unknown action lists the bulk keys", async () => {
    const res = await bulkActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ resource: "users", action: "nope" }),
    });
    expect((await res.json()).error).toBe(
      'action not found: "nope". Registered actions: "archive".',
    );
  });

  it("dashboard action: unknown dashboard lists the registered paths", async () => {
    const res = await dashboardActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ dashboard: "pipeline", action: "rebuild" }),
    });
    expect((await res.json()).error).toBe(
      'dashboard not found: "/pipeline". Registered dashboards: "/".',
    );
  });
});

describe("404 messages stay terse in production", () => {
  it("row action: unknown resource", async () => {
    process.env.NODE_ENV = "production";
    const res = await rowActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ resource: "ghost", id: "u1", action: "ping" }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("resource not found");
  });

  it("row action: unknown action", async () => {
    process.env.NODE_ENV = "production";
    const res = await rowActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ resource: "users", id: "u1", action: "nope" }),
    });
    expect((await res.json()).error).toBe("action not found");
  });

  it("dashboard action: unknown dashboard", async () => {
    process.env.NODE_ENV = "production";
    const res = await dashboardActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ dashboard: "pipeline", action: "rebuild" }),
    });
    expect((await res.json()).error).toBe("dashboard not found");
  });
});
