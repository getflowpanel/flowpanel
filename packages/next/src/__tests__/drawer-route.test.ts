import type { Adapter, ListQueryContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { drawerRoute } from "../drawer/drawer-route.js";

const fakeAdapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
  inferSchema: () =>
    ({ create: {} as never, update: {} as never, select: {} as never }) as ReturnType<
      Adapter["inferSchema"]
    >,
  list: async (_ref, ctx) => ({
    rows: [
      { id: "p1", userId: ctx.filters.userId, amount: 10 },
      { id: "p2", userId: ctx.filters.userId, amount: 20 },
    ],
    total: 2,
    page: 1,
    pageSize: 20,
  }),
  get: async (_ref, ctx) =>
    ctx.id === "missing" ? null : { id: ctx.id, email: "a@b.c", name: "Alice" },
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => {},
};

function mkConfig(role = "admin") {
  return defineAdmin({
    adapter: fakeAdapter,
    auth: { session: async () => null, role: () => role, requireRole: () => true },
    resources: [
      resource(
        { __name: "users" },
        {
          columns: ["id", "email"],
          drawer: {
            width: "lg",
            header: (row: unknown) => (row as { name: string }).name,
            fields: "*",
            actions: [
              {
                key: "resend-welcome",
                label: "Resend welcome",
                variant: "default",
                run: async () => ({ ok: true }),
              },
              {
                key: "delete-user",
                label: "Delete user",
                requireRole: "admin",
                run: async () => ({ ok: true }),
              },
            ],
          },
        },
      ),
      resource({ __name: "posts" }, { columns: ["id"] }),
    ],
  });
}

function mkReq(): Request {
  return new Request("http://localhost/api/flowpanel/drawer/users/abc");
}

