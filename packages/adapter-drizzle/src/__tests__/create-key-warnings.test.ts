import { defineAdmin, resource } from "@flowpanel/core";
import * as my from "drizzle-orm/mysql-core";
import * as pg from "drizzle-orm/pg-core";
import * as sqlite from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { drizzleAdapter } from "../adapter";

const auth = { session: async () => ({ id: "u1" }), role: () => "admin", access: "admin" };

function keyWarnings(dialect: "pg" | "mysql" | "sqlite", tables: Record<string, object>) {
  const { warnings } = defineAdmin({
    adapter: drizzleAdapter({ db: {}, schema: tables, dialect }),
    auth,
    resources: Object.values(tables).map((table) => resource(table, { columns: ["id"] })),
  });
  return warnings.filter((line) => line.includes("primary key"));
}

describe("the create warning for a primary key Drizzle cannot fill", () => {
  it("stays quiet for every Postgres key the database or Drizzle generates", () => {
    expect(
      keyWarnings("pg", {
        serial: pg.pgTable("serial", { id: pg.serial("id").primaryKey() }),
        bigserial: pg.pgTable("bigserial", {
          id: pg.bigserial("id", { mode: "number" }).primaryKey(),
        }),
        uuid: pg.pgTable("uuid", { id: pg.uuid("id").primaryKey().defaultRandom() }),
        always: pg.pgTable("always", {
          id: pg.integer("id").primaryKey().generatedAlwaysAsIdentity(),
        }),
        byDefault: pg.pgTable("by_default", {
          id: pg.integer("id").primaryKey().generatedByDefaultAsIdentity(),
        }),
        fn: pg.pgTable("fn", {
          id: pg
            .text("id")
            .primaryKey()
            .$defaultFn(() => "x"),
        }),
      }),
    ).toEqual([]);
  });

  it("stays quiet for MySQL auto-increment and $defaultFn keys", () => {
    expect(
      keyWarnings("mysql", {
        serial: my.mysqlTable("serial", { id: my.serial("id").primaryKey() }),
        auto: my.mysqlTable("auto", { id: my.int("id").primaryKey().autoincrement() }),
        fn: my.mysqlTable("fn", {
          id: my
            .varchar("id", { length: 36 })
            .primaryKey()
            .$defaultFn(() => "x"),
        }),
      }),
    ).toEqual([]);
  });

  it("stays quiet for SQLite integer keys, which alias the rowid", () => {
    expect(
      keyWarnings("sqlite", {
        rowid: sqlite.sqliteTable("rowid", { id: sqlite.integer("id").primaryKey() }),
        auto: sqlite.sqliteTable("auto", {
          id: sqlite.integer("id").primaryKey({ autoIncrement: true }),
        }),
      }),
    ).toEqual([]);
  });

  it("names a text key without a default in every dialect", () => {
    const pgUsers = pg.pgTable("users", { id: pg.text("id").primaryKey() });
    const myUsers = my.mysqlTable("users", { id: my.varchar("id", { length: 36 }).primaryKey() });
    const liteUsers = sqlite.sqliteTable("users", { id: sqlite.text("id").primaryKey() });
    for (const [dialect, table] of [
      ["pg", pgUsers],
      ["mysql", myUsers],
      ["sqlite", liteUsers],
    ] as const) {
      expect(keyWarnings(dialect, { users: table })).toEqual([
        expect.stringMatching(
          /^resource users: create is enabled but primary key `id` has no default/,
        ),
      ]);
    }
  });
});
