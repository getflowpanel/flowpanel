import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { DetailTabsClient } from "@flowpanel/next/client";
import { DataTable, KVRow } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ResourceDetailPage } from "../pages/resource-detail.js";

/**
 * Collects the props of every element of `type` in the RSC-returned tree.
 * Descends through `children` AND, for `DetailTabsClient`, through each
 * tab's server-prerendered `content` — that's where the "resource" tab's
 * `<DataTable>` actually lives.
 */
function findAllElements(
  tree: ReactNode,
  type: unknown,
  out: (Record<string, unknown> & { children?: ReactNode })[] = [],
): (Record<string, unknown> & { children?: ReactNode })[] {
  if (tree === null || tree === undefined || typeof tree !== "object") return out;
  if (Array.isArray(tree)) {
    for (const c of tree) findAllElements(c, type, out);
    return out;
  }
  if (!isValidElement(tree)) return out;
  const el = tree as ReactElement<
    Record<string, unknown> & { children?: ReactNode; tabs?: ReadonlyArray<{ content: ReactNode }> }
  >;
  if (el.type === type) out.push(el.props);
  if (el.type === DetailTabsClient && el.props.tabs) {
    for (const t of el.props.tabs) findAllElements(t.content, type, out);
  }
  findAllElements(el.props.children, type, out);
  return out;
}

function mkAdapter(getRow: Record<string, unknown>, listRows: Record<string, unknown>[]): Adapter {
  return {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
    inferSchema: () =>
      ({ create: {} as never, update: {} as never, select: {} as never }) as ReturnType<
        Adapter["inferSchema"]
      >,
    list: async () => ({ rows: listRows, total: listRows.length, page: 1, pageSize: 25 }),
    get: async () => getRow,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
}

describe("ResourceDetailPage — row projection", () => {
  it("no detail.tabs: KV fallback drops undeclared fields (declared surface only)", async () => {
    const adapter = mkAdapter(
      { id: "1", email: "a@b.co", passwordHash: "secret", internalFlag: true },
      [],
    );
    const config = defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [resource({ __name: "users" }, { columns: ["id", "email"] })],
    });
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    const node = await ResourceDetailPage({
      config,
      resource: resourceCfg,
      name: "users",
      id: "1",
      req: new Request("http://localhost/admin/users/1"),
    });

    const rows = findAllElements(node, KVRow);
    const labels = rows.map((r) => r.label);
    expect(labels.sort()).toEqual(["email", "id"]);
    expect(labels).not.toContain("passwordHash");
    expect(labels).not.toContain("internalFlag");
  });

  it("'resource' detail tab: related rows are projected to the TARGET resource's declared surface", async () => {
    const usersAdapterCalls: Record<string, unknown> = { id: "1", email: "a@b.co" };
    const adapter = mkAdapter(usersAdapterCalls, [
      { id: "p1", userId: "1", amount: 10, cardNumber: "4111111111111111" },
    ]);
    const config = defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "email"],
            detail: {
              tabs: [{ key: "payments", label: "Payments", resource: "payments" }],
            },
          },
        ),
        resource({ __name: "payments" }, { columns: ["id", "userId", "amount"] }),
      ],
    });
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    const node = await ResourceDetailPage({
      config,
      resource: resourceCfg,
      name: "users",
      id: "1",
      req: new Request("http://localhost/admin/users/1"),
    });

    // DetailTabsClient receives pre-rendered `content` per tab; walk into it.
    const dataTables = findAllElements(node, DataTable) as {
      rows: Record<string, unknown>[];
    }[];
    expect(dataTables).toHaveLength(1);
    expect(dataTables[0]?.rows).toEqual([{ id: "p1", userId: "1", amount: 10 }]);
    expect(dataTables[0]?.rows[0]).not.toHaveProperty("cardNumber");
  });

  it("detail tab with fields: '*' (no tab.resource) drops undeclared fields", async () => {
    const adapter = mkAdapter(
      { id: "1", email: "a@b.co", passwordHash: "secret", internalFlag: true },
      [],
    );
    const config = defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "email"],
            detail: {
              tabs: [{ key: "overview", label: "Overview", fields: "*" }],
            },
          },
        ),
      ],
    });
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    const node = await ResourceDetailPage({
      config,
      resource: resourceCfg,
      name: "users",
      id: "1",
      req: new Request("http://localhost/admin/users/1"),
    });

    const rows = findAllElements(node, KVRow);
    const labels = rows.map((r) => r.label);
    expect(labels.sort()).toEqual(["email", "id"]);
    expect(labels).not.toContain("passwordHash");
    expect(labels).not.toContain("internalFlag");
  });
});
