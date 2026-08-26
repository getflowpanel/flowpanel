import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { z } from "zod";
import { resourceCreateRoute, resourceUpdateRoute } from "../actions/resource-form";
import { publishResource } from "../runtime/publish";

const createSchema = z.object({
  email: z.string().email(),
  priceCents: z.number().nullable().optional(),
});
const updateSchema = z.object({
  email: z.string().email().optional(),
  priceCents: z.number().nullable().optional(),
});

function makeConfig(opts: {
  role?: string;
  requireRole?: string | string[];
  createDisabled?: boolean;
  updateDisabled?: boolean;
  readOnly?: boolean;
  createReturn?: Record<string, unknown> | null;
  updateReturn?: Record<string, unknown> | null;
  createCaptured?: { value?: unknown };
  updateCaptured?: { value?: unknown };
}) {
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({
      name: "users",
      columns: [
        { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
        { name: "email", type: "string", nullable: false, unique: true, primaryKey: false },
        { name: "priceCents", type: "number", nullable: true, unique: false, primaryKey: false },
      ],
      primaryKey: "id",
    }),
    inferSchema: () => ({ create: createSchema, update: updateSchema }) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => ({ id: "u1", email: "a@b.com", priceCents: null }),
    create: async (_ref, ctx) => {
      if (opts.createCaptured) opts.createCaptured.value = (ctx as { input: unknown }).input;
      return opts.createReturn === undefined
        ? ({ id: "u1", email: "a@b.com" } as Record<string, unknown>)
        : (opts.createReturn as Record<string, unknown>);
    },
    update: async (_ref, ctx) => {
      if (opts.updateCaptured) opts.updateCaptured.value = (ctx as { input: unknown }).input;
      return opts.updateReturn === undefined
        ? ({ id: "u1", email: "new@b.com" } as Record<string, unknown>)
        : (opts.updateReturn as Record<string, unknown>);
    },
    delete: async () => undefined,
  };

  const resource: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "users" },
    options: {
      columns: [{ field: "id" }, { field: "email" }, { field: "priceCents" }],
      ...(opts.requireRole !== undefined ? { requireRole: opts.requireRole } : {}),
      ...(opts.createDisabled ? { create: { disabled: true } } : {}),
      ...(opts.updateDisabled ? { update: { disabled: true } } : {}),
    },
  } as never;

  const config: ResolvedAdminConfig = {
    adapter,
    auth: {
      session: async () => null,
      role: () => opts.role ?? "admin",
    },
    resources: [resource],
    resourcesByName: new Map([["users", resource]]),
    dashboardsByPath: new Map(),
    ...(opts.readOnly ? { readOnly: true } : {}),
    __resolved: true,
  } as never;
  return config;
}

function formRequest(url: string, fields: Record<string, string>): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return new Request(url, { method: "POST", body: fd });
}

