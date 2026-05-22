import type {
  Adapter,
  ItemQueryContext,
  ListQueryContext,
  ListResult,
  MutationContext,
} from "@flowpanel/core";
import { and, asc, desc, eq, getTableColumns, ilike, like, or, sql } from "drizzle-orm";
import { introspect } from "./introspect.js";
import { inferSchema } from "./schema.js";

export interface DrizzleAdapterOptions<DB = unknown> {
  db: DB;
  schema: Record<string, unknown>;
  dialect?: "pg" | "mysql" | "sqlite";
}

export function drizzleAdapter<DB>(opts: {
  db: DB;
  schema: Record<string, unknown>;
  dialect?: "pg" | "mysql" | "sqlite";
}): Adapter<DB> {
  const dialect = opts.dialect ?? "pg";
  const likeOp = dialect === "pg" ? ilike : like;

  function getDb(ctx: { db: unknown }): any {
    return (ctx.db ?? opts.db) as any;
  }

  function pkFor(cols: Record<string, any>): string {
    const entry = Object.entries(cols).find(([, c]) => c.primary);
    return entry?.[0] ?? "id";
  }

  function buildWhere(cols: Record<string, any>, ctx: ListQueryContext<any>) {
    const clauses: unknown[] = [];
    for (const [k, v] of Object.entries(ctx.filters)) {
      if (v === undefined || v === null || v === "") continue;
      if (cols[k]) clauses.push(eq(cols[k], v));
    }
    if (ctx.search) {
      const textCols = Object.values<any>(cols).filter((c) => {
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
        clauses.push(or(...(ors as any)));
      }
    }
    if (ctx.softDelete?.column && cols[ctx.softDelete.column]) {
      clauses.push(sql`${cols[ctx.softDelete.column]} IS NULL`);
    }
    return clauses.length ? and(...(clauses as any)) : undefined;
  }

  return {
    kind: "drizzle",
    db: opts.db,

    introspect: (ref) => introspect(ref),
    inferSchema: (ref) => inferSchema(ref),

    async list(ref: any, ctx: ListQueryContext<any>): Promise<ListResult<any>> {
      const cols = getTableColumns(ref);
      const db = getDb(ctx);
      const where = buildWhere(cols as any, ctx);
      const sortCol =
        ctx.sort && (cols as any)[ctx.sort.field] ? (cols as any)[ctx.sort.field] : null;
      const orderBy = sortCol
        ? ctx.sort?.dir === "asc"
          ? asc(sortCol as any)
          : desc(sortCol as any)
        : undefined;

      let q: any = db.select().from(ref);
      if (where) q = q.where(where);
      if (orderBy) q = q.orderBy(orderBy);
      const offset = (ctx.page - 1) * ctx.pageSize;
      const rows = await q.limit(ctx.pageSize).offset(offset);

      const countExpr = dialect === "pg" ? sql<number>`count(*)::int` : sql<number>`count(*)`;
      let countQ: any = db.select({ c: countExpr }).from(ref);
      if (where) countQ = countQ.where(where);
      const [countRow] = await countQ;
      const total = Number(countRow?.c ?? 0);

      return { rows, total, page: ctx.page, pageSize: ctx.pageSize };
    },

    async get(ref: any, ctx: ItemQueryContext) {
      const cols = getTableColumns(ref);
      const db = getDb(ctx as any);
      const pk = pkFor(cols as any);
      const rows = await db
        .select()
        .from(ref)
        .where(eq((cols as any)[pk], ctx.id))
        .limit(1);
      return rows[0] ?? null;
    },

    async create(ref: any, ctx: MutationContext<any>) {
      const cols = getTableColumns(ref);
      const db = getDb(ctx as any);
      if (dialect === "mysql" || dialect === "sqlite") {
        await db.insert(ref).values(ctx.input as any);
        const pk = pkFor(cols as any);
        const id = (ctx.input as Record<string, unknown>)[pk];
        if (id === undefined || id === null) {
          throw new Error(
            `drizzleAdapter: create requires explicit primary key on dialect "${dialect}" ` +
              `(auto-generated PKs not yet supported for non-RETURNING dialects). ` +
              `Provide input.${pk}, or use dialect "pg" which supports RETURNING.`,
          );
        }
        const rows = await db
          .select()
          .from(ref)
          .where(eq((cols as any)[pk], id))
          .limit(1);
        return rows[0];
      }
      const rows = await db
        .insert(ref)
        .values(ctx.input as any)
        .returning();
      return rows[0];
    },

    async update(ref: any, ctx: MutationContext<any>) {
      const cols = getTableColumns(ref);
      const db = getDb(ctx as any);
      const pk = pkFor(cols as any);
      if (!ctx.id) throw new Error("update requires ctx.id");
      if (dialect === "mysql" || dialect === "sqlite") {
        await db
          .update(ref)
          .set(ctx.input as any)
          .where(eq((cols as any)[pk], ctx.id));
        const rows = await db
          .select()
          .from(ref)
          .where(eq((cols as any)[pk], ctx.id))
          .limit(1);
        return rows[0];
      }
      const rows = await db
        .update(ref)
        .set(ctx.input as any)
        .where(eq((cols as any)[pk], ctx.id))
        .returning();
      return rows[0];
    },

    async delete(ref: any, ctx: MutationContext<any>) {
      const cols = getTableColumns(ref);
      const db = getDb(ctx as any);
      const pk = pkFor(cols as any);
      if (!ctx.id) throw new Error("delete requires ctx.id");
      const softCol = ctx.softDelete?.column;
      if (softCol && (cols as any)[softCol]) {
        await db
          .update(ref)
          .set({ [softCol]: new Date() })
          .where(eq((cols as any)[pk], ctx.id));
      } else {
        await db.delete(ref).where(eq((cols as any)[pk], ctx.id));
      }
    },

    async restore(ref: any, ctx: MutationContext<any>) {
      const cols = getTableColumns(ref);
      const db = getDb(ctx as any);
      const pk = pkFor(cols as any);
      const softCol = ctx.softDelete?.column;
      if (!softCol) throw new Error("restore requires ctx.softDelete to be configured");
      if (!ctx.id) throw new Error("restore requires ctx.id");
      await db
        .update(ref)
        .set({ [softCol]: null })
        .where(eq((cols as any)[pk], ctx.id));
    },

    // ── Migration bookkeeping (used by `flowpanel migrate`) ──────────────
    // We use drizzle's `sql` template tag for safe parameter binding.
    // `db.execute(sql, params)` is NOT honored by drizzle — Postgres saw
    // a literal `$1` and crashed with "there is no parameter $1".

    async runMigrationSql(rawSql: string): Promise<void> {
      const db = opts.db as any;
      await db.execute(sql.raw(rawSql));
    },

    async listAppliedMigrations(): Promise<Set<string>> {
      const db = opts.db as any;
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
      const db = opts.db as any;
      await db.execute(sql`INSERT INTO _flowpanel_migrations (id) VALUES (${id})`);
    },
  };
}
