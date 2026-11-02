import { describe, expect, it } from "vitest";
import { dialectFromDependencies, drizzleDialectOf, migrationTemplate } from "../sql-dialect";
import { tpl } from "../template";

describe("drizzleDialectOf", () => {
  it("reads the dialect from a core or driver import", () => {
    expect(drizzleDialectOf('import { pgTable } from "drizzle-orm/pg-core";')).toBe("postgresql");
    expect(drizzleDialectOf('import { drizzle } from "drizzle-orm/mysql2";')).toBe("mysql");
    expect(drizzleDialectOf('import { drizzle } from "drizzle-orm/libsql/web";')).toBe("sqlite");
    expect(drizzleDialectOf('import { sql } from "drizzle-orm";')).toBeNull();
  });
});

describe("dialectFromDependencies", () => {
  it("answers only when one driver is declared", () => {
    expect(dialectFromDependencies({ "better-sqlite3": "^12" })).toBe("sqlite");
    expect(dialectFromDependencies({ pg: "^8", mysql2: "^3" })).toBeNull();
    expect(dialectFromDependencies({})).toBeNull();
  });
});

describe("migration templates", () => {
  it("has one per dialect, each without PostgreSQL types where they do not exist", async () => {
    const mysql = await tpl(migrationTemplate("mysql"));
    const sqlite = await tpl(migrationTemplate("sqlite"));
    for (const sql of [mysql, sqlite]) {
      expect(sql).not.toMatch(/timestamptz|jsonb|gen_random_uuid/);
    }
    expect(await tpl(migrationTemplate("postgresql"))).toContain("timestamptz");
  });
});
