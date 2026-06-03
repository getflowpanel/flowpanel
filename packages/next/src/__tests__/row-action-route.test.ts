import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish.js", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type {
  Adapter,
  AuditConfig,
  ResolvedAdminConfig,
  ResourceConfig,
  RowAction,
} from "@flowpanel/core";
import { rowActionRoute, serializeRowAction } from "../actions/row-action.js";
import { publishResource } from "../runtime/publish.js";

type Row = { id: string; status: string };

function makeConfig(opts: {
  action?: RowAction<Row>;
  audit?: AuditConfig | undefined;
  resourceAudit?: boolean | undefined;
  role?: string;
  rowNotFound?: boolean;
}) {
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
    inferSchema: () => ({}) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () =>
      opts.rowNotFound
        ? null
        : ({ id: "u1", status: "active" } as unknown as Record<string, unknown>),
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };

  const resource: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "users" },
    options: {
      columns: [],
      ...(opts.action ? { actions: [opts.action as RowAction<Row>] } : {}),
      ...(opts.resourceAudit === false ? { audit: false } : {}),
    },
  } as never;

  const config: ResolvedAdminConfig = {
    adapter,
    auth: { session: async () => null, role: () => opts.role ?? "admin" },
    ...(opts.audit ? { audit: opts.audit } : {}),
    resources: [resource],
    resourcesByName: new Map([["users", resource]]),
    dashboardsByPath: new Map(),
    __resolved: true,
  } as never;
  return config;
}

describe("rowActionRoute", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
  });

  it("returns 404 when the resource name is unknown", async () => {
    const config = makeConfig({
      action: {
        key: "ping",
        label: "Ping",
        run: async () => ({ ok: true }),
      },
    });
    const handler = rowActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "ghost", id: "u1", action: "ping" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the action key is not in resource.options.actions", async () => {
    const config = makeConfig({
      action: {
        key: "ping",
        label: "Ping",
        run: async () => ({ ok: true }),
      },
    });
    const handler = rowActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "users", id: "u1", action: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the row is not found in the adapter", async () => {
    const config = makeConfig({
      rowNotFound: true,
      action: {
        key: "ping",
        label: "Ping",
        run: async () => ({ ok: true }),
      },
    });
    const handler = rowActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "users", id: "u1", action: "ping" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when per-action requireRole fails", async () => {
    const config = makeConfig({
      role: "user",
      action: {
        key: "ping",
        label: "Ping",
        requireRole: "admin",
        run: async () => ({ ok: true }),
      },
    });
    const handler = rowActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "users", id: "u1", action: "ping" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 409 when disabled(row) returns a reason string", async () => {
    const config = makeConfig({
      action: {
        key: "ping",
        label: "Ping",
        disabled: (row) => (row.status === "active" ? "already active" : false),
        run: async () => ({ ok: true }),
      },
    });
    const handler = rowActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "users", id: "u1", action: "ping" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("already active");
  });

  it("returns 404 when hidden(row, ctx) returns true", async () => {
    const config = makeConfig({
      action: {
        key: "ping",
        label: "Ping",
        hidden: async () => true,
        run: async () => ({ ok: true }),
      },
    });
    const handler = rowActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "users", id: "u1", action: "ping" }),
    });
    expect(res.status).toBe(404);
  });

  it("runs the action, applies refresh, and emits the audit event on success", async () => {
    const sink = vi.fn(async () => {});
    const run = vi.fn(async () => ({
      ok: true as const,
      message: "ok",
      refresh: true,
    }));
    const config = makeConfig({
      audit: { enabled: true, sink },
      action: { key: "reset-cap", label: "Reset cap", run },
    });
    const handler = rowActionRoute(config);
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"note":"weekly reset"}',
    });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "users", id: "u1", action: "reset-cap" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, message: "ok", refresh: true });

    expect(run).toHaveBeenCalledWith(
      { id: "u1", status: "active" },
      expect.objectContaining({ note: "weekly reset" }),
      expect.objectContaining({ session: null }),
    );
    expect(publishResource).toHaveBeenCalledWith("users", { action: "update" });
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "users.action.reset-cap",
        resource: "users",
        targetId: "u1",
      }),
    );
  });

  it("does NOT emit audit when resource.options.audit === false", async () => {
    const sink = vi.fn(async () => {});
    const config = makeConfig({
      audit: { enabled: true, sink },
      resourceAudit: false,
      action: { key: "ping", label: "Ping", run: async () => ({ ok: true }) },
    });
    const handler = rowActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "users", id: "u1", action: "ping" }),
    });
    expect(res.status).toBe(200);
    expect(sink).not.toHaveBeenCalled();
  });

  it("returns 500 with a generic message (not the raw error) when action.run throws", async () => {
    const config = makeConfig({
      action: {
        key: "boom",
        label: "Boom",
        run: async () => {
          throw new Error("kaboom");
        },
      },
    });
    const handler = rowActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "users", id: "u1", action: "boom" }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).not.toContain("kaboom");
    expect(body.error).toBe("internal error");
  });

  it("surfaces err.safeMessage on 500 when the thrown error opts in", async () => {
    const config = makeConfig({
      action: {
        key: "boom",
        label: "Boom",
        run: async () => {
          throw Object.assign(new Error("raw db detail: column users.secret"), {
            safeMessage: "Could not complete the action",
          });
        },
      },
    });
    const handler = rowActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "users", id: "u1", action: "boom" }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Could not complete the action");
    expect(body.error).not.toContain("secret");
  });

  it("returns 422 with issues when input fails the action's required form field", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const config = makeConfig({
      action: {
        key: "note",
        label: "Note",
        form: [{ name: "status", type: "text", required: true }],
        run,
      },
    });
    const handler = rowActionRoute(config);
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "users", id: "u1", action: "note" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("validation failed");
    expect(body.issues).toEqual([{ path: ["status"], message: "status is required" }]);
    expect(run).not.toHaveBeenCalled();
  });

  it("passes input through to run when the form validation succeeds", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const config = makeConfig({
      action: {
        key: "note",
        label: "Note",
        form: [{ name: "status", type: "text", required: true }],
        run,
      },
    });
    const handler = rowActionRoute(config);
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "looks good" }),
    });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "users", id: "u1", action: "note" }),
    });
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledWith(
      { id: "u1", status: "active" },
      expect.objectContaining({ status: "looks good" }),
      expect.anything(),
    );
  });
});