describe("drawerRoute", () => {
  it("404 when resource is unknown", async () => {
    const handler = drawerRoute(mkConfig());
    const res = await handler(mkReq(), {
      params: Promise.resolve({ resource: "unknown", id: "abc" }),
    });
    expect(res.status).toBe(404);
  });

  it("names the requested resource and the registered ones in development", async () => {
    const handler = drawerRoute(mkConfig());
    const res = await handler(mkReq(), {
      params: Promise.resolve({ resource: "unknown", id: "abc" }),
    });
    expect((await res.json()).error).toBe(
      'resource not found: "unknown". Registered resources: "users", "posts".',
    );
  });

  it("stays terse in production", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const res = await drawerRoute(mkConfig())(mkReq(), {
        params: Promise.resolve({ resource: "unknown", id: "abc" }),
      });
      expect((await res.json()).error).toBe("resource not found");
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it("400 when resource has no drawer config", async () => {
    const handler = drawerRoute(mkConfig());
    const res = await handler(mkReq(), {
      params: Promise.resolve({ resource: "posts", id: "abc" }),
    });
    expect(res.status).toBe(400);
  });

  it("404 when the row is missing", async () => {
    const handler = drawerRoute(mkConfig());
    const res = await handler(mkReq(), {
      params: Promise.resolve({ resource: "users", id: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns a payload with serialized actions (no run function)", async () => {
    const handler = drawerRoute(mkConfig());
    const res = await handler(mkReq(), {
      params: Promise.resolve({ resource: "users", id: "abc" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      row: { id: string };
      header: string;
      width: string;
      fields: string;
      actions: { key: string; run?: unknown }[];
      tabs: unknown;
    };
    expect(body.row.id).toBe("abc");
    expect(body.header).toBe("Alice");
    expect(body.width).toBe("lg");
    expect(body.fields).toBe("*");
    expect(body.tabs).toBeNull();
    expect(body.actions).toHaveLength(2);
    expect(body.actions[0]?.key).toBe("resend-welcome");
    expect("run" in (body.actions[0] ?? {})).toBe(false);
  });

  it("does not advertise drawer actions the current operator cannot run", async () => {
    const res = await drawerRoute(mkConfig("support"))(mkReq(), {
      params: Promise.resolve({ resource: "users", id: "abc" }),
    });
    const body = (await res.json()) as { actions: { key: string }[] };

    expect(body.actions.map((action) => action.key)).toEqual(["resend-welcome"]);
  });

  it("ships the resource's display label, humanizing the registry name when none is set", async () => {
    const handler = drawerRoute(mkConfig());
    const res = await handler(mkReq(), {
      params: Promise.resolve({ resource: "users", id: "abc" }),
    });
    const body = (await res.json()) as { resourceLabel: string };
    expect(body.resourceLabel).toBe("Users");
  });

  it("prefers the resource's configured label over the registry name", async () => {
    const config = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "users" },
          { label: "Customer", columns: ["id"], drawer: { fields: "*" } },
        ),
      ],
    });
    const res = await drawerRoute(config)(mkReq(), {
      params: Promise.resolve({ resource: "users", id: "abc" }),
    });
    const body = (await res.json()) as { resourceLabel: string };
    expect(body.resourceLabel).toBe("Customer");
  });

  it("projects payload.row to the declared surface — an undeclared column never reaches the wire", async () => {
    // `fakeAdapter.get` returns `name` (used only server-side by
    // `drawer.header`) in addition to `id`/`email`. `columns: ["id",
    // "email"]` is the only declaration on this resource — `name` must not
    // survive into the JSON body even though `drawer.fields` is "*".
    const handler = drawerRoute(mkConfig());
    const res = await handler(mkReq(), {
      params: Promise.resolve({ resource: "users", id: "abc" }),
    });
    const body = (await res.json()) as { row: Record<string, unknown>; header: string };
    expect(body.row).toEqual({ id: "abc", email: "a@b.c" });
    expect(body.row).not.toHaveProperty("name");
    // The header is still computed server-side from the FULL row — only the
    // wire payload is projected.
    expect(body.header).toBe("Alice");
  });

  it("ships column formats so a drawer row reads like its table cell", async () => {
    const config = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: [
              { field: "id" },
              { field: "email", label: "Email" },
              { field: "amount", format: { kind: "money", currency: "EUR", scale: 100 } },
              { field: "name", render: (r: unknown) => (r as { name: string }).name },
            ],
            drawer: { fields: "*" },
          },
        ),
      ],
    });
    const res = await drawerRoute(config)(mkReq(), {
      params: Promise.resolve({ resource: "users", id: "abc" }),
    });
    const body = (await res.json()) as {
      formats: Record<string, unknown>;
      labels: Record<string, string>;
      prerendered: Record<string, string>;
    };
    expect(body.formats).toEqual({ amount: { kind: "money", currency: "EUR", scale: 100 } });
    expect(body.labels).toEqual({ email: "Email" });
    // `render` still wins — it is prerendered server-side, formats are data.
    expect(body.prerendered.name).toBe("Alice");
    expect(body.formats).not.toHaveProperty("name");
  });
});

