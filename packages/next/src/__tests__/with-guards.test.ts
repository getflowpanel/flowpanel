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
  ErrorContext,
  RateLimitConfig,
  RequireRole,
  ResolvedAdminConfig,
  ResourceAccess,
  ResourceConfig,
  SecurityConfig,
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
  security?: SecurityConfig;
  resourceAccess?: ResourceAccess<Row>;
  onError?: NonNullable<NonNullable<ResolvedAdminConfig["hooks"]>["onError"]>;
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
      ...(opts.resourceAccess ? { access: opts.resourceAccess } : {}),
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
    ...(opts.security ? { security: opts.security } : {}),
    ...(opts.onError ? { hooks: { onError: opts.onError } } : {}),
    resources: [resource],
    resourcesByName: new Map([["items", resource]]),
    dashboardsByPath: new Map(),
    __resolved: true,
  } as never;
  return { config, resource };
}

describe("withGuards — cross-site writes", () => {
  it("rejects a cross-origin mutation before calling the handler", async () => {
    const { config, resource } = makeConfig({});
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const req = new Request("https://admin.example.com/x", {
      method: "POST",
      headers: { origin: "https://evil.example.com" },
    });

    const res = await withGuards(config, req, { resource }, handler);

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Cross-origin write requests are not allowed.",
      code: "forbidden",
      requestId: expect.any(String),
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects cross-site Fetch Metadata when Origin is absent", async () => {
    const { config, resource } = makeConfig({});
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const req = new Request("https://admin.example.com/x", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
    });

    const res = await withGuards(config, req, { resource }, handler);

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("allows same-origin mutations", async () => {
    const { config, resource } = makeConfig({});
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const req = new Request("https://admin.example.com/x", {
      method: "POST",
      headers: {
        origin: "https://admin.example.com",
        "sec-fetch-site": "same-origin",
      },
    });

    const res = await withGuards(config, req, { resource }, handler);

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("allows an explicitly trusted origin", async () => {
    const { config, resource } = makeConfig({
      security: { trustedOrigins: ["https://ops.example.com"] },
    });
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const req = new Request("https://admin.internal/x", {
      method: "POST",
      headers: {
        origin: "https://ops.example.com",
        "sec-fetch-site": "cross-site",
      },
    });

    const res = await withGuards(config, req, { resource }, handler);

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("can defer the check to an upstream gateway explicitly", async () => {
    const { config, resource } = makeConfig({ security: { sameOrigin: false } });
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const req = new Request("https://admin.example.com/x", {
      method: "POST",
      headers: {
        origin: "https://evil.example.com",
        "sec-fetch-site": "cross-site",
      },
    });

    const res = await withGuards(config, req, { resource }, handler);

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not apply the mutation guard to read routes", async () => {
    const { config, resource } = makeConfig({});
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const req = new Request("https://admin.example.com/x", {
      headers: {
        origin: "https://evil.example.com",
        "sec-fetch-site": "cross-site",
      },
    });

    const res = await withGuards(config, req, { resource, write: false }, handler);

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });
});

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
    expect(await limited.json()).toMatchObject({
      ok: false,
      error: "Rate limit exceeded",
      code: "rate_limited",
      requestId: expect.any(String),
    });
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
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Row is locked",
      code: "conflict",
      requestId: expect.any(String),
    });
  });

  it("collapses a raw error to a generic 500 rather than leaking its message", async () => {
    const { config, resource } = makeConfig({});
    const res = await withGuards(config, jsonReq({}), { resource }, async () => {
      throw new Error('relation "users" does not exist');
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: false,
      error: "Internal server error",
      code: "internal",
      requestId: expect.any(String),
    });
    expect(body.error).not.toContain("users");
  });

  it("does not trust a status on an error that carries no safeMessage", async () => {
    const { config, resource } = makeConfig({});
    const res = await withGuards(config, jsonReq({}), { resource }, async () => {
      throw Object.assign(new Error("upstream said no"), { status: 402 });
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({
      ok: false,
      error: "Internal server error",
      code: "internal",
    });
  });

  it("reports one unexpected failure with a non-authoritative error context", async () => {
    const onError = vi.fn(async (_error: Error, _context: ErrorContext) => {});
    const { config, resource } = makeConfig({ onError });
    const thrown = new Error("database secret");
    const res = await withGuards(
      config,
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "x-request-id": "req_test" },
      }),
      { resource, operation: "update", route: "items/:id" },
      async () => {
        throw thrown;
      },
    );

    expect(res.status).toBe(500);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]?.[1]).toEqual({
      requestId: "req_test",
      operation: "update",
      route: "items/:id",
      actorId: null,
      method: "POST",
      url: "http://localhost/x",
      ip: null,
      userAgent: null,
    });
    expect(onError.mock.calls[0]?.[1]).not.toHaveProperty("db");
    expect(onError.mock.calls[0]?.[1]).not.toHaveProperty("scope");
  });
});

describe("withGuards — operation policy", () => {
  it("enforces operation access before running a writable handler", async () => {
    const { config, resource } = makeConfig({
      role: "operator",
      resourceAccess: { update: "admin" },
    });
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const res = await withGuards(config, jsonReq({}), { resource, operation: "update" }, handler);

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "forbidden" });
    expect(handler).not.toHaveBeenCalled();
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
