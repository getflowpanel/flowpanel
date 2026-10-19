import type { Adapter, ItemQueryContext, ListResult, MutationContext } from "@flowpanel/core";
import { type AnyColumn, and, asc, desc, eq, type SQL, sql, type Table } from "drizzle-orm";
import { columnsOf } from "./columns";
import { type DrizzleDialect, resolveDialect } from "./dialect";
import {
  type ColumnsRecord,
  type DrizzleLikeDb,
  firstRow,
  isInvalidKeyText,
  pkFor,
  type WriteTarget,
} from "./drizzle-db";
import { introspect } from "./introspect";
import { createMigrationMethods } from "./migration-executor";
import type { MigrationDb } from "./migrations";
import { inferSchema } from "./schema";
import { captureScopeClauses } from "./scope";
import { drizzleAuditLog, rawSqlRows } from "./sql-params";
import { runInTransaction } from "./transaction";
import { buildWhere, countRows } from "./where";
import { DIALECT_WRITES } from "./writes";

const EMPTY_PROJECTION = Symbol("flowpanel.emptyProjection");

export interface DrizzleAdapterOptions<DB = unknown> {
  db: DB;
  schema: Record<string, unknown>;
  /** Inferred from `schema` when omitted. */
  dialect?: DrizzleDialect;
  /**
   * Reads zoneless `YYYY-MM-DD HH:mm:ss` strings as UTC `Date`s; turn off if a text column holds timestamp-shaped strings `select *` cannot cast.
   * @defaultValue true
   */
  parseDates?: boolean;
}

function projection(cols: ColumnsRecord, select: readonly string[] | undefined) {
  if (select === undefined) return undefined;
  if (select.length === 0) return EMPTY_PROJECTION;
  if (select.length > 1024) throw new Error("drizzleAdapter: select exceeds 1024 columns");
  const selected: ColumnsRecord = {};
  for (const name of new Set(select)) {
    const column = cols[name];
    if (!column) throw new Error(`drizzleAdapter: select contains unknown column "${name}"`);
    selected[name] = column;
  }
  return selected;
}

function selectFrom(
  db: DrizzleLikeDb,
  ref: Table,
  selected: ColumnsRecord | typeof EMPTY_PROJECTION | undefined,
) {
  if (selected === EMPTY_PROJECTION) return db.select({ __fp_exists: sql<number>`1` }).from(ref);
  return (selected ? db.select(selected) : db.select()).from(ref);
}

function writeTarget(ref: Table): WriteTarget {
  const cols = columnsOf(ref) as ColumnsRecord;
  const pk = pkFor(cols);
  return { ref, cols, pk, pkCol: cols[pk] };
}

/** The row a delete or restore addresses, inside the caller's scope. */
function keyedWhere(target: WriteTarget, id: string, ctx: MutationContext<unknown>): SQL {
  if (!target.pkCol) {
    throw new Error(`drizzleAdapter: primary key column "${target.pk}" not found`);
  }
  return and(eq(target.pkCol, id), ...captureScopeClauses(ctx)) as SQL;
}

/** A sort that puts empty values last in both directions, whatever the database's own default. */
function sortTerms(
  col: AnyColumn,
  dir: "asc" | "desc",
  dialect: DrizzleDialect,
): Array<SQL | AnyColumn> {
  const nullable = Reflect.get(col, "notNull") !== true;
  if (!nullable) return [dir === "asc" ? asc(col) : desc(col)];
  if (dialect === "pg") return [sql`${col} ${sql.raw(dir)} nulls last`];
  return dir === "asc" ? [sql`${col} is null`, asc(col)] : [desc(col)];
}

