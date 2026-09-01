import { describe, expect, it, vi } from "vitest";
import { MIGRATIONS_TABLE_DDL, prismaAdapter } from "../adapter";
import type { PrismaDmmf } from "../introspect";
import type { PrismaClientLike } from "../runtime";
import { splitSqlStatements } from "../sql-statements";

const dmmf: PrismaDmmf = { datamodel: { models: [], enums: [] } };

type MockPrisma = PrismaClientLike & {
  $executeRaw: ReturnType<typeof vi.fn>;
  $executeRawUnsafe: ReturnType<typeof vi.fn>;
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
  $transaction: ReturnType<typeof vi.fn>;
};

function makeMockPrisma(rows: Array<{ id: string }> = []): MockPrisma {
  const prisma = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    $queryRawUnsafe: vi.fn().mockResolvedValue(rows),
    $transaction: vi.fn(),
  } as MockPrisma;
  prisma.$transaction.mockImplementation(async (run: (tx: MockPrisma) => Promise<unknown>) =>
    run(prisma),
  );
  return prisma;
}

function sqlCalls(client: MockPrisma): string[] {
  return [
    ...client.$queryRawUnsafe.mock.calls.map(([sql]) => String(sql)),
    ...client.$executeRawUnsafe.mock.calls.map(([sql]) => String(sql)),
  ];
}

describe("prismaAdapter migrations bookkeeping", () => {
  it("exposes first-class and compatibility migration hooks", () => {
    const adapter = prismaAdapter({
      prisma: makeMockPrisma(),
      dmmf,
      provider: "postgresql",
    });

    expect(adapter.applyMigration).toEqual(expect.any(Function));
    expect(adapter.runMigrationSql).toEqual(expect.any(Function));
    expect(adapter.listAppliedMigrations).toEqual(expect.any(Function));
    expect(adapter.markMigrationApplied).toEqual(expect.any(Function));
  });

  it("creates the bookkeeping table with dialect-portable DDL", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf, provider: "sqlite" });

    await adapter.listAppliedMigrations?.();

    const ddl = prisma.$executeRawUnsafe.mock.calls[0]?.[0] as string;
    expect(ddl).toBe(MIGRATIONS_TABLE_DDL);
    expect(ddl).not.toMatch(/timestamptz/i);
    expect(ddl).not.toMatch(/DEFAULT\s+now\(\)/i);
    expect(ddl).toMatch(/DEFAULT CURRENT_TIMESTAMP/);
  });

  it("returns the applied ids", async () => {
    const prisma = makeMockPrisma([{ id: "0001_init" }, { id: "0002_posts" }]);
    const adapter = prismaAdapter({ prisma, dmmf, provider: "sqlite" });

    await expect(adapter.listAppliedMigrations?.()).resolves.toEqual(
      new Set(["0001_init", "0002_posts"]),
    );
  });

  it("records an applied migration through a parameterized compatibility insert", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf, provider: "sqlite" });

    await adapter.markMigrationApplied?.("0003_orders");

    const [strings, ...values] = prisma.$executeRaw.mock.calls[0] as [string[], ...unknown[]];
    expect(strings.join("?")).toMatch(/INSERT INTO _flowpanel_migrations/);
    expect(values).toEqual(["0003_orders"]);
  });
});

