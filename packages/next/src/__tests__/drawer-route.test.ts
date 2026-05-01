import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { drawerActionRoute, drawerRoute } from "../drawer/drawer-route.js";

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

function mkConfig() {
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
            fields: "*",
            actions: [
              {
                key: "resend-welcome",
                label: "Resend welcome",
                variant: "default",
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
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0]?.key).toBe("resend-welcome");
    expect("run" in (body.actions[0] ?? {})).toBe(false);
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

  it("serializes fields, resource, and widgets-deferred tabs", async () => {
    const handler = drawerRoute(mkConfigWithTabs());
    const res = await handler(mkReq(), {
      params: Promise.resolve({ resource: "users", id: "abc" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tabs: (
        | { kind: "fields"; key: string; fields: unknown }
        | { kind: "resource"; key: string; rows: unknown[]; columns: string[] }
        | { kind: "widgets-deferred"; key: string }
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
    expect(body.tabs[2]).toMatchObject({ kind: "widgets-deferred", key: "activity" });
  });
});

describe("drawerActionRoute", () => {
  it("returns 501 — runner deferred to M3", async () => {
    const handler = drawerActionRoute(mkConfig());
    const res = await handler(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ resource: "users", id: "abc", action: "resend-welcome" }),
    });
    expect(res.status).toBe(501);
  });
});