describe("serializeRowAction", () => {
  it("strips runtime callbacks (run/hidden/disabled) from the wire shape", () => {
    const action: RowAction<Row> = {
      key: "reset",
      label: "Reset",
      icon: "refresh",
      variant: "destructive",
      placement: "menu",
      hidden: async () => false,
      disabled: () => false,
      run: async () => ({ ok: true }),
    };
    const wire = serializeRowAction(action);
    expect(wire).toEqual({
      key: "reset",
      label: "Reset",
      icon: "refresh",
      variant: "destructive",
      placement: "menu",
      hasForm: false,
    });
    // Type assertion: the runtime callbacks are not in the type.
    expect("run" in wire).toBe(false);
    expect("hidden" in wire).toBe(false);
    expect("disabled" in wire).toBe(false);
  });

  it("normalizes the confirm string to the object form", () => {
    const wire = serializeRowAction({
      key: "k",
      label: "L",
      confirm: "Are you sure?",
      run: async () => ({ ok: true }),
    });
    expect(wire.confirm).toEqual({ title: "Are you sure?" });
  });

  it("passes through the confirm object verbatim", () => {
    const wire = serializeRowAction({
      key: "k",
      label: "L",
      confirm: { title: "Delete?", description: "Permanent.", confirmLabel: "Delete" },
      run: async () => ({ ok: true }),
    });
    expect(wire.confirm).toEqual({
      title: "Delete?",
      description: "Permanent.",
      confirmLabel: "Delete",
    });
  });

  it("flags hasForm true when action.form is non-empty", () => {
    const withForm = serializeRowAction({
      key: "k",
      label: "L",
      form: [{ name: "amount", type: "number" }],
      run: async () => ({ ok: true }),
    });
    expect(withForm.hasForm).toBe(true);
    const withoutForm = serializeRowAction({
      key: "k",
      label: "L",
      run: async () => ({ ok: true }),
    });
    expect(withoutForm.hasForm).toBe(false);
  });
});
