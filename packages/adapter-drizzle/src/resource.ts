import { eq, count, asc, desc, and, type SQL } from "drizzle-orm";
import type {
  ResourceAdapter,
  FindManyArgs,
  ModelMetadata,
  Row,
  NormalizedFilter,
} from "@flowpanel/core";
import { normalizedFiltersToDrizzleWhere, normalizedFiltersToDrizzleOr } from "./filters";

// biome-ignore lint/suspicious/noExplicitAny: Drizzle db type is opaque across versions
type DrizzleDatabaseLike = any;

interface TableEntry {
  table: unknown;
  metadata: ModelMetadata;
}

/**
 * Create a Drizzle ResourceAdapter.
 *
 * @param getDb   Async resolver returning the Drizzle database instance.
 *                Accepts a plain db or a factory function; callers should wrap
 *                both into `() => Promise<db>` at the call site.
 * @param tables  Map of model name → { table, metadata }.
 * @param enums   Map of enum name → values[].
 */
export function createDrizzleResourceAdapter(
  getDb: () => Promise<DrizzleDatabaseLike>,
  tables: Map<string, TableEntry>,
  enums: Map<string, string[]>,
): ResourceAdapter {
  function getEntry(model: string): TableEntry {
    const entry = tables.get(model);
    if (!entry) {
      throw new Error(`Drizzle ResourceAdapter: no table registered for model "${model}"`);
    }
    return entry;
  }

  function getPkColumn(table: unknown, primaryKey: string): unknown {
    const tableRecord = table as Record<string, unknown>;
    const col = tableRecord[primaryKey];
    if (!col) {
      throw new Error(`Drizzle ResourceAdapter: primary key column "${primaryKey}" not found`);
    }
    return col;
  }

  function buildWhere(
    filters: NormalizedFilter[] | undefined,
    searchOr: NormalizedFilter[] | undefined,
    table: unknown,
  ): SQL | undefined {
    const regularWhere =
      filters && filters.length > 0 ? normalizedFiltersToDrizzleWhere(filters, table) : undefined;
    const searchOrWhere =
      searchOr && searchOr.length > 0 ? normalizedFiltersToDrizzleOr(searchOr, table) : undefined;

    if (regularWhere && searchOrWhere) return and(regularWhere, searchOrWhere);
    return regularWhere ?? searchOrWhere;
  }

  function buildOrderBy(
    orderBy: { field: string; dir: "asc" | "desc" } | undefined,
    table: unknown,
  ): SQL | undefined {
    if (!orderBy) return undefined;
    const tableRecord = table as Record<string, unknown>;
    const col = tableRecord[orderBy.field];
    if (!col) return undefined;
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle column type is opaque
    return orderBy.dir === "asc" ? asc(col as any) : desc(col as any);
  }

  return {
    getModelNames(): string[] {
      return Array.from(tables.keys());
    },

    getModelMetadata(model: string): ModelMetadata {
      return getEntry(model).metadata;
    },

    getEnumValues(enumName: string): string[] {
      return enums.get(enumName) ?? [];
    },

    async findMany(model: string, args: FindManyArgs): Promise<{ data: Row[]; total: number }> {
      const db = await getDb();
      const { table, metadata } = getEntry(model);
      const where = buildWhere(args.where, args.searchOr, table);
      const orderByExpr = buildOrderBy(args.orderBy, table);

      // Check if relational query builder is available and include is requested
      const hasRelationalQuery =
        args.include &&
        db.query &&
        // Look for the table's relational query by model name (lowercase first)
        db.query[toLowerFirst(model)];

      let dataPromise: Promise<Row[]>;

      if (hasRelationalQuery) {
        // Use relational query builder when includes are needed
        const relationalTable = db.query[toLowerFirst(model)];
        dataPromise = relationalTable.findMany({
          ...(where !== undefined && { where: () => where }),
          ...(orderByExpr !== undefined && { orderBy: () => orderByExpr }),
          ...(args.skip !== undefined && { offset: args.skip }),
          ...(args.take !== undefined && { limit: args.take }),
          with: args.include,
        });
      } else {
        // Use SQL-like builder
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle builder is dynamic
        let query: any = db.select().from(table as any);
        if (where) query = query.where(where);
        if (orderByExpr) query = query.orderBy(orderByExpr);
        if (args.skip !== undefined) query = query.offset(args.skip);
        if (args.take !== undefined) query = query.limit(args.take);
        dataPromise = query;
      }

      // Count query always uses SQL builder
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle builder is dynamic
      let countQuery: any = db.select({ count: count() }).from(table as any);
      if (where) countQuery = countQuery.where(where);
      const countPromise: Promise<{ count: number }[]> = countQuery;

      const [data, countResult] = await Promise.all([dataPromise, countPromise]);
      const total = countResult[0]?.count ?? 0;

      return { data, total };
    },

    async findUnique(
      model: string,
      args: { where: Record<string, unknown>; include?: Record<string, unknown> },
    ): Promise<Row | null> {
      const db = await getDb();
      const { table, metadata } = getEntry(model);
      const pkCol = getPkColumn(table, metadata.primaryKey);
      const pkValue = args.where[metadata.primaryKey];

      // Try relational query builder first if include is requested
      if (args.include && db.query?.[toLowerFirst(model)]) {
        const relationalTable = db.query[toLowerFirst(model)];
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle column type is opaque
        const result = await relationalTable.findFirst({
          where: (t: unknown, { eq: eqFn }: { eq: typeof eq }) =>
            eqFn((t as Record<string, unknown>)[metadata.primaryKey] as any, pkValue),
          with: args.include,
        });
        return result ?? null;
      }

      // biome-ignore lint/suspicious/noExplicitAny: Drizzle builder is dynamic
      const rows: Row[] = await db
        .select()
        .from(table as any)
        .where(eq(pkCol as any, pkValue))
        .limit(1);

      return rows[0] ?? null;
    },

    async count(model: string, args: { where?: NormalizedFilter[] }): Promise<number> {
      const db = await getDb();
      const { table } = getEntry(model);
      const where = buildWhere(args.where, undefined, table);

      // biome-ignore lint/suspicious/noExplicitAny: Drizzle builder is dynamic
      let query: any = db.select({ count: count() }).from(table as any);
      if (where) query = query.where(where);

      const result: { count: number }[] = await query;
      return result[0]?.count ?? 0;
    },

    async create(model: string, args: { data: Record<string, unknown> }): Promise<Row> {
      const db = await getDb();
      const { table } = getEntry(model);

      // biome-ignore lint/suspicious/noExplicitAny: Drizzle builder is dynamic
      const rows: Row[] = await db
        .insert(table as any)
        .values(args.data)
        .returning();
      const row = rows[0];
      if (!row) throw new Error(`Drizzle ResourceAdapter: insert returned no rows for "${model}"`);
      return row;
    },

    async update(
      model: string,
      args: { where: Record<string, unknown>; data: Record<string, unknown> },
    ): Promise<Row> {
      const db = await getDb();
      const { table, metadata } = getEntry(model);
      const pkCol = getPkColumn(table, metadata.primaryKey);
      const pkValue = args.where[metadata.primaryKey];

      // biome-ignore lint/suspicious/noExplicitAny: Drizzle builder is dynamic
      const rows: Row[] = await db
        .update(table as any)
        .set(args.data)
        .where(eq(pkCol as any, pkValue))
        .returning();

      const row = rows[0];
      if (!row) throw new Error(`Drizzle ResourceAdapter: update returned no rows for "${model}"`);
      return row;
    },

    async delete(model: string, args: { where: Record<string, unknown> }): Promise<Row> {
      const db = await getDb();
      const { table, metadata } = getEntry(model);
      const pkCol = getPkColumn(table, metadata.primaryKey);
      const pkValue = args.where[metadata.primaryKey];

      // biome-ignore lint/suspicious/noExplicitAny: Drizzle builder is dynamic
      const rows: Row[] = await db
        .delete(table as any)
        .where(eq(pkCol as any, pkValue))
        .returning();

      const row = rows[0];
      if (!row) throw new Error(`Drizzle ResourceAdapter: delete returned no rows for "${model}"`);
      return row;
    },
  };
}

function toLowerFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
