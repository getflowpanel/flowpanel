import type { ListQueryContext } from "@flowpanel/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzleAdapter } from "../index";

const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  age: integer("age"),
});

let db: ReturnType<typeof drizzle>;
let sqlite: InstanceType<typeof Database>;
const sqlLog: string[] = [];

beforeAll(() => {
  sqlite = new Database(":memory:", {
    verbose: (query) => {
      if (typeof query === "string") sqlLog.push(query);
    },
  });
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

  it("enforces explicit list/get projections", async () => {
    const listed = await adapter.list(users, ctx({ db, pageSize: 1, select: ["id", "email"] }));
    expect(Object.keys(listed.rows[0] as object).sort()).toEqual(["email", "id"]);

    const item = await adapter.get(users, {
      ...ctx({ db }),
      id: "u3",
      select: ["id", "name"],
    } as any);
    expect(Object.keys(item as object).sort()).toEqual(["id", "name"]);
    await expect(adapter.list(users, ctx({ db, select: ["missing"] }))).rejects.toThrow(
      /unknown column "missing"/,
    );
    await expect(
      adapter.list(users, ctx({ db, select: Array.from({ length: 1025 }, () => "id") })),
    ).rejects.toThrow(/select exceeds 1024 columns/);
  });

  it("returns value-free rows and existence for an explicit empty projection", async () => {
    const firstQuery = sqlLog.length;
    const first = await adapter.list(users, ctx({ db, page: 1, pageSize: 2, select: [] }));
    expect(first).toMatchObject({ total: 25, page: 1, pageSize: 2 });
    expect(first.rows).toEqual([{}, {}]);

    const partial = await adapter.list(users, ctx({ db, page: 13, pageSize: 2, select: [] }));
    expect(partial.rows).toEqual([{}]);
    const outOfRange = await adapter.list(users, ctx({ db, page: 14, pageSize: 2, select: [] }));
    expect(outOfRange.rows).toEqual([]);

    expect(await adapter.get(users, { ...ctx({ db }), id: "u3", select: [] } as any)).toEqual({});
    expect(await adapter.get(users, { ...ctx({ db }), id: "nope", select: [] } as any)).toBeNull();

    const emptyProjectionQueries = sqlLog.slice(firstQuery).join("\n").toLowerCase();
    expect(emptyProjectionQueries).toContain("select 1");
    expect(emptyProjectionQueries).not.toMatch(
      /select\s+(?:"users"\.)?"(?:email|name|active|age)"/,
    );
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

  it("FAIL-CLOSED: search has no effect when searchFields is undeclared", async () => {
    // A hand-crafted `?search=` on a resource with no declared search fields
    // must not become a data oracle across every text column.
    const r = await adapter.list(users, ctx({ db, search: "User 7" }));
    expect(r.total).toBe(25);
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

// Regression: sqlite is NOT a non-RETURNING dialect (better-sqlite3 and
// libsql both support `.returning()`), so `create` must accept an
// auto-generated primary key instead of demanding an explicit one.
describe("drizzleAdapter SQLite sql and count capabilities", () => {
  function capabilities() {
    const adapter = drizzleAdapter({ db, schema: { users }, dialect: "sqlite" });
    if (!adapter.sql || !adapter.count) throw new Error("fixture: capabilities missing");
    return { sql: adapter.sql, count: adapter.count };
  }

  it("runs a bound statement and returns its rows", async () => {
    const { sql: query } = capabilities();
    const rows = await query<{ id: string }>`
      select id from users where email = ${"u3@e.co"}
    `;
    expect(rows).toEqual([{ id: "u3" }]);
  });

  it("binds a hostile value instead of letting it end the statement", async () => {
    const { sql: query, count } = capabilities();
    const before = await count(users);
    const rows = await query<{ id: string }>`
      select id from users where email = ${"u3@e.co'; drop table users; --"}
    `;
    expect(rows).toEqual([]);
    expect(await count(users)).toBe(before);
  });

  it("keeps a timestamp-shaped string a string when parseDates is off", async () => {
    const { sql: parsing } = capabilities();
    const raw = drizzleAdapter({ db, schema: { users }, dialect: "sqlite", parseDates: false }).sql;
    if (!raw) throw new Error("fixture: capabilities missing");
    const [parsed] = await parsing<{ at: unknown }>`select '2026-01-02 03:04:05' as at`;
    const [kept] = await raw<{ at: unknown }>`select '2026-01-02 03:04:05' as at`;
    expect(parsed?.at).toBeInstanceOf(Date);
    expect(kept?.at).toBe("2026-01-02 03:04:05");
  });

  it("counts every row, and the rows one filter matches", async () => {
    const { sql: query, count } = capabilities();
    const [total] = await query<{ n: number }>`select count(*) as n from users`;
    expect(await count(users)).toBe(total?.n);
    expect(await count(users, { id: "u3" })).toBe(1);
    expect(await count(users, { email: "nobody@e.co" })).toBe(0);
  });
});

describe("drizzleAdapter SQLite auto-generated primary key", () => {
  const posts = sqliteTable("posts", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
  });

  let autoDb: ReturnType<typeof drizzle>;
  let autoSqlite: InstanceType<typeof Database>;

  beforeAll(() => {
    autoSqlite = new Database(":memory:");
    autoDb = drizzle(autoSqlite);
    autoSqlite.exec(`
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL
      )
    `);
  });

  afterAll(() => {
    autoSqlite?.close();
  });

  it("create succeeds without an explicit primary key and returns the generated id", async () => {
    const adapter = drizzleAdapter({ db: null as any, schema: { posts }, dialect: "sqlite" });
    const created: any = await adapter.create(posts, {
      req: new Request("http://localhost/admin/posts"),
      session: null,
      role: "admin",
      scope: null,
      ip: null,
      userAgent: null,
      db: autoDb,
      input: { title: "Auto PK" },
    } as any);
    expect(created).toMatchObject({ title: "Auto PK" });
    expect(created.id).toBeTypeOf("number");
  });
});
