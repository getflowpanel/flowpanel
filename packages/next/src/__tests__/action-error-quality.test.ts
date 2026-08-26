import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
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
import { bulkActionRoute } from "../actions/bulk-action";
import { dashboardActionRoute } from "../actions/dashboard-action";
import { rowActionRoute } from "../actions/row-action";

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

describe("404 bodies never enumerate the registry", () => {
  it("row action: unknown resource", async () => {
    const res = await rowActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ resource: "ghost", id: "u1", action: "ping" }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("resource not found");
  });

  it("row action: unknown action", async () => {
    const res = await rowActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ resource: "users", id: "u1", action: "nope" }),
    });
    expect((await res.json()).error).toBe("action not found");
  });

  it("bulk action: unknown action", async () => {
    const res = await bulkActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ resource: "users", action: "nope" }),
    });
    expect((await res.json()).error).toBe("action not found");
  });

  it("dashboard action: unknown dashboard", async () => {
    const res = await dashboardActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ dashboard: "pipeline", action: "rebuild" }),
    });
    expect((await res.json()).error).toBe("dashboard not found");
  });

  it("stays terse in production too", async () => {
    process.env.NODE_ENV = "production";
    const res = await rowActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ resource: "ghost", id: "u1", action: "ping" }),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("resource not found");
  });
});

describe("404s report the registry on the server log in development", () => {
  it("names what was asked for and what is registered", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await rowActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ resource: "ghost", id: "u1", action: "ping" }),
    });
    expect(warn).toHaveBeenCalledWith(
      '[flowpanel] resource not found: "ghost". Registered resources: "users", "orders".',
    );
    warn.mockRestore();
  });

  it("stays silent in production", async () => {
    process.env.NODE_ENV = "production";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await rowActionRoute(makeConfig())(jsonReq("{}"), {
      params: Promise.resolve({ resource: "ghost", id: "u1", action: "ping" }),
    });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
