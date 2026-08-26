import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type {
  Adapter,
  AuditConfig,
  BulkAction,
  ResolvedAdminConfig,
  ResourceConfig,
  Session,
} from "@flowpanel/core";
import { bulkActionRoute, serializeBulkAction } from "../actions/bulk-action";
import { publishResource } from "../runtime/publish";

type Row = { id: string };

function makeConfig(opts: {
  action?: BulkAction<Row>;
  audit?: AuditConfig | undefined;
  resourceAudit?: boolean | undefined;
  role?: string;
  rowNotFound?: boolean;
  session?: Session | null;
}) {
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "items", columns: [], primaryKey: "id" }),
    inferSchema: () => ({}) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => (opts.rowNotFound ? null : {}),
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
      ...(opts.resourceAudit === false ? { audit: false } : {}),
    },
  } as never;

  const config: ResolvedAdminConfig = {
    adapter,
    auth: { session: async () => opts.session ?? null, role: () => opts.role ?? "admin" },
    ...(opts.audit ? { audit: opts.audit } : {}),
    resources: [resource],
    resourcesByName: new Map([["items", resource]]),
    dashboardsByPath: new Map(),
    __resolved: true,
  } as never;
  return config;
}

function jsonReq(body: unknown): Request {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("bulkActionRoute", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
  });

  it("404 when resource unknown", async () => {
    const config = makeConfig({
      action: { key: "x", label: "X", run: async () => ({ ok: true }) },
    });
    const handler = bulkActionRoute(config);
    const res = await handler(jsonReq({ ids: ["a"] }), {
      params: Promise.resolve({ resource: "ghost", action: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("404 when action key unknown", async () => {
    const config = makeConfig({
      action: { key: "verify", label: "V", run: async () => ({ ok: true }) },
    });
    const handler = bulkActionRoute(config);
    const res = await handler(jsonReq({ ids: ["a"] }), {
      params: Promise.resolve({ resource: "items", action: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("400 when ids is missing", async () => {
    const config = makeConfig({
      action: { key: "verify", label: "V", run: async () => ({ ok: true }) },
    });
    const handler = bulkActionRoute(config);
    const res = await handler(jsonReq({}), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(res.status).toBe(400);
  });

  it("400 when the action input is not an object", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const config = makeConfig({ action: { key: "verify", label: "V", run } });
    const handler = bulkActionRoute(config);
    const res = await handler(jsonReq({ ids: ["a"], input: "not-an-object" }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "input must be an object" });
    expect(run).not.toHaveBeenCalled();
  });

  it("400 when ids is empty", async () => {
    const config = makeConfig({
      action: { key: "verify", label: "V", run: async () => ({ ok: true }) },
    });
    const handler = bulkActionRoute(config);
    const res = await handler(jsonReq({ ids: [] }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(res.status).toBe(400);
  });

  it("403 when per-action requireRole fails", async () => {
    const config = makeConfig({
      role: "user",
      action: {
        key: "verify",
        label: "V",
        requireRole: "admin",
        run: async () => ({ ok: true }),
      },
    });
    const handler = bulkActionRoute(config);
    const res = await handler(jsonReq({ ids: ["a"] }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(res.status).toBe(403);
  });

  it("runs the action, applies refresh, and audits with the cap'd id list", async () => {
    const sink = vi.fn(async () => {});
    const run = vi.fn(async () => ({
      ok: true as const,
      message: "Verified 3 items",
      refresh: true,
    }));
    const config = makeConfig({
      audit: { enabled: true, sink },
      action: {
        key: "verify",
        label: "Verify",
        form: [{ name: "note", type: "text" }],
        run,
      },
    });
    const handler = bulkActionRoute(config);
    const res = await handler(jsonReq({ ids: ["a", "b", "c"], input: { note: "k" } }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, message: "Verified 3 items", refresh: true });

    expect(run).toHaveBeenCalledWith(
      ["a", "b", "c"],
      { note: "k" },
      expect.objectContaining({ session: null, actorId: null }),
    );
    expect(publishResource).toHaveBeenCalledWith("items", { action: "update" });
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "items.bulk.verify",
        resource: "items",
        targetId: "a,b,c",
      }),
    );
  });

  it("deduplicates ids and requires every selected row to exist inside the active scope", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const handler = bulkActionRoute(
      makeConfig({ action: { key: "verify", label: "Verify", run } }),
    );
    const deduped = await handler(jsonReq({ ids: ["a", "a", "b"] }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(deduped.status).toBe(200);
    expect(run).toHaveBeenCalledWith(["a", "b"], {}, expect.anything());

    const missingRun = vi.fn(async () => ({ ok: true as const }));
    const missingHandler = bulkActionRoute(
      makeConfig({
        rowNotFound: true,
        action: { key: "verify", label: "Verify", run: missingRun },
      }),
    );
    const missing = await missingHandler(jsonReq({ ids: ["outside-scope"] }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(missing.status).toBe(404);
    expect(missingRun).not.toHaveBeenCalled();
  });

  it("audit targetId truncates after 10 ids with an ellipsis marker", async () => {
    const sink = vi.fn(async () => {});
    const config = makeConfig({
      audit: { enabled: true, sink },
      action: { key: "verify", label: "V", run: async () => ({ ok: true }) },
    });
    const handler = bulkActionRoute(config);
    const ids = Array.from({ length: 12 }, (_, i) => `id${i}`);
    await handler(jsonReq({ ids }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: expect.stringMatching(/^id0,id1,id2,id3,id4,id5,id6,id7,id8,id9…$/),
      }),
    );
  });

  it("does not emit audit when resource.options.audit === false", async () => {
    const sink = vi.fn(async () => {});
    const config = makeConfig({
      audit: { enabled: true, sink },
      resourceAudit: false,
      action: { key: "verify", label: "V", run: async () => ({ ok: true }) },
    });
    const handler = bulkActionRoute(config);
    const res = await handler(jsonReq({ ids: ["a"] }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(res.status).toBe(200);
    expect(sink).not.toHaveBeenCalled();
  });

  it("returns 500 with a generic message (not the raw error) when action.run throws", async () => {
    const config = makeConfig({
      action: {
        key: "verify",
        label: "V",
        run: async () => {
          throw new Error("db down");
        },
      },
    });
    const handler = bulkActionRoute(config);
    const res = await handler(jsonReq({ ids: ["a"] }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).not.toContain("db down");
    expect(body.error).toBe("Internal server error");
  });

  it("passes ctx.actorId derived from the session to run", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const config = makeConfig({
      session: { id: "u1" } as unknown as Session,
      action: {
        key: "verify",
        label: "V",
        run,
      },
    });
    const handler = bulkActionRoute(config);
    await handler(jsonReq({ ids: ["a"] }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(run).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ actorId: "u1" }),
    );
  });

  it("returns 422 when ids exceeds the bulk cap, before running", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const config = makeConfig({ action: { key: "verify", label: "V", run } });
    const handler = bulkActionRoute(config);
    const ids = Array.from({ length: 1001 }, (_, i) => `id${i}`);
    const res = await handler(jsonReq({ ids }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/too many ids \(max 1000\)/);
    expect(run).not.toHaveBeenCalled();
  });

  it("allows exactly the bulk cap (1000 ids)", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const config = makeConfig({ action: { key: "verify", label: "V", run } });
    const handler = bulkActionRoute(config);
    const ids = Array.from({ length: 1000 }, (_, i) => `id${i}`);
    const res = await handler(jsonReq({ ids }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("returns 422 with issues when input fails the action's required form field", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const config = makeConfig({
      action: {
        key: "verify",
        label: "V",
        form: [{ name: "id", type: "text", required: true }],
        run,
      },
    });
    const handler = bulkActionRoute(config);
    const res = await handler(jsonReq({ ids: ["a"], input: {} }), {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("validation failed");
    expect(body.issues).toEqual([{ path: ["id"], message: "id is required" }]);
    expect(run).not.toHaveBeenCalled();
  });

  it("accepts FormData body with multiple ids fields", async () => {
    const run = vi.fn(async () => ({ ok: true as const, message: "ok" }));
    const config = makeConfig({
      action: {
        key: "verify",
        label: "V",
        form: [{ name: "note", type: "text" }],
        run,
      },
    });
    const handler = bulkActionRoute(config);
    const fd = new FormData();
    fd.append("ids", "a");
    fd.append("ids", "b");
    fd.set("note", "hi");
    const req = new Request("http://localhost/x", { method: "POST", body: fd });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "items", action: "verify" }),
    });
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledWith(
      ["a", "b"],
      expect.objectContaining({ note: "hi" }),
      expect.anything(),
    );
  });
});

describe("serializeBulkAction", () => {
  it("strips the run callback", () => {
    const wire = serializeBulkAction({
      key: "verify",
      label: "Verify",
      icon: "check",
      variant: "destructive",
      run: async () => ({ ok: true }),
    });
    expect(wire).toEqual({
      key: "verify",
      label: "Verify",
      icon: "check",
      variant: "destructive",
      hasForm: false,
    });
    expect("run" in wire).toBe(false);
  });

  it("normalizes confirm string to the object form", () => {
    const wire = serializeBulkAction({
      key: "k",
      label: "L",
      confirm: "Are you sure?",
      run: async () => ({ ok: true }),
    });
    expect(wire.confirm).toEqual({ title: "Are you sure?" });
  });

  it("serializes form field descriptors so BulkActionsBar can render them", () => {
    const wire = serializeBulkAction({
      key: "archive",
      label: "Archive",
      form: [{ name: "reason", type: "textarea", required: true }],
      run: async () => ({ ok: true }),
    });
    expect(wire.form).toEqual([{ name: "reason", type: "textarea", required: true }]);
  });

  it("omits `form` from the wire shape when there's no form", () => {
    const wire = serializeBulkAction({
      key: "k",
      label: "L",
      run: async () => ({ ok: true }),
    });
    expect("form" in wire).toBe(false);
  });
});
