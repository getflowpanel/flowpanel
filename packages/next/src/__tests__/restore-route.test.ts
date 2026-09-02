import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, AuditConfig, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { restoreRoute } from "../actions/restore";
import { publishResource } from "../runtime/publish";

function makeConfig(opts: {
  audit?: AuditConfig | undefined;
  resourceAudit?: boolean;
  role?: string;
  requireRole?: string | string[];
  readOnly?: boolean;
  softDelete?: string | false;
  hasRestoreMethod?: boolean;
  rowNotFound?: boolean;
  restoreThrows?: boolean;
  session?: unknown;
  capturedCtx?: { value?: unknown };
  userId?: (session: unknown) => string | null;
}) {
  const softDelete = opts.softDelete === undefined ? "deletedAt" : opts.softDelete;
  const restoreImpl = async (_ref: unknown, ctx: unknown) => {
    if (opts.capturedCtx) opts.capturedCtx.value = ctx;
    if (opts.restoreThrows) throw new Error("db failed");
  };

  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
    inferSchema: () => ({}) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () =>
      opts.rowNotFound
        ? null
        : ({ id: "u1", email: "a@x.com", deletedAt: new Date("2026-01-01") } as unknown as Record<
            string,
            unknown
          >),
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
    ...(opts.hasRestoreMethod === false ? {} : { restore: restoreImpl }),
  };

  const resource: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "users" },
    options: {
      columns: [{ field: "id" }, { field: "email" }],
      ...(softDelete ? { delete: { softDelete } } : {}),
      ...(opts.resourceAudit === false ? { audit: false } : {}),
      ...(opts.requireRole !== undefined ? { requireRole: opts.requireRole } : {}),
    },
  } as never;

  const config: ResolvedAdminConfig = {
    adapter,
    auth: {
      session: async () => (opts.session === undefined ? null : opts.session),
      role: () => opts.role ?? "admin",
      ...(opts.userId ? { userId: opts.userId } : {}),
    },
    ...(opts.audit ? { audit: opts.audit } : {}),
    ...(opts.readOnly ? { readOnly: true } : {}),
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

describe("restoreRoute", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
  });

  it("returns 404 when the resource name is unknown", async () => {
    const handler = restoreRoute(makeConfig({}));
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, { params: paramsFor("ghost", "u1") });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the resource does not declare delete.softDelete", async () => {
    const handler = restoreRoute(makeConfig({ softDelete: false }));
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/does not support restore/);
  });

  it("returns 501 when the adapter has no restore method", async () => {
    const handler = restoreRoute(makeConfig({ hasRestoreMethod: false }));
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(501);
  });

  it("returns 403 when the admin is read-only", async () => {
    const handler = restoreRoute(makeConfig({ readOnly: true }));
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(403);
  });

  it("returns 403 when the session's role fails the resource's requireRole", async () => {
    const handler = restoreRoute(makeConfig({ role: "viewer", requireRole: "admin" }));
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the row does not exist", async () => {
    const handler = restoreRoute(makeConfig({ rowNotFound: true }));
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(404);
  });

  it("returns 500 with a generic message (not the raw adapter error) when restore throws", async () => {
    const handler = restoreRoute(makeConfig({ restoreThrows: true }));
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).not.toMatch(/db failed/);
    expect(body.error).toBe("Internal server error");
  });

  it("succeeds: calls adapter.restore with id + softDelete binding, publishes, and returns ok", async () => {
    const captured: { value?: unknown } = {};
    const handler = restoreRoute(makeConfig({ capturedCtx: captured }));
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, { params: paramsFor("users", "u1") });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const ctx = captured.value as { id: string; softDelete?: { column: string } };
    expect(ctx.id).toBe("u1");
    expect(ctx.softDelete).toEqual({ column: "deletedAt" });
    expect(publishResource).toHaveBeenCalledWith("users", { action: "update" });
  });

  it("emits audit with a before/after diff on the soft-delete column", async () => {
    const sink = vi.fn(async (_ev: unknown) => {});
    const handler = restoreRoute(
      makeConfig({
        audit: { enabled: true, sink },
        session: { user: { id: "actor-1" } },
      }),
    );
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "x-forwarded-for": "9.9.9.9", "user-agent": "vitest" },
    });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(200);

    expect(sink).toHaveBeenCalledTimes(1);
    const ev = sink.mock.calls[0]?.[0] as {
      action: string;
      actorId: string | null;
      targetId: string;
      diff: { before: Record<string, unknown>; after: Record<string, unknown> };
      ip?: string;
      userAgent?: string;
    };
    expect(ev.action).toBe("users.restore");
    expect(ev.targetId).toBe("u1");
    expect(ev.actorId).toBe("actor-1");
    expect(ev.diff.before.deletedAt).toBeInstanceOf(Date);
    expect(ev.diff.after.deletedAt).toBeNull();
    expect(ev.ip).toBe("9.9.9.9");
    expect(ev.userAgent).toBe("vitest");
  });

  it("uses config.auth.userId to derive the audit event's actorId when configured", async () => {
    const sink = vi.fn(async (_ev: unknown) => {});
    const handler = restoreRoute(
      makeConfig({
        audit: { enabled: true, sink },
        session: { id: "session-top-id", custom: { uid: "extractor-actor" } },
        userId: (s) => (s as { custom?: { uid?: string } })?.custom?.uid ?? null,
      }),
    );
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(200);

    expect(sink).toHaveBeenCalledTimes(1);
    const ev = sink.mock.calls[0]?.[0] as { actorId: string | null };
    expect(ev.actorId).toBe("extractor-actor");
  });

  it("does NOT emit audit when resource.options.audit === false", async () => {
    const sink = vi.fn(async (_ev: unknown) => {});
    const handler = restoreRoute(
      makeConfig({ audit: { enabled: true, sink }, resourceAudit: false }),
    );
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, { params: paramsFor("users", "u1") });
    expect(res.status).toBe(200);
    expect(sink).not.toHaveBeenCalled();
  });
});
