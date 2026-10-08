import {
  type Adapter,
  type ItemQueryContext,
  type ListQueryContext,
  type ListResult,
  type MutationContext,
  parseSqlRows,
  sanitizeSqlParams,
} from "@flowpanel/core";
import { plainDecimals } from "./decimals";
import { buildFilterWhere, numberFields } from "./filters";
import type { PrismaDmmf } from "./introspect";
import { introspect } from "./introspect";
import { createMigrationMethods } from "./migration-executor";
import {
  applyScopeToData,
  applyScopeToWhere,
  checkedDmmf,
  InvalidIdError,
  loadDmmf,
  type PrismaClientLike,
  pkWhere,
  getDelegate as resolveDelegate,
} from "./runtime";
import { inferSchema } from "./schema";
import type { PrismaProvider } from "./sql-statements";

export interface PrismaAdapterOptions<P = unknown> {
  prisma: P;
  /** The `datasource` provider from schema.prisma; migrations are dialect-specific. */
  provider: PrismaProvider;
  dmmf?: PrismaDmmf;
  /**
   * Reads zoneless `YYYY-MM-DD HH:mm:ss` strings as UTC `Date`s; turn off if a text column holds timestamp-shaped strings `select *` cannot cast.
   * @defaultValue true
   */
  parseDates?: boolean;
}

export { MIGRATIONS_TABLE_DDL } from "./runtime";
export type { PrismaProvider } from "./sql-statements";

/** Prisma's P2025 for the row itself (not a nested connect) means it is gone: `null`, as the adapter contract says. */
function isGoneRow(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("code" in err) || err.code !== "P2025") {
    return false;
  }
  const cause =
    "meta" in err && typeof err.meta === "object" && err.meta !== null && "cause" in err.meta
      ? err.meta.cause
      : undefined;
  return typeof cause !== "string" || /^Record to (update|delete)/.test(cause);
}

async function missingAsNull<T>(write: Promise<T>): Promise<T | null> {
  try {
    return await write;
  } catch (err) {
    if (isGoneRow(err)) return null;
    throw err;
  }
}

