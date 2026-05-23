import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish.js", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, AuditConfig, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { z } from "zod";
import { inlineUpdateRoute } from "../actions/inline-update.js";
import { publishResource } from "../runtime/publish.js";

function makeConfig(opts: {
  audit?: AuditConfig | undefined;
  resourceAudit?: boolean;
  role?: string;
  rowNotFound?: boolean;
  updateThrows?: boolean;
  columns?: unknown[];
  session?: unknown;
  updateSchema?: z.ZodTypeAny;
  capturedInput?: { value?: unknown };
}) {
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
    inferSchema: () =>
      (opts.updateSchema
        ? { create: z.object({}), update: opts.updateSchema, select: z.object({}) }
        : {}) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () =>
      opts.rowNotFound
        ? null
        : ({ id: "u1", status: "active", email: "old@x.com" } as unknown as Record<
            string,
            unknown
          >),
    create: async () => ({}),
    update: async (_ref, ctx) => {
      if (opts.capturedInput) {
        opts.capturedInput.value = (ctx as { input?: Record<string, unknown> }).input?.email;
      }
      if (opts.updateThrows) throw new Error("db failed");
      return { id: "u1" };
    },
    delete: async () => undefined,
  };

  const resource: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "users" },
    options: {
      columns: opts.columns ?? [
        { field: "id" },
        { field: "email", editable: true },
        { field: "status" },
        "name", // string column entry should be skipped by editable check
      ],
      ...(opts.resourceAudit === false ? { audit: false } : {}),
    },
  } as never;

  const config: ResolvedAdminConfig = {
    adapter,
    auth: {
      session: async () => (opts.session === undefined ? null : opts.session),
      role: () => opts.role ?? "admin",
    },
    ...(opts.audit ? { audit: opts.audit } : {}),
    resources: [resource],
    resourcesByName: new Map([["users", resource]]),
    dashboardsByPath: new Map(),
    __resolved: true,
  } as never;
  return config;
}

function paramsFor(resource: string, id: string) {
  return Promise.resolve({ resource, id });
}

describe("inlineUpdateRoute", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
  });

  it("returns 404 when the resource name is unknown", async () => {
    const handler = inlineUpdateRoute(makeConfig({}));
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "email", value: "x" }),
    });
    const res = await handler(req, { params: paramsFor("ghost", "u1") });
    expect(res.status).toBe(404);
  });

  it("returns 400 when JSON body is malformed", async () => {
    const handler = inlineUpdateRoute(makeConfig({}));
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json{",
    });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/invalid JSON/i);
  });

  it("returns 400 when field is missing", async () => {
    const handler = inlineUpdateRoute(makeConfig({}));
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x" }),
    });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/field is required/);
  });

  it("returns 400 when field is empty string", async () => {
    const handler = inlineUpdateRoute(makeConfig({}));
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "", value: "x" }),
    });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(400);
  });

  it("returns 403 when column is not declared editable", async () => {
    const handler = inlineUpdateRoute(makeConfig({}));
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "status", value: "inactive" }),
    });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/not editable/);
  });

  it("returns 404 when the row does not exist", async () => {
    const handler = inlineUpdateRoute(makeConfig({ rowNotFound: true }));
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "email", value: "new@x.com" }),
    });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(404);
  });

  it("returns 500 with a generic message (not the raw adapter error) when update throws", async () => {
    const handler = inlineUpdateRoute(makeConfig({ updateThrows: true }));
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "email", value: "new@x.com" }),
    });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    // Raw adapter message must not leak (it can carry DB schema/row details).
    expect(body.error).not.toMatch(/db failed/);
    expect(body.error).toBe("internal error");
  });

  it("succeeds, emits audit with before/after diff, and publishes", async () => {
    const sink = vi.fn(async (_ev: unknown) => {});
    const handler = inlineUpdateRoute(
      makeConfig({
        audit: { enabled: true, sink },
        session: { user: { id: "actor-1" } },
      }),
    );
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "9.9.9.9",
        "user-agent": "vitest",
      },
      body: JSON.stringify({ field: "email", value: "new@x.com" }),
    });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    expect(sink).toHaveBeenCalledTimes(1);
    const ev = sink.mock.calls[0]?.[0] as {
      action: string;
      actorId: string | null;
      diff: { before: Record<string, unknown>; after: Record<string, unknown> };
      ip?: string;
      userAgent?: string;
    };
    expect(ev.action).toBe("users.inline-update");
    expect(ev.actorId).toBe("actor-1");
    expect(ev.diff.before).toEqual({ email: "old@x.com" });
    expect(ev.diff.after).toEqual({ email: "new@x.com" });
    expect(ev.ip).toBe("9.9.9.9");
    expect(ev.userAgent).toBe("vitest");
  });

  it("does NOT emit audit when resource.options.audit === false", async () => {
    const sink = vi.fn(async (_ev: unknown) => {});
    const handler = inlineUpdateRoute(
      makeConfig({ audit: { enabled: true, sink }, resourceAudit: false }),
    );
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "email", value: "new@x.com" }),
    });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(200);
    expect(sink).not.toHaveBeenCalled();
  });

  it("audit.actorId is null when session has no user.id", async () => {
    const sink = vi.fn(async (_ev: unknown) => {});
    const handler = inlineUpdateRoute(
      makeConfig({ audit: { enabled: true, sink }, session: { user: {} } }),
    );
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "email", value: "y@x.com" }),
    });
    await handler(req, { params: paramsFor("users", "u1") });
    expect(sink).toHaveBeenCalled();
    const ev = sink.mock.calls[0]?.[0] as { actorId: string | null };
    expect(ev.actorId).toBeNull();
  });

  it("treats numeric column entries in options.columns as non-editable", async () => {
    const handler = inlineUpdateRoute(
      makeConfig({
        columns: [42, Symbol("x"), { field: "email", editable: true }],
      }),
    );
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "email", value: "new@x.com" }),
    });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(200);
  });

  it("returns 422 with issues when the value fails the update schema", async () => {
    const handler = inlineUpdateRoute(
      makeConfig({
        updateSchema: z.object({ email: z.string().email() }).partial(),
      }),
    );
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "email", value: "not-an-email" }),
    });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("validation failed");
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues[0].path).toEqual(["email"]);
  });

  it("writes the parsed value (coerced by the update schema), not the raw input", async () => {
    const captured: { value?: unknown } = {};
    const handler = inlineUpdateRoute(
      makeConfig({
        // z.coerce.number turns the string "42" into the number 42 on parse.
        updateSchema: z.object({ email: z.coerce.number() }).partial(),
        capturedInput: captured,
      }),
    );
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "email", value: "42" }),
    });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(200);
    expect(captured.value).toBe(42);
  });

  it("skips value validation when inferSchema has no usable update schema", async () => {
    // Default mock returns `{}` from inferSchema — validation must be skipped
    // (not crash) and the write proceeds with the raw value.
    const handler = inlineUpdateRoute(makeConfig({}));
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: "email", value: "anything-goes" }),
    });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(200);
  });
});
