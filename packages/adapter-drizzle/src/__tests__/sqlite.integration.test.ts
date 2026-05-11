import type { ListQueryContext } from "@flowpanel/core";
import Database from "better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzleAdapter } from "../index.js";

const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  age: integer("age"),
});

let db: ReturnType<typeof drizzle>;
let sqlite: InstanceType<typeof Database>;

beforeAll(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      age INTEGER
    )
  `);
  for (let i = 0; i < 25; i++) {
    sqlite
      .prepare("INSERT INTO users (id, email, name, age) VALUES (?, ?, ?, ?)")
      .run(`u${i}`, `u${i}@e.co`, `User ${i}`, 20 + i);
  }
});

afterAll(() => {
  sqlite?.close();
});

describe("drizzleAdapter SQLite CRUD", () => {
  const adapter = drizzleAdapter({ db: null as any, schema: { users }, dialect: "sqlite" });

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

  it("list search across text columns", async () => {
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
