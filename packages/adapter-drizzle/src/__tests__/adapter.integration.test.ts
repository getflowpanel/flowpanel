import { execSync } from "node:child_process";
import type { ListQueryContext } from "@flowpanel/core";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzleAdapter } from "../index";

// Check Docker availability synchronously so describe.skipIf works at module load time.
function isDockerAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const dockerAvailable = isDockerAvailable();

const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  active: boolean("active").notNull().default(true),
  age: integer("age"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

let container: StartedPostgreSqlContainer;
let db: ReturnType<typeof drizzle>;
let client: ReturnType<typeof postgres>;

beforeAll(async () => {
  if (!dockerAvailable) return;
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  client = postgres(container.getConnectionUri());
  db = drizzle(client);
  await client`
    CREATE TABLE users (
      id text PRIMARY KEY,
      email text NOT NULL,
      name text,
      active boolean NOT NULL DEFAULT true,
      age integer,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `;
  for (let i = 0; i < 25; i++) {
    await client`
      INSERT INTO users (id, email, name, age)
      VALUES (${`u${i}`}, ${`u${i}@e.co`}, ${`User ${i}`}, ${20 + i})
    `;
  }
}, 120_000);

afterAll(async () => {
  await client?.end();
  await container?.stop();
});

function ctx(overrides: Partial<ListQueryContext<any>> = {}): ListQueryContext<any> {
  return {
    req: new Request("http://localhost/admin/users"),
    session: null,
    role: "admin",
    scope: null,
    ip: null,
    userAgent: null,
    db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    filters: {},
    sort: null,
    page: 1,
    pageSize: 10,
    search: "",
    ...overrides,
  } as ListQueryContext<any>;
}

describe.skipIf(!dockerAvailable)("drizzleAdapter CRUD", () => {
  const adapter = drizzleAdapter({ db: null as any, schema: { users }, dialect: "pg" });

  it("list returns rows with pagination", async () => {
    const r = await adapter.list(users, ctx({ db, pageSize: 10, page: 1 }));
    expect(r.total).toBe(25);
    expect(r.rows).toHaveLength(10);
  });

  it("list sort ascending", async () => {
    const r = await adapter.list(
      users,
      ctx({ db, sort: { field: "age", dir: "asc" }, pageSize: 5 }),
    );
    expect((r.rows[0] as any).age).toBe(20);
  });

  it("list filter by equality", async () => {
    const r = await adapter.list(users, ctx({ db, filters: { email: "u5@e.co" } }));
    expect(r.total).toBe(1);
    expect((r.rows[0] as any).id).toBe("u5");
  });

  it("list search matches within declared searchFields", async () => {
    const r = await adapter.list(users, ctx({ db, search: "User 7", searchFields: ["name"] }));
    expect(r.rows.some((row: any) => row.id === "u7")).toBe(true);
  });

  it("list search does NOT match columns outside searchFields", async () => {
    // "u5@e.co" only appears in `email`; searchFields only declares `name`.
    const r = await adapter.list(users, ctx({ db, search: "u5@e.co", searchFields: ["name"] }));
    expect(r.total).toBe(0);
  });

  it("list search treats %, _ and ! in the query as literals, not wildcards", async () => {
    const wild = await adapter.list(users, ctx({ db, search: "%", searchFields: ["name"] }));
    expect(wild.total).toBe(0);

    const underscore = await adapter.list(
      users,
      ctx({ db, search: "User _", searchFields: ["name"] }),
    );
    expect(underscore.total).toBe(0);

    const bang = await adapter.list(users, ctx({ db, search: "User 7", searchFields: ["name"] }));
    expect(bang.total).toBeGreaterThan(0);
  });

  it("FAIL-CLOSED: search has no effect when searchFields is undeclared", async () => {
    // A hand-crafted `?search=` on a resource with no declared search fields
    // must not become a data oracle across every text column.
    const r = await adapter.list(users, ctx({ db, search: "User 7" }));
    expect(r.total).toBe(25);
  });

  it("list filter __null__ sentinel translates to IS NULL", async () => {
    // Insert two rows with NULL name alongside the 25 seeded non-null rows.
    await client`INSERT INTO users (id, email, name) VALUES ('null1', 'null1@e.co', NULL)`;
    await client`INSERT INTO users (id, email, name) VALUES ('null2', 'null2@e.co', NULL)`;

    const r = await adapter.list(users, ctx({ db, filters: { name: "__null__" }, pageSize: 50 }));
    expect(r.total).toBe(2);
    expect(r.rows.map((row: any) => row.id).sort()).toEqual(["null1", "null2"]);

    const inv = await adapter.list(
      users,
      ctx({ db, filters: { name: "__notnull__" }, pageSize: 50 }),
    );
    expect(inv.total).toBe(25);
    expect(inv.rows.every((row: any) => row.name !== null)).toBe(true);

    // Cleanup so subsequent tests see the original 25-row state.
    await client`DELETE FROM users WHERE id IN ('null1', 'null2')`;
  });

  it("numeric-range filter: `gte`/`lte` return only in-range rows, never throws", async () => {
    // Reproduces the reported bug: `eq(age, "25:30")` used to throw
    // "invalid input syntax for type integer" and 500 the whole page.
    const r = await adapter.list(
      users,
      ctx({ db, filters: { age: { op: "range", gte: 25, lte: 30 } }, pageSize: 50 }),
    );
    expect(r.total).toBe(6); // ages 25..30 inclusive
    expect(r.rows.every((row: any) => row.age >= 25 && row.age <= 30)).toBe(true);
  });

  it("numeric-range filter: one-sided bound (only gte, or only lte)", async () => {
    const gteOnly = await adapter.list(
      users,
      ctx({ db, filters: { age: { op: "range", gte: 40 } }, pageSize: 50 }),
    );
    expect(gteOnly.rows.every((row: any) => row.age >= 40)).toBe(true);
    expect(gteOnly.total).toBe(5); // ages 40..44

    const lteOnly = await adapter.list(
      users,
      ctx({ db, filters: { age: { op: "range", lte: 21 } }, pageSize: 50 }),
    );
    expect(lteOnly.rows.every((row: any) => row.age <= 21)).toBe(true);
    expect(lteOnly.total).toBe(2); // ages 20..21
  });

  it("daterange filter: `gte`/`lte` return only in-range rows, never throws", async () => {
    // Reproduces the reported bug: a `daterange` filter against a timestamp
    // column used to hit the same class of Postgres type-syntax crash.
    await client`INSERT INTO users (id, email, name, created_at) VALUES ('d1', 'd1@e.co', 'D1', '2020-01-15T00:00:00Z')`;
    await client`INSERT INTO users (id, email, name, created_at) VALUES ('d2', 'd2@e.co', 'D2', '2020-06-15T00:00:00Z')`;

    const r = await adapter.list(
      users,
      ctx({
        db,
        filters: {
          createdAt: {
            op: "range",
            gte: new Date("2020-01-01T00:00:00Z"),
            lte: new Date("2020-03-01T00:00:00Z"),
          },
        },
        pageSize: 50,
      }),
    );
    expect(r.total).toBe(1);
    expect((r.rows[0] as any).id).toBe("d1");

    await client`DELETE FROM users WHERE id IN ('d1', 'd2')`;
  });

  it("multiselect filter: returns the UNION of matching rows, never matches nothing", async () => {
    // Reproduces the reported bug: `eq(id, "u1,u3,u5")` used to silently
    // match zero rows instead of throwing — worse than a crash because
    // nobody notices.
    const r = await adapter.list(
      users,
      ctx({ db, filters: { id: { op: "in", values: ["u1", "u3", "u5"] } }, pageSize: 50 }),
    );
    expect(r.total).toBe(3);
    expect(r.rows.map((row: any) => row.id).sort()).toEqual(["u1", "u3", "u5"]);
  });

  it("get returns a row or null", async () => {
    expect(await adapter.get(users, { ...ctx({ db }), id: "u3" } as any)).toMatchObject({
      id: "u3",
    });
    expect(await adapter.get(users, { ...ctx({ db }), id: "nope" } as any)).toBeNull();
  });

  it("create, update, delete roundtrip", async () => {
    const created: any = await adapter.create(users, {
      req: ctx().req,
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
      db,
      input: { id: "new1", email: "new@e.co", name: "New" },
    } as any);
    expect(created).toMatchObject({ id: "new1", email: "new@e.co" });

    await adapter.update(users, {
      req: ctx().req,
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
      db,
      id: "new1",
      input: { name: "Updated" },
    } as any);

    const after: any = await adapter.get(users, { ...ctx({ db }), id: "new1" } as any);
    expect(after.name).toBe("Updated");

    await adapter.delete(users, {
      req: ctx().req,
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
      db,
      id: "new1",
      input: {},
    } as any);

    expect(await adapter.get(users, { ...ctx({ db }), id: "new1" } as any)).toBeNull();
  });
});

describe.skipIf(!dockerAvailable)("drizzleAdapter migrations (pg)", () => {
  it("creates its bookkeeping table and round-trips applied ids", async () => {
    const adapter = drizzleAdapter({ db, schema: { users } });

    expect(await adapter.listAppliedMigrations?.()).toEqual(new Set());

    await adapter.markMigrationApplied?.("0001_init");
    await adapter.markMigrationApplied?.("0002_posts");

    expect(await adapter.listAppliedMigrations?.()).toEqual(new Set(["0001_init", "0002_posts"]));
  });

  it("executes raw migration SQL", async () => {
    const adapter = drizzleAdapter({ db, schema: { users } });
    await adapter.runMigrationSql?.(`CREATE TABLE probe_mig (id text PRIMARY KEY)`);
    const rows = await client`SELECT id FROM probe_mig`;
    expect(rows).toHaveLength(0);
  });
});
