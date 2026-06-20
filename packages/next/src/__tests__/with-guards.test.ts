import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish.js", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type {
  Adapter,
  BulkAction,
  RateLimitConfig,
  RequireRole,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { FlowpanelConflictError } from "@flowpanel/core";
import { bulkActionRoute } from "../actions/bulk-action.js";
import { withGuards } from "../runtime/with-guards.js";

type Row = { id: string; reason: string };

function makeConfig(opts: {
  action?: BulkAction<Row>;
  role?: string;
  authRequireRole?: RequireRole;
  rateLimit?: RateLimitConfig;
  readOnly?: boolean;
}) {
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "items", columns: [], primaryKey: "id" }),
    inferSchema: () => ({}) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => ({}),
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };

  const resource: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "items" },
    options: {
      columns: [],
      ...(opts.action ? { bulkActions: [opts.action as BulkAction<Row>] } : {}),
    },
  } as never;

  const config: ResolvedAdminConfig = {
    adapter,
    auth: {
      session: async () => null,
      role: () => opts.role ?? "admin",
      ...(opts.authRequireRole !== undefined ? { requireRole: opts.authRequireRole } : {}),
    },
    ...(opts.rateLimit ? { rateLimit: opts.rateLimit } : {}),
    ...(opts.readOnly ? { readOnly: true } : {}),
    resources: [resource],
    resourcesByName: new Map([["items", resource]]),
    dashboardsByPath: new Map(),
    __resolved: true,
  } as never;
  return { config, resource };
}

function jsonReq(body: unknown): Request {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("withGuards — errors from buildRequestContext keep their status", () => {
  it("maps FlowpanelRateLimitError to 429, not a bare 500", async () => {
    const { config, resource } = makeConfig({
      rateLimit: { driver: "memory", limit: 1, windowMs: 60_000, per: "ip" },
    });
    const call = () =>
      withGuards(
        config,
        new Request("http://localhost/x", { method: "POST" }),
        { resource },
        async () => Response.json({ ok: true }),
      );

    expect((await call()).status).toBe(200);
    const limited = await call();
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ ok: false, error: "Rate limit exceeded" });
  });

  it("maps the admin-wide auth.requireRole failure to 403, not a bare 500", async () => {
    const { config, resource } = makeConfig({ role: "user", authRequireRole: "admin" });
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const res = await withGuards(config, jsonReq({}), { resource }, handler);

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("withGuards — handler errors", () => {
  it("maps a FlowpanelError thrown by the handler to its own status", async () => {
    const { config, resource } = makeConfig({});
    const res = await withGuards(config, jsonReq({}), { resource }, async () => {
      throw new FlowpanelConflictError("Row is locked");
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, error: "Row is locked" });
  });

  it("collapses a raw error to a generic 500 rather than leaking its message", async () => {
    const { config, resource } = makeConfig({});
    const res = await withGuards(config, jsonReq({}), { resource }, async () => {
      throw new Error('relation "users" does not exist');
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "internal error" });
    expect(body.error).not.toContain("users");
  });

  it("does not trust a status on an error that carries no safeMessage", async () => {
    const { config, resource } = makeConfig({});
    const res = await withGuards(config, jsonReq({}), { resource }, async () => {
      throw Object.assign(new Error("upstream said no"), { status: 402 });
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "internal error" });
  });
});

describe("withGuards — guard order", () => {
  it("rejects an unauthorized bulk POST with 403 before validating its input", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const { config } = makeConfig({
      role: "user",
      action: {
        key: "verify",
        label: "V",
        requireRole: "admin",
        form: [{ name: "reason", type: "text", required: true }],
        run,
      },
    });
    const handler = bulkActionRoute(config);
    const res = await handler(jsonReq({ ids: ["a"], input: {} }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.issues).toBeUndefined();
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects a read-only bulk POST with 403 before validating its input", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const { config } = makeConfig({
      readOnly: true,
      action: {
        key: "verify",
        label: "V",
        form: [{ name: "reason", type: "text", required: true }],
        run,
      },
    });
    const handler = bulkActionRoute(config);
    const res = await handler(jsonReq({ ids: ["a"], input: {} }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("This admin is read-only.");
    expect(body.issues).toBeUndefined();
    expect(run).not.toHaveBeenCalled();
  });

  it("still 422s on invalid input once every gate passes", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const { config } = makeConfig({
      action: {
        key: "verify",
        label: "V",
        form: [{ name: "reason", type: "text", required: true }],
        run,
      },
    });
    const handler = bulkActionRoute(config);
    const res = await handler(jsonReq({ ids: ["a"], input: {} }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });

    expect(res.status).toBe(422);
    expect((await res.json()).issues).toEqual([
      { path: ["reason"], message: "reason is required" },
    ]);
    expect(run).not.toHaveBeenCalled();
  });
});
