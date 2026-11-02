import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzleAdapter } from "../index";

const events = sqliteTable("events", { id: text("id").primaryKey(), at: text("at").notNull() });

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

beforeAll(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  sqlite.exec("CREATE TABLE events (id TEXT PRIMARY KEY, at TEXT NOT NULL)");
  const insert = sqlite.prepare("INSERT INTO events (id, at) VALUES (?, ?)");
  insert.run("e1", "2026-09-01T09:00:00.000Z");
  insert.run("e2", "2026-09-02T09:00:00.000Z");
});

afterAll(() => {
  sqlite?.close();
});

describe("ctx.sql on SQLite with a nested fragment", () => {
  it("binds a Date two fragments deep", async () => {
    const run = drizzleAdapter({ db, schema: { events }, dialect: "sqlite" }).sql;
    if (!run) throw new Error("fixture: the sql capability is missing");
    const since = sql`at >= ${new Date("2026-09-02T00:00:00.000Z")}`;
    const scope = sql`${since} and id is not null`;
    const rows = await run<{ id: string }>`select id from events where ${scope} order by id`;
    expect(rows).toEqual([{ id: "e2" }]);
  });
});
