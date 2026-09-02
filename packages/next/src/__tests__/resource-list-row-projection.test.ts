import type { Adapter, ListQueryContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import {
  DataTableWithDrawerRows,
  ResourceListFilters,
  ResourceListSearch,
} from "@flowpanel/next/client";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ResourceListPage } from "../pages/resource-list";

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

const fakeAdapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
  inferSchema: () =>
    ({ create: {} as never, update: {} as never, select: {} as never }) as ReturnType<
      Adapter["inferSchema"]
    >,
  list: async () => ({
    rows: [{ id: "1", email: "a@b.co", passwordHash: "secret", internalFlag: true }],
    total: 1,
    page: 1,
    pageSize: 20,
  }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

function mkConfig() {
  return defineAdmin({
    adapter: fakeAdapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [resource({ __name: "users" }, { columns: ["id", "email"] })],
  });
}

describe("ResourceListPage — row projection", () => {
  it("forwards the one-shot created row marker to the client table", async () => {
    const config = mkConfig();
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    const node = await ResourceListPage({
      config,
      resource: resourceCfg,
      searchParams: new URLSearchParams("view=recent&fp_created=1"),
      req: new Request("http://localhost/admin/users?view=recent&fp_created=1"),
    });

    const props = findElement(node, DataTableWithDrawerRows) as
      | { enteringRowKeys?: string[]; createdRowKey?: string }
      | undefined;
    expect(props?.enteringRowKeys).toEqual(["1"]);
    expect(props?.createdRowKey).toBe("1");
  });

  it("drops undeclared columns from rows crossing into the client DataTable", async () => {
    const config = mkConfig();
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    const node = await ResourceListPage({
      config,
      resource: resourceCfg,
      searchParams: new URLSearchParams(),
      req: new Request("http://localhost/admin/users"),
    });

    const props = findElement(node, DataTableWithDrawerRows) as
      | { rows: Record<string, unknown>[] }
      | undefined;
    expect(props).toBeDefined();
    expect(props?.rows).toEqual([{ id: "1", email: "a@b.co" }]);
    expect(props?.rows[0]).not.toHaveProperty("passwordHash");
    expect(props?.rows[0]).not.toHaveProperty("internalFlag");
  });

  it("removes read-restricted columns as well as their row values", async () => {
    const config = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => ({ id: "support-1" }), role: () => "support" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "email", { field: "internalFlag", label: "Internal flag" }],
            fieldAccess: { internalFlag: { read: "admin" } },
          },
        ),
      ],
    });
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    const node = await ResourceListPage({
      config,
      resource: resourceCfg,
      searchParams: new URLSearchParams(),
      req: new Request("http://localhost/admin/users"),
    });

    const props = findElement(node, DataTableWithDrawerRows) as
      | { columns: { field: string }[]; rows: Record<string, unknown>[] }
      | undefined;
    expect(props?.columns.map((column) => column.field)).toEqual(["id", "email"]);
    expect(props?.rows).toEqual([{ id: "1", email: "a@b.co" }]);
  });

  it("keeps explicit expose fields for renderers and client rows after read policy", async () => {
    const renderedRows: Record<string, unknown>[] = [];
    const config = defineAdmin({
      adapter: {
        ...fakeAdapter,
        introspect: () => ({
          name: "users",
          primaryKey: "id",
          columns: ["id", "email", "internalFlag", "passwordHash"].map((name) => ({
            name,
            type: name === "internalFlag" ? ("boolean" as const) : ("string" as const),
            nullable: false,
            unique: false,
            primaryKey: name === "id",
          })),
        }),
      },
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: [
              "id",
              {
                field: "email",
                render: (row: unknown) => {
                  const projected = row as Record<string, unknown>;
                  renderedRows.push(projected);
                  return String(projected.internalFlag);
                },
              },
            ],
            expose: ["internalFlag", "passwordHash"],
            fieldAccess: { passwordHash: { sensitive: true } },
          },
        ),
      ],
    });
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    const node = await ResourceListPage({
      config,
      resource: resourceCfg,
      searchParams: new URLSearchParams(),
      req: new Request("http://localhost/admin/users"),
    });

    const table = findElement(node, DataTableWithDrawerRows) as
      | { rows: Record<string, unknown>[]; prerenderedCells?: (ReactNode | undefined)[][] }
      | undefined;
    expect(table?.rows).toEqual([{ id: "1", email: "a@b.co", internalFlag: true }]);
    expect(table?.prerenderedCells?.[0]?.[1]).toBe("true");
    expect(renderedRows).toEqual([{ id: "1", email: "a@b.co", internalFlag: true }]);
  });

  it("removes read-restricted fields before list queries, controls, and cell renderers", async () => {
    const list = vi.fn(async (_ref: unknown, ctx: ListQueryContext<unknown>) => ({
      rows: [{ id: "1", email: "a@b.co", internalFlag: "classified" }],
      total: 1,
      page: ctx.page,
      pageSize: ctx.pageSize,
    }));
    const renderedRows: Record<string, unknown>[] = [];
    const canReadInternal = vi.fn(() => false);
    const config = defineAdmin({
      adapter: { ...fakeAdapter, list },
      auth: { session: async () => ({ id: "support-1" }), role: () => "support" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: [
              "id",
              {
                field: "email",
                render: (row: unknown) => {
                  const projected = row as Record<string, unknown>;
                  renderedRows.push(projected);
                  return String(projected.internalFlag ?? "redacted");
                },
              },
              { field: "internalFlag", label: "Internal flag" },
            ],
            filters: ["email", "internalFlag"],
            search: ["email", "internalFlag"],
            defaultSort: { field: "internalFlag", dir: "asc" },
            fieldAccess: { internalFlag: { read: canReadInternal } },
          },
        ),
      ],
    });
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    const node = await ResourceListPage({
      config,
      resource: resourceCfg,
      searchParams: new URLSearchParams(
        "f_email=a%40b.co&f_internalFlag=classified&q=classified&sort=internalFlag%3Aasc",
      ),
      req: new Request(
        "http://localhost/admin/users?f_email=a%40b.co&f_internalFlag=classified&q=classified&sort=internalFlag%3Aasc",
      ),
    });

    const query = list.mock.calls[0]?.[1];
    expect(query?.filters).toEqual({ email: "a@b.co" });
    expect(query?.sort).toBeNull();
    expect(query?.searchFields).toEqual(["email"]);
    expect(query?.search).toBe("classified");
    expect(query?.searchParams.get("f_email")).toBe("a@b.co");
    expect(query?.searchParams.get("f_internalFlag")).toBeNull();
    expect(query?.searchParams.get("sort")).toBeNull();

    const table = findElement(node, DataTableWithDrawerRows) as
      | {
          columns: { field: string }[];
          rows: Record<string, unknown>[];
          prerenderedCells?: (ReactNode | undefined)[][];
        }
      | undefined;
    expect(table?.columns.map((column) => column.field)).toEqual(["id", "email"]);
    expect(table?.rows).toEqual([{ id: "1", email: "a@b.co" }]);
    expect(table?.prerenderedCells?.[0]?.[1]).toBe("redacted");
    expect(renderedRows).toEqual([{ id: "1", email: "a@b.co" }]);

    const filterControls = findElement(node, ResourceListFilters) as
      | { filters: { field: string }[] }
      | undefined;
    expect(filterControls?.filters.map((filter) => filter.field)).toEqual(["email"]);
    expect(findElement(node, ResourceListSearch)).toBeDefined();
    expect(canReadInternal).toHaveBeenCalledOnce();
  });
});
