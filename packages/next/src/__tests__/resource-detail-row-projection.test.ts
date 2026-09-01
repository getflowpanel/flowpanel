import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { DetailTabsClient } from "@flowpanel/next/client";
import { DataTable, KVRow, PageHeader } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ResourceDetailPage } from "../pages/resource-detail";

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
    expect(labels.sort()).toEqual(["Email", "ID"]);
    expect(labels).not.toContain("passwordHash");
    expect(labels).not.toContain("internalFlag");
  });

  it("'resource' detail tab: related rows are projected to the TARGET resource's declared surface", async () => {
    const usersAdapterCalls: Record<string, unknown> = { id: "1", email: "a@b.co" };
    const adapter = mkAdapter(usersAdapterCalls, [
      { id: "p1", userId: "1", amount: 10, cardNumber: "4111111111111111" },
    ]);
    const seenByRender: string[][] = [];
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
        resource(
          { __name: "payments" },
          {
            columns: [
              "id",
              "userId",
              {
                field: "amount",
                render: (r: Record<string, unknown>) => {
                  seenByRender.push(Object.keys(r).sort());
                  return String(r.amount);
                },
              },
            ],
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

    // DetailTabsClient receives pre-rendered `content` per tab; walk into it.
    const dataTables = findAllElements(node, DataTable) as {
      rows: Record<string, unknown>[];
    }[];
    expect(dataTables).toHaveLength(1);
    expect(dataTables[0]?.rows).toEqual([{ id: "p1", userId: "1", amount: 10 }]);
    expect(dataTables[0]?.rows[0]).not.toHaveProperty("cardNumber");
    // A server-side render(row) sees the same projected row the client gets.
    expect(seenByRender).toEqual([["amount", "id", "userId"]]);
  });

  it("'resource' detail tab fails closed when the target has no scope under a global scope", async () => {
    const adapter = mkAdapter({ id: "1", email: "a@b.co" }, [
      { id: "p1", userId: "1", amount: 10 },
    ]);
    const config = defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      scope: () => ({ tenantId: "t1" }),
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "email"],
            scope: "bypass",
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

    expect(findAllElements(node, DataTable)).toHaveLength(0);
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
    expect(labels.sort()).toEqual(["Email", "ID"]);
    expect(labels).not.toContain("passwordHash");
    expect(labels).not.toContain("internalFlag");
  });

  it("omits the detail identifier when the configured rowKey is not readable", async () => {
    const adapter = mkAdapter({ id: "1", internalId: "private-1" }, []);
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "support-1" }), role: () => "support" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "internalId"],
            rowKey: "internalId",
            fieldAccess: { internalId: { read: "admin" } },
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

    expect(findAllElements(node, PageHeader)[0]?.title).toBe("users");
  });

  it("passes only declared, readable, and explicitly exposed fields to no-tabs column renderers", async () => {
    const seenRows: Record<string, unknown>[] = [];
    const adapter = mkAdapter(
      {
        id: "1",
        email: "a@b.co",
        computedLabel: "active customer",
        secret: "classified",
        adapterOnly: "never declared",
      },
      [],
    );
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "support-1" }), role: () => "support" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: [
              "id",
              {
                field: "email",
                render: (row: Record<string, unknown>) => {
                  seenRows.push(row);
                  return String(row.computedLabel);
                },
              },
              "secret",
            ],
            expose: ["computedLabel"],
            fieldAccess: { secret: { read: "admin" } },
          },
        ),
      ],
    });
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    await ResourceDetailPage({
      config,
      resource: resourceCfg,
      name: "users",
      id: "1",
      req: new Request("http://localhost/admin/users/1"),
    });

    expect(seenRows).toEqual([{ id: "1", email: "a@b.co", computedLabel: "active customer" }]);
  });

  it("passes only declared and readable fields to detail tab renderers", async () => {
    const seenRows: Record<string, unknown>[] = [];
    const adapter = mkAdapter(
      { id: "1", email: "a@b.co", secret: "classified", adapterOnly: "never declared" },
      [],
    );
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "support-1" }), role: () => "support" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "email", "secret"],
            fieldAccess: { secret: { read: "admin" } },
            detail: {
              tabs: [
                {
                  key: "overview",
                  label: "Overview",
                  render: (row: Record<string, unknown>) => {
                    seenRows.push(row);
                    return null;
                  },
                },
              ],
            },
          },
        ),
      ],
    });
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    await ResourceDetailPage({
      config,
      resource: resourceCfg,
      name: "users",
      id: "1",
      req: new Request("http://localhost/admin/users/1"),
    });

    expect(seenRows).toEqual([{ id: "1", email: "a@b.co" }]);
  });

  it("passes only declared, readable, and explicitly exposed fields to detail tab hidden callbacks", async () => {
    const seenRows: Record<string, unknown>[] = [];
    const adapter = mkAdapter(
      {
        id: "1",
        email: "a@b.co",
        computedLabel: "active customer",
        secret: "classified",
        adapterOnly: "never declared",
      },
      [],
    );
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "support-1" }), role: () => "support" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "email", "secret"],
            expose: ["computedLabel"],
            fieldAccess: { secret: { read: "admin" } },
            detail: {
              tabs: [
                {
                  key: "overview",
                  label: "Overview",
                  hidden: (row: Record<string, unknown>) => {
                    seenRows.push(row);
                    return true;
                  },
                },
              ],
            },
          },
        ),
      ],
    });
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    await ResourceDetailPage({
      config,
      resource: resourceCfg,
      name: "users",
      id: "1",
      req: new Request("http://localhost/admin/users/1"),
    });

    expect(seenRows).toEqual([{ id: "1", email: "a@b.co", computedLabel: "active customer" }]);
  });

  it("passes a projected expose field from a related tab filter to the adapter", async () => {
    const seenRows: Record<string, unknown>[] = [];
    let relatedFilters: Record<string, unknown> | undefined;
    const adapter: Adapter = {
      ...mkAdapter(
        {
          id: "1",
          email: "a@b.co",
          customerId: "customer-7",
          secret: "classified",
          adapterOnly: "never declared",
        },
        [],
      ),
      list: async (_ref, ctx) => {
        relatedFilters = ctx.filters;
        return { rows: [], total: 0, page: ctx.page, pageSize: ctx.pageSize };
      },
    };
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "support-1" }), role: () => "support" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "email", "secret"],
            expose: ["customerId"],
            fieldAccess: { secret: { read: "admin" } },
            detail: {
              tabs: [
                {
                  key: "payments",
                  label: "Payments",
                  resource: "payments",
                  filter: (row: Record<string, unknown>) => {
                    seenRows.push(row);
                    return { customerId: row.customerId };
                  },
                },
              ],
            },
          },
        ),
        resource({ __name: "payments" }, { columns: ["id", "customerId"] }),
      ],
    });
    const resourceCfg = config.resourcesByName.get("users");
    if (!resourceCfg) throw new Error("users resource not registered");

    await ResourceDetailPage({
      config,
      resource: resourceCfg,
      name: "users",
      id: "1",
      req: new Request("http://localhost/admin/users/1"),
    });

    expect(seenRows).toEqual([{ id: "1", email: "a@b.co", customerId: "customer-7" }]);
    expect(relatedFilters).toEqual({ customerId: "customer-7" });
  });
});
