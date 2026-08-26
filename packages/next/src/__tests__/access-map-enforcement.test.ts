import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

import type {
  Adapter,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
  Session,
} from "@flowpanel/core";
import { bulkActionRoute } from "../actions/bulk-action";
import { rowActionRoute } from "../actions/row-action";
import { drawerActionRoute } from "../drawer/drawer-route";
import { buildNav } from "../runtime/nav";

function roleOf(s: Session | null): string {
  return (s as { role?: string } | null)?.role ?? "guest";
}

/**
 * A resource guarded the canonical way: an `access` map and no `requireRole`.
 * `assertCanonicalAccess` rejects declaring both, so `requireRole` is necessarily
 * undefined here — which is exactly what used to leave these routes ungated.
 */
function makeConfig(action: Record<string, unknown>, role = "support") {
  const adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "payouts", columns: [], primaryKey: "id" }),
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => ({ id: "p1" }),
    update: async () => ({ id: "p1" }),
    delete: async () => undefined,
  } as unknown as Adapter;

  const resource = {
    __kind: "resource",
    ref: { __name: "payouts" },
    options: {
      access: { read: "admin", create: "admin", update: "admin", delete: "admin" },
      columns: [{ field: "id" }],
      actions: [action],
      drawer: { fields: "*", actions: [action] },
      bulkActions: [action],
    },
  } as unknown as ResourceConfig;

  return {
    adapter,
    auth: { session: async () => ({ role }), role: roleOf },
    resources: [resource],
    resourcesByName: new Map([["payouts", resource]]),
    dashboardsByPath: new Map(),
    pagesByPath: new Map(),
    queuesByKey: new Map(),
    paths: { base: "/admin", api: "/api/flowpanel" },
    __resolved: true,
  } as unknown as ResolvedAdminConfig;
}

const ungatedAction = { key: "approve", label: "Approve", run: async () => ({ ok: true }) };

function post(body: unknown = {}) {
  return new Request("http://localhost/api/flowpanel/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("resource access map governs action routes", () => {
  it("refuses a row action the resource's update rule forbids", async () => {
    const config = makeConfig(ungatedAction);
    const res = await rowActionRoute(config)(post(), {
      params: Promise.resolve({ resource: "payouts", id: "p1", action: "approve" }),
    });
    expect(res.status).toBe(403);
  });

  it("refuses a drawer action the resource's update rule forbids", async () => {
    const config = makeConfig(ungatedAction);
    const res = await drawerActionRoute(config)(post(), {
      params: Promise.resolve({ resource: "payouts", id: "p1", action: "approve" }),
    });
    expect(res.status).toBe(403);
  });

  it("refuses a bulk action the resource's update rule forbids", async () => {
    const config = makeConfig(ungatedAction);
    const res = await bulkActionRoute(config)(post({ ids: ["p1"], input: {} }), {
      params: Promise.resolve({ resource: "payouts", action: "approve" }),
    });
    expect(res.status).toBe(403);
  });

  it("admits the same action for a role the resource's update rule allows", async () => {
    const config = makeConfig(ungatedAction, "admin");
    const res = await rowActionRoute(config)(post(), {
      params: Promise.resolve({ resource: "payouts", id: "p1", action: "approve" }),
    });
    expect(res.status).toBe(200);
  });

  it("lets an action carrying its own rule govern itself", async () => {
    const delegated = { ...ungatedAction, requireRole: "support" };
    const config = makeConfig(delegated);
    const res = await rowActionRoute(config)(post(), {
      params: Promise.resolve({ resource: "payouts", id: "p1", action: "approve" }),
    });
    expect(res.status).toBe(200);
  });
});

describe("navigation follows the access map", () => {
  it("omits a resource the caller may not read", async () => {
    const config = makeConfig(ungatedAction);
    const reqCtx = {
      session: { role: "support" },
      role: "support",
      scope: undefined,
    } as unknown as RequestContext;
    const groups = await buildNav(config, reqCtx);
    expect(groups.flatMap((g) => g.items.map((i) => i.label))).toEqual([]);
  });

  it("advertises it to a caller who may read it", async () => {
    const config = makeConfig(ungatedAction, "admin");
    const reqCtx = {
      session: { role: "admin" },
      role: "admin",
      scope: undefined,
    } as unknown as RequestContext;
    const groups = await buildNav(config, reqCtx);
    expect(groups.flatMap((g) => g.items.map((i) => i.label))).toEqual(["Payouts"]);
  });
});
