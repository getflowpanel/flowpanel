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
  it("awaits an async role before the admin gate and resolves it once", async () => {
    const role = vi.fn(async () => "admin");
    const config = defineAdmin({
      adapter,
      auth: {
        session: async () => ({ id: "operator-1" }),
        role,
        requireRole: "admin",
      },
    });
    const req = new Request("http://localhost/admin");
    const [first, second] = await Promise.all([
      buildRequestContext({ req, config }),
      buildRequestContext({ req, config }),
    ]);
    expect(first.role).toBe("admin");
    expect(second).toBe(first);
    expect(role).toHaveBeenCalledTimes(1);
  });

  it("fails closed before resolving scope when async role lookup rejects", async () => {
    let scoped = false;
    const config = defineAdmin({
      adapter,
      auth: {
        session: async () => ({ id: "operator-1" }),
        role: async () => {
          throw new Error("Identity provider unavailable");
        },
        requireRole: "admin",
      },
      scope: () => {
        scoped = true;
        return null;
      },
    });
    await expect(
      buildRequestContext({ req: new Request("http://localhost/admin"), config }),
    ).rejects.toThrow("Identity provider unavailable");
    expect(scoped).toBe(false);
  });

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
