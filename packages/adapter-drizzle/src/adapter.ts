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

export interface DrizzleAdapterOptions {
  db: unknown;
  schema: Record<string, unknown>;
  dialect?: "pg" | "mysql" | "sqlite";
}

export function drizzleAdapter(opts: DrizzleAdapterOptions): Adapter {
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

      let countQ: any = db.select({ c: sql<number>`count(*)::int` }).from(ref);
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
      const db = getDb(ctx as any);
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
      await db.delete(ref).where(eq((cols as any)[pk], ctx.id));
    },
  };
}