describe("prismaAdapter PostgreSQL migrations", () => {
  it("locks, rechecks, executes, and records inside one transaction", async () => {
    const root = makeMockPrisma();
    const tx = makeMockPrisma();
    const events: string[] = [];
    root.$transaction.mockImplementation(async (run: (target: MockPrisma) => Promise<unknown>) => {
      events.push("transaction:start");
      const result = await run(tx);
      events.push("transaction:commit");
      return result;
    });
    tx.$queryRawUnsafe.mockImplementation(async (sql: string) => {
      events.push(sql.includes("pg_advisory_xact_lock") ? "lock" : "recheck");
      return [];
    });
    tx.$executeRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.startsWith("INSERT INTO _flowpanel_migrations")) events.push("marker");
      else events.push(sql);
      return 1;
    });
    const adapter = prismaAdapter({ prisma: root, dmmf, provider: "postgresql" });

    await adapter.applyMigration?.(
      "0001_init",
      "CREATE TABLE first_probe (id text); INSERT INTO first_probe VALUES ('one;two');",
    );

    expect(events).toEqual([
      "transaction:start",
      "lock",
      "recheck",
      "CREATE TABLE first_probe (id text)",
      "INSERT INTO first_probe VALUES ('one;two')",
      "marker",
      "transaction:commit",
    ]);
    expect(root.$executeRawUnsafe).toHaveBeenCalledWith(MIGRATIONS_TABLE_DDL);
    expect(tx.$queryRawUnsafe.mock.calls[0]).toEqual([
      expect.stringContaining("pg_advisory_xact_lock"),
      "0001_init",
    ]);
    expect(tx.$executeRawUnsafe.mock.calls.at(-1)).toEqual([
      expect.stringMatching(/^INSERT INTO _flowpanel_migrations/),
      "0001_init",
    ]);
  });

  it("treats a duplicate id as a no-op only after locking and rechecking", async () => {
    const prisma = makeMockPrisma();
    prisma.$queryRawUnsafe.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "0002_once" }]);
    const adapter = prismaAdapter({ prisma, dmmf, provider: "postgresql" });

    await adapter.applyMigration?.(
      "0002_once",
      "CREATE TABLE duplicate_body_must_not_run (id text)",
    );

    expect(prisma.$queryRawUnsafe.mock.calls[0]?.[0]).toContain("pg_advisory_xact_lock");
    expect(prisma.$queryRawUnsafe.mock.calls[1]?.[0]).toMatch(
      /^SELECT id FROM _flowpanel_migrations/,
    );
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(MIGRATIONS_TABLE_DDL);
  });

  it("does not record the marker when a statement fails", async () => {
    const prisma = makeMockPrisma();
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    prisma.$executeRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql === "BROKEN STATEMENT") throw new Error("postgres syntax error");
      return 0;
    });
    const adapter = prismaAdapter({ prisma, dmmf, provider: "postgresql" });

    await expect(
      adapter.applyMigration?.(
        "0003_failure",
        "CREATE TABLE partial_probe (id text); BROKEN STATEMENT;",
      ),
    ).rejects.toThrow("postgres syntax error");
    expect(sqlCalls(prisma)).not.toContainEqual(
      expect.stringMatching(/^INSERT INTO _flowpanel_migrations/),
    );
  });
});

describe("prismaAdapter SQLite migrations", () => {
  it("takes a write lock before rechecking and keeps SQL plus marker in the transaction", async () => {
    const root = makeMockPrisma();
    const tx = makeMockPrisma();
    const events: string[] = [];
    root.$transaction.mockImplementation(async (run: (target: MockPrisma) => Promise<unknown>) =>
      run(tx),
    );
    tx.$executeRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.startsWith("INSERT INTO _flowpanel_migration_lock")) events.push("write-lock");
      else if (sql.startsWith("INSERT INTO _flowpanel_migrations")) events.push("marker");
      else events.push(sql);
      return 1;
    });
    tx.$queryRawUnsafe.mockImplementation(async () => {
      events.push("recheck");
      return [];
    });
    const adapter = prismaAdapter({ prisma: root, dmmf, provider: "sqlite" });

    await adapter.applyMigration?.(
      "0001_sqlite",
      "CREATE TABLE sqlite_probe (id integer); INSERT INTO sqlite_probe VALUES (1);",
    );

    expect(events).toEqual([
      "write-lock",
      "recheck",
      "CREATE TABLE sqlite_probe (id integer)",
      "INSERT INTO sqlite_probe VALUES (1)",
      "marker",
    ]);
    expect(root.$executeRawUnsafe.mock.calls.map(([sql]) => sql)).toEqual([
      MIGRATIONS_TABLE_DDL,
      expect.stringMatching(/^CREATE TABLE IF NOT EXISTS _flowpanel_migration_lock/),
    ]);
  });

  it("does not execute a duplicate body after the write-lock recheck", async () => {
    const prisma = makeMockPrisma([{ id: "0002_once" }]);
    const adapter = prismaAdapter({ prisma, dmmf, provider: "sqlite" });

    await adapter.applyMigration?.(
      "0002_once",
      "CREATE TABLE duplicate_body_must_not_run (id integer)",
    );

    expect(prisma.$executeRawUnsafe.mock.calls.map(([sql]) => sql)).not.toContain(
      "CREATE TABLE duplicate_body_must_not_run (id integer)",
    );
    expect(prisma.$executeRawUnsafe.mock.calls.at(-1)?.[0]).toMatch(
      /^INSERT INTO _flowpanel_migration_lock/,
    );
  });
});

