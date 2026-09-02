import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, MutationContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { bulkActionRoute } from "../actions/bulk-action";

const deleted: { id: unknown; softDelete: unknown }[] = [];

function makeAdapter(): Adapter {
  return {
    kind: "drizzle",
    db: {},
    introspect: () => ({
      name: "items",
      columns: [
        { name: "id", type: "string", nullable: false, primary: true },
        { name: "title", type: "string", nullable: false },
        { name: "archivedAt", type: "date", nullable: true },
      ],
      primaryKey: "id",
    }),
    inferSchema: () => ({}) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => ({ id: "a", title: "A" }),
    create: async () => ({}),
    update: async () => ({}),
    delete: async (_ref: unknown, ctx: MutationContext<unknown>) => {
      deleted.push({ id: ctx.id, softDelete: ctx.softDelete });
    },
  } as never;
}

function makeConfig(options: Record<string, unknown> = {}) {
  return defineAdmin({
    adapter: makeAdapter(),
    auth: { session: async () => ({ userId: "u1" }), role: () => "admin" },
    resources: [
      resource(
        { __name: "items" } as never,
        {
          columns: ["title"],
          ...options,
        } as never,
      ),
    ],
  } as never) as never;
}

function deleteReq(ids: string[]): Request {
  return new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

const params = Promise.resolve({ resource: "items", action: "delete" });

describe("the compiler-injected bulk delete", () => {
  beforeEach(() => {
    deleted.length = 0;
  });

  it("deletes every selected row instead of returning a sentinel", async () => {
    const res = await bulkActionRoute(makeConfig())(deleteReq(["a", "b"]), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.error).toBeUndefined();
    expect(deleted.map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("passes the resource's soft-delete column through", async () => {
    const config = makeConfig({ delete: { softDelete: "archivedAt" } });
    await bulkActionRoute(config)(deleteReq(["a"]), { params });

    expect(deleted[0]?.softDelete).toEqual({ column: "archivedAt" });
  });

  it("hard-deletes when the resource declares no soft-delete column", async () => {
    await bulkActionRoute(makeConfig())(deleteReq(["a"]), { params });

    expect(deleted[0]?.softDelete).toBeUndefined();
  });

  it("is refused when the delete operation's access rule denies the caller", async () => {
    const config = makeConfig({ access: { delete: () => false } });
    const res = await bulkActionRoute(config)(deleteReq(["a"]), { params });

    expect(res.status).toBe(403);
    expect(deleted).toHaveLength(0);
  });
});
