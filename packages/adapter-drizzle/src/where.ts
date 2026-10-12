import type { ListQueryContext } from "@flowpanel/core";
import { type FilterCondition, filterConditions, searchedFields } from "@flowpanel/core/internal";
import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  type SQL,
  sql,
  type Table,
} from "drizzle-orm";
import type { DrizzleDialect } from "./dialect";
import type { ColumnsRecord, DrizzleColumnLike, DrizzleLikeDb } from "./drizzle-db";
import { captureScopeClauses, type ScopeContext } from "./scope";

/** Everything `buildWhere` reads: a `list` context satisfies it, and so does a bare filter map. */
export type WhereContext = Pick<ListQueryContext<unknown>, "filters"> &
  Partial<
    Pick<ListQueryContext<unknown>, "search" | "searchFields" | "softDelete" | "includeDeleted">
  > &
  ScopeContext;

function isTextColumn(column: DrizzleColumnLike | undefined): boolean {
  if (!column || column.enumValues) return false;
  const dt = String(column.dataType ?? "").toLowerCase();
  const ct = String(column.columnType ?? "").toLowerCase();
  return (
    dt.includes("string") || dt.includes("text") || ct.includes("text") || ct.includes("varchar")
  );
}

function clauseFor(condition: FilterCondition, column: DrizzleColumnLike): SQL[] {
  switch (condition.op) {
    case "isNull":
      return [isNull(column)];
    case "notNull":
      return [isNotNull(column)];
    case "range":
      return [
        ...(condition.gte !== undefined ? [gte(column, condition.gte)] : []),
        ...(condition.lte !== undefined ? [lte(column, condition.lte)] : []),
      ];
    case "in":
      return [inArray(column, [...condition.values])];
    case "eq":
      return [eq(column, condition.value)];
  }
}

function searchClause(
  cols: ColumnsRecord,
  ctx: WhereContext,
  dialect: DrizzleDialect,
): SQL | undefined {
  const fields = searchedFields(ctx.search, ctx.searchFields, (f) => isTextColumn(cols[f]));
  if (!ctx.search || fields.length === 0) return undefined;
  // `%`/`_` in user input are literals, not wildcards; `!` is the ESCAPE character.
  const pattern = `%${ctx.search.replace(/[!%_]/g, "!$&")}%`;
  const like = dialect === "pg" ? sql`ILIKE` : sql`LIKE`;
  return or(...fields.map((f) => sql`${cols[f]} ${like} ${pattern} ESCAPE '!'`));
}

export function buildWhere(
  cols: ColumnsRecord,
  ctx: WhereContext,
  dialect: DrizzleDialect,
): SQL | undefined {
  const clauses: SQL[] = [];
  for (const condition of filterConditions(ctx.filters, (f) => cols[f] !== undefined)) {
    const column = cols[condition.field];
    if (column) clauses.push(...clauseFor(condition, column));
  }
  const search = searchClause(cols, ctx, dialect);
  if (search) clauses.push(search);
  const softCol = ctx.softDelete?.column ? cols[ctx.softDelete.column] : undefined;
  if (softCol && !ctx.includeDeleted) clauses.push(isNull(softCol));
  clauses.push(...captureScopeClauses(ctx));
  return clauses.length ? and(...clauses) : undefined;
}

export async function countRows(
  db: DrizzleLikeDb,
  ref: Table,
  where: SQL | undefined,
  dialect: DrizzleDialect,
): Promise<number> {
  const expr = dialect === "pg" ? sql<number>`count(*)::int` : sql<number>`count(*)`;
  let q: unknown = db.select({ c: expr }).from(ref);
  if (where) q = (q as { where: (w: SQL) => unknown }).where(where);
  const [row] = (await (q as Promise<Array<{ c: number }>>)) ?? [];
  return Number(row?.c ?? 0);
}