type Claim = {
  id: string;
  owner: string;
  state: "running" | "failed";
  statement_index: number;
  error_message: string | null;
};

function makeMysqlProtocolPrisma(
  options: { failSql?: string; pauseSql?: string } = {},
): MockPrisma & {
  applied: Set<string>;
  claims: Map<string, Claim>;
  executed: string[];
  pauseEntered: Promise<void>;
  releasePause: () => void;
} {
  const applied = new Set<string>();
  const claims = new Map<string, Claim>();
  const executed: string[] = [];
  let signalPauseEntered!: () => void;
  let releasePause!: () => void;
  const pauseEntered = new Promise<void>((resolve) => {
    signalPauseEntered = resolve;
  });
  const pause = new Promise<void>((resolve) => {
    releasePause = resolve;
  });
  const prisma = makeMockPrisma() as MockPrisma & {
    applied: Set<string>;
    claims: Map<string, Claim>;
    executed: string[];
    pauseEntered: Promise<void>;
    releasePause: () => void;
  };
  prisma.applied = applied;
  prisma.claims = claims;
  prisma.executed = executed;
  prisma.pauseEntered = pauseEntered;
  prisma.releasePause = releasePause;
  prisma.$queryRawUnsafe.mockImplementation(async (sql: string, id: string) => {
    if (sql.startsWith("SELECT id FROM _flowpanel_migrations")) {
      return applied.has(id) ? [{ id }] : [];
    }
    if (sql.includes("FROM _flowpanel_migration_claims")) {
      const claim = claims.get(id);
      return claim ? [{ ...claim }] : [];
    }
    return [];
  });
  prisma.$executeRawUnsafe.mockImplementation(
    async (sql: string, ...params: Array<string | number | null>) => {
      if (sql.startsWith("CREATE TABLE IF NOT EXISTS _flowpanel_")) return 0;
      if (sql.startsWith("INSERT INTO _flowpanel_migration_claims")) {
        const [id, owner] = params as [string, string];
        if (!claims.has(id)) {
          claims.set(id, {
            id,
            owner,
            state: "running",
            statement_index: 0,
            error_message: null,
          });
          return 1;
        }
        return 0;
      }
      if (
        sql.startsWith("UPDATE _flowpanel_migration_claims") &&
        sql.includes("state = 'running'")
      ) {
        const [statementIndex, id, owner] = params as [number, string, string];
        const claim = claims.get(id);
        if (claim?.owner === owner) claim.statement_index = statementIndex;
        return claim?.owner === owner ? 1 : 0;
      }
      if (
        sql.startsWith("UPDATE _flowpanel_migration_claims") &&
        sql.includes("state = 'failed'")
      ) {
        const [statementIndex, errorMessage, id, owner] = params as [
          number,
          string,
          string,
          string,
        ];
        const claim = claims.get(id);
        if (claim?.owner === owner) {
          claim.state = "failed";
          claim.statement_index = statementIndex;
          claim.error_message = errorMessage;
        }
        return claim?.owner === owner ? 1 : 0;
      }
      if (sql.startsWith("INSERT INTO _flowpanel_migrations")) {
        applied.add(params[0] as string);
        return 1;
      }
      if (sql.startsWith("DELETE FROM _flowpanel_migration_claims")) {
        const [id, owner] = params as [string, string | undefined];
        const claim = claims.get(id);
        if (claim && (owner === undefined || claim.owner === owner)) claims.delete(id);
        return claim ? 1 : 0;
      }
      executed.push(sql);
      if (sql === options.pauseSql) {
        signalPauseEntered();
        await pause;
      }
      if (sql === options.failSql) throw new Error("mysql syntax error");
      return 0;
    },
  );
  return prisma;
}

