import type { Adapter } from "@flowpanel/core";
import { defineAdmin } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { buildRequestContext } from "../runtime/request-setup";

const adapter: Adapter = {
  kind: "test",
  db: {},
  introspect: () => ({ name: "items", columns: [], primaryKey: "id" }),
  inferSchema: () => ({ create: {} as never, update: {} as never, select: {} as never }),
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => null,
  delete: async () => undefined,
};

describe("request runtime", () => {
  it("resolves auth and scope once for the same Request and admin", async () => {
    const session = vi.fn(async () => ({ id: "operator-1" }));
    const scope = vi.fn(() => ({ tenantId: "acme" }));
    const config = defineAdmin({
      adapter,
      auth: { session, role: () => "admin" },
      scope,
    });
    const request = new Request("http://localhost/admin");

    const [first, second] = await Promise.all([
      buildRequestContext({ req: request, config }),
      buildRequestContext({ req: request, config }),
    ]);

    expect(first).toBe(second);
    expect(session).toHaveBeenCalledTimes(1);
    expect(scope).toHaveBeenCalledTimes(1);
  });
});
