import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { drizzleAdapter } from "../index.js";
import { migrationsTableDdl } from "../migrations.js";

const users = sqliteTable("users_mig", { id: text("id").primaryKey() });

describe("migrationsTableDdl", () => {
  it("uses postgres types on pg", () => {
    expect(migrationsTableDdl("pg")).toMatch(/applied_at timestamptz NOT NULL DEFAULT now\(\)/);
  });

  it("uses a keyed varchar and CURRENT_TIMESTAMP on mysql", () => {
    const ddl = migrationsTableDdl("mysql");
    // mysql rejects `timestamptz` and cannot key an unbounded text column.
    expect(ddl).toMatch(/id varchar\(255\) NOT NULL PRIMARY KEY/);
    expect(ddl).toMatch(/applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP/);
    expect(ddl).not.toMatch(/timestamptz|now\(\)/);
  });

  it("avoids function defaults on sqlite", () => {
    const ddl = migrationsTableDdl("sqlite");
    // sqlite parses `DEFAULT now()` as a syntax error.
    expect(ddl).not.toMatch(/timestamptz|now\(\)/);
    expect(ddl).toMatch(/DEFAULT CURRENT_TIMESTAMP/);
  });
});

describe("drizzleAdapter migrations on sqlite", () => {
  let sqlite: InstanceType<typeof Database>;
  let adapter: ReturnType<typeof drizzleAdapter>;

  beforeAll(() => {
    sqlite = new Database(":memory:");
    adapter = drizzleAdapter({ db: drizzle(sqlite), schema: { users } });
  });

  afterAll(() => {
    sqlite?.close();
  });

  it("creates its bookkeeping table and round-trips applied ids", async () => {
    expect(await adapter.listAppliedMigrations?.()).toEqual(new Set());

    await adapter.markMigrationApplied?.("0001_init");
    await adapter.markMigrationApplied?.("0002_posts");

    expect(await adapter.listAppliedMigrations?.()).toEqual(new Set(["0001_init", "0002_posts"]));
  });

  it("executes raw migration SQL", async () => {
    await adapter.runMigrationSql?.(`CREATE TABLE probe (id integer PRIMARY KEY)`);
    expect(sqlite.prepare(`SELECT id FROM probe`).all()).toEqual([]);
  });
});

describe("drizzleAdapter migrations on mysql", () => {
  it("reads mysql2's [rows, fields] answer shape", async () => {
    const execute = vi.fn().mockResolvedValue([[{ id: "0001_init" }], []]);
    const adapter = drizzleAdapter({ db: { execute }, schema: {}, dialect: "mysql" });

    expect(await adapter.listAppliedMigrations?.()).toEqual(new Set(["0001_init"]));
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