describe("drawerRoute (tabs)", () => {
  function mkConfigWithTabs() {
    return defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "email"],
            drawer: {
              width: "lg",
              header: (row: unknown) => (row as { name: string }).name,
              fields: ["id", "email"],
              tabs: [
                { key: "profile", label: "Profile", fields: "*" },
                {
                  key: "payments",
                  label: "Payments",
                  resource: "payments",
                  filter: (row: unknown) => ({ userId: (row as { id: string }).id }),
                },
                { key: "activity", label: "Activity", widgets: [] },
              ],
            },
          },
        ),
        resource({ __name: "payments" }, { columns: ["id", "userId", "amount"] }),
      ],
    });
  }

  it("serializes fields, resource, and widgets tabs", async () => {
    const handler = drawerRoute(mkConfigWithTabs());
    const res = await handler(mkReq(), {
      params: Promise.resolve({ resource: "users", id: "abc" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tabs: (
        | { kind: "fields"; key: string; fields: unknown }
        | { kind: "resource"; key: string; rows: unknown[]; columns: string[] }
        | { kind: "widgets"; key: string; widgets: unknown[] }
      )[];
    };
    expect(body.tabs).toHaveLength(3);
    expect(body.tabs[0]).toMatchObject({ kind: "fields", key: "profile", fields: "*" });
    const payments = body.tabs[1] as {
      kind: "resource";
      rows: { userId: string }[];
      columns: string[];
    };
    expect(payments.kind).toBe("resource");
    expect(payments.rows).toHaveLength(2);
    // filter(row).userId was threaded through adapter.list.
    expect(payments.rows[0]?.userId).toBe("abc");
    expect(payments.columns).toEqual(["id", "userId", "amount"]);
    expect(body.tabs[2]).toMatchObject({ kind: "widgets", key: "activity", widgets: [] });
  });

  it("projects a 'resource' tab's related rows to the TARGET resource's declared surface", async () => {
    // The related resource's own adapter row carries `cardNumber`, which
    // `payments` never declares as a column — it must not reach the wire
    // just because the "resource" tab embeds a whole related list.
    const adapterWithUndeclaredField: Adapter = {
      kind: "drizzle",
      db: {},
      introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
      inferSchema: () =>
        ({ create: {} as never, update: {} as never, select: {} as never }) as ReturnType<
          Adapter["inferSchema"]
        >,
      list: async (_ref, ctx) => ({
        rows: [
          { id: "p1", userId: ctx.filters.userId, amount: 10, cardNumber: "4111111111111111" },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
      get: async (_ref, ctx) => ({ id: ctx.id, email: "a@b.c", name: "Alice" }),
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => undefined,
    };
    const config = defineAdmin({
      adapter: adapterWithUndeclaredField,
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "users" },
          {
            columns: ["id", "email"],
            drawer: {
              tabs: [
                {
                  key: "payments",
                  label: "Payments",
                  resource: "payments",
                  filter: (row: unknown) => ({ userId: (row as { id: string }).id }),
                },
              ],
            },
          },
        ),
        resource({ __name: "payments" }, { columns: ["id", "userId", "amount"] }),
      ],
    });
    const handler = drawerRoute(config);
    const res = await handler(mkReq(), {
      params: Promise.resolve({ resource: "users", id: "abc" }),
    });
    const body = (await res.json()) as {
      tabs: { kind: "resource"; rows: Record<string, unknown>[] }[];
    };
    expect(body.tabs[0]?.rows).toEqual([{ id: "p1", userId: "abc", amount: 10 }]);
    expect(body.tabs[0]?.rows[0]).not.toHaveProperty("cardNumber");
  });
});

describe("drawerRoute (tabs) — cross-resource authorization", () => {
  function mkConfigWith(opts: {
    role?: string;
    targetRequireRole?: string;
    targetScope?: unknown;
    globalScope?: boolean;
    widgetTab?: boolean;
    list?: Adapter["list"];
  }) {
    const list =
      opts.list ??
      (async () => ({
        rows: [{ id: "p1", userId: "abc", amount: 10, cardNumber: "4111111111111111" }],
        total: 1,
        page: 1,
        pageSize: 20,
      }));
    const tab = opts.widgetTab
      ? {
          key: "activity",
          label: "Activity",
          widgets: [{ kind: "table", options: { resource: "payments" } }],
        }
      : {
          key: "payments",
          label: "Payments",
          resource: "payments",
          filter: (row: unknown) => ({ userId: (row as { id: string }).id }),
        };
    return defineAdmin({
      adapter: { ...fakeAdapter, list },
      auth: { session: async () => null, role: () => opts.role ?? "admin" },
      ...(opts.globalScope ? { scope: () => ({ tenantId: "t1" }) } : {}),
      resources: [
        resource({ __name: "users" }, {
          columns: ["id", "email"],
          ...(opts.globalScope ? { scope: "bypass" } : {}),
          drawer: { tabs: [tab] },
        } as never),
        resource({ __name: "payments" }, {
          columns: ["id", "userId", "amount"],
          ...(opts.targetRequireRole ? { requireRole: opts.targetRequireRole } : {}),
          ...(opts.targetScope ? { scope: opts.targetScope } : {}),
        } as never),
      ],
    });
  }

  async function tabsOf(config: ReturnType<typeof mkConfigWith>) {
    const res = await drawerRoute(config)(mkReq(), {
      params: Promise.resolve({ resource: "users", id: "abc" }),
    });
    const body = (await res.json()) as {
      tabs: {
        kind: string;
        rows?: Record<string, unknown>[];
        columns?: string[];
        widgets?: { kind: string; rows?: Record<string, unknown>[] }[];
      }[];
    };
    return body.tabs;
  }

  it("a 'resource' tab does not read a role-gated target the viewer cannot access", async () => {
    const list = vi.fn(async (_ref: unknown, _ctx: ListQueryContext<unknown>) => ({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 20,
    }));
    const tabs = await tabsOf(
      mkConfigWith({ role: "staff", targetRequireRole: "superadmin", list }),
    );
    expect(tabs[0]).toMatchObject({ kind: "resource", rows: [], columns: [] });
    expect(list).not.toHaveBeenCalled();
  });

  it("a 'resource' tab does not read a target that declares no scope while global scope is active", async () => {
    const list = vi.fn(async (_ref: unknown, _ctx: ListQueryContext<unknown>) => ({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 20,
    }));
    const tabs = await tabsOf(mkConfigWith({ globalScope: true, list }));
    expect(tabs[0]).toMatchObject({ kind: "resource", rows: [], columns: [] });
    expect(list).not.toHaveBeenCalled();
  });

  it("a 'resource' tab binds the target's scope predicate to the request's scope value", async () => {
    const scopeCalls: unknown[][] = [];
    const list = vi.fn(async (_ref: unknown, _ctx: ListQueryContext<unknown>) => ({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 20,
    }));
    await tabsOf(
      mkConfigWith({
        globalScope: true,
        list,
        targetScope: (scope: unknown, query: unknown) => {
          scopeCalls.push([scope, query]);
          return query;
        },
      }),
    );
    const listCtx = list.mock.calls[0]?.[1] as {
      applyScope?: (q: unknown) => unknown;
      scopeRequired?: boolean;
    };
    expect(listCtx.scopeRequired).toBe(true);
    listCtx.applyScope?.("q");
    expect(scopeCalls).toEqual([[{ tenantId: "t1" }, "q"]]);
  });

  it("a widget tab's table does not read a role-gated target the viewer cannot access", async () => {
    const list = vi.fn(async (_ref: unknown, _ctx: ListQueryContext<unknown>) => ({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 20,
    }));
    const tabs = await tabsOf(
      mkConfigWith({ role: "staff", targetRequireRole: "superadmin", widgetTab: true, list }),
    );
    expect(tabs[0]?.widgets?.[0]).toMatchObject({ kind: "table", rows: [] });
    expect(list).not.toHaveBeenCalled();
  });

  it("a widget tab's table does not read a target that declares no scope while global scope is active", async () => {
    const list = vi.fn(async (_ref: unknown, _ctx: ListQueryContext<unknown>) => ({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 20,
    }));
    const tabs = await tabsOf(mkConfigWith({ globalScope: true, widgetTab: true, list }));
    expect(tabs[0]?.widgets?.[0]).toMatchObject({ kind: "table", rows: [] });
    expect(list).not.toHaveBeenCalled();
  });

  it("a widget tab's table ships only the target's declared columns", async () => {
    const tabs = await tabsOf(mkConfigWith({ widgetTab: true }));
    expect(tabs[0]?.widgets?.[0]?.rows).toEqual([{ id: "p1", userId: "abc", amount: 10 }]);
  });
});
