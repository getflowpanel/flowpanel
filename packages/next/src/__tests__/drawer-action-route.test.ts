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
  DrawerAction,
  ResolvedAdminConfig,
  ResourceConfig,
  Session,
} from "@flowpanel/core";
import { drawerActionRoute } from "../drawer/drawer-route.js";
import { publish, publishResource } from "../runtime/publish.js";

function makeConfig(
  action: DrawerAction,
  opts: { audit?: AuditConfig; resourceAudit?: boolean; session?: Session | null } = {},
) {
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
    inferSchema: () => ({}) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => ({ id: "1", status: "pending" }),
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
  const resource: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "jobs" },
    options: {
      columns: [],
      drawer: { actions: [action] },
      ...(opts.resourceAudit === false ? { audit: false } : {}),
    },
  } as never;
  const config: ResolvedAdminConfig = {
    adapter,
    auth: { session: async () => opts.session ?? null, role: () => "admin" },
    ...(opts.audit ? { audit: opts.audit } : {}),
    resources: [resource],
    resourcesByName: new Map([["jobs", resource]]),
    dashboardsByPath: new Map(),
    __resolved: true,
  } as never;
  return config;
}

describe("drawerActionRoute", () => {
  beforeEach(() => {
    vi.mocked(publishResource).mockReset();
    vi.mocked(publish).mockReset();
  });

  it("returns 404 when resource is unknown", async () => {
    const config = makeConfig({
      key: "x",
      label: "X",
      run: async () => ({ ok: true }),
    } as DrawerAction);
    const handler = drawerActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "ghost", id: "1", action: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when action key is unknown", async () => {
    const config = makeConfig({
      key: "approve",
      label: "A",
      run: async () => ({ ok: true }),
    } as DrawerAction);
    const handler = drawerActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "jobs", id: "1", action: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("executes action.run with row + formData + ctx, returns its result, and applies refresh", async () => {
    const run = vi.fn(async (_row: unknown, _input: unknown) => ({
      ok: true as const,
      message: "Approved",
      refresh: true,
    }));
    const config = makeConfig({ key: "approve", label: "Approve", run } as DrawerAction);
    const handler = drawerActionRoute(config);
    const fd = new FormData();
    fd.set("note", "hi");
    const req = new Request("http://localhost/x", { method: "POST", body: fd });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "jobs", id: "1", action: "approve" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, message: "Approved", refresh: true });
    expect(run).toHaveBeenCalledWith(
      { id: "1", status: "pending" },
      expect.objectContaining({ note: "hi" }),
      expect.objectContaining({ session: null }),
    );
    expect(publishResource).toHaveBeenCalledWith("jobs", { action: "update" });
  });

  it("publishes to exactly that channel when the action returns a bare-string refresh", async () => {
    const run = vi.fn(async () => ({ ok: true as const, refresh: "jobs.stats" }));
    const config = makeConfig({ key: "approve", label: "Approve", run } as DrawerAction);
    const handler = drawerActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "jobs", id: "1", action: "approve" }),
    });
    expect(res.status).toBe(200);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith("jobs.stats");
    expect(publishResource).not.toHaveBeenCalled();
  });

  it("passes ctx.actorId derived from the session to run", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const config = makeConfig({ key: "approve", label: "Approve", run } as DrawerAction, {
      session: { id: "u1" } as unknown as Session,
    });
    const handler = drawerActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    await handler(req, {
      params: Promise.resolve({ resource: "jobs", id: "1", action: "approve" }),
    });
    expect(run).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ actorId: "u1" }),
    );
  });

  it("returns { ok: false, error } on a thrown action WITHOUT leaking the raw message", async () => {
    const run = vi.fn(async () => {
      // A raw error (e.g. a DB constraint) must never reach the client verbatim.
      throw new Error("boom: column users.ssn violates constraint");
    });
    const config = makeConfig({ key: "approve", label: "A", run } as DrawerAction);
    const handler = drawerActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "jobs", id: "1", action: "approve" }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("internal error");
    expect(body.error).not.toContain("boom");
    expect(body.error).not.toContain("ssn");
  });

  it("emits audit on successful drawer action with the drawer namespace", async () => {
    const sink = vi.fn(async () => {});
    const run = vi.fn(async () => ({ ok: true as const, message: "approved" }));
    const config = makeConfig({ key: "approve", label: "Approve", run } as DrawerAction, {
      audit: { enabled: true, sink },
    });
    const handler = drawerActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "jobs", id: "1", action: "approve" }),
    });
    expect(res.status).toBe(200);
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "jobs.drawer.approve",
        resource: "jobs",
        targetId: "1",
      }),
    );
  });

  it("rejects input that violates the declared form before running the action", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const config = makeConfig({
      key: "reject",
      label: "Reject",
      form: [{ name: "reason", type: "text", required: true }],
      run,
    } as DrawerAction);
    const handler = drawerActionRoute(config);
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "jobs", id: "1", action: "reject" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.issues).toEqual([{ path: ["reason"], message: "reason is required" }]);
    // The guard must run *before* the handler — otherwise a hand-crafted POST
    // reaches user code with input the form would have rejected.
    expect(run).not.toHaveBeenCalled();
  });

  it("runs a function-form field validator and returns its message as a field error", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const config = makeConfig({
      key: "reject",
      label: "Reject",
      form: [
        {
          name: "reason",
          type: "text",
          validate: (value: unknown) =>
            value === "duplicate" ? "already flagged as duplicate" : null,
        },
      ],
      run,
    } as DrawerAction);
    const handler = drawerActionRoute(config);
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "duplicate" }),
    });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "jobs", id: "1", action: "reject" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.issues).toEqual([{ path: ["reason"], message: "already flagged as duplicate" }]);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs the action when the declared form is satisfied", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const config = makeConfig({
      key: "reject",
      label: "Reject",
      form: [{ name: "reason", type: "text", required: true }],
      run,
    } as DrawerAction);
    const handler = drawerActionRoute(config);
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "duplicate" }),
    });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "jobs", id: "1", action: "reject" }),
    });
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledWith(expect.anything(), { reason: "duplicate" }, expect.anything());
  });

  it("returns download payload as JSON (client-side trigger applies)", async () => {
    const run = vi.fn(async () => ({
      ok: true as const,
      download: { filename: "ok.csv", data: "a,b\n1,2", mime: "text/csv" },
    }));
    const config = makeConfig({ key: "export", label: "E", run } as DrawerAction);
    const handler = drawerActionRoute(config);
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await handler(req, {
      params: Promise.resolve({ resource: "jobs", id: "1", action: "export" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.download?.filename).toBe("ok.csv");
  });
});
