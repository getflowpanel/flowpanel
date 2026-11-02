import type { ListQueryContext } from "@flowpanel/core";
import { normalizeWhere } from "@flowpanel/core/internal";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzleAdapter } from "../index";

const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  active: integer("active", { mode: "boolean" }).notNull(),
  total: integer("total").notNull(),
});

const columns = ["id", "status", "active", "total"];
let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  sqlite.exec(
    "CREATE TABLE accounts (id TEXT PRIMARY KEY, status TEXT NOT NULL, active INTEGER NOT NULL, total INTEGER NOT NULL)",
  );
  const insert = sqlite.prepare("INSERT INTO accounts VALUES (?, ?, ?, ?)");
  insert.run("a", "paid", 1, 10);
  insert.run("b", "refunded", 0, 20);
  insert.run("c", "open", 1, 30);
});

afterAll(() => {
  sqlite?.close();
});

describe("the filter shapes ctx.read produces, on SQLite", () => {
  let adapter: ReturnType<typeof drizzleAdapter>;
  beforeAll(() => {
    adapter = drizzleAdapter({ db, schema: { accounts }, dialect: "sqlite" });
  });

  async function ids(where: Record<string, unknown>): Promise<string[]> {
    const filters = normalizeWhere('ctx.read("accounts")', where, columns);
    if (filters === null) return [];
    const result = await adapter.list(accounts, {
      db,
      filters,
      sort: { field: "id", dir: "asc" },
      page: 1,
      pageSize: 100,
      search: "",
    } as unknown as ListQueryContext<unknown>);
    return result.rows.map((row) => (row as { id: string }).id);
  }

  it("matches any of an array, numbers included", async () => {
    expect(await ids({ status: ["paid", "open"] })).toEqual(["a", "c"]);
    expect(await ids({ total: [10, 30] })).toEqual(["a", "c"]);
  });

  it("matches inside a range, and the adapter's own shapes as they are", async () => {
    expect(await ids({ total: { gte: 15, lte: 30 } })).toEqual(["b", "c"]);
    expect(await ids({ total: { op: "range", lte: 20 } })).toEqual(["a", "b"]);
    expect(await ids({ status: { op: "in", values: ["refunded"] } })).toEqual(["b"]);
  });

  it("matches a boolean as a plain value", async () => {
    expect(await ids({ active: false })).toEqual(["b"]);
    expect(await ids({ active: true })).toEqual(["a", "c"]);
  });
});
