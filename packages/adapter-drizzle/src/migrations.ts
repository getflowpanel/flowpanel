import type { SQL } from "drizzle-orm";
import type { DrizzleDialect } from "./dialect.js";

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

/** sqlite drivers expose `run`/`all`; pg and mysql expose `execute`. */
export interface MigrationDb {
  execute?: (q: SQL) => Promise<unknown>;
  run?: (q: SQL) => Promise<unknown>;
  all?: (q: SQL) => Promise<unknown>;
}

function method(db: MigrationDb, name: "execute" | "run" | "all"): (q: SQL) => Promise<unknown> {
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
  return method(db, dialect === "sqlite" ? "run" : "execute")(query);
}

export async function selectMigrationIds(
  db: MigrationDb,
  dialect: DrizzleDialect,
  query: SQL,
): Promise<string[]> {
  const raw = await method(db, dialect === "sqlite" ? "all" : "execute")(query);
  return rowsOf(raw, dialect).map((r) => String(r.id));
}

function rowsOf(raw: unknown, dialect: DrizzleDialect): Array<{ id: unknown }> {
  // mysql2 answers [rows, fields]; node-postgres answers { rows }; postgres-js
  // and the sqlite drivers answer the row array itself.
  if (dialect === "mysql" && Array.isArray(raw)) return (raw[0] ?? []) as Array<{ id: unknown }>;
  if (Array.isArray(raw)) return raw as Array<{ id: unknown }>;
  const rows = (raw as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as Array<{ id: unknown }>) : [];
}
