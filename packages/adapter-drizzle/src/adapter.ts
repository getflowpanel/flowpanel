import type {
  Adapter,
  ItemQueryContext,
  ListQueryContext,
  ListResult,
  MutationContext,
} from "@flowpanel/core";
import {
  and,
  type AnyColumn,
  asc,
  desc,
  eq,
  getTableColumns,
  ilike,
  like,
  or,
  type SQL,
  sql,
  type Table,
} from "drizzle-orm";
import { introspect } from "./introspect.js";
import { inferSchema } from "./schema.js";

/**
 * Loose shape of a drizzle DB instance. Every dialect-specific class
 * (`NodePgDatabase`, `BetterSQLite3Database`, `MySql2Database`, …) implements
 * these methods, but their generic parameters differ enough that we'd need
 * the user's exact import to type them precisely. We keep `DB` user-supplied
 * via the `drizzleAdapter<DB>(...)` factory and use this internal shape only
 * for the query-builder erasure inside helpers.
 */
interface DrizzleLikeDb {
  select: (...args: unknown[]) => {
    from: (ref: Table) => {
      where: (w: SQL | undefined) => unknown;
      orderBy: (o: SQL | AnyColumn) => unknown;
      limit: (n: number) => unknown;
      [k: string]: unknown;
    };
  };
  insert: (ref: Table) => {
    values: (v: Record<string, unknown>) => Promise<unknown> & {
      returning: () => Promise<Record<string, unknown>[]>;
    };
  };
  update: (ref: Table) => {
    set: (v: Record<string, unknown>) => {
      where: (w: SQL) => Promise<unknown> & {
        returning: () => Promise<Record<string, unknown>[]>;
      };
    };
  };
  delete: (ref: Table) => { where: (w: SQL) => Promise<unknown> };
  execute: (q: SQL) => Promise<unknown>;
}

/**
 * Drizzle column metadata we read in helpers. The public `AnyColumn` type
 * declares these as `readonly` instance fields, but the structural subset
 * we touch (`primary`, `dataType`, `columnType`, `enumValues`, `notNull`,
 * `isUnique`) is a runtime-only contract — not all of these surface in the
 * declared type. We narrow via an intersection rather than `extends` so
 * the read-side helpers don't have to satisfy the full `Column` shape.
 */
type DrizzleColumnLike = AnyColumn & {
  primary?: boolean;
  notNull?: boolean;
  isUnique?: boolean;
  dataType?: string;
  columnType?: string;
  enumValues?: readonly string[];
};

type ColumnsRecord = Record<string, DrizzleColumnLike>;

export interface DrizzleAdapterOptions<DB = unknown> {
  db: DB;
  schema: Record<string, unknown>;
  dialect?: "pg" | "mysql" | "sqlite";
}