export function prismaAdapter<P>(opts: PrismaAdapterOptions<P>): Adapter<P, string> {
  const EMPTY_PROJECTION = Symbol("flowpanel.emptyProjection");
  let _dmmf: PrismaDmmf | undefined;
  const prisma = opts.prisma as PrismaClientLike;

  function getDmmf(): PrismaDmmf {
    if (!_dmmf) _dmmf = opts.dmmf ? checkedDmmf(opts.dmmf) : loadDmmf();
    return _dmmf;
  }

  function hasScope(ctx: { boundScope?: unknown }): boolean {
    return ctx.boundScope !== undefined;
  }

  function getDb(ctx: { db?: unknown } = {}): PrismaClientLike {
    return (ctx.db ?? prisma) as PrismaClientLike;
  }

  function getDelegate(modelName: string, ctx: { db?: unknown } = {}) {
    return resolveDelegate(getDb(ctx), modelName);
  }

  function projection(modelName: string, select: readonly string[] | undefined) {
    if (select === undefined) return undefined;
    if (select.length === 0) return EMPTY_PROJECTION;
    if (select.length > 1024) throw new Error("prismaAdapter: select exceeds 1024 fields");
    const model = getDmmf().datamodel.models.find((entry) => entry.name === modelName);
    const known = new Set(
      model?.fields.filter((field) => field.kind !== "object").map((field) => field.name),
    );
    const projected: Record<string, boolean> = {};
    for (const name of new Set(select)) {
      if (!known.has(name))
        throw new Error(`prismaAdapter: select contains unknown field "${name}"`);
      projected[name] = true;
    }
    return projected;
  }

  function plainRow<Row>(row: Row, modelName: string): Row {
    return plainDecimals([row], getDmmf(), modelName)[0] ?? row;
  }

  const canTransact = typeof prisma.$transaction === "function";

  return {
    kind: "prisma",
    db: opts.prisma,
    ...(canTransact
      ? {
          transaction: <T>(run: (db: P) => Promise<T>) =>
            prisma.$transaction?.((tx) => run(tx as unknown as P)) as Promise<T>,
        }
      : {}),

    introspect: (modelName) => introspect(modelName, getDmmf()),

    inferSchema: (modelName) => inferSchema(modelName, getDmmf()),

    async list(modelName, ctx: ListQueryContext<unknown>): Promise<ListResult<unknown>> {
      const delegate = getDelegate(modelName);
      const dmmf = getDmmf();
      const select = projection(modelName, ctx.select);

      const where = buildFilterWhere(ctx.filters, numberFields(modelName, dmmf));

      if (ctx.search && ctx.searchFields?.length) {
        const intro = introspect(modelName, dmmf);
        const textColSet = new Set(
          intro.columns.filter((c) => c.type === "string" && !c.enumValues).map((c) => c.name),
        );
        const textCols = ctx.searchFields.filter((f) => textColSet.has(f));
        if (textCols.length > 0) {
          // Prisma accepts `mode` only on PostgreSQL; other dialects compare case-insensitively by default.
          const insensitive = opts.provider === "postgresql" ? { mode: "insensitive" } : {};
          where.OR = textCols.map((name) => ({
            [name]: { contains: ctx.search, ...insensitive },
          }));
        }
      }

      const softCol = ctx.softDelete?.column;
      if (softCol && !ctx.includeDeleted) {
        where[softCol] = null;
      }

      const scopedWhere = applyScopeToWhere(where, ctx);

      const orderBy = ctx.sort ? { [ctx.sort.field]: ctx.sort.dir } : undefined;

      const skip = (ctx.page - 1) * ctx.pageSize;
      const take = ctx.pageSize;

      if (select === EMPTY_PROJECTION) {
        const total = await delegate.count({ where: scopedWhere });
        const rowCount = Math.max(0, Math.min(take, total - skip));
        return {
          rows: Array.from({ length: rowCount }, () => ({})),
          total,
          page: ctx.page,
          pageSize: ctx.pageSize,
        };
      }

      const [rows, total] = await Promise.all([
        delegate.findMany({
          where: scopedWhere,
          ...(select ? { select } : {}),
          ...(orderBy ? { orderBy } : {}),
          skip,
          take,
        }),
        delegate.count({ where: scopedWhere }),
      ]);

      return {
        rows: plainDecimals(rows, dmmf, modelName),
        total,
        page: ctx.page,
        pageSize: ctx.pageSize,
      };
    },

    async get(modelName, ctx: ItemQueryContext) {
      const delegate = getDelegate(modelName);
      try {
        const baseWhere = applyScopeToWhere(pkWhere(ctx.id, modelName, getDmmf()), ctx);
        const select = projection(modelName, ctx.select);
        if (select === EMPTY_PROJECTION) {
          return (await delegate.count({ where: baseWhere })) > 0 ? {} : null;
        }
        const args = { where: baseWhere, ...(select ? { select } : {}) };
        const result = hasScope(ctx)
          ? await delegate.findFirst(args)
          : await delegate.findUnique(args);
        return result ? plainRow(result, modelName) : null;
      } catch (err) {
        if (err instanceof InvalidIdError || (err as { code?: unknown }).code === "P2023") {
          return null;
        }
        throw err;
      }
    },

    async create(modelName, ctx: MutationContext<unknown>) {
      const delegate = getDelegate(modelName, ctx);
      const data = applyScopeToData((ctx.input as Record<string, unknown>) ?? {}, ctx);
      return plainRow(await delegate.create({ data }), modelName);
    },

    async update(modelName, ctx: MutationContext<unknown>) {
      if (!ctx.id) throw new Error("prismaAdapter: update requires ctx.id");
      const delegate = getDelegate(modelName, ctx);
      const baseWhere = applyScopeToWhere(pkWhere(ctx.id, modelName, getDmmf()), ctx);
      if (hasScope(ctx)) {
        const res = await delegate.updateMany({ where: baseWhere, data: ctx.input });
        if (res.count === 0) return null;
        const row = await delegate.findFirst({ where: baseWhere });
        return row ? plainRow(row, modelName) : null;
      }
      const row = await missingAsNull(delegate.update({ where: baseWhere, data: ctx.input }));
      return row === null ? null : plainRow(row, modelName);
    },

    async delete(modelName, ctx: MutationContext<unknown>): Promise<void> {
      if (!ctx.id) throw new Error("prismaAdapter: delete requires ctx.id");
      const delegate = getDelegate(modelName, ctx);
      const baseWhere = applyScopeToWhere(pkWhere(ctx.id, modelName, getDmmf()), ctx);
      const softCol = ctx.softDelete?.column;
      if (softCol) {
        if (hasScope(ctx)) {
          await delegate.updateMany({ where: baseWhere, data: { [softCol]: new Date() } });
        } else {
          await missingAsNull(
            delegate.update({ where: baseWhere, data: { [softCol]: new Date() } }),
          );
        }
      } else if (hasScope(ctx)) {
        await delegate.deleteMany({ where: baseWhere });
      } else {
        await missingAsNull(delegate.delete({ where: baseWhere }));
      }
    },

    async restore(modelName, ctx: MutationContext<unknown>): Promise<void> {
      const softCol = ctx.softDelete?.column;
      if (!softCol)
        throw new Error("prismaAdapter: restore requires ctx.softDelete to be configured");
      if (!ctx.id) throw new Error("prismaAdapter: restore requires ctx.id");
      const delegate = getDelegate(modelName, ctx);
      const baseWhere = applyScopeToWhere(pkWhere(ctx.id, modelName, getDmmf()), ctx);
      if (hasScope(ctx)) {
        await delegate.updateMany({ where: baseWhere, data: { [softCol]: null } });
      } else {
        await missingAsNull(delegate.update({ where: baseWhere, data: { [softCol]: null } }));
      }
    },

    async sql<Row = Record<string, unknown>>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<Row[]> {
      const rows = await prisma.$queryRaw(strings, ...sanitizeSqlParams(values));
      return parseSqlRows<Row>(rows as Array<Record<string, unknown>>, {
        parseDates: opts.parseDates ?? true,
      });
    },

    async count(modelName, where): Promise<number> {
      return resolveDelegate(prisma, modelName).count({
        where: buildFilterWhere(where, numberFields(modelName, getDmmf())),
      });
    },

    ...createMigrationMethods(prisma, opts.provider),
  };
}