describe("prismaAdapter MySQL migrations", () => {
  it("uses a durable owner claim and removes it only after recording the marker", async () => {
    const prisma = makeMysqlProtocolPrisma();
    const adapter = prismaAdapter({ prisma, dmmf, provider: "mysql" });

    await adapter.applyMigration?.(
      "0001_mysql",
      "CREATE TABLE mysql_probe (id integer); INSERT INTO mysql_probe VALUES (1);",
    );

    expect(prisma.executed).toEqual([
      "CREATE TABLE mysql_probe (id integer)",
      "INSERT INTO mysql_probe VALUES (1)",
    ]);
    expect(prisma.applied).toEqual(new Set(["0001_mysql"]));
    expect(prisma.claims).toEqual(new Map());
    expect(prisma.$transaction).not.toHaveBeenCalled();
    const calls = prisma.$executeRawUnsafe.mock.calls.map(([sql]) => String(sql));
    expect(
      calls.findIndex((sql) => sql.startsWith("INSERT INTO _flowpanel_migration_claims")),
    ).toBeLessThan(calls.indexOf("CREATE TABLE mysql_probe (id integer)"));
    expect(
      calls.findIndex((sql) => sql.startsWith("INSERT INTO _flowpanel_migrations")),
    ).toBeLessThan(
      calls.findIndex((sql) => sql.startsWith("DELETE FROM _flowpanel_migration_claims")),
    );
  });

  it("makes a contender wait and recheck instead of executing the same body", async () => {
    const prisma = makeMysqlProtocolPrisma({ pauseSql: "CREATE TABLE mysql_once (id integer)" });
    const first = prismaAdapter({ prisma, dmmf, provider: "mysql" });
    const second = prismaAdapter({ prisma, dmmf, provider: "mysql" });

    const firstRun = first.applyMigration?.("0002_once", "CREATE TABLE mysql_once (id integer)");
    await prisma.pauseEntered;
    const secondRun = second.applyMigration?.(
      "0002_once",
      "CREATE TABLE duplicate_body_must_not_run (id integer)",
    );
    await new Promise((resolve) => setTimeout(resolve, 40));
    prisma.releasePause();
    await Promise.all([firstRun, secondRun]);

    expect(prisma.executed).toEqual(["CREATE TABLE mysql_once (id integer)"]);
    expect(prisma.applied).toEqual(new Set(["0002_once"]));
    expect(prisma.claims).toEqual(new Map());
  });

  it("persists actionable failure state and refuses to silently retry partial DDL", async () => {
    const prisma = makeMysqlProtocolPrisma({ failSql: "BROKEN STATEMENT" });
    const first = prismaAdapter({ prisma, dmmf, provider: "mysql" });

    await expect(
      first.applyMigration?.(
        "0003_partial",
        "CREATE TABLE mysql_partial (id integer); BROKEN STATEMENT;",
      ),
    ).rejects.toThrow(/durable recovery claim.*statement 2/i);

    expect(prisma.applied).toEqual(new Set());
    expect(prisma.claims.get("0003_partial")).toMatchObject({
      state: "failed",
      statement_index: 2,
      error_message: "mysql syntax error",
    });

    const retry = prismaAdapter({ prisma, dmmf, provider: "mysql" });
    await expect(
      retry.applyMigration?.("0003_partial", "CREATE TABLE must_not_retry (id integer)"),
    ).rejects.toThrow(/failed durable claim.*manual recovery/i);
    expect(prisma.executed).not.toContain("CREATE TABLE must_not_retry (id integer)");
  });

  it("cleans a leftover completed claim without rerunning SQL", async () => {
    const prisma = makeMysqlProtocolPrisma();
    prisma.applied.add("0004_complete");
    prisma.claims.set("0004_complete", {
      id: "0004_complete",
      owner: "dead-owner",
      state: "running",
      statement_index: 1,
      error_message: null,
    });
    const adapter = prismaAdapter({ prisma, dmmf, provider: "mysql" });

    await adapter.applyMigration?.(
      "0004_complete",
      "CREATE TABLE completed_body_must_not_run (id integer)",
    );

    expect(prisma.executed).toEqual([]);
    expect(prisma.claims.has("0004_complete")).toBe(false);
  });
});