export function drizzleAdapter<DB>(opts: {
  db: DB;
  schema: Record<string, unknown>;
  dialect?: "pg" | "mysql" | "sqlite";
}): Adapter<DB, Table> {
  const dialect = opts.dialect ?? "pg";
  const likeOp = dialect === "pg" ? ilike : like;

  function getDb(ctx: { db?: unknown }): DrizzleLikeDb {
    return (ctx.db ?? opts.db) as DrizzleLikeDb;
  }

  function pkFor(cols: ColumnsRecord): string {
    const entry = Object.entries(cols).find(([, c]) => c.primary);
    return entry?.[0] ?? "id";
  }

  function buildWhere(cols: ColumnsRecord, ctx: ListQueryContext<unknown>): SQL | undefined {
    const clauses: SQL[] = [];
    for (const [k, v] of Object.entries(ctx.filters)) {
      if (v === undefined || v === null || v === "") continue;
      const col = cols[k];
      if (col) clauses.push(eq(col, v));
    }
    if (ctx.search) {
      const textCols = Object.values(cols).filter((c) => {
        const dt = String(c.dataType ?? "").toLowerCase();
        const ct = String(c.columnType ?? "").toLowerCase();
        return (
          (dt.includes("string") ||
            dt.includes("text") ||
            ct.includes("text") ||
            ct.includes("varchar")) &&
          !c.enumValues
        );
      });
      if (textCols.length) {
        const ors = textCols.map((c) => likeOp(c, `%${ctx.search}%`));
        // drizzle's `or(...)` typing wants at least one arg; runtime accepts the spread
        const orClause = or(...ors);
        if (orClause) clauses.push(orClause);
      }
    }
    const softCol = ctx.softDelete?.column;
    if (softCol) {
      const col = cols[softCol];
      if (col) clauses.push(sql`${col} IS NULL`);
    }
    return clauses.length ? and(...clauses) : undefined;
  }

  return {
    kind: "drizzle",
    db: opts.db,

    introspect: (ref) => introspect(ref),
    inferSchema: (ref) => inferSchema(ref),

    async list(ref, ctx): Promise<ListResult<unknown>> {
      const cols = getTableColumns(ref) as ColumnsRecord;
      const db = getDb(ctx);
      const where = buildWhere(cols, ctx);
      const sortField = ctx.sort?.field;
      const sortCol = sortField ? cols[sortField] : undefined;
      const orderBy = sortCol
        ? ctx.sort?.dir === "asc"
          ? asc(sortCol)
          : desc(sortCol)
        : undefined;

      // drizzle's chain API is dialect-erased here — successive `.where/.orderBy/.limit`
      // calls return chain objects whose type union we don't reconstruct.
      let q: unknown = db.select().from(ref);
      if (where) q = (q as { where: (w: SQL) => unknown }).where(where);
      if (orderBy) q = (q as { orderBy: (o: SQL | AnyColumn) => unknown }).orderBy(orderBy);
      const offset = (ctx.page - 1) * ctx.pageSize;
      const rows = (await (
        q as { limit: (n: number) => { offset: (o: number) => Promise<unknown[]> } }
      )
        .limit(ctx.pageSize)
        .offset(offset)) as unknown[];

      const countExpr = dialect === "pg" ? sql<number>`count(*)::int` : sql<number>`count(*)`;
      let countQ: unknown = db.select({ c: countExpr }).from(ref);
      if (where) countQ = (countQ as { where: (w: SQL) => unknown }).where(where);
      const [countRow] = (await (countQ as Promise<Array<{ c: number }>>)) ?? [];
      const total = Number(countRow?.c ?? 0);

      return { rows, total, page: ctx.page, pageSize: ctx.pageSize };
    },

    async get(ref, ctx: ItemQueryContext) {
      const cols = getTableColumns(ref) as ColumnsRecord;
      const db = getDb(ctx);
      const pk = pkFor(cols);
      const pkCol = cols[pk];
      if (!pkCol) return null;
      const rows = (await (
        db.select().from(ref) as unknown as {
          where: (w: SQL) => { limit: (n: number) => Promise<unknown[]> };
        }
      )
        .where(eq(pkCol, ctx.id))
        .limit(1)) as unknown[];
      return rows[0] ?? null;
    },

    async create(ref, ctx: MutationContext<unknown>) {
      const cols = getTableColumns(ref) as ColumnsRecord;
      const db = getDb(ctx);
      const input = ctx.input as Record<string, unknown>;
      if (dialect === "mysql" || dialect === "sqlite") {
        await db.insert(ref).values(input);
        const pk = pkFor(cols);
        const id = input[pk];
        if (id === undefined || id === null) {
          throw new Error(
            `drizzleAdapter: create requires explicit primary key on dialect "${dialect}" ` +
              `(auto-generated PKs not yet supported for non-RETURNING dialects). ` +
              `Provide input.${pk}, or use dialect "pg" which supports RETURNING.`,
          );
        }
        const pkCol = cols[pk];
        if (!pkCol) throw new Error(`drizzleAdapter: primary key column "${pk}" not found`);
        const rows = (await (
          db.select().from(ref) as unknown as {
            where: (w: SQL) => { limit: (n: number) => Promise<unknown[]> };
          }
        )
          .where(eq(pkCol, id))
          .limit(1)) as unknown[];
        return rows[0];
      }
      const rows = await db.insert(ref).values(input).returning();
      return rows[0];
    },

    async update(ref, ctx: MutationContext<unknown>) {
      const cols = getTableColumns(ref) as ColumnsRecord;
      const db = getDb(ctx);
      const pk = pkFor(cols);
      if (!ctx.id) throw new Error("update requires ctx.id");
      const pkCol = cols[pk];
      if (!pkCol) throw new Error(`drizzleAdapter: primary key column "${pk}" not found`);
      const input = ctx.input as Record<string, unknown>;
      if (dialect === "mysql" || dialect === "sqlite") {
        await db.update(ref).set(input).where(eq(pkCol, ctx.id));
        const rows = (await (
          db.select().from(ref) as unknown as {
            where: (w: SQL) => { limit: (n: number) => Promise<unknown[]> };
          }
        )
          .where(eq(pkCol, ctx.id))
          .limit(1)) as unknown[];
        return rows[0];
      }
      const rows = await db.update(ref).set(input).where(eq(pkCol, ctx.id)).returning();
      return rows[0];
    },

    async delete(ref, ctx: MutationContext<unknown>) {
      const cols = getTableColumns(ref) as ColumnsRecord;
      const db = getDb(ctx);
      const pk = pkFor(cols);
      if (!ctx.id) throw new Error("delete requires ctx.id");
      const pkCol = cols[pk];
      if (!pkCol) throw new Error(`drizzleAdapter: primary key column "${pk}" not found`);
      const softCol = ctx.softDelete?.column;
      if (softCol && cols[softCol]) {
        await db
          .update(ref)
          .set({ [softCol]: new Date() })
          .where(eq(pkCol, ctx.id));
      } else {
        await db.delete(ref).where(eq(pkCol, ctx.id));
      }
    },

    async restore(ref, ctx: MutationContext<unknown>) {
      const cols = getTableColumns(ref) as ColumnsRecord;
      const db = getDb(ctx);
      const pk = pkFor(cols);
      const softCol = ctx.softDelete?.column;
      if (!softCol) throw new Error("restore requires ctx.softDelete to be configured");
      if (!ctx.id) throw new Error("restore requires ctx.id");
      const pkCol = cols[pk];
      if (!pkCol) throw new Error(`drizzleAdapter: primary key column "${pk}" not found`);
      await db
        .update(ref)
        .set({ [softCol]: null })
        .where(eq(pkCol, ctx.id));
    },

    // ── Migration bookkeeping (used by `flowpanel migrate`) ──────────────
    // We use drizzle's `sql` template tag for safe parameter binding.
    // `db.execute(sql, params)` is NOT honored by drizzle — Postgres saw
    // a literal `$1` and crashed with "there is no parameter $1".

    async runMigrationSql(rawSql: string): Promise<void> {
      const db = opts.db as DrizzleLikeDb;
      await db.execute(sql.raw(rawSql));
    },

    async listAppliedMigrations(): Promise<Set<string>> {
      const db = opts.db as DrizzleLikeDb;
      await db.execute(
        sql.raw(
          `CREATE TABLE IF NOT EXISTS _flowpanel_migrations (
            id text PRIMARY KEY,
            applied_at timestamptz NOT NULL DEFAULT now()
          )`,
        ),
      );
      const result: unknown = await db.execute(sql.raw(`SELECT id FROM _flowpanel_migrations`));
      const rows =
        (result as { rows?: Array<{ id: string }> }).rows ?? (result as Array<{ id: string }>);
      const ids = new Set<string>();
      for (const r of rows) ids.add(r.id);
      return ids;
    },

    async markMigrationApplied(id: string): Promise<void> {
      const db = opts.db as DrizzleLikeDb;
      await db.execute(sql`INSERT INTO _flowpanel_migrations (id) VALUES (${id})`);
    },
  };
}
