import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(async () => {}),
  publishResource: vi.fn(async () => {}),
  bindPublisher: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { type AuditEvent, defineAdmin, resource } from "@flowpanel/core";
import Database from "better-sqlite3";
import { eq, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { handlers } from "../handlers";

const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan"),
  note: text("note"),
  apiKey: text("api_key"),
  tenantId: text("tenant_id").notNull(),
});

const sqlite = new Database(":memory:");
const audited: AuditEvent[] = [];
let role = "admin";

const admin = defineAdmin({
  adapter: drizzleAdapter({ db: drizzle(sqlite), schema: { customers }, dialect: "sqlite" }),
  auth: {
    session: async () => ({ id: "u1" }),
    role: () => role,
    access: ({ session }) => session !== null,
  },
  scope: async () => ({ tenantId: "A" }),
  audit: {
    sink: async (event: AuditEvent) => {
      audited.push(event);
    },
  },
  resources: [
    resource(customers, {
      columns: [{ field: "name", label: "Customer" }, "plan", "note", "apiKey"],
      filters: ["plan"],
      search: ["name"],
      defaultSort: { field: "name", dir: "asc" },
      fieldAccess: { note: { read: "admin" }, apiKey: { sensitive: true } },
      scope: (scope, query: { where(condition: SQL): unknown }) =>
        query.where(eq(customers.tenantId, (scope as { tenantId: string }).tenantId)),
      export: { formats: ["csv", "json"], maxRows: 3, access: ["admin", "support"] },
    }),
  ],
});

beforeAll(() => {
  sqlite.exec(
    "CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, plan TEXT, note TEXT, " +
      "api_key TEXT, tenant_id TEXT NOT NULL)",
  );
  sqlite.exec(
    "INSERT INTO customers VALUES " +
      "('1', 'Ann', 'pro', 'vip', 'k1', 'A'), ('2', '=HYPERLINK(\"x\")', 'free', NULL, 'k2', 'A'), " +
      "('3', 'Cy', 'pro', NULL, 'k3', 'A'), ('4', 'Dee', 'pro', NULL, 'k4', 'A'), " +
      "('5', 'Bob', 'pro', 'other tenant', 'k5', 'B')",
  );
});
afterAll(() => sqlite.close());

async function exported(query: string): Promise<Response> {
  return handlers(admin).GET(
    new Request(`http://localhost/api/flowpanel/export/customers?${query}`),
    {
      params: Promise.resolve({ route: ["export", "customers"] }),
    },
  );
}

