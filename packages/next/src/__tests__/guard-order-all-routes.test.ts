import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish.js", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { z } from "zod";
import { inlineUpdateRoute } from "../actions/inline-update.js";
import { referenceSearchRoute } from "../actions/reference-search.js";
import { importRoute } from "../actions/resource-import.js";
import { restoreRoute } from "../actions/restore.js";
import { drawerRoute } from "../drawer/drawer-route.js";

function makeConfig(opts: { requireRole?: string; rateLimited?: boolean } = {}) {
  const adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
    inferSchema: () => ({
      create: z.object({}),
      update: z.object({ email: z.email("must be a valid email") }),
      select: z.object({}),
    }),
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => ({ id: "u1", email: "old@x.com" }),
    create: async () => ({}),
    update: async () => ({ id: "u1" }),
    delete: async () => undefined,
    restore: async () => undefined,
  } as unknown as Adapter;

  const resource = {
    __kind: "resource",
    ref: { __name: "users" },
    options: {
      columns: [{ field: "id" }, { field: "email", editable: true }, { field: "secret" }],
      delete: { softDelete: "deletedAt" },
      drawer: { fields: "*" },
      import: { formats: ["csv"] },
      update: {
        fields: [{ name: "owner", reference: { resource: "users", labelField: "email" } }],
      },
    },
  } as unknown as ResourceConfig;

  return {
    adapter,
    auth: {
      session: async () => null,
      role: () => "anonymous",
      ...(opts.requireRole ? { requireRole: opts.requireRole } : {}),
    },
    ...(opts.rateLimited ? { rateLimit: { driver: "memory", limit: 1, windowMs: 60_000 } } : {}),
    resources: [resource],
    resourcesByName: new Map([["users", resource]]),
    dashboardsByPath: new Map(),
    __resolved: true,
  } as unknown as ResolvedAdminConfig;
}

const idParams = Promise.resolve({ resource: "users", id: "u1" });

function routesUnder(config: ResolvedAdminConfig) {
  return [
    {
      name: "inline-update",
      call: () =>
        inlineUpdateRoute(config)(
          new Request("http://localhost/x", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ field: "email", value: "not-an-email" }),
          }),
          { params: idParams },
        ),
    },
    {
      name: "restore",
      call: () =>
        restoreRoute(config)(new Request("http://localhost/x", { method: "POST" }), {
          params: idParams,
        }),
    },
    {
      name: "import",
      call: () =>
        importRoute(config)(
          new Request("http://localhost/x", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ format: "csv", content: "email\na@b.c" }),
          }),
          { params: Promise.resolve({ resource: "users" }) },
        ),
    },
    {
      name: "reference-search",
      call: () =>
        referenceSearchRoute(config)(new Request("http://localhost/x?q=a"), {
          params: Promise.resolve({ resource: "users", field: "owner" }),
        }),
    },
    {
      name: "drawer GET",
      call: () => drawerRoute(config)(new Request("http://localhost/x"), { params: idParams }),
    },
  ];
}

describe("every route enforces the admin-wide role gate before its own work", () => {
  for (const route of routesUnder(makeConfig({ requireRole: "admin" }))) {
    it(`${route.name} answers 403 instead of throwing`, async () => {
      const res = await route.call();
      expect(res.status).toBe(403);
      expect((await res.json()).ok).toBe(false);
    });
  }
});

describe("every route maps a rate-limit rejection to 429", () => {
  for (const { name } of routesUnder(makeConfig())) {
    it(`${name} answers 429 instead of throwing`, async () => {
      const route = routesUnder(makeConfig({ rateLimited: true })).find((r) => r.name === name);
      if (!route) throw new Error(`no route named ${name}`);
      await route.call();
      const res = await route.call();
      expect(res.status).toBe(429);
    });
  }
});

describe("inline-update authenticates before it validates", () => {
  const config = makeConfig({ requireRole: "admin" });

  it("does not reveal which columns are editable", async () => {
    const res = await inlineUpdateRoute(config)(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field: "secret", value: "x" }),
      }),
      { params: idParams },
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).not.toContain("not editable");
  });

  it("does not leak the update schema's validation messages", async () => {
    const res = await inlineUpdateRoute(config)(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field: "email", value: "not-an-email" }),
      }),
      { params: idParams },
    );
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("must be a valid email");
  });
});

describe("read-only routes stay reachable when the admin is globally read-only", () => {
  const config = { ...makeConfig(), readOnly: true } as ResolvedAdminConfig;

  it("drawer GET still serves its payload", async () => {
    const res = await drawerRoute(config)(new Request("http://localhost/x"), { params: idParams });
    expect(res.status).toBe(200);
  });

  it("reference search still serves options", async () => {
    const res = await referenceSearchRoute(config)(new Request("http://localhost/x?q=a"), {
      params: Promise.resolve({ resource: "users", field: "owner" }),
    });
    expect(res.status).toBe(200);
  });

  it("restore is still blocked", async () => {
    const res = await restoreRoute(config)(new Request("http://localhost/x", { method: "POST" }), {
      params: idParams,
    });
    expect(res.status).toBe(403);
  });
});
