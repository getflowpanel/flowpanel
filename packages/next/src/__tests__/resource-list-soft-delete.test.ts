import type { Adapter, ListQueryContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { DataTableWithDrawerRows, ResourceListDeletedToggle } from "@flowpanel/next/client";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ResourceListPage } from "../pages/resource-list.js";

/**
 * Walks the RSC-returned tree and returns the props of the first element of
 * `type`, or `undefined` if none is found.
 */
function findElement(
  tree: ReactNode,
  type: unknown,
): (Record<string, unknown> & { children?: ReactNode }) | undefined {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) {
    for (const c of tree) {
      const found = findElement(c, type);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (el.type === type) return el.props;
  return findElement(el.props.children, type);
}

const rows = [
  { id: "1", email: "live@x.com", deletedAt: null },
  { id: "2", email: "gone@x.com", deletedAt: new Date("2026-01-01") },
];

function makeAdapter(listSpy: (ctx: ListQueryContext<unknown>) => void): Adapter {
  return {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
    inferSchema: () =>
      ({ create: {} as never, update: {} as never, select: {} as never }) as ReturnType<
        Adapter["inferSchema"]
      >,
    list: async (_ref, ctx) => {
      listSpy(ctx as ListQueryContext<unknown>);
      return { rows, total: rows.length, page: 1, pageSize: 20 };
    },
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
    restore: async () => undefined,
  };
}

function mkConfig(listSpy: (ctx: ListQueryContext<unknown>) => void, withSoftDelete: boolean) {
  return defineAdmin({
    adapter: makeAdapter(listSpy),
    auth: { session: async () => null, role: () => "admin" },
    resources: [
      resource(
        { __name: "users" },
        {
          columns: ["id", "email"],
          ...(withSoftDelete ? { delete: { softDelete: "deletedAt" } } : {}),
        },
      ),
    ],
  });
}

describe("ResourceListPage — soft-delete wiring", () => {
  it("does not set softDelete/includeDeleted or render the toggle for a resource without delete.softDelete", async () => {
    const listSpy = vi.fn();
    const config = mkConfig(listSpy, false);
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    const node = await ResourceListPage({
      config,
      resource: resourceCfg,
      searchParams: new URLSearchParams(),
      req: new Request("http://localhost/admin/users"),
    });

    const ctx = listSpy.mock.calls[0]?.[0] as ListQueryContext<unknown>;
    expect(ctx.softDelete).toBeUndefined();
    expect(ctx.includeDeleted).toBeUndefined();
    expect(findElement(node, ResourceListDeletedToggle)).toBeUndefined();

    const props = findElement(node, DataTableWithDrawerRows);
    expect(props?.deletedRowKeys).toBeUndefined();
  });

  it("defaults includeDeleted to false (hides deleted rows) when softDelete is declared and no ?deleted param is set", async () => {
    const listSpy = vi.fn();
    const config = mkConfig(listSpy, true);
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    const node = await ResourceListPage({
      config,
      resource: resourceCfg,
      searchParams: new URLSearchParams(),
      req: new Request("http://localhost/admin/users"),
    });

    const ctx = listSpy.mock.calls[0]?.[0] as ListQueryContext<unknown>;
    expect(ctx.softDelete).toEqual({ column: "deletedAt" });
    expect(ctx.includeDeleted).toBe(false);
    expect(findElement(node, ResourceListDeletedToggle)).toBeDefined();
  });

  it("sets includeDeleted to true from ?deleted=1 (the toggle reveals deleted rows)", async () => {
    const listSpy = vi.fn();
    const config = mkConfig(listSpy, true);
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    await ResourceListPage({
      config,
      resource: resourceCfg,
      searchParams: new URLSearchParams("deleted=1"),
      req: new Request("http://localhost/admin/users?deleted=1"),
    });

    const ctx = listSpy.mock.calls[0]?.[0] as ListQueryContext<unknown>;
    expect(ctx.includeDeleted).toBe(true);
  });

  it("computes deletedRowKeys from raw rows (pre-projection) and strips the soft-delete column from client rows", async () => {
    const listSpy = vi.fn();
    const config = mkConfig(listSpy, true);
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    const node = await ResourceListPage({
      config,
      resource: resourceCfg,
      searchParams: new URLSearchParams("deleted=1"),
      req: new Request("http://localhost/admin/users?deleted=1"),
    });

    const props = findElement(node, DataTableWithDrawerRows) as
      | { rows: Record<string, unknown>[]; deletedRowKeys?: string[] }
      | undefined;
    expect(props?.deletedRowKeys).toEqual(["2"]);
    // `deletedAt` isn't a declared column — it must not cross into the client rows.
    expect(props?.rows[0]).not.toHaveProperty("deletedAt");
    expect(props?.rows[1]).not.toHaveProperty("deletedAt");
  });
});
