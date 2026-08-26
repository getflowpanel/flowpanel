// LOC-OK: one adapter contract implementation — the dialect branches inside
// list/create/update only make sense read together.
import type {
  Adapter,
  ItemQueryContext,
  ListQueryContext,
  ListResult,
  MutationContext,
} from "@flowpanel/core";
import {
  FlowpanelAccessError,
  isFilterInValue,
  isFilterRangeValue,
  resolveScopeApplier,
} from "@flowpanel/core";
import {
  type AnyColumn,
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lte,
  or,
  type SQL,
  sql,
  type Table,
} from "drizzle-orm";
import { type DrizzleDialect, resolveDialect } from "./dialect";
import { introspect } from "./introspect";
import { type MigrationDb, migrationsTableDdl, runRaw, selectMigrationIds } from "./migrations";
import { inferSchema } from "./schema";

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
  transaction: <T>(fn: (tx: DrizzleLikeDb) => Promise<T>) => Promise<T>;
}

interface ScopeContext {
  boundScope?: { apply(query: unknown): unknown };
  applyScope?: (query: unknown) => unknown;
  scopeRequired?: boolean;
}

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
  /** Inferred from `schema` when omitted. */
  dialect?: DrizzleDialect;
}

export function drizzleAdapter<DB>(opts: DrizzleAdapterOptions<DB>): Adapter<DB, Table> {
  const dialect = resolveDialect(opts);
  const likeOp = dialect === "pg" ? ilike : like;

  function getDb(ctx: { db?: unknown }): DrizzleLikeDb {
    return (ctx.db ?? opts.db) as DrizzleLikeDb;
  }

  function pkFor(cols: ColumnsRecord): string {
    const entry = Object.entries(cols).find(([, c]) => c.primary);
    return entry?.[0] ?? "id";
  }

  /** Runs the tenant predicate against a probe to collect the conditions it applies. */
  function captureScopeClauses(ctx: ScopeContext): SQL[] {
    const applyScope = resolveScopeApplier(ctx);
    if (!applyScope) return [];
    const captured: SQL[] = [];
    const probe = {
      where(cond: SQL) {
        captured.push(cond);
        return probe;
      },
    };
    applyScope(probe);
    if (ctx.scopeRequired && captured.length === 0) {
      throw new FlowpanelAccessError(
        "scope required but the bound Drizzle predicate added no where clause. " +
          "Refusing to run an unscoped query.",
      );
    }
    return captured;
  }

  function projection(cols: ColumnsRecord, select: readonly string[] | undefined) {
    if (select === undefined) return undefined;
    if (select.length === 0) throw new Error("drizzleAdapter: select must contain a column");
    if (select.length > 1024) throw new Error("drizzleAdapter: select exceeds 1024 columns");
    const selected: ColumnsRecord = {};
    for (const name of new Set(select)) {
      const column = cols[name];
      if (!column) throw new Error(`drizzleAdapter: select contains unknown column "${name}"`);
      selected[name] = column;
    }
    return selected;
  }

  function selectFrom(db: DrizzleLikeDb, ref: Table, selected: ColumnsRecord | undefined) {
    return (selected ? db.select(selected) : db.select()).from(ref);
  }

  /** mysql has no RETURNING, so the row is read back by its caller-supplied id. */
  async function insertRow(
    handle: DrizzleLikeDb,
    ref: Table,
    pk: string,
    pkCol: DrizzleColumnLike | undefined,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown> | undefined> {
    if (dialect === "mysql") {
      await handle.insert(ref).values(input);
      const id = input[pk];
      if (id === undefined || id === null) {
        throw new Error(
          `drizzleAdapter: create requires explicit primary key on dialect "mysql" ` +
            `(auto-generated PKs not yet supported for mysql, which has no RETURNING). ` +
            `Provide input.${pk}, or use dialect "pg" / "sqlite", both of which support RETURNING.`,
        );
      }
      if (!pkCol) throw new Error(`drizzleAdapter: primary key column "${pk}" not found`);
      const rows = (await (
        handle.select().from(ref) as unknown as {
          where: (w: SQL) => { limit: (n: number) => Promise<unknown[]> };
        }
      )
        .where(eq(pkCol, id))
        .limit(1)) as Record<string, unknown>[];
      return rows[0];
    }
    const rows = await handle.insert(ref).values(input).returning();
    return rows[0];
  }

  async function rowSatisfiesScope(
    handle: DrizzleLikeDb,
    ref: Table,
    pkCol: DrizzleColumnLike,
    id: unknown,
    scopeClauses: SQL[],
  ): Promise<boolean> {
    const scopedWhere = and(eq(pkCol, id), ...scopeClauses) as SQL;
    const check = (await (
      handle.select().from(ref) as unknown as {
        where: (w: SQL) => { limit: (n: number) => Promise<unknown[]> };
      }
    )
      .where(scopedWhere)
      .limit(1)) as unknown[];
    return check.length > 0;
  }

  function buildWhere(cols: ColumnsRecord, ctx: ListQueryContext<unknown>): SQL | undefined {
    const clauses: SQL[] = [];
    for (const [k, v] of Object.entries(ctx.filters)) {
      if (v === undefined || v === null || v === "") continue;
      const col = cols[k];
      if (!col) continue;
      if (v === "__null__") {
        clauses.push(isNull(col));
        continue;
      }
      if (v === "__notnull__") {
        clauses.push(isNotNull(col));
        continue;
      }
      if (isFilterRangeValue(v)) {
        if (v.gte !== undefined) clauses.push(gte(col, v.gte));
        if (v.lte !== undefined) clauses.push(lte(col, v.lte));
        continue;
      }
      if (isFilterInValue(v)) {
        if (v.values.length > 0) clauses.push(inArray(col, v.values));
        continue;
      }
      clauses.push(eq(col, v));
    }
    if (ctx.search && ctx.searchFields?.length) {
      const textCols = ctx.searchFields
        .map((f) => cols[f])
        .filter((c): c is DrizzleColumnLike => {
          if (!c) return false;
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
        const orClause = or(...ors);
        if (orClause) clauses.push(orClause);
      }
    }
    const softCol = ctx.softDelete?.column;
    if (softCol && !ctx.includeDeleted) {
      const col = cols[softCol];
      if (col) clauses.push(sql`${col} IS NULL`);
    }
    for (const c of captureScopeClauses(ctx)) clauses.push(c);
    return clauses.length ? and(...clauses) : undefined;
  }

  return {
    kind: "drizzle",
    db: opts.db,
    transaction: (run) => (opts.db as DrizzleLikeDb).transaction((tx) => run(tx as unknown as DB)),

    introspect: (ref) => introspect(ref),
    inferSchema: (ref) => inferSchema(ref),

    async list(ref, ctx): Promise<ListResult<unknown>> {
      const cols = getTableColumns(ref) as ColumnsRecord;
      const db = getDb(ctx);
      const selected = projection(cols, ctx.select);
      const where = buildWhere(cols, ctx);
      const sortField = ctx.sort?.field;
      const sortCol = sortField ? cols[sortField] : undefined;
      const orderBy = sortCol
        ? ctx.sort?.dir === "asc"
          ? asc(sortCol)
          : desc(sortCol)
        : undefined;

      let q: unknown = selectFrom(db, ref, selected);
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
      const selected = projection(cols, ctx.select);
      const where = and(eq(pkCol, ctx.id), ...captureScopeClauses(ctx)) as SQL;
      const rows = (await (
        selectFrom(db, ref, selected) as unknown as {
          where: (w: SQL) => { limit: (n: number) => Promise<unknown[]> };
        }
      )
        .where(where)
        .limit(1)) as unknown[];
      return rows[0] ?? null;
    },

    async create(ref, ctx: MutationContext<unknown>) {
      const cols = getTableColumns(ref) as ColumnsRecord;
      const db = getDb(ctx);
      const input = ctx.input as Record<string, unknown>;
      const pk = pkFor(cols);
      const pkCol = cols[pk];
      const scopeClauses = captureScopeClauses(ctx);

      if (scopeClauses.length > 0 && (dialect === "pg" || dialect === "mysql")) {
        return db.transaction(async (tx) => {
          const row = await insertRow(tx, ref, pk, pkCol, input);
          if (row && pkCol && !(await rowSatisfiesScope(tx, ref, pkCol, row[pk], scopeClauses))) {
            throw new FlowpanelAccessError(
              "create refused: the created row does not satisfy the resource's tenant scope. " +
                "Ensure the create form/schema supplies a tenant column value matching the current scope.",
            );
          }
          return row;
        });
      }

      const row = await insertRow(db, ref, pk, pkCol, input);

      if (scopeClauses.length > 0 && dialect === "sqlite" && row && pkCol) {
        const id = row[pk];
        if (!(await rowSatisfiesScope(db, ref, pkCol, id, scopeClauses))) {
          await db.delete(ref).where(eq(pkCol, id));
          throw new FlowpanelAccessError(
            "create refused: the created row does not satisfy the resource's tenant scope. " +
              "Ensure the create form/schema supplies a tenant column value matching the current scope.",
          );
        }
      }

      return row;
    },

    async update(ref, ctx: MutationContext<unknown>) {
      const cols = getTableColumns(ref) as ColumnsRecord;
      const db = getDb(ctx);
      const pk = pkFor(cols);
      if (!ctx.id) throw new Error("update requires ctx.id");
      const pkCol = cols[pk];
      if (!pkCol) throw new Error(`drizzleAdapter: primary key column "${pk}" not found`);
      const input = ctx.input as Record<string, unknown>;
      const where = and(eq(pkCol, ctx.id), ...captureScopeClauses(ctx)) as SQL;
      if (dialect === "mysql" || dialect === "sqlite") {
        await db.update(ref).set(input).where(where);
        const rows = (await (
          db.select().from(ref) as unknown as {
            where: (w: SQL) => { limit: (n: number) => Promise<unknown[]> };
          }
        )
          .where(where)
          .limit(1)) as unknown[];
        return rows[0];
      }
      const rows = await db.update(ref).set(input).where(where).returning();
      return rows[0];
    },

    async delete(ref, ctx: MutationContext<unknown>) {
      const cols = getTableColumns(ref) as ColumnsRecord;
      const db = getDb(ctx);
      const pk = pkFor(cols);
      if (!ctx.id) throw new Error("delete requires ctx.id");
      const pkCol = cols[pk];
      if (!pkCol) throw new Error(`drizzleAdapter: primary key column "${pk}" not found`);
      const where = and(eq(pkCol, ctx.id), ...captureScopeClauses(ctx)) as SQL;
      const softCol = ctx.softDelete?.column;
      if (softCol && cols[softCol]) {
        await db
          .update(ref)
          .set({ [softCol]: new Date() })
          .where(where);
      } else {
        await db.delete(ref).where(where);
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
      const where = and(eq(pkCol, ctx.id), ...captureScopeClauses(ctx)) as SQL;
      await db
        .update(ref)
        .set({ [softCol]: null })
        .where(where);
    },

    async runMigrationSql(rawSql: string): Promise<void> {
      await runRaw(opts.db as MigrationDb, dialect, sql.raw(rawSql));
    },

    async listAppliedMigrations(): Promise<Set<string>> {
      const db = opts.db as MigrationDb;
      await runRaw(db, dialect, sql.raw(migrationsTableDdl(dialect)));
      const ids = await selectMigrationIds(
        db,
        dialect,
        sql.raw(`SELECT id FROM _flowpanel_migrations`),
      );
      return new Set(ids);
    },

    async markMigrationApplied(id: string): Promise<void> {
      await runRaw(
        opts.db as MigrationDb,
        dialect,
        sql`INSERT INTO _flowpanel_migrations (id) VALUES (${id})`,
      );
    },
  };
}
