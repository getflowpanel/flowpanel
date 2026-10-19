import type { Adapter, ColumnMeta, RequestContext, ResourceConfig } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { DetailTabsClient, RelatedTabTable } from "@flowpanel/next/client";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ResourceDetailPage } from "../pages/resource-detail";
import { prerenderResourceCells } from "../runtime/prerender-cells";
import { declaredRowFields } from "../runtime/project-row";

function findAll(
  tree: ReactNode,
  type: unknown,
  out: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
  if (tree === null || tree === undefined || typeof tree !== "object") return out;
  if (Array.isArray(tree)) {
    for (const child of tree) findAll(child, type, out);
    return out;
  }
  if (!isValidElement(tree)) return out;
  const el = tree as ReactElement<
    Record<string, unknown> & { children?: ReactNode; tabs?: ReadonlyArray<{ content: ReactNode }> }
  >;
  if (el.type === type) out.push(el.props);
  if (el.type === DetailTabsClient && el.props.tabs) {
    for (const tab of el.props.tabs) findAll(tab.content, type, out);
  }
  findAll(el.props.children, type, out);
  return out;
}

const meta = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: true,
  unique: name === "id",
  primaryKey: name === "id",
});

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) => {
    const name = (ref as { __name: string }).__name;
    const columns = name === "users" ? ["id"] : ["id", "userId", "note", "secret"];
    return { name, columns: columns.map(meta), primaryKey: "id" };
  },
  inferSchema: () => ({}) as never,
  list: async (_ref, ctx) => {
    const { page, pageSize } = ctx as { page: number; pageSize: number };
    const rows = [{ id: "s1", userId: "u1", note: "first", secret: "x" }];
    return { rows, total: rows.length, page, pageSize };
  },
  get: async () => ({ id: "u1" }),
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const reqCtx: RequestContext = {
  req: new Request("http://localhost/"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

describe("a column's secondary field", () => {
  it("joins the row projection and is dropped on a reference column", () => {
    const r = {
      __kind: "resource",
      ref: { __name: "r" },
      options: { columns: ["id", { field: "name", secondary: "email" }] },
    } as unknown as ResourceConfig;
    expect([...declaredRowFields(r)].sort()).toEqual(["email", "id", "name"]);
    const { columns } = prerenderResourceCells<Record<string, unknown>>(
      [
        { field: "name", secondary: "email" },
        {
          field: "userId",
          secondary: "email",
          reference: { resource: "users", labelField: "email" },
        },
      ],
      [],
      reqCtx,
    );
    expect(columns).toEqual([
      { field: "name", secondary: "email" },
      { field: "userId", type: "reference" },
    ]);
  });

  it("reaches a related tab's table with the rows that carry it", async () => {
    const config = defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id"],
            detail: {
              tabs: [
                {
                  key: "scores",
                  label: "Scores",
                  resource: "scores",
                  filter: (row: Record<string, unknown>) => ({ userId: row.id }),
                },
              ],
            },
          },
        ),
        resource({ __name: "scores" }, { columns: [{ field: "id", secondary: "note" }, "userId"] }),
      ],
    });
    const users = config.resourcesByName.get("users");
    if (!users) throw new Error("fixture: resource not registered");
    const tree = await ResourceDetailPage({
      config,
      resource: users,
      name: "users",
      id: "u1",
      req: new Request("http://localhost/admin/users/u1?tab=scores"),
    });
    const table = findAll(tree, RelatedTabTable)[0];
    expect((table!.columns as Record<string, unknown>[])[0]).toMatchObject({
      field: "id",
      secondary: "note",
    });
    expect(table?.rows).toEqual([{ id: "s1", note: "first" }]);
  });
});
