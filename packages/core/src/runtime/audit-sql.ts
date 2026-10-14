import type {
  AuditEvent,
  AuditLogEntry,
  AuditLogFacets,
  AuditLogStore,
  Scope,
} from "@flowpanel/core";
import { isAllTenants } from "../all-tenants";
import { type AuditSqlDialect, Statement, timestampValue, where } from "./audit-sql-where";

export type { AuditSqlDialect };

/** One statement as template chunks: `values[i]` binds between `strings[i]` and `strings[i + 1]`. */
export interface AuditSqlStatement {
  strings: readonly string[];
  values: readonly unknown[];
}

/** How an adapter runs FlowPanel's own statements through its driver. */
export interface AuditSqlExecutor {
  run(statement: AuditSqlStatement): Promise<void>;
  rows(statement: AuditSqlStatement): Promise<ReadonlyArray<Record<string, unknown>>>;
  /** One transaction around `run`, when the driver can hold one. */
  transaction?<T>(run: (executor: AuditSqlExecutor) => Promise<T>): Promise<T>;
}

const TABLE = "flowpanel_audit_log";
const FACET_LIMIT = 200;
/** The Audit log counts this many events at most, so a page view never counts a whole history. */
export const AUDIT_COUNT_CAP = 10_000;
const VALUES_PER_ROW = 10;
/** Bound values one statement may carry: Prisma allows 32,767, SQLite builds before 3.32 allow 999. */
const PLACEHOLDER_LIMIT: Record<AuditSqlDialect, number> = {
  postgresql: 32_767,
  mysql: 32_767,
  sqlite: 999,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (isRecord(value) && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortedKeys(value[key])]),
    );
  }
  return value;
}

/** The same tenant always gives the same key, whatever order its scope keys come in. */
export function auditScopeKey(scope: Scope | undefined): string | null {
  if (!scope || isAllTenants(scope)) return null;
  return JSON.stringify(sortedKeys(scope));
}

function jsonText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value, (_key, inner: unknown) =>
    typeof inner === "bigint" ? inner.toString() : inner,
  );
}

function readTimestamp(raw: unknown): Date {
  if (raw instanceof Date) return raw;
  const text = String(raw).replace(" ", "T");
  return new Date(/(?:Z|[+-]\d\d:?\d\d)$/.test(text) ? text : `${text}Z`);
}

function parsedJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** A stored diff, or `null` for none or one that does not read as `{ before, after }`. */
function readDiff(raw: unknown): AuditLogEntry["diff"] {
  const parsed = parsedJson(raw);
  if (!isRecord(parsed) || !("before" in parsed) || !("after" in parsed)) return null;
  return { before: parsed.before, after: parsed.after };
}

function text(raw: unknown): string | null {
  return raw === null || raw === undefined ? null : String(raw);
}

function selectColumns(dialect: AuditSqlDialect): string {
  if (dialect === "postgresql") {
    return "id::text AS id, actor_id, actor_name, action, resource, target_id, diff::text AS diff, to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS at";
  }
  if (dialect === "mysql") {
    return "id, actor_id, actor_name, action, resource, target_id, CAST(diff AS CHAR) AS diff, CAST(at AS CHAR) AS at";
  }
  return "id, actor_id, actor_name, action, resource, target_id, diff, at";
}

function count(dialect: AuditSqlDialect, raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`flowpanel: ${dialect} returned no audit log count`);
  return n;
}

function bounded(n: number, max: number): number {
  return Math.min(Math.max(0, Math.trunc(Number.isFinite(n) ? n : 0)), max);
}