export function drizzleAdapter<DB>(opts: DrizzleAdapterOptions<DB>): Adapter<DB, Table> {
  const dialect = resolveDialect(opts);
  const writes = DIALECT_WRITES[dialect];
  const migrationMethods = createMigrationMethods(opts.db as MigrationDb, dialect);

  function getDb(ctx: { db?: unknown } = {}): DrizzleLikeDb {
    return (ctx.db ?? opts.db) as DrizzleLikeDb;
  }

  return {
    kind: "drizzle",
    db: opts.db,
    transaction: <T>(run: (db: DB) => Promise<T>) =>
      runInTransaction(opts.db, (tx) => run(tx as DB)),

    introspect: (ref) => introspect(ref),
    inferSchema: (ref) => inferSchema(ref),

    async list(ref, ctx): Promise<ListResult<unknown>> {
      const cols = columnsOf(ref) as ColumnsRecord;
      const db = getDb();
      const selected = projection(cols, ctx.select);
      const where = buildWhere(cols, ctx, dialect);
      const sortCol = ctx.sort?.field ? cols[ctx.sort.field] : undefined;
      const tieCols = (ctx.tiebreak ?? []).flatMap((field) => {
        const col = field === ctx.sort?.field ? undefined : cols[field];
        return col ? [asc(col)] : [];
      });
      const orderBy = [
        ...(sortCol ? sortTerms(sortCol, ctx.sort?.dir ?? "desc", dialect) : []),
        ...tieCols,
      ];

      let q: unknown = selectFrom(db, ref, selected);
      if (where) q = (q as { where: (w: SQL) => unknown }).where(where);
      if (orderBy.length > 0) {
        q = (q as { orderBy: (...o: Array<SQL | AnyColumn>) => unknown }).orderBy(...orderBy);
      }
      const offset = (ctx.page - 1) * ctx.pageSize;
      const rows = (await (
        q as { limit: (n: number) => { offset: (o: number) => Promise<unknown[]> } }
      )
        .limit(ctx.pageSize)
        .offset(offset)) as unknown[];

      return {
        rows: selected === EMPTY_PROJECTION ? rows.map(() => ({})) : rows,
        total: await countRows(db, ref, where, dialect),
        page: ctx.page,
        pageSize: ctx.pageSize,
      };
    },

    async get(ref, ctx: ItemQueryContext) {
      const cols = columnsOf(ref) as ColumnsRecord;
      const pkCol = cols[pkFor(cols)];
      if (!pkCol) return null;
      const selected = projection(cols, ctx.select);
      const where = and(eq(pkCol, ctx.id), ...captureScopeClauses(ctx)) as SQL;
      try {
        const row = await firstRow(selectFrom(getDb(), ref, selected), where);
        if (selected === EMPTY_PROJECTION) return row ? {} : null;
        return row ?? null;
      } catch (err) {
        if (isInvalidKeyText(err)) return null;
        throw err;
      }
    },

    async create(ref, ctx: MutationContext<unknown>) {
      const target = writeTarget(ref);
      const input = ctx.input as Record<string, unknown>;
      const scope = captureScopeClauses(ctx);
      return scope.length === 0
        ? writes.insert(getDb(ctx), target, input)
        : writes.scopedInsert(getDb(ctx), target, input, scope);
    },

    async update(ref, ctx: MutationContext<unknown>) {
      const target = writeTarget(ref);
      if (!ctx.id) throw new Error("update requires ctx.id");
      const input = ctx.input as Record<string, unknown>;
      const scope = captureScopeClauses(ctx);
      if (scope.length > 0) return writes.scopedUpdate(getDb(ctx), target, input, ctx.id, scope);
      return writes.update(getDb(ctx), target, input, ctx.id, keyedWhere(target, ctx.id, ctx));
    },

    async delete(ref, ctx: MutationContext<unknown>) {
      const target = writeTarget(ref);
      if (!ctx.id) throw new Error("delete requires ctx.id");
      const where = keyedWhere(target, ctx.id, ctx);
      const softCol = ctx.softDelete?.column;
      const db = getDb(ctx);
      if (softCol && target.cols[softCol]) {
        await db
          .update(ref)
          .set({ [softCol]: new Date() })
          .where(where);
      } else {
        await db.delete(ref).where(where);
      }
    },

    async restore(ref, ctx: MutationContext<unknown>) {
      const softCol = ctx.softDelete?.column;
      if (!softCol) throw new Error("restore requires ctx.softDelete to be configured");
      if (!ctx.id) throw new Error("restore requires ctx.id");
      await getDb(ctx)
        .update(ref)
        .set({ [softCol]: null })
        .where(keyedWhere(writeTarget(ref), ctx.id, ctx));
    },

    sql: <Row = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]) =>
      rawSqlRows<Row>(opts.db as MigrationDb, dialect, strings, values, {
        parseDates: opts.parseDates ?? true,
      }),

    async count(ref, where): Promise<number> {
      const cols = columnsOf(ref) as ColumnsRecord;
      const filter = buildWhere(cols, { filters: where ?? {} }, dialect);
      return countRows(opts.db as DrizzleLikeDb, ref, filter, dialect);
    },
    auditLog: drizzleAuditLog(opts.db as MigrationDb, dialect),
    ...migrationMethods,
  };
}
