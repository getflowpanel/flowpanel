import type { Adapter, RequestContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { createControllerFactory } from "../runtime/controller-factory.js";

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
});