function insert(
  dialect: AuditSqlDialect,
  event: AuditEvent,
  ids: ReadonlyArray<string | undefined>,
): Statement {
  const statement = new Statement().text(
    `INSERT INTO ${TABLE} (actor_id, actor_name, action, resource, target_id, diff, ip, user_agent, scope_key, at) VALUES `,
  );
  ids.forEach((targetId, index) => {
    statement.text(index === 0 ? "(" : ", (");
    for (const value of [
      event.actorId,
      event.actorName ?? null,
      event.action,
      event.resource ?? null,
      targetId ?? null,
    ]) {
      statement.value(value).text(", ");
    }
    statement.value(jsonText(event.diff), dialect === "postgresql" ? "::jsonb" : "").text(", ");
    for (const value of [event.ip ?? null, event.userAgent ?? null, auditScopeKey(event.scope)]) {
      statement.value(value).text(", ");
    }
    timestampValue(statement, dialect, event.at).text(")");
  });
  return statement;
}

/** One statement per batch of ids, each within the dialect's limit on bound values. */
function inserts(dialect: AuditSqlDialect, event: AuditEvent): Statement[] {
  const ids: ReadonlyArray<string | undefined> = event.targetIds?.length
    ? event.targetIds
    : [event.targetId];
  const perStatement = Math.floor(PLACEHOLDER_LIMIT[dialect] / VALUES_PER_ROW);
  const statements: Statement[] = [];
  for (let start = 0; start < ids.length; start += perStatement) {
    statements.push(insert(dialect, event, ids.slice(start, start + perStatement)));
  }
  return statements;
}

/** An `AuditLogStore` over `flowpanel_audit_log`, for adapters that can run SQL. */
export function sqlAuditLog(dialect: AuditSqlDialect, executor: AuditSqlExecutor): AuditLogStore {
  return {
    async append(event) {
      const statements = inserts(dialect, event);
      if (statements.length > 1 && executor.transaction) {
        let started = false;
        try {
          await executor.transaction(async (tx) => {
            started = true;
            for (const statement of statements) await tx.run(statement);
          });
          return;
        } catch (err) {
          if (started) throw err;
        }
      }
      for (const statement of statements) await executor.run(statement);
    },

    async list(query) {
      const limit = bounded(query.limit, 500);
      const offset = bounded(query.offset, Number.MAX_SAFE_INTEGER);
      const page = where(
        new Statement().text(`SELECT ${selectColumns(dialect)} FROM ${TABLE}`),
        dialect,
        query,
      ).text(` ORDER BY at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`);
      const total = where(
        new Statement().text(`SELECT COUNT(*) AS n FROM (SELECT 1 AS one FROM ${TABLE}`),
        dialect,
        query,
      ).text(` LIMIT ${AUDIT_COUNT_CAP + 1}) counted`);
      const [rows, totals] = await Promise.all([executor.rows(page), executor.rows(total)]);
      const found = count(dialect, totals[0]?.n);
      return {
        entries: rows.map((row) => ({
          id: String(row.id),
          actorId: text(row.actor_id),
          actorName: text(row.actor_name),
          action: String(row.action),
          resource: text(row.resource),
          targetId: text(row.target_id),
          diff: readDiff(row.diff),
          at: readTimestamp(row.at),
        })),
        total: Math.min(found, AUDIT_COUNT_CAP),
        capped: found > AUDIT_COUNT_CAP,
      };
    },

    async facets(query): Promise<AuditLogFacets> {
      const actors = where(
        new Statement().text(`SELECT actor_id, MAX(actor_name) AS actor_name FROM ${TABLE}`),
        dialect,
        query,
        ["actor_id IS NOT NULL"],
      ).text(` GROUP BY actor_id ORDER BY MAX(at) DESC LIMIT ${FACET_LIMIT}`);
      const actions = where(
        new Statement().text(`SELECT DISTINCT action FROM ${TABLE}`),
        dialect,
        query,
      ).text(` ORDER BY action LIMIT ${FACET_LIMIT}`);
      const [actorRows, actionRows] = await Promise.all([
        executor.rows(actors),
        executor.rows(actions),
      ]);
      return {
        actors: actorRows.map((row) => ({
          id: String(row.actor_id),
          name: text(row.actor_name),
        })),
        actions: actionRows.map((row) => String(row.action)),
      };
    },
  };
}
