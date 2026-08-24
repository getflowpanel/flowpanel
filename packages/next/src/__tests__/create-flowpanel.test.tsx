import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { createFlowpanel } from "../create-flowpanel.js";

const adapter: Adapter = {
  kind: "test",
  db: { private: true },
  introspect: () => ({
    name: "customers",
    primaryKey: "id",
    columns: [
      { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
      { name: "name", type: "string", nullable: false, unique: false, primaryKey: false },
    ],
  }),
  inferSchema: () => ({ create: {} as never, update: {} as never, select: {} as never }),
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => null,
  delete: async () => undefined,
};

describe("createFlowpanel", () => {
  it("binds page, every route method and wire-safe client metadata once", async () => {
    const admin = defineAdmin({
      id: "acme-ops",
      adapter,
      auth: { session: async () => ({ id: "1" }), role: () => "admin" },
      paths: { admin: "/ops", api: "/api/ops" },
      resources: [resource("customers", { name: "customers", columns: ["id", "name"] })],
    });

    const runtime = createFlowpanel(admin);

    expect(typeof runtime.page).toBe("function");
    expect(Object.keys(runtime.handlers).sort()).toEqual(
      ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"].sort(),
    );
    expect(runtime.client).toEqual({
      id: "acme-ops",
      paths: { admin: "/ops", api: "/api/ops" },
      protocol: {
        version: 1,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      },
    });
    expect(JSON.stringify(runtime.client)).not.toContain("private");

    await runtime.dispose();
    await expect(runtime.dispose()).resolves.toBeUndefined();
    await expect(runtime.events.publish("resource.customers", {})).rejects.toThrow("disposed");
  });

  it("answers OPTIONS without resolving auth", async () => {
    const session = vi.fn(async () => ({ id: "1" }));
    const runtime = createFlowpanel(
      defineAdmin({ adapter, auth: { session, role: () => "admin" } }),
    );
    const response = await runtime.handlers.OPTIONS(new Request("http://localhost/api"), {
      params: Promise.resolve({ route: [] }),
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("allow")).toContain("PATCH");
    expect(session).not.toHaveBeenCalled();
  });
});
