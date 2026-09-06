import type { Adapter, ItemQueryContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { DetailTabsClient } from "@flowpanel/next/client";
import { DataTable, KVRow, PageHeader } from "@flowpanel/react";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
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
  it("loads base dependencies then only the active tab fields with scoped, readable selects", async () => {
    const queries: ItemQueryContext[] = [];
    const rendered: Record<string, unknown>[] = [];
    let statusPolicyCalls = 0;
    const adapter: Adapter = {
      ...mkAdapter(
        {
          id: "1",
          email: "a@b.co",
          status: "active",
          overviewOnly: "overview",
          activityOnly: "activity",
          token: "never selected or serialized",
        },
        [],
      ),
      introspect: () => ({
        name: "users",
        primaryKey: "id",
        columns: ["id", "email", "status", "overviewOnly", "activityOnly", "token"].map((name) => ({
          name,
          type: "string" as const,
          nullable: false,
          unique: false,
          primaryKey: name === "id",
        })),
      }),
      get: async (_ref, ctx) => {
        queries.push(ctx);
        return {
          id: "1",
          email: "a@b.co",
          status: "active",
          overviewOnly: "overview",
          activityOnly: "activity",
          token: "never selected or serialized",
        };
      },
    };
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "operator" }), role: () => "operator" },
      scope: () => ({ tenantId: "tenant-1" }),
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "email"],
            scope: () => ({ tenantId: "tenant-1" }),
            fieldAccess: {
              status: {
                read: () => {
                  statusPolicyCalls += 1;
                  return true;
                },
              },
              token: { sensitive: true },
            },
            detail: {
              expose: ["status"],
              tabs: [
                {
                  key: "overview",
                  label: "Overview",
                  hidden: (row: Record<string, unknown>) => row.status !== "active",
                  fields: ["overviewOnly"],
                  render: (row: Record<string, unknown>) => {
                    rendered.push(row);
                    return null;
                  },
                },
                { key: "activity", label: "Activity", fields: ["activityOnly"] },
              ],
            },
          },
        ),
      ],
    });

    await ResourceDetailPage({
      config,
      resource: config.resourcesByName.get("users")!,
      name: "users",
      id: "1",
      req: new Request("http://localhost/admin/users/1?tab=overview"),
    });

    expect(queries).toHaveLength(2);
    expect(queries.map((query) => query.select)).toEqual([
      ["id", "email", "status"],
      ["id", "email", "status", "overviewOnly"],
    ]);
    expect(queries.every((query) => query.boundScope !== undefined)).toBe(true);
    expect(queries.flatMap((query) => query.select ?? [])).not.toContain("activityOnly");
    expect(queries.flatMap((query) => query.select ?? [])).not.toContain("token");
    expect(statusPolicyCalls).toBe(1);
    expect(rendered).toEqual([
      { id: "1", email: "a@b.co", status: "active", overviewOnly: "overview" },
    ]);
  });

  it("chooses the default tab for an unknown key without loading inactive fields", async () => {
    const queries: ItemQueryContext[] = [];
    const config = defineAdmin({
      adapter: {
        ...mkAdapter(
          { id: "1", email: "a@b.co", overviewOnly: "overview", activityOnly: "activity" },
          [],
        ),
        introspect: () => ({
          name: "users",
          primaryKey: "id",
          columns: ["id", "email", "overviewOnly", "activityOnly"].map((name) => ({
            name,
            type: "string" as const,
            nullable: false,
            unique: false,
            primaryKey: name === "id",
          })),
        }),
        get: async (_ref, ctx) => {
          queries.push(ctx);
          return { id: "1", email: "a@b.co", overviewOnly: "overview", activityOnly: "activity" };
        },
      },
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "email"],
            detail: {
              tabs: [
                { key: "overview", label: "Overview", fields: ["overviewOnly"] },
                { key: "activity", label: "Activity", fields: ["activityOnly"] },
              ],
            },
          },
        ),
      ],
    });

    await ResourceDetailPage({
      config,
      resource: config.resourcesByName.get("users")!,
      name: "users",
      id: "1",
      req: new Request("http://localhost/admin/users/1?tab=missing"),
    });

    expect(queries).toHaveLength(1);
    expect(queries[0]?.select).toEqual(["id", "email", "overviewOnly"]);
    expect(queries[0]?.select).not.toContain("activityOnly");
  });

  it.each([
    { query: "?tab=overview", label: "a requested unconditional tab" },
    { query: "?tab=missing", label: "the first unconditional tab for an unknown key" },
  ])("loads active fields in one read for $label despite other hidden predicates", async ({
    query,
  }) => {
    const queries: ItemQueryContext[] = [];
    const config = defineAdmin({
      adapter: {
        ...mkAdapter(
          { id: "1", email: "a@b.co", overviewOnly: "overview", guardedOnly: "guarded" },
          [],
        ),
        introspect: () => ({
          name: "users",
          primaryKey: "id",
          columns: ["id", "email", "overviewOnly", "guardedOnly"].map((name) => ({
            name,
            type: "string" as const,
            nullable: false,
            unique: false,
            primaryKey: name === "id",
          })),
        }),
        get: async (_ref, ctx) => {
          queries.push(ctx);
          return { id: "1", email: "a@b.co", overviewOnly: "overview", guardedOnly: "guarded" };
        },
      },
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "email"],
            detail: {
              tabs: [
                { key: "overview", label: "Overview", fields: ["overviewOnly"] },
                {
                  key: "guarded",
                  label: "Guarded",
                  hidden: () => true,
                  fields: ["guardedOnly"],
                },
              ],
            },
          },
        ),
      ],
    });

    await ResourceDetailPage({
      config,
      resource: config.resourcesByName.get("users")!,
      name: "users",
      id: "1",
      req: new Request(`http://localhost/admin/users/1${query}`),
    });

    expect(queries).toHaveLength(1);
    expect(queries[0]?.select).toEqual(["id", "email", "overviewOnly"]);
    expect(queries[0]?.select).not.toContain("guardedOnly");
  });

  it("uses the configured heading with only authorized row fields", async () => {
    const seenRows: Record<string, unknown>[] = [];
    const config = defineAdmin({
      adapter: mkAdapter({ id: "1", name: "Ada", secret: "private", adapterOnly: "hidden" }, []),
      auth: { session: async () => ({ id: "support" }), role: () => "support" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "name", "secret"],
            fieldAccess: { secret: { read: "admin" } },
            detail: {
              header: (row: Record<string, unknown>) => {
                seenRows.push(row);
                return createElement("span", null, String(row.name));
              },
            },
          },
        ),
      ],
    });
    const node = await ResourceDetailPage({
      config,
      resource: config.resourcesByName.get("users")!,
      name: "users",
      id: "1",
      req: new Request("http://localhost/admin/users/1"),
    });
    expect(seenRows).toEqual([{ id: "1", name: "Ada" }]);
    const title = findAllElements(node, PageHeader)[0]?.title as ReactElement<{ children: string }>;
    expect(isValidElement(title)).toBe(true);
    expect(title.props.children).toBe("Ada");
  });

  it.each([
    { update: false, disabled: false, shown: false },
    { update: async () => false, disabled: false, shown: false },
    { update: "admin", disabled: false, shown: false },
    { update: async () => true, disabled: false, shown: true },
    { update: true, disabled: true, shown: false },
  ])("gates the edit action with update access and disabled: $shown", async ({
    update,
    disabled,
    shown,
  }) => {
    const config = defineAdmin({
      adapter: mkAdapter({ id: "1" }, []),
      auth: { session: async () => ({ id: "support" }), role: () => "support" },
      labels: { actions: { edit: "Редактировать" } },
      resources: [
        resource(
          { __name: "users" },
          { columns: ["id"], access: { read: true, update }, update: { disabled } },
        ),
      ],
    });
    const node = await ResourceDetailPage({
      config,
      resource: config.resourcesByName.get("users")!,
      name: "users",
      id: "1",
      req: new Request("http://localhost/admin/users/1"),
    });
    const actions = findAllElements(node, PageHeader)[0]?.actions as ReactNode;
    const links = findAllElements(actions, "a");
    expect(links).toHaveLength(shown ? 1 : 0);
    if (shown) {
      expect(links[0]?.children).toBe("Редактировать");
      expect(links[0]?.href).toBe("/admin/users/1/edit");
    }
  });

  it.each([
    undefined,
    "activity",
    "missing",
    "hidden",
  ])("renders only the active visible tab for ?tab=%s", async (tab) => {
    const rendered: string[] = [];
    const config = defineAdmin({
      adapter: mkAdapter({ id: "1", email: "user@example.com" }, []),
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "email"],
            detail: {
              tabs: [
                {
                  key: "overview",
                  label: "Overview",
                  render: () => {
                    rendered.push("overview");
                    return null;
                  },
                },
                {
                  key: "activity",
                  label: "Activity",
                  render: () => {
                    rendered.push("activity");
                    return null;
                  },
                },
                {
                  key: "hidden",
                  label: "Hidden",
                  hidden: () => true,
                  render: () => {
                    throw new Error("private tab executed");
                  },
                },
              ],
            },
          },
        ),
      ],
    });
    await ResourceDetailPage({
      config,
      resource: config.resourcesByName.get("users")!,
      name: "users",
      id: "1",
      req: new Request(`http://localhost/admin/users/1${tab ? `?tab=${tab}` : ""}`),
    });
    expect(rendered).toEqual([tab === "activity" ? "activity" : "overview"]);
  });

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
