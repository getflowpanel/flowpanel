import type { AuditLogQuery, AuditLogVisibility } from "@flowpanel/core";
import { DASHBOARD_ACTION_PREFIX, DASHBOARD_AUDIT_RESOURCE } from "../internal/dashboard-audit";

export type AuditSqlDialect = "postgresql" | "mysql" | "sqlite";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether PostgreSQL can compare `id` with its uuid primary key. */
export function isUuid(id: string): boolean {
  return UUID.test(id);
}

export class Statement {
  readonly strings: string[] = [""];
  readonly values: unknown[] = [];

  text(chunk: string): this {
    this.strings[this.strings.length - 1] += chunk;
    return this;
  }

  value(value: unknown, cast = ""): this {
    this.values.push(value);
    this.strings.push(cast);
    return this;
  }
}

function timestamp(dialect: AuditSqlDialect, at: Date): string {
  const iso = at.toISOString();
  return dialect === "mysql" ? iso.slice(0, 23).replace("T", " ") : iso;
}

export function timestampValue(
  statement: Statement,
  dialect: AuditSqlDialect,
  at: Date,
): Statement {
  return statement.value(timestamp(dialect, at), dialect === "postgresql" ? "::timestamptz" : "");
}

function inList(statement: Statement, column: string, values: readonly string[]): Statement {
  statement.text(`${column} IN (`);
  values.forEach((value, index) => {
    if (index > 0) statement.text(", ");
    statement.value(value);
  });
  return statement.text(")");
}

function visibility(statement: Statement, visible: AuditLogVisibility): Statement {
  const { resources, actions } = visible;
  statement.text("(");
  if (resources.length > 0) inList(statement, "resource", resources).text(" OR ");
  statement.text(`(resource IS NULL AND action NOT LIKE '${DASHBOARD_ACTION_PREFIX}%')`);
  if (actions.length > 0) {
    statement.text(" OR ((resource IS NULL OR resource = ").value(DASHBOARD_AUDIT_RESOURCE);
    inList(statement.text(") AND "), "action", actions).text(")");
  }
  return statement.text(")");
}

export function where(
  statement: Statement,
  dialect: AuditSqlDialect,
  query: Partial<AuditLogQuery>,
  extra: readonly string[] = [],
) {
  const conditions: Array<(s: Statement) => void> = [];
  const equal = (column: string, value: string | undefined) => {
    if (value !== undefined) conditions.push((s) => s.text(`${column} = `).value(value));
  };
  if (query.scope) {
    const key = query.scope.key;
    conditions.push((s) =>
      key === null ? s.text("scope_key IS NULL") : s.text("scope_key = ").value(key),
    );
  }
  const { visible } = query;
  if (visible) conditions.push((s) => visibility(s, visible));
  const { id } = query;
  if (id !== undefined && dialect === "postgresql" && !isUuid(id)) {
    conditions.push((s) => s.text("1 = 0"));
  } else if (id !== undefined) {
    conditions.push((s) => s.text("id = ").value(id, dialect === "postgresql" ? "::uuid" : ""));
  }
  equal("resource", query.resource);
  equal("target_id", query.targetId);
  equal("actor_id", query.actorId);
  equal("action", query.action);
  const { from, to } = query;
  if (from) conditions.push((s) => timestampValue(s.text("at >= "), dialect, from));
  if (to) conditions.push((s) => timestampValue(s.text("at < "), dialect, to));
  for (const condition of extra) conditions.push((s) => s.text(condition));
  conditions.forEach((condition, index) => {
    statement.text(index === 0 ? " WHERE " : " AND ");
    condition(statement);
  });
  return statement;
}