describe("the server export", () => {
  it("streams every matching row the list would show, as the user may read it", async () => {
    role = "admin";
    const res = await exported("format=csv&f_plan=pro");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(
      /attachment; filename="customers-filtered-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    expect(await res.text()).toBe("Customer,Plan,Note\r\nAnn,pro,vip\r\nCy,pro,\r\nDee,pro,\r\n");
  });

  it("leaves out fields the role cannot read and defuses formulas", async () => {
    role = "support";
    const text = await (await exported("format=csv&q=HYPER")).text();
    expect(text).toBe(`Customer,Plan\r\n"'=HYPERLINK(""x"")",free\r\n`);
  });

  it("stops at maxRows and says so in the header and the file name", async () => {
    role = "admin";
    const res = await exported("format=json");
    expect(res.headers.get("x-flowpanel-export-capped")).toBe("3");
    expect(res.headers.get("content-disposition")).toContain("customers-all-first-3-");
    const rows = JSON.parse(await res.text()) as Array<Record<string, unknown>>;
    expect(rows.map((row) => row.name)).toEqual(['=HYPERLINK("x")', "Ann", "Cy"]);
    expect(Object.keys(rows[0] ?? {})).toEqual(["name", "plan", "note"]);
  });

  it("audits the export with the actor and refuses a format the resource does not offer", async () => {
    audited.length = 0;
    await exported("format=csv");
    expect(audited).toMatchObject([{ action: "customers.export", actorId: "u1" }]);
    expect(audited[0]).not.toHaveProperty("targetId");
    expect((await exported("format=xml")).headers.get("content-type")).toContain("text/csv");
  });
});

describe("export.access", () => {
  it("refuses a role it leaves out, though that role may read the list", async () => {
    role = "viewer";
    const before = audited.length;
    try {
      expect((await exported("format=csv")).status).toBe(403);
      expect(audited).toHaveLength(before);
    } finally {
      role = "admin";
    }
  });
});

describe("the server export across batches", () => {
  const events = sqliteTable("events", { id: text("id").primaryKey(), kind: text("kind") });
  const db = new Database(":memory:");
  const eventsAdmin = defineAdmin({
    adapter: drizzleAdapter({ db: drizzle(db), schema: { events }, dialect: "sqlite" }),
    auth: { session: async () => ({ id: "u1" }), role: () => "admin" },
    resources: [
      resource(events, { columns: ["id", "kind"], export: { formats: ["json"], maxRows: 5000 } }),
    ],
  });
  const ids = Array.from({ length: 1100 }, (_, i) => `e${String(i).padStart(4, "0")}`);

  beforeAll(() => {
    db.exec("CREATE TABLE events (id TEXT PRIMARY KEY, kind TEXT)");
    const insert = db.prepare("INSERT INTO events VALUES (?, ?)");
    for (const [n, id] of [...ids].reverse().entries()) insert.run(id, n % 2 === 0 ? "a" : "b");
  });
  afterAll(() => db.close());

  async function exported(query: string): Promise<Array<{ id: string; kind: string }>> {
    const res = await handlers(eventsAdmin).GET(
      new Request(`http://localhost/api/flowpanel/export/events?format=json&${query}`),
      { params: Promise.resolve({ route: ["export", "events"] }) },
    );
    return JSON.parse(await res.text()) as Array<{ id: string; kind: string }>;
  }

  it("keeps every row exactly once, ties broken by the primary key, across batches", async () => {
    const rows = await exported("sort=kind:asc");
    expect(rows.map((row) => row.kind)).toEqual([
      ...Array<string>(550).fill("a"),
      ...Array<string>(550).fill("b"),
    ]);
    const a = rows.slice(0, 550).map((row) => row.id);
    const b = rows.slice(550).map((row) => row.id);
    expect(a).toEqual([...a].sort());
    expect(b).toEqual([...b].sort());
    expect(new Set(rows.map((row) => row.id)).size).toBe(1100);
  });

  it("orders an unsorted export by the primary key", async () => {
    expect((await exported("")).map((row) => row.id)).toEqual(ids);
  });
});

describe("the server export of a composite-key table", () => {
  it("orders by every key column, and passes no tiebreak when no key column exists", async () => {
    const { primaryKey } = await import("drizzle-orm/sqlite-core");
    const members = sqliteTable(
      "members",
      { org: text("org").notNull(), user: text("user").notNull(), note: text("note") },
      (t) => [primaryKey({ columns: [t.org, t.user] })],
    );
    const db = new Database(":memory:");
    db.exec("CREATE TABLE members (org TEXT, user TEXT, note TEXT, PRIMARY KEY (org, user))");
    for (const [org, user] of [
      ["b", "2"],
      ["a", "2"],
      ["b", "1"],
      ["a", "1"],
    ]) {
      db.prepare("INSERT INTO members VALUES (?, ?, 'x')").run(org, user);
    }
    const adapter = drizzleAdapter({ db: drizzle(db), schema: { members }, dialect: "sqlite" });
    const listed = vi.spyOn(adapter, "list");
    const config = defineAdmin({
      adapter,
      auth: { session: async () => ({ id: "u1" }), role: () => "admin" },
      resources: [resource(members, { columns: ["org", "user"], export: { formats: ["csv"] } })],
    });
    const res = await handlers(config).GET(
      new Request("http://localhost/api/flowpanel/export/members?format=csv"),
      { params: Promise.resolve({ route: ["export", "members"] }) },
    );
    expect(await res.text()).toBe("Org,User\r\na,1\r\na,2\r\nb,1\r\nb,2\r\n");
    expect(listed.mock.calls[0]?.[1].tiebreak).toEqual(["org", "user"]);

    const noKey = defineAdmin({
      adapter: {
        ...adapter,
        introspect: () => {
          const { keyColumns: _composite, ...rest } = adapter.introspect(members);
          return { ...rest, primaryKey: "id" };
        },
      },
      auth: { session: async () => ({ id: "u1" }), role: () => "admin" },
      resources: [resource(members, { columns: ["org", "user"], export: { formats: ["csv"] } })],
    });
    listed.mockClear();
    await (
      await handlers(noKey).GET(
        new Request("http://localhost/api/flowpanel/export/members?format=csv"),
        { params: Promise.resolve({ route: ["export", "members"] }) },
      )
    ).text();
    expect(listed.mock.calls[0]?.[1].tiebreak).toEqual([]);
    db.close();
  });
});
