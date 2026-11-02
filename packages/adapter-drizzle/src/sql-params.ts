import {
  type AuditLogStore,
  type ParseSqlRowsOptions,
  parseSqlRows,
  sanitizeSqlParams,
} from "@flowpanel/core";
import {
  type AuditSqlExecutor,
  type AuditSqlStatement,
  sqlAuditLog,
} from "@flowpanel/core/internal";
import { is, SQL, sql } from "drizzle-orm";
import type { DrizzleDialect } from "./dialect";
import { type MigrationDb, runRaw, selectRaw } from "./migrations";
import { runInTransaction } from "./transaction";

function copyWith<T extends object>(source: T, change: Partial<T>): T {
  return Object.assign(Object.create(Object.getPrototypeOf(source)) as T, source, change);
}

function bindableAll(values: readonly unknown[]): readonly unknown[] {
  const mapped = values.map(bindable);
  return mapped.every((value, i) => value === values[i]) ? values : mapped;
}

function bindable(value: unknown): unknown {
  if (is(value, SQL)) return fragment(value);
  if (is(value, SQL.Aliased)) {
    const inner = fragment(value.sql);
    return inner === value.sql ? value : copyWith(value, { sql: inner });
  }
  if (Array.isArray(value)) return bindableAll(value);
  return sanitizeSqlParams([value])[0];
}

/** A fragment with every nested `Date` and `bigint` bindable, copied only when something changes. */
function fragment(query: SQL): SQL {
  const chunks = bindableAll(query.queryChunks);
  if (chunks === query.queryChunks) return query;
  return copyWith(query, { queryChunks: chunks as SQL["queryChunks"] });
}

/** One bound read-only statement, with the driver's row shape normalised away. */
export async function rawSqlRows<Row>(
  db: MigrationDb,
  dialect: DrizzleDialect,
  strings: TemplateStringsArray,
  values: readonly unknown[],
  options: ParseSqlRowsOptions = {},
): Promise<Row[]> {
  const query: SQL = sql(strings, ...values.map(bindable));
  return parseSqlRows<Row>(await selectRaw(db, dialect, query), options);
}

function statementSql({ strings, values }: AuditSqlStatement): SQL {
  const template = Object.assign([...strings], { raw: [...strings] });
  return sql(template, ...values.map(bindable));
}

const AUDIT_DIALECT = { pg: "postgresql", mysql: "mysql", sqlite: "sqlite" } as const;

function isMigrationDb(value: unknown): value is MigrationDb {
  return typeof value === "object" && value !== null;
}

function auditExecutor(db: MigrationDb, dialect: DrizzleDialect): AuditSqlExecutor {
  return {
    run: async (statement) => {
      await runRaw(db, dialect, statementSql(statement));
    },
    rows: (statement) => selectRaw(db, dialect, statementSql(statement)),
    transaction: (run) =>
      runInTransaction(db, (tx) => run(auditExecutor(isMigrationDb(tx) ? tx : db, dialect))),
  };
}

/** `flowpanel_audit_log` through the same driver calls `flowpanel migrate` uses. */
export function drizzleAuditLog(db: MigrationDb, dialect: DrizzleDialect): AuditLogStore {
  return sqlAuditLog(AUDIT_DIALECT[dialect], auditExecutor(db, dialect));
}
