import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { DataTableWithDrawerRows } from "@flowpanel/next/client";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
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
});
