import Database from "better-sqlite3";
import type { SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { PgDialect } from "drizzle-orm/pg-core";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { drizzleAdapter } from "../index";
import { migrationsTableDdl } from "../migrations";

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

  it("applies SQL and records its id in one adapter operation", async () => {
    await adapter.applyMigration?.(
      "0003_atomic",
      `CREATE TABLE atomic_probe (id integer PRIMARY KEY)`,
    );

    expect(sqlite.prepare(`SELECT id FROM atomic_probe`).all()).toEqual([]);
    expect(await adapter.listAppliedMigrations?.()).toContain("0003_atomic");
  });

  it("executes every statement while preserving semicolons in strings and comments", async () => {
    await adapter.applyMigration?.(
      "0004_multi",
      `CREATE TABLE "multi;probe" (id integer PRIMARY KEY, note text NOT NULL);
       INSERT INTO "multi;probe" (id, note) VALUES (1, 'one;two');
       -- this semicolon is documentation only ;
       INSERT INTO "multi;probe" (id, note) VALUES (2, 'three');
       /* nor should this block-comment semicolon split anything ; */
       INSERT INTO "multi;probe" (id, note) VALUES (3, 'four');
       -- trailing comment-only fragments are not statements ;`,
    );

    expect(sqlite.prepare(`SELECT id, note FROM "multi;probe" ORDER BY id`).all()).toEqual([
      { id: 1, note: "one;two" },
      { id: 2, note: "three" },
      { id: 3, note: "four" },
    ]);
    expect(await adapter.listAppliedMigrations?.()).toContain("0004_multi");
  });

  it("treats a duplicate migration id as a clean no-op after rechecking the marker", async () => {
    await adapter.applyMigration?.(
      "0005_once",
      `CREATE TABLE applied_once (id integer PRIMARY KEY)`,
    );

    await expect(
      adapter.applyMigration?.(
        "0005_once",
        `CREATE TABLE duplicate_body_must_not_run (id integer PRIMARY KEY)`,
      ),
    ).resolves.toBeUndefined();
    expect(
      sqlite
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'duplicate_body_must_not_run'`,
        )
        .get(),
    ).toBeUndefined();
  });

  it("rolls back every statement and the marker when a later statement fails", async () => {
    await expect(
      adapter.applyMigration?.(
        "0006_rollback",
        `CREATE TABLE must_rollback (id integer PRIMARY KEY);
         INSERT INTO table_that_does_not_exist (id) VALUES (1);`,
      ),
    ).rejects.toThrow();
    expect(
      sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'must_rollback'`)
        .get(),
    ).toBeUndefined();
    expect(await adapter.listAppliedMigrations?.()).not.toContain("0006_rollback");
  });
});

