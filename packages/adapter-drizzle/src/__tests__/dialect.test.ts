import { int, mysqlTable, varchar } from "drizzle-orm/mysql-core";
import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { resolveDialect } from "../dialect";

const pgUsers = pgTable("users", { id: text("id").primaryKey(), age: integer("age") });
const mysqlUsers = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  age: int("age"),
});
const sqliteUsers = sqliteTable("users", { id: sqliteText("id").primaryKey() });

describe("resolveDialect", () => {
  it("infers pg from a pgTable in the schema", () => {
    expect(resolveDialect({ schema: { pgUsers } })).toBe("pg");
  });

  it("infers mysql from a mysqlTable in the schema", () => {
    expect(resolveDialect({ schema: { mysqlUsers } })).toBe("mysql");
  });

  it("infers sqlite from a sqliteTable in the schema", () => {
    expect(resolveDialect({ schema: { sqliteUsers } })).toBe("sqlite");
  });

  it("skips non-table members of the schema namespace", () => {
    const schema = { ROLES: ["admin"], helper: () => null, sqliteUsers };
    expect(resolveDialect({ schema })).toBe("sqlite");
  });

  it("prefers an explicit dialect over inference", () => {
    expect(resolveDialect({ schema: { pgUsers }, dialect: "sqlite" })).toBe("sqlite");
  });

  it("throws instead of silently defaulting to pg when nothing is inferable", () => {
    expect(() => resolveDialect({ schema: {} })).toThrow(/could not infer the SQL dialect/);
  });
});
