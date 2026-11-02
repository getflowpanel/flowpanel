import type { ItemQueryContext, ListQueryContext, MutationContext } from "@flowpanel/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, sqliteView, text } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzleAdapter, introspect } from "../index";

const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  internal: integer("internal", { mode: "boolean" }).notNull().default(false),
});

const userRow = sqliteView("admin_user_row", {
  id: text("id").primaryKey(),
  name: text("name"),
  internal: integer("internal", { mode: "boolean" }),
  sent: integer("sent"),
}).existing();

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  sqlite.exec(`
    CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT, internal INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE response (id TEXT PRIMARY KEY, user_id TEXT, sent INTEGER);
    CREATE VIEW admin_user_row AS
      SELECT u.id, u.name, u.internal,
        (SELECT count(*) FROM response r WHERE r.user_id = u.id AND r.sent = 1) AS sent
      FROM user u;
    INSERT INTO user VALUES ('u1', 'Ada', 0), ('u2', 'Bob', 1), ('u3', 'Cy', 0);
    INSERT INTO response VALUES ('r1', 'u1', 1), ('r2', 'u1', 1), ('r3', 'u3', 0);
  `);
});

afterAll(() => sqlite?.close());

const base = {
  req: new Request("http://localhost/admin/user"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

function listCtx(overrides: Partial<ListQueryContext<unknown>> = {}): ListQueryContext<unknown> {
  return {
    ...base,
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
  } as ListQueryContext<unknown>;
}

describe("drizzleAdapter over a view", () => {
  let adapter: ReturnType<typeof drizzleAdapter>;
  beforeAll(() => {
    adapter = drizzleAdapter({ db, schema: { user, userRow }, dialect: "sqlite" });
  });

  it("introspects the view's selected columns and names it a view", () => {
    const meta = introspect(userRow);
    expect(meta).toMatchObject({ name: "admin_user_row", kind: "view", primaryKey: "id" });
    expect(meta.columns.map((column) => column.name)).toEqual(["id", "name", "internal", "sent"]);
    expect(meta.columns.every((column) => column.writableOnCreate === false)).toBe(true);
    expect(introspect(user).kind).toBeUndefined();
  });

  it("lists, sorts, filters and counts the view", async () => {
    const page = await adapter.list(
      userRow as never,
      listCtx({ filters: { sent: 2 }, sort: { field: "name" as never, dir: "asc" } }),
    );
    expect(page.rows).toEqual([{ id: "u1", name: "Ada", internal: false, sent: 2 }]);
    expect(page.total).toBe(1);
    expect(await adapter.count?.(userRow as never, { internal: false })).toBe(2);
  });

  it("reads one row of the view by its key", async () => {
    const ctx = { ...listCtx(), id: "u3" } as unknown as ItemQueryContext;
    expect(await adapter.get(userRow as never, ctx)).toEqual({
      id: "u3",
      name: "Cy",
      internal: false,
      sent: 0,
    });
  });

  it("writes to the table and never validates a write against the view", async () => {
    const mctx = { ...base, db, input: { internal: true }, id: "u1" } as MutationContext<unknown>;
    await adapter.update(user as never, mctx);
    const ctx = { ...listCtx(), id: "u1" } as unknown as ItemQueryContext;
    expect(await adapter.get(userRow as never, ctx)).toMatchObject({ internal: true, sent: 2 });
    expect(adapter.inferSchema(userRow as never).update.safeParse({ internal: true }).success).toBe(
      false,
    );
    expect(adapter.inferSchema(user as never).update.safeParse({ internal: true }).success).toBe(
      true,
    );
  });
});