describe("prismaAdapter migration SQL validation", () => {
  it("recognizes dollar quotes for every provider and rejects them outside PostgreSQL", () => {
    expect(
      splitSqlStatements(
        "CREATE FUNCTION f() RETURNS void AS $$ BEGIN PERFORM 1; END $$ LANGUAGE plpgsql;",
        "postgresql",
      ),
    ).toHaveLength(1);
    expect(() => splitSqlStatements("SELECT $$ordinary value; still quoted$$;", "sqlite")).toThrow(
      /dollar-quoted SQL is only supported for PostgreSQL/,
    );
    expect(() =>
      splitSqlStatements("SELECT $tag$ordinary value; still quoted$tag$;", "mysql"),
    ).toThrow(/dollar-quoted SQL is only supported for PostgreSQL/);
  });

  it("rejects client directives and unsafe procedural bodies before executing anything", async () => {
    for (const [provider, sql] of [
      ["postgresql", "\\i other.sql"],
      ["sqlite", ".read other.sql"],
      ["mysql", "DELIMITER $$\nCREATE PROCEDURE p() BEGIN SELECT 1; END$$"],
      ["mysql", "SOURCE other.sql"],
      ["sqlite", "CREATE TRIGGER t AFTER UPDATE ON x BEGIN UPDATE x SET id = 1; END;"],
    ] as const) {
      const prisma = makeMockPrisma();
      const adapter = prismaAdapter({ prisma, dmmf, provider });
      await expect(adapter.runMigrationSql?.(sql)).rejects.toThrow(
        /client directive|procedural migration SQL/,
      );
      expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  });

  it("ignores procedural keywords inside comments and string literals", () => {
    expect(
      splitSqlStatements(
        "-- CREATE TRIGGER is documentation\nSELECT 'CREATE FUNCTION is text'; SELECT 2;",
        "sqlite",
      ),
    ).toEqual(["-- CREATE TRIGGER is documentation\nSELECT 'CREATE FUNCTION is text'", "SELECT 2"]);
  });

  it("keeps semicolons inside escaped quoted identifiers", () => {
    expect(
      splitSqlStatements("SELECT `a``;b` FROM items; SELECT [c]];d] FROM items;", "mysql"),
    ).toEqual(["SELECT `a``;b` FROM items", "SELECT [c]];d] FROM items"]);
  });

  it("rejects executable MySQL comments before execution", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf, provider: "mysql" });

    await expect(
      adapter.runMigrationSql?.("/*!40101 SET @flowpanel_probe = 1 */ SELECT 1;"),
    ).rejects.toThrow(/executable MySQL comments are not supported/);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("rejects empty SQL before opening a transaction", async () => {
    const prisma = makeMockPrisma();
    const adapter = prismaAdapter({ prisma, dmmf, provider: "sqlite" });

    await expect(adapter.applyMigration?.("0005_empty", " -- only a comment\n")).rejects.toThrow(
      /migration SQL is empty/,
    );
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
