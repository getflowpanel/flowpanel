import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, AuditEvent, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { defineAdmin, resource as defineResource } from "@flowpanel/core";
import { z } from "zod";
import { bulkActionRoute } from "../actions/bulk-action";
import { makeActions } from "../actions/resource-actions";

function makeConfig(opts: { rowExists?: boolean; failOn?: string; transactional?: boolean } = {}) {
  const deleted: string[] = [];
  const audited: AuditEvent[] = [];

  const adapter = {
    kind: "drizzle",
    db: { handle: "root" },
    introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
    inferSchema: () => ({ create: z.object({}), update: z.object({}), select: z.object({}) }),
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async (_ref: unknown, ctx: { id: string }) =>
      opts.rowExists === false ? null : { id: ctx.id },
    create: async () => ({}),
    update: async () => ({}),
    delete: async (_ref: unknown, ctx: { id: string }) => {
      if (opts.failOn === ctx.id) throw new Error("constraint violation");
      deleted.push(ctx.id);
    },
    ...(opts.transactional
      ? {
          transaction: async <T>(run: (db: unknown) => Promise<T>) => {
            const before = [...deleted];
            try {
              return await run({ handle: "tx" });
            } catch (err) {
              deleted.length = 0;
              deleted.push(...before);
              throw err;
            }
          },
        }
      : {}),
  } as unknown as Adapter;

  const config = defineAdmin({
    adapter,
    auth: { session: async () => ({ role: "admin" }), role: () => "admin" },
    audit: { enabled: true, sink: async (e: AuditEvent) => void audited.push(e) },
    resources: [defineResource("users", { name: "users", columns: ["id"] })],
  }) as unknown as ResolvedAdminConfig;
  const resource = config.resourcesByName.get("users") as ResourceConfig;

  return { config, resource, deleted, audited };
}

const reqCtx = {
  requestId: "req-1",
  req: new Request("http://localhost/admin/users"),
  session: { role: "admin" },
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

describe("a delete only reports what it did", () => {
  it("refuses an id the caller cannot see instead of auditing a phantom delete", async () => {
    const { config, resource, audited } = makeConfig({ rowExists: false });
    const actions = makeActions(config, resource, { reqCtx: reqCtx as never });
    await expect(actions.delete("gone")).rejects.toThrow();
    expect(audited).toEqual([]);
  });

  it("audits a delete that actually happened", async () => {
    const { config, resource, audited, deleted } = makeConfig();
    const actions = makeActions(config, resource, { reqCtx: reqCtx as never });
    await actions.delete("u1");
    expect(deleted).toEqual(["u1"]);
    expect(audited).toHaveLength(1);
  });
});

describe("a bulk delete is all or nothing", () => {
  function bulkDelete(config: ResolvedAdminConfig, ids: string[]) {
    return bulkActionRoute(config)(
      new Request("http://localhost/api/flowpanel/users/bulk-actions/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids, input: {} }),
      }),
      { params: Promise.resolve({ resource: "users", action: "delete" }) },
    );
  }

  it("rolls the batch back when one row fails", async () => {
    const { config, deleted, audited } = makeConfig({ failOn: "u3", transactional: true });
    const res = await bulkDelete(config, ["u1", "u2", "u3", "u4"]);
    expect(res.status).toBe(500);
    expect(deleted).toEqual([]);
    expect(audited).toEqual([]);
  });

  it("runs the batch through the adapter's transaction handle", async () => {
    const { config, deleted } = makeConfig({ transactional: true });
    const res = await bulkDelete(config, ["u1", "u2"]);
    expect(res.status).toBe(200);
    expect(deleted).toEqual(["u1", "u2"]);
  });
});
