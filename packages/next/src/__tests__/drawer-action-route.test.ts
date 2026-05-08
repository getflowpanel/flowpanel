import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish.js", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, DrawerAction, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { drawerActionRoute } from "../drawer/drawer-route.js";
import { publishResource } from "../runtime/publish.js";

function makeConfig(action: DrawerAction) {
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
    },
  } as never;
  const config: ResolvedAdminConfig = {
    adapter,
    auth: { session: async () => null, role: () => "admin" },
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
    const run = vi.fn(async (_row: unknown, input: unknown) => ({
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

  it("propagates errors as { ok: false, error }", async () => {
    const run = vi.fn(async () => {
      throw new Error("boom");
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
    expect(body.error).toContain("boom");
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
