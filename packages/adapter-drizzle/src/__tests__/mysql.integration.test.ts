import { execSync } from "node:child_process";
import type { ListQueryContext, MutationContext } from "@flowpanel/core";
import { bindAdapterScope, FlowpanelAccessError } from "@flowpanel/core";
import { MySqlContainer, type StartedMySqlContainer } from "@testcontainers/mysql";
import { eq, sql } from "drizzle-orm";
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

const autoPosts = mysqlTable("auto_posts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
});

const notes = mysqlTable("notes", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  body: varchar("body", { length: 255 }).notNull(),
});

const dbKeyed = mysqlTable("db_keyed", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  label: varchar("label", { length: 255 }).notNull(),
});

const sqlKeyed = mysqlTable("sql_keyed", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => sql`(UUID())`),
  companyId: varchar("company_id", { length: 36 }).notNull(),
});

const scopedPosts = mysqlTable("scoped_posts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  companyId: varchar("company_id", { length: 36 }).notNull(),
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
    CREATE TABLE IF NOT EXISTS notes (
      id VARCHAR(36) PRIMARY KEY,
      body VARCHAR(255) NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS db_keyed (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      label VARCHAR(255) NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sql_keyed (
      id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
      company_id VARCHAR(36) NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS scoped_posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      company_id VARCHAR(36) NOT NULL
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
  let adapter: ReturnType<typeof drizzleAdapter>;
  beforeAll(() => {
    adapter = drizzleAdapter({ db, schema: { users }, dialect: "mysql" });
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

  it("list returns rows with pagination", async () => {
    const r = await adapter.list(users, ctx({ pageSize: 10, page: 1 }));
    expect(r.total).toBe(25);
    expect(r.rows).toHaveLength(10);
  });

  it("list filter by equality", async () => {
    const r = await adapter.list(users, ctx({ filters: { email: "u5@e.co" } }));
    expect(r.total).toBe(1);
    expect((r.rows[0] as any).id).toBe("u5");
  });

  it("list search matches within declared searchFields", async () => {
    const r = await adapter.list(users, ctx({ search: "User 7", searchFields: ["name"] }));
    expect(r.rows.some((row: any) => row.id === "u7")).toBe(true);
  });

  it("FAIL-CLOSED: search has no effect when searchFields is undeclared", async () => {
    const r = await adapter.list(users, ctx({ search: "User 7" }));
    expect(r.total).toBe(25);
  });

  function createCtx(input: Record<string, unknown>) {
    return {
      req: ctx().req,
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
      db,
      input,
    } as any;
  }

  async function countOf(table: string): Promise<number> {
    const [rows] = (await pool.query(`SELECT COUNT(*) AS c FROM ${table}`)) as unknown as [
      { c: number }[],
      unknown,
    ];
    return Number(rows[0]?.c);
  }

  it("create without an id returns the row with its auto-increment id, written once", async () => {
    const autoAdapter = drizzleAdapter({
      db: null as any,
      schema: { autoPosts },
      dialect: "mysql",
    });
    const before = await countOf("auto_posts");
    const first: any = await autoAdapter.create(autoPosts, createCtx({ title: "First" }));
    const second: any = await autoAdapter.create(autoPosts, createCtx({ title: "Second" }));
    expect(first).toMatchObject({ title: "First" });
    expect(typeof first.id).toBe("number");
    expect(second).toMatchObject({ title: "Second" });
    expect(second.id).toBeGreaterThan(first.id);
    expect(await countOf("auto_posts")).toBe(before + 2);
  });

  it("create without an id returns the row with the id its $defaultFn generated", async () => {
    const notesAdapter = drizzleAdapter({ db: null as any, schema: { notes }, dialect: "mysql" });
    const created: any = await notesAdapter.create(notes, createCtx({ body: "Hello" }));
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created).toMatchObject({ body: "Hello" });
  });

  it("create without an id on a key the database generates refuses before writing", async () => {
    const keyedAdapter = drizzleAdapter({ db: null as any, schema: { dbKeyed }, dialect: "mysql" });
    const before = await countOf("db_keyed");
    await expect(keyedAdapter.create(dbKeyed, createCtx({ label: "x" }))).rejects.toThrow(
      /needs input\.id/,
    );
    expect(await countOf("db_keyed")).toBe(before);
  });

  it("create with an id on an auto-increment key keeps that id", async () => {
    const autoAdapter = drizzleAdapter({
      db: null as any,
      schema: { autoPosts },
      dialect: "mysql",
    });
    const created: any = await autoAdapter.create(
      autoPosts,
      createCtx({ id: 9001, title: "Pinned" }),
    );
    expect(created).toMatchObject({ id: 9001, title: "Pinned" });
  });

  it("create with an empty id, as a form sends it, still generates the key", async () => {
    const autoAdapter = drizzleAdapter({
      db: null as any,
      schema: { autoPosts },
      dialect: "mysql",
    });
    const notesAdapter = drizzleAdapter({ db: null as any, schema: { notes }, dialect: "mysql" });
    const post: any = await autoAdapter.create(autoPosts, createCtx({ id: null, title: "Blank" }));
    const note: any = await notesAdapter.create(notes, createCtx({ id: null, body: "Blank" }));
    expect(typeof post.id).toBe("number");
    expect(note.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("list sort ascending", async () => {
    const r = await adapter.list(users, ctx({ sort: { field: "age", dir: "asc" }, pageSize: 5 }));
    expect((r.rows[0] as any).age).toBe(20);
  });

  it("list sort descending", async () => {
    const r = await adapter.list(users, ctx({ sort: { field: "age", dir: "desc" }, pageSize: 5 }));
    expect((r.rows[0] as any).age).toBe(44);
  });

  it("get returns a row or null", async () => {
    expect(await adapter.get(users, { ...ctx(), id: "u3" } as any)).toMatchObject({
      id: "u3",
    });
    expect(await adapter.get(users, { ...ctx(), id: "nope" } as any)).toBeNull();
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

    expect(await adapter.get(users, { ...ctx(), id: "del1" } as any)).toBeNull();
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
        mutCtx(
          { id: "ok1", name: "OK", companyId: "c1" },
          { boundScope: bindAdapterScope(applyScopeC1) },
        ),
      );
      expect(row).toMatchObject({ id: "ok1", companyId: "c1" });
    });

    const postsAdapter = drizzleAdapter({
      db: null as any,
      schema: { scopedPosts, sqlKeyed },
      dialect: "mysql",
    });
    const postsInC1 = {
      boundScope: bindAdapterScope((q: unknown): unknown =>
        (q as { where: (c: unknown) => unknown }).where(eq(scopedPosts.companyId, "c1")),
      ),
    };

    async function postsTitled(title: string): Promise<number> {
      const [rows] = (await pool.query("SELECT id FROM scoped_posts WHERE title = ?", [
        title,
      ])) as unknown as [unknown[], unknown];
      return rows.length;
    }

    it("in-scope create without an id returns the row with its auto-increment id", async () => {
      const row: any = await postsAdapter.create(
        scopedPosts,
        mutCtx({ title: "Mine", companyId: "c1" }, postsInC1),
      );
      expect(row).toMatchObject({ title: "Mine", companyId: "c1" });
      expect(typeof row.id).toBe("number");
    });

    it("SECURITY: a cross-tenant create without an id is rolled back", async () => {
      await expect(
        postsAdapter.create(scopedPosts, mutCtx({ title: "Theirs", companyId: "c2" }, postsInC1)),
      ).rejects.toBeInstanceOf(FlowpanelAccessError);
      expect(await postsTitled("Theirs")).toBe(0);
    });

    it("SECURITY: a cross-tenant create with id 0, which mysql replaces, is rolled back", async () => {
      await expect(
        postsAdapter.create(
          scopedPosts,
          mutCtx({ id: 0, title: "Zero", companyId: "c2" }, postsInC1),
        ),
      ).rejects.toBeInstanceOf(FlowpanelAccessError);
      expect(await postsTitled("Zero")).toBe(0);
    });

    it("SECURITY: a key whose $defaultFn returns SQL is refused before anything is written", async () => {
      const inScope = {
        boundScope: bindAdapterScope((q: unknown): unknown =>
          (q as { where: (c: unknown) => unknown }).where(eq(sqlKeyed.companyId, "c1")),
        ),
      };
      await expect(
        postsAdapter.create(sqlKeyed, mutCtx({ companyId: "c2" }, inScope)),
      ).rejects.toThrow(/needs input\.id/);
      const [rows] = (await pool.query("SELECT id FROM sql_keyed")) as unknown as [
        unknown[],
        unknown,
      ];
      expect(rows).toHaveLength(0);
    });

    it("SECURITY: without transactions, an auto-increment create still stays in its scope", async () => {
      const noTx = Object.create(db) as typeof db;
      Object.assign(noTx, {
        transaction: async () => {
          throw new Error("No transactions support in this driver");
        },
      });
      const scoped = { ...postsInC1, db: noTx };
      await expect(
        postsAdapter.create(scopedPosts, mutCtx({ title: "NoTxTheirs", companyId: "c2" }, scoped)),
      ).rejects.toBeInstanceOf(FlowpanelAccessError);
      expect(await postsTitled("NoTxTheirs")).toBe(0);
      const row: any = await postsAdapter.create(
        scopedPosts,
        mutCtx({ title: "NoTxMine", companyId: "c1" }, scoped),
      );
      expect(row).toMatchObject({ title: "NoTxMine", companyId: "c1" });
      expect(typeof row.id).toBe("number");
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
            { boundScope: bindAdapterScope(applyScopeC1) },
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

    it("SECURITY: update that sets the tenant column to another tenant is refused and the row is unchanged", async () => {
      await pool.query("INSERT INTO items (id, name, company_id) VALUES (?, ?, ?)", [
        "move1",
        "Before",
        "c1",
      ]);
      await expect(
        itemsAdapter.update(
          items,
          mutCtx(
            { name: "After", companyId: "c2" },
            { id: "move1", boundScope: bindAdapterScope(applyScopeC1) },
          ),
        ),
      ).rejects.toBeInstanceOf(FlowpanelAccessError);
      const [rows] = (await pool.query("SELECT name, company_id FROM items WHERE id = ?", [
        "move1",
      ])) as unknown as [{ name: string; company_id: string }[], unknown];
      expect(rows[0]).toEqual({ name: "Before", company_id: "c1" });
    });

    it("SECURITY: a driver without transactions, such as neon-http, still cannot move or misplace a row", async () => {
      const noTx = Object.create(db) as typeof db;
      Object.assign(noTx, {
        transaction: async () => {
          throw new Error("No transactions support in neon-http driver");
        },
      });
      const scoped = { boundScope: bindAdapterScope(applyScopeC1), db: noTx };
      await pool.query("INSERT INTO items (id, name, company_id) VALUES ('notx1', 'Before', 'c1')");
      await expect(
        itemsAdapter.update(items, mutCtx({ companyId: "c2" }, { id: "notx1", ...scoped })),
      ).rejects.toBeInstanceOf(FlowpanelAccessError);
      const [moved] = (await pool.query(
        "SELECT company_id FROM items WHERE id = 'notx1'",
      )) as unknown as [{ company_id: string }[], unknown];
      expect(moved[0]?.company_id).toBe("c1");
      expect(
        await itemsAdapter.update(items, mutCtx({ name: "After" }, { id: "notx1", ...scoped })),
      ).toMatchObject({ id: "notx1", name: "After", companyId: "c1" });
      await expect(
        itemsAdapter.create(items, mutCtx({ id: "notx2", name: "X", companyId: "c2" }, scoped)),
      ).rejects.toBeInstanceOf(FlowpanelAccessError);
      const [created] = (await pool.query(
        "SELECT id FROM items WHERE id = 'notx2'",
      )) as unknown as [unknown[], unknown];
      expect(created).toHaveLength(0);
      expect(
        await itemsAdapter.create(
          items,
          mutCtx({ id: "notx3", name: "Y", companyId: "c1" }, scoped),
        ),
      ).toMatchObject({ id: "notx3", companyId: "c1" });
    });

    it("update inside the scope succeeds, and an out-of-scope id is not found", async () => {
      await pool.query("INSERT INTO items (id, name, company_id) VALUES (?, ?, ?), (?, ?, ?)", [
        "keep1",
        "Before",
        "c1",
        "other1",
        "Other",
        "c2",
      ]);
      const scoped = { boundScope: bindAdapterScope(applyScopeC1) };
      const row = await itemsAdapter.update(
        items,
        mutCtx({ name: "After", companyId: "c1" }, { id: "keep1", ...scoped }),
      );
      expect(row).toMatchObject({ id: "keep1", name: "After", companyId: "c1" });
      const missing = await itemsAdapter.update(
        items,
        mutCtx({ name: "Hacked" }, { id: "other1", ...scoped }),
      );
      expect(missing).toBeUndefined();
      const [rows] = (await pool.query("SELECT name FROM items WHERE id = ?", [
        "other1",
      ])) as unknown as [{ name: string }[], unknown];
      expect(rows[0]?.name).toBe("Other");
    });

    it("executes multi-statement files individually before recording the marker", async () => {
      const adapter = drizzleAdapter({ db, schema: { users } });
      await adapter.applyMigration?.(
        "0003_multi_mysql",
        `CREATE TABLE probe_mig_multi (id INT PRIMARY KEY, note VARCHAR(255) NOT NULL);
       INSERT INTO probe_mig_multi (id, note) VALUES (1, 'one;two');
       -- a comment semicolon must not become a statement ;
       INSERT INTO probe_mig_multi (id, note) VALUES (2, 'three');`,
      );

      const [rows] = (await pool.query(
        "SELECT id, note FROM probe_mig_multi ORDER BY id",
      )) as unknown as [Array<{ id: number; note: string }>, unknown];
      expect(rows).toEqual([
        { id: 1, note: "one;two" },
        { id: 2, note: "three" },
      ]);
      expect(await adapter.listAppliedMigrations?.()).toContain("0003_multi_mysql");
    });
  },
);
