import {
  MigrationSqlLexError,
  SQL_CLIENT_DIRECTIVE,
  SQL_TRANSACTION_CONTROL,
  tokenizeMigrationSql,
} from "@flowpanel/core/internal/migration-sql";
import type { SQL } from "drizzle-orm";
import type { DrizzleDialect } from "./dialect";

const DDL: Record<DrizzleDialect, string> = {
  pg: `CREATE TABLE IF NOT EXISTS _flowpanel_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)`,
  mysql: `CREATE TABLE IF NOT EXISTS _flowpanel_migrations (
  id varchar(255) NOT NULL PRIMARY KEY,
  applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
  sqlite: `CREATE TABLE IF NOT EXISTS _flowpanel_migrations (
  id text PRIMARY KEY,
  applied_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
};

export function migrationsTableDdl(dialect: DrizzleDialect): string {
  return DDL[dialect];
}

/**
 * Split ordinary migration files without treating protected semicolons as
 * statement boundaries. Dialect-specific client directives and procedural
 * bodies that cannot be split safely are rejected before any SQL is run.
 */
export function splitSqlStatements(rawSql: string, dialect: DrizzleDialect): string[] {
  let tokenized: ReturnType<typeof tokenizeMigrationSql>;
  try {
    tokenized = tokenizeMigrationSql(rawSql, {
      dollarQuotes: true,
      mysqlComments: dialect === "mysql",
    });
  } catch (error) {
    if (error instanceof MigrationSqlLexError) {
      throw new Error("drizzleAdapter: migration SQL contains an unterminated quote or comment");
    }
    throw error;
  }

  const statements: string[] = [];
  for (const statement of tokenized) {
    if (dialect === "mysql" && statement.hasExecutableMysqlComment) {
      throw new Error(
        "drizzleAdapter: executable MySQL comments are not supported in migration files; " +
          "use explicit SQL statements instead.",
      );
    }
    if (statement.hasExecutableMysqlComment && statement.syntax === "") continue;
    if (SQL_CLIENT_DIRECTIVE.test(statement.syntax)) {
      throw new Error(
        "drizzleAdapter: migration SQL contains a client directive, which database drivers do not interpret. " +
          "Move that statement to a dialect-specific migration runner.",
      );
    }
    if (SQL_TRANSACTION_CONTROL.test(statement.syntax)) {
      throw new Error(
        "drizzleAdapter: migration SQL cannot contain transaction-control statements; " +
          "the adapter owns the migration boundary.",
      );
    }
    if (dialect !== "pg" && statement.hasDollarQuote) {
      throw new Error(
        "drizzleAdapter: dollar-quoted migration SQL is only supported on PostgreSQL; " +
          "use a dialect-specific migration runner for this file.",
      );
    }
    if (
      /\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:TRIGGER|PROCEDURE|FUNCTION)\b/i.test(statement.syntax) &&
      !(dialect === "pg" && statement.hasDollarQuote)
    ) {
      throw new Error(
        "drizzleAdapter: procedural migration SQL requires a dialect-specific runner " +
          "unless PostgreSQL dollar quoting keeps the complete body in one statement.",
      );
    }
    statements.push(statement.text);
  }
  return statements;
}

/** sqlite drivers expose `run`/`all`; pg and mysql expose `execute`. */
export interface MigrationDb {
  execute?: (q: SQL) => unknown | Promise<unknown>;
  run?: (q: SQL) => unknown | Promise<unknown>;
  all?: (q: SQL) => unknown | Promise<unknown>;
  transaction?: <T>(run: (tx: MigrationDb) => T | Promise<T>) => T | Promise<T>;
}

function method(
  db: MigrationDb,
  name: "execute" | "run" | "all",
): (q: SQL) => unknown | Promise<unknown> {
  const fn = db[name];
  if (typeof fn !== "function") {
    throw new Error(
      `drizzleAdapter: the drizzle instance exposes no \`${name}()\`, which migrations need. ` +
        "Pass the database returned by drizzle(), not a wrapper.",
    );
  }
  return fn.bind(db);
}

export async function runRaw(
  db: MigrationDb,
  dialect: DrizzleDialect,
  query: SQL,
): Promise<unknown> {
  return await runRawDirect(db, dialect, query);
}

/** Preserve the driver's sync/async return shape for transaction callbacks. */
export function runRawDirect(
  db: MigrationDb,
  dialect: DrizzleDialect,
  query: SQL,
): unknown | Promise<unknown> {
  return method(db, dialect === "sqlite" ? "run" : "execute")(query);
}

export async function selectMigrationIds(
  db: MigrationDb,
  dialect: DrizzleDialect,
  query: SQL,
): Promise<string[]> {
  return await selectMigrationIdsDirect(db, dialect, query);
}

/** Preserve sync sqlite transaction callbacks while supporting async sqlite drivers. */
export function selectMigrationIdsDirect(
  db: MigrationDb,
  dialect: DrizzleDialect,
  query: SQL,
): string[] | Promise<string[]> {
  const raw = method(db, dialect === "sqlite" ? "all" : "execute")(query);
  if (isPromiseLike(raw)) {
    return Promise.resolve(raw).then((value) =>
      rowsOf(value, dialect).map((row) => String(row.id)),
    );
  }
  return rowsOf(raw, dialect).map((row) => String(row.id));
}

export function readMigrationScalar(raw: unknown, dialect: DrizzleDialect, key: string): unknown {
  return rowsOf(raw, dialect)[0]?.[key];
}

export function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as PromiseLike<T>).then === "function"
  );
}

function rowsOf(raw: unknown, dialect: DrizzleDialect): Array<Record<string, unknown>> {
  // mysql2 answers [rows, fields]; node-postgres answers { rows }; postgres-js
  // and the sqlite drivers answer the row array itself.
  if (dialect === "mysql" && Array.isArray(raw)) {
    return (raw[0] ?? []) as Array<Record<string, unknown>>;
  }
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  const rows = (raw as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}