describe("drizzleAdapter migrations on mysql", () => {
  it("reads mysql2's [rows, fields] answer shape", async () => {
    const execute = vi.fn().mockResolvedValue([[{ id: "0001_init" }], []]);
    const adapter = drizzleAdapter({ db: { execute }, schema: {}, dialect: "mysql" });

    expect(await adapter.listAppliedMigrations?.()).toEqual(new Set(["0001_init"]));
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("pins one connection, serializes, rechecks, and executes statements individually", async () => {
    const dialect = new MySqlDialect();
    const targetExecute = vi.fn(async (query: SQL) => {
      const built = dialect.sqlToQuery(query);
      if (built.sql.includes("GET_LOCK")) return [[{ acquired: 1 }], []];
      if (built.sql.startsWith("SELECT id FROM _flowpanel_migrations")) return [[], []];
      if (built.sql.includes("RELEASE_LOCK")) return [[{ released: 1 }], []];
      return [[], []];
    });
    const target = { execute: targetExecute };
    const db = {
      execute: vi.fn().mockResolvedValue([[], []]),
      transaction: vi.fn(async (run: (tx: typeof target) => unknown) => run(target)),
    };
    const adapter = drizzleAdapter({ db, schema: {}, dialect: "mysql" });

    await adapter.applyMigration?.(
      "0002_multi",
      `CREATE TABLE first_probe (id integer PRIMARY KEY);
       INSERT INTO first_probe (id) VALUES (1);
       -- trailing comment only ;`,
    );

    const calls = targetExecute.mock.calls.map(([query]) => dialect.sqlToQuery(query).sql);
    expect(calls.filter((query) => query.startsWith("CREATE TABLE first_probe"))).toEqual([
      "CREATE TABLE first_probe (id integer PRIMARY KEY)",
    ]);
    expect(calls.filter((query) => query.startsWith("INSERT INTO first_probe"))).toEqual([
      "INSERT INTO first_probe (id) VALUES (1)",
    ]);
    expect(calls.findIndex((query) => query.includes("GET_LOCK"))).toBeLessThan(
      calls.findIndex((query) => query.startsWith("SELECT id FROM _flowpanel_migrations")),
    );
    expect(calls.findIndex((query) => query.startsWith("INSERT INTO _flowpanel_migrations"))).toBe(
      calls.length - 2,
    );
    expect(calls.at(-1)).toContain("RELEASE_LOCK");
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it("skips a duplicate id only after acquiring the advisory lock and rechecking", async () => {
    const dialect = new MySqlDialect();
    const targetExecute = vi.fn(async (query: SQL) => {
      const built = dialect.sqlToQuery(query);
      if (built.sql.includes("GET_LOCK")) return [[{ acquired: 1 }], []];
      if (built.sql.startsWith("SELECT id FROM _flowpanel_migrations")) {
        return [[{ id: "0003_duplicate" }], []];
      }
      if (built.sql.includes("RELEASE_LOCK")) return [[{ released: 1 }], []];
      return [[], []];
    });
    const target = { execute: targetExecute };
    const db = {
      execute: vi.fn().mockResolvedValue([[], []]),
      transaction: vi.fn(async (run: (tx: typeof target) => unknown) => run(target)),
    };
    const adapter = drizzleAdapter({ db, schema: {}, dialect: "mysql" });

    await expect(
      adapter.applyMigration?.(
        "0003_duplicate",
        "CREATE TABLE duplicate_body_must_not_run (id integer)",
      ),
    ).resolves.toBeUndefined();

    const calls = targetExecute.mock.calls.map(([query]) => dialect.sqlToQuery(query).sql);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toContain("GET_LOCK");
    expect(calls[1]).toMatch(/^SELECT id FROM _flowpanel_migrations/);
    expect(calls[2]).toContain("RELEASE_LOCK");
  });

  it("releases the advisory lock when one statement fails and does not write the marker", async () => {
    const dialect = new MySqlDialect();
    const targetExecute = vi.fn(async (query: SQL) => {
      const built = dialect.sqlToQuery(query);
      if (built.sql.includes("GET_LOCK")) return [[{ acquired: 1 }], []];
      if (built.sql.startsWith("SELECT id FROM _flowpanel_migrations")) return [[], []];
      if (built.sql.startsWith("BROKEN STATEMENT")) throw new Error("mysql syntax error");
      if (built.sql.includes("RELEASE_LOCK")) return [[{ released: 1 }], []];
      return [[], []];
    });
    const target = { execute: targetExecute };
    const db = {
      execute: vi.fn().mockResolvedValue([[], []]),
      transaction: vi.fn(async (run: (tx: typeof target) => unknown) => run(target)),
    };
    const adapter = drizzleAdapter({ db, schema: {}, dialect: "mysql" });

    await expect(
      adapter.applyMigration?.(
        "0004_failure",
        "CREATE TABLE partial_mysql (id integer); BROKEN STATEMENT;",
      ),
    ).rejects.toThrow("mysql syntax error");

    const calls = targetExecute.mock.calls.map(([query]) => dialect.sqlToQuery(query).sql);
    expect(calls.at(-1)).toContain("RELEASE_LOCK");
    expect(calls).not.toContainEqual(expect.stringMatching(/^INSERT INTO _flowpanel_migrations/));
  });
});

describe("drizzleAdapter migrations on postgres", () => {
  it("keeps a dollar-quoted body together while executing the next statement separately", async () => {
    const dialect = new PgDialect();
    const target = { execute: vi.fn().mockResolvedValue({ rows: [] }) };
    const db = {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      transaction: vi.fn(async (run: (tx: typeof target) => unknown) => run(target)),
    };
    const adapter = drizzleAdapter({ db, schema: {}, dialect: "pg" });

    await adapter.applyMigration?.(
      "0001_function",
      `CREATE FUNCTION migration_probe() RETURNS void AS $body$
       BEGIN
         PERFORM 1;
         PERFORM 2;
       END
       $body$ LANGUAGE plpgsql;
       CREATE TABLE after_function (id integer PRIMARY KEY);`,
    );

    const calls = target.execute.mock.calls.map(([query]) => dialect.sqlToQuery(query).sql);
    const bodies = calls.filter(
      (query) => query.startsWith("CREATE FUNCTION") || query.startsWith("CREATE TABLE after"),
    );
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toContain("PERFORM 1;\n         PERFORM 2;");
    expect(bodies[1]).toBe("CREATE TABLE after_function (id integer PRIMARY KEY)");
  });

  it("acquires its transaction lock before rechecking and skips a duplicate id", async () => {
    const dialect = new PgDialect();
    const target = {
      execute: vi.fn(async (query: SQL) => {
        const built = dialect.sqlToQuery(query);
        if (built.sql.startsWith("SELECT id FROM _flowpanel_migrations")) {
          return { rows: [{ id: "0002_duplicate" }] };
        }
        return { rows: [] };
      }),
    };
    const db = {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      transaction: vi.fn(async (run: (tx: typeof target) => unknown) => run(target)),
    };
    const adapter = drizzleAdapter({ db, schema: {}, dialect: "pg" });

    await adapter.applyMigration?.(
      "0002_duplicate",
      "CREATE TABLE duplicate_body_must_not_run (id integer)",
    );

    const calls = target.execute.mock.calls.map(([query]) => dialect.sqlToQuery(query).sql);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("pg_advisory_xact_lock");
    expect(calls[1]).toMatch(/^SELECT id FROM _flowpanel_migrations/);
  });
});

describe("drizzleAdapter migration SQL validation", () => {
  it.each([
    ["comment-only input", "-- documentation ;\n/* more documentation ; */"],
    ["unterminated string", "INSERT INTO notes(value) VALUES ('unfinished);"],
    ["mysql delimiter directive", "DELIMITER $$ CREATE PROCEDURE p() BEGIN SELECT 1; END $$"],
    ["unsafe procedural body", "CREATE TRIGGER t AFTER UPDATE ON items BEGIN SELECT 1; END;"],
  ])("rejects %s before touching the database", async (_label, rawSql) => {
    const db = {
      execute: vi.fn().mockResolvedValue([[], []]),
      transaction: vi.fn(),
    };
    const adapter = drizzleAdapter({ db, schema: {}, dialect: "mysql" });

    await expect(adapter.applyMigration?.("unsafe", rawSql)).rejects.toThrow();
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rejects executable MySQL comments with Drizzle-specific guidance", async () => {
    const db = {
      execute: vi.fn().mockResolvedValue([[], []]),
      transaction: vi.fn(),
    };
    const adapter = drizzleAdapter({ db, schema: {}, dialect: "mysql" });

    await expect(
      adapter.applyMigration?.("unsafe-comment", "/*!40101 SET @flowpanel_probe = 1 */ SELECT 1;"),
    ).rejects.toThrow(/executable MySQL comments are not supported/);
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each([
    "mysql",
    "sqlite",
  ] as const)("rejects dollar-quoted bodies on %s before touching the database", async (dialect) => {
    const db = {
      execute: vi.fn().mockResolvedValue([[], []]),
      run: vi.fn().mockResolvedValue(undefined),
      transaction: vi.fn(),
    };
    const adapter = drizzleAdapter({ db, schema: {}, dialect });

    await expect(
      adapter.applyMigration?.("unsafe-dollar-body", "DO $$ BEGIN SELECT 1; SELECT 2; END $$;"),
    ).rejects.toThrow(/dollar-quoted migration SQL is only supported on PostgreSQL/);
    expect(db.execute).not.toHaveBeenCalled();
    expect(db.run).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

describe("drizzleAdapter migrations on async sqlite", () => {
  it("keeps asynchronous driver calls inside the transaction callback", async () => {
    const target = {
      all: vi.fn().mockResolvedValue([]),
      run: vi.fn().mockResolvedValue(undefined),
    };
    const db = {
      run: vi.fn().mockResolvedValue(undefined),
      transaction: vi.fn(async (apply: (tx: typeof target) => unknown) => apply(target)),
    };
    const adapter = drizzleAdapter({ db, schema: {}, dialect: "sqlite" });

    await adapter.applyMigration?.("0001_async", "CREATE TABLE async_probe (id integer)");

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(target.all).toHaveBeenCalledOnce();
    expect(target.run).toHaveBeenCalledTimes(3);
  });
});
