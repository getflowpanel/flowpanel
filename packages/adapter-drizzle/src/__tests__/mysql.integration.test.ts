import type { ListQueryContext } from "@flowpanel/core";
import { MySqlContainer, type StartedMySqlContainer } from "@testcontainers/mysql";
import { boolean, int, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import * as mysql from "mysql2/promise";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzleAdapter } from "../index.js";

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

  it("list search across varchar columns", async () => {
    const r = await adapter.list(users, ctx({ db, search: "User 7" }));
    expect(r.rows.some((row: any) => row.id === "u7")).toBe(true);
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