describe("resourceCreateRoute", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
  });

  it("returns 404 when the resource name is unknown", async () => {
    const handler = resourceCreateRoute(makeConfig({}));
    const req = formRequest("http://localhost/x", { email: "a@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "ghost" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when create is disabled", async () => {
    const handler = resourceCreateRoute(makeConfig({ createDisabled: true }));
    const req = formRequest("http://localhost/x", { email: "a@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/disabled/);
  });

  it("returns 403 when the admin is read-only", async () => {
    const handler = resourceCreateRoute(makeConfig({ readOnly: true }));
    const req = formRequest("http://localhost/x", { email: "a@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when the session's role doesn't satisfy requireRole", async () => {
    const handler = resourceCreateRoute(makeConfig({ role: "viewer", requireRole: "admin" }));
    const req = formRequest("http://localhost/x", { email: "a@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(403);
  });

  it("creates the row, publishes, and returns { ok: true }", async () => {
    const captured: { value?: unknown } = {};
    const handler = resourceCreateRoute(makeConfig({ createCaptured: captured }));
    const req = formRequest("http://localhost/x", { email: "a@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(captured.value).toEqual({ email: "a@b.com" });
    expect(publishResource).toHaveBeenCalledWith("users", { action: "create", id: "u1" });
  });

  it("coerces an empty form field to null", async () => {
    const captured: { value?: unknown } = {};
    const handler = resourceCreateRoute(makeConfig({ createCaptured: captured }));
    const fd = new FormData();
    fd.set("email", "a@b.com");
    fd.set("priceCents", "");
    const req = new Request("http://localhost/x", { method: "POST", body: fd });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(200);
    expect(captured.value).toEqual({ email: "a@b.com", priceCents: null });
  });

  it("returns fieldErrors + status 422 on a validation failure", async () => {
    const handler = resourceCreateRoute(makeConfig({}));
    const req = formRequest("http://localhost/x", { email: "not-an-email" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { ok: boolean; fieldErrors?: Record<string, string> };
    expect(body.ok).toBe(false);
    expect(body.fieldErrors?.email).toBeDefined();
  });

  // A <form> POST always carries string values, but the inferred create
  // schema (plain drizzle-zod) does not coerce — a numeric column must be
  // converted before it reaches `actions.create`, or every such field fails
  // validation on every submit (see `coerceRowByColumns`).
  it("coerces a numeric form field to a number before validation", async () => {
    const captured: { value?: unknown } = {};
    const handler = resourceCreateRoute(makeConfig({ createCaptured: captured }));
    const req = formRequest("http://localhost/x", { email: "a@b.com", priceCents: "1999" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(200);
    expect(captured.value).toEqual({ email: "a@b.com", priceCents: 1999 });
  });

  it("returns fieldErrors + status 422 when a numeric field can't be coerced", async () => {
    const handler = resourceCreateRoute(makeConfig({}));
    const req = formRequest("http://localhost/x", { email: "a@b.com", priceCents: "not-a-number" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { ok: boolean; fieldErrors?: Record<string, string> };
    expect(body.ok).toBe(false);
    expect(body.fieldErrors?.priceCents).toMatch(/not a valid number/);
  });

  it("returns a generic 500 error (not the raw adapter error) on an unrelated throw", async () => {
    const config = makeConfig({});
    config.adapter.create = async () => {
      throw Object.assign(new Error("db exploded"), { safeMessage: "Action failed" });
    };
    const handler = resourceCreateRoute(config);
    const req = formRequest("http://localhost/x", { email: "a@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users" }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Action failed");
    expect(body.error).not.toMatch(/db exploded/);
  });
});

describe("resourceUpdateRoute", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
  });

  it("returns 404 when the resource name is unknown", async () => {
    const handler = resourceUpdateRoute(makeConfig({}));
    const req = formRequest("http://localhost/x", { email: "new@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "ghost", id: "u1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when editing is disabled", async () => {
    const handler = resourceUpdateRoute(makeConfig({ updateDisabled: true }));
    const req = formRequest("http://localhost/x", { email: "new@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users", id: "u1" }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/disabled/);
  });

  it("returns 403 when the session's role doesn't satisfy requireRole", async () => {
    const handler = resourceUpdateRoute(makeConfig({ role: "viewer", requireRole: "admin" }));
    const req = formRequest("http://localhost/x", { email: "new@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users", id: "u1" }) });
    expect(res.status).toBe(403);
  });

  it("updates the row, publishes, and returns { ok: true }", async () => {
    const handler = resourceUpdateRoute(makeConfig({}));
    const req = formRequest("http://localhost/x", { email: "new@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users", id: "u1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(publishResource).toHaveBeenCalledWith("users", { action: "update", id: "u1" });
  });

  it("returns fieldErrors + status 422 on a validation failure", async () => {
    const handler = resourceUpdateRoute(makeConfig({}));
    const req = formRequest("http://localhost/x", { email: "not-an-email" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users", id: "u1" }) });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { ok: boolean; fieldErrors?: Record<string, string> };
    expect(body.ok).toBe(false);
    expect(body.fieldErrors?.email).toBeDefined();
  });

  it("coerces a numeric form field to a number before validation", async () => {
    const captured: { value?: unknown } = {};
    const handler = resourceUpdateRoute(makeConfig({ updateCaptured: captured }));
    const req = formRequest("http://localhost/x", { email: "new@b.com", priceCents: "2500" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users", id: "u1" }) });
    expect(res.status).toBe(200);
    expect(captured.value).toEqual({ email: "new@b.com", priceCents: 2500 });
  });

  it("returns 404 when the adapter reports the row doesn't exist", async () => {
    const handler = resourceUpdateRoute(makeConfig({ updateReturn: null }));
    const req = formRequest("http://localhost/x", { email: "new@b.com" });
    const res = await handler(req, { params: Promise.resolve({ resource: "users", id: "u1" }) });
    expect(res.status).toBe(404);
  });
});
