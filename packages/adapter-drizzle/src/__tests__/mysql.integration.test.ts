import { execSync } from "node:child_process";
import type { ListQueryContext, MutationContext } from "@flowpanel/core";
import { FlowpanelAccessError } from "@flowpanel/core";
import { MySqlContainer, type StartedMySqlContainer } from "@testcontainers/mysql";
import { eq } from "drizzle-orm";
import { boolean, int, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import * as mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzleAdapter } from "../index";

// Check Docker availability synchronously so describe.skipIf works at module load time
function isDockerAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const dockerAvailable = isDockerAvailable();

const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  active: boolean("active").notNull().default(true),
  age: int("age"),
});

// Regression fixture: an auto-increment PK, so `create` without an explicit
// id reaches the "no RETURNING" guard instead of failing the INSERT itself
// (unlike `users.id`, which has no server-side default at all).
const autoPosts = mysqlTable("auto_posts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
});

// Tenant-scoped fixture for the create-scope-transaction tests below.
const items = mysqlTable("items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  companyId: varchar("company_id", { length: 36 }).notNull(),
});

let container: StartedMySqlContainer;
let db: MySql2Database;
let pool: mysql.Pool;

beforeAll(async () => {
  if (!dockerAvailable) return;
  container = await new MySqlContainer("mysql:8").start();
  pool = mysql.createPool(container.getConnectionUri());
  db = drizzle(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      age INT
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auto_posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      company_id VARCHAR(36) NOT NULL
    )
  `);
  for (let i = 0; i < 25; i++) {
    await pool.query("INSERT INTO users (id, email, name, age) VALUES (?, ?, ?, ?)", [
      `u${i}`,
      `u${i}@e.co`,
      `User ${i}`,
      20 + i,
    ]);
  }
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe.skipIf(!dockerAvailable)("drizzleAdapter MySQL CRUD", () => {
  const adapter = drizzleAdapter({ db: null as any, schema: { users }, dialect: "mysql" });

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

  it("list returns rows with pagination", async () => {
    const r = await adapter.list(users, ctx({ db, pageSize: 10, page: 1 }));
    expect(r.total).toBe(25);
    expect(r.rows).toHaveLength(10);
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

  it("FAIL-CLOSED: search has no effect when searchFields is undeclared", async () => {
    const r = await adapter.list(users, ctx({ db, search: "User 7" }));
    expect(r.total).toBe(25);
  });

  it("create still requires an explicit primary key on mysql (no RETURNING)", async () => {
    // `autoPosts.id` has a server-side default (AUTO_INCREMENT) — the INSERT
    // itself succeeds, so this exercises our own read-back guard rather than
    // a NOT NULL violation from the database.
    const autoAdapter = drizzleAdapter({
      db: null as any,
      schema: { autoPosts },
      dialect: "mysql",
    });
    await expect(
      autoAdapter.create(autoPosts, {
        req: ctx().req,
        session: null,
        role: "admin",
        scope: null,
        ip: null,
        userAgent: null,
        db,
        input: { title: "No explicit id" },
      } as any),
    ).rejects.toThrow(/explicit primary key/);
  });

  it("list sort ascending", async () => {
    const r = await adapter.list(
      users,
      ctx({ db, sort: { field: "age", dir: "asc" }, pageSize: 5 }),
    );
    expect((r.rows[0] as any).age).toBe(20);
  });

  it("list sort descending", async () => {
    const r = await adapter.list(
      users,
      ctx({ db, sort: { field: "age", dir: "desc" }, pageSize: 5 }),
    );
    expect((r.rows[0] as any).age).toBe(44);
  });

  it("get returns a row or null", async () => {
    expect(await adapter.get(users, { ...ctx({ db }), id: "u3" } as any)).toMatchObject({
      id: "u3",
    });
    expect(await adapter.get(users, { ...ctx({ db }), id: "nope" } as any)).toBeNull();
  });

  it("create inserts and returns the row (non-RETURNING branch)", async () => {
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
  });

  it("update modifies and returns updated row", async () => {
    // Ensure row exists
    await adapter.create(users, {
      req: ctx().req,
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
      db,
      input: { id: "upd1", email: "upd@e.co", name: "Before" },
    } as any);

    const updated: any = await adapter.update(users, {
      req: ctx().req,
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
      db,
      id: "upd1",
      input: { name: "After" },
    } as any);
    expect(updated).toMatchObject({ id: "upd1", name: "After", active: true });
  });

  it("delete removes row", async () => {
    await adapter.create(users, {
      req: ctx().req,
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
      db,
      input: { id: "del1", email: "del@e.co", name: "ToDelete" },
    } as any);

    await adapter.delete(users, {
      req: ctx().req,
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
      db,
      id: "del1",
      input: {},
    } as any);

    expect(await adapter.get(users, { ...ctx({ db }), id: "del1" } as any)).toBeNull();
  });
});

describe.skipIf(!dockerAvailable)(
  "drizzleAdapter create scope — real transaction rollback (mysql)",
  () => {
    const itemsAdapter = drizzleAdapter({ db: null as any, schema: { items }, dialect: "mysql" });

    const applyScopeC1 = (q: unknown): unknown =>
      (q as { where: (c: unknown) => unknown }).where(eq(items.companyId, "c1"));

    function mutCtx(
      input: Record<string, unknown>,
      overrides: Partial<MutationContext<unknown>> = {},
    ): MutationContext<unknown> {
      return {
        req: new Request("http://localhost/admin/items"),
        session: null,
        role: "admin",
        scope: { companyId: "c1" },
        ip: null,
        userAgent: null,
        db,
        input,
        ...overrides,
      } as MutationContext<unknown>;
    }

    it("in-scope create succeeds", async () => {
      const row: any = await itemsAdapter.create(
        items,
        mutCtx({ id: "ok1", name: "OK", companyId: "c1" }, { applyScope: applyScopeC1 }),
      );
      expect(row).toMatchObject({ id: "ok1", companyId: "c1" });
    });

    it("SECURITY: cross-tenant create is atomically rolled back — no partial state", async () => {
      const [countBefore] = (await pool.query("SELECT COUNT(*) as c FROM items")) as unknown as [
        { c: number }[],
        unknown,
      ];
      const before = countBefore[0]?.c;

      await expect(
        itemsAdapter.create(
          items,
          mutCtx(
            { id: "hacked1", name: "Cross-tenant", companyId: "c2" },
            { applyScope: applyScopeC1 },
          ),
        ),
      ).rejects.toBeInstanceOf(FlowpanelAccessError);

      const [rows] = (await pool.query("SELECT id FROM items WHERE id = ?", [
        "hacked1",
      ])) as unknown as [unknown[], unknown];
      expect(rows).toHaveLength(0);

      // No partial state: the row count is exactly what it was before the
      // rejected attempt — a real ROLLBACK, not an insert followed by a
      // best-effort compensating delete.
      const [countAfter] = (await pool.query("SELECT COUNT(*) as c FROM items")) as unknown as [
        { c: number }[],
        unknown,
      ];
      expect(countAfter[0]?.c).toBe(before);
    });

    it("FAIL-CLOSED: create throws when scopeRequired && no applyScope, before writing anything", async () => {
      await expect(
        itemsAdapter.create(
          items,
          mutCtx({ id: "shouldnotexist", name: "X", companyId: "c1" }, { scopeRequired: true }),
        ),
      ).rejects.toBeInstanceOf(FlowpanelAccessError);
      const [rows] = (await pool.query("SELECT id FROM items WHERE id = ?", [
        "shouldnotexist",
      ])) as unknown as [unknown[], unknown];
      expect(rows).toHaveLength(0);
    });
  },
);

describe.skipIf(!dockerAvailable)("drizzleAdapter migrations (mysql)", () => {
  it("creates its bookkeeping table and round-trips applied ids", async () => {
    const adapter = drizzleAdapter({ db, schema: { users } });

    expect(await adapter.listAppliedMigrations?.()).toEqual(new Set());

    await adapter.markMigrationApplied?.("0001_init");
    await adapter.markMigrationApplied?.("0002_posts");

    expect(await adapter.listAppliedMigrations?.()).toEqual(new Set(["0001_init", "0002_posts"]));
  });

  it("executes raw migration SQL", async () => {
    const adapter = drizzleAdapter({ db, schema: { users } });
    await adapter.runMigrationSql?.(`CREATE TABLE probe_mig (id VARCHAR(36) PRIMARY KEY)`);
    const [rows] = (await pool.query("SELECT id FROM probe_mig")) as unknown as [
      unknown[],
      unknown,
    ];
    expect(rows).toHaveLength(0);
  });
});
