import type { Adapter, RequestContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { createControllerFactory } from "../runtime/controller-factory";

describe("protected request controllers", () => {
  it("enforces the compiled exposure projection and returns result envelopes", async () => {
    const list = vi.fn(async (_ref, ctx) => ({
      rows: [{ id: "c1", name: "Acme", secret: "never" }],
      total: 1,
      page: ctx.page,
      pageSize: ctx.pageSize,
    }));
    const adapter: Adapter = {
      kind: "test",
      db: {},
      introspect: () => ({
        name: "customers",
        primaryKey: "id",
        columns: [
          { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
          { name: "name", type: "string", nullable: false, unique: false, primaryKey: false },
          {
            name: "secret",
            type: "string",
            nullable: false,
            unique: false,
            primaryKey: false,
            sensitive: true,
          },
        ],
      }),
      inferSchema: () => ({ create: {} as never, update: {} as never, select: {} as never }),
      list,
      get: async () => null,
      create: async () => ({}),
      update: async () => null,
      delete: async () => undefined,
    };
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "operator" }), role: () => "admin" },
      resources: [
        resource("customers", {
          name: "customers",
          columns: ["id", "name"],
          fieldAccess: { secret: { sensitive: true } },
        }),
      ],
    });
    const request = new Request("http://localhost/admin/customers");
    const context: RequestContext = {
      requestId: "req-1",
      req: request,
      session: { id: "operator" },
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
    };
    const controllers = createControllerFactory(config, context);

    const result = await controllers.resources.customers.list({ page: 1, pageSize: 50 });

    expect(result).toEqual({
      ok: true,
      data: { rows: [{ id: "c1", name: "Acme" }], total: 1, page: 1, pageSize: 50 },
      meta: { requestId: "req-1" },
    });
    expect(list.mock.calls[0]?.[1].select).toEqual(["id", "name"]);

    const forbidden = await controllers.resources.customers.list({ select: ["secret"] });
    expect(forbidden).toMatchObject({ ok: false, error: { code: "unknown_field" } });
  });

  it("removes read-restricted query controls before calling the adapter", async () => {
    const list = vi.fn(async (_ref, ctx) => ({
      rows: [{ id: "c1", name: "Acme", secret: "never" }],
      total: 1,
      page: ctx.page,
      pageSize: ctx.pageSize,
    }));
    const adapter: Adapter = {
      kind: "test",
      db: {},
      introspect: () => ({
        name: "customers",
        primaryKey: "id",
        columns: [
          { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
          { name: "name", type: "string", nullable: false, unique: false, primaryKey: false },
          { name: "secret", type: "string", nullable: false, unique: false, primaryKey: false },
        ],
      }),
      inferSchema: () => ({ create: {} as never, update: {} as never, select: {} as never }),
      list,
      get: async () => null,
      create: async () => ({}),
      update: async () => null,
      delete: async () => undefined,
    };
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "operator" }), role: () => "support" },
      resources: [
        resource("customers", {
          name: "customers",
          columns: ["id", "name", "secret"],
          search: ["name", "secret"],
          defaultSort: { field: "secret", dir: "asc" },
          fieldAccess: { secret: { read: "admin" } },
        }),
      ],
    });
    const request = new Request(
      "http://localhost/admin/customers?filter.secret=guess&search=guess&sort=secret%3Aasc",
    );
    const context: RequestContext = {
      requestId: "req-field-query",
      req: request,
      session: { id: "operator" },
      role: "support",
      scope: null,
      ip: null,
      userAgent: null,
    };

    const result = await createControllerFactory(config, context).resources.customers.list({
      filters: { name: "Acme", secret: "guess" },
      sort: { field: "secret", dir: "desc" },
      search: "guess",
    });

    expect(result.ok).toBe(true);
    const query = list.mock.calls[0]?.[1];
    expect(query?.filters).toEqual({ name: "Acme" });
    expect(query?.sort).toBeNull();
    expect(query?.searchFields).toEqual(["name"]);
    expect(query?.search).toBe("guess");
    expect(query?.searchParams.get("filter.secret")).toBeNull();
    expect(query?.searchParams.get("sort")).toBeNull();
  });

  it("rejects a delegated action when the originating request is cross-origin", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const adapter: Adapter = {
      kind: "test",
      db: {},
      introspect: () => ({
        name: "customers",
        primaryKey: "id",
        columns: [{ name: "id", type: "string", nullable: false, unique: true, primaryKey: true }],
      }),
      inferSchema: () => ({ create: {} as never, update: {} as never, select: {} as never }),
      list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
      get: async () => ({ id: "c1" }),
      create: async () => ({}),
      update: async () => null,
      delete: async () => undefined,
    };
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "operator" }), role: () => "admin" },
      resources: [
        resource("customers", {
          name: "customers",
          columns: ["id"],
          actions: [{ key: "ping", label: "Ping", run }],
        }),
      ],
    });
    const request = new Request("http://localhost/admin/customers", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    const context: RequestContext = {
      requestId: "req-2",
      req: request,
      session: { id: "operator" },
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
    };
    const controllers = createControllerFactory(config, context);
    const result = await controllers.resources.customers.action("c1", "ping");
    expect(result.ok).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("dashboard(path).action(key) reaches the dashboard's action", async () => {
    const run = vi.fn(async () => ({ ok: true as const }));
    const adapter: Adapter = {
      kind: "test",
      db: {},
      introspect: () => ({
        name: "customers",
        primaryKey: "id",
        columns: [{ name: "id", type: "string", nullable: false, unique: true, primaryKey: true }],
      }),
      inferSchema: () => ({ create: {} as never, update: {} as never, select: {} as never }),
      list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
      get: async () => null,
      create: async () => ({}),
      update: async () => null,
      delete: async () => undefined,
    };
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "operator" }), role: () => "admin" },
      resources: [resource("customers", { name: "customers", columns: ["id"] })],
      dashboards: [
        {
          path: "/team/ops",
          label: "Ops",
          sections: [],
          actions: [{ key: "trigger", label: "Trigger", run }],
        },
      ],
    });
    const context: RequestContext = {
      requestId: "req-3",
      req: new Request("http://localhost/admin"),
      session: { id: "operator" },
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
    };
    const controllers = createControllerFactory(config, context);
    const result = await controllers.dashboard("/team/ops").action("trigger");
    expect(result.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
