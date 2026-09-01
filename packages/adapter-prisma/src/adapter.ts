import type {
  Adapter,
  ItemQueryContext,
  ListQueryContext,
  ListResult,
  MutationContext,
} from "@flowpanel/core";
import { isFilterInValue, isFilterRangeValue } from "@flowpanel/core";
import type { PrismaDmmf } from "./introspect";
import { introspect } from "./introspect";
import { createMigrationMethods } from "./migration-executor";
import {
  applyScopeToData,
  applyScopeToWhere,
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
}

export { MIGRATIONS_TABLE_DDL } from "./runtime";
export type { PrismaProvider } from "./sql-statements";

export function prismaAdapter<P>(opts: PrismaAdapterOptions<P>): Adapter<P, string> {
  let _dmmf: PrismaDmmf | undefined = opts.dmmf;
  const prisma = opts.prisma as PrismaClientLike;

  function getDmmf(): PrismaDmmf {
    if (!_dmmf) _dmmf = loadDmmf();
    return _dmmf;
  }

  function hasScope(ctx: { boundScope?: unknown; applyScope?: unknown }): boolean {
    return ctx.boundScope !== undefined || ctx.applyScope !== undefined;
  }

  function getDb(ctx: { db?: unknown }): PrismaClientLike {
    return (ctx.db ?? prisma) as PrismaClientLike;
  }

  function getDelegate(modelName: string, ctx: { db?: unknown }) {
    return resolveDelegate(getDb(ctx), modelName);
  }

  function projection(modelName: string, select: readonly string[] | undefined) {
    if (select === undefined) return undefined;
    if (select.length === 0) throw new Error("prismaAdapter: select must contain a field");
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
      const delegate = getDelegate(modelName, ctx);
      const dmmf = getDmmf();
      const select = projection(modelName, ctx.select);

      const where: Record<string, unknown> = {};

      for (const [k, v] of Object.entries(ctx.filters ?? {})) {
        if (v === undefined || v === null || v === "") continue;
        if (v === "__null__") {
          where[k] = null;
          continue;
        }
        if (v === "__notnull__") {
          where[k] = { not: null };
          continue;
        }
        if (isFilterRangeValue(v)) {
          const cond: Record<string, unknown> = {};
          if (v.gte !== undefined) cond.gte = v.gte;
          if (v.lte !== undefined) cond.lte = v.lte;
          if (Object.keys(cond).length > 0) where[k] = cond;
          continue;
        }
        if (isFilterInValue(v)) {
          if (v.values.length > 0) where[k] = { in: v.values };
          continue;
        }
        where[k] = v;
      }

      if (ctx.search && ctx.searchFields?.length) {
        const intro = introspect(modelName, dmmf);
        const textColSet = new Set(
          intro.columns.filter((c) => c.type === "string" && !c.enumValues).map((c) => c.name),
        );
        const textCols = ctx.searchFields.filter((f) => textColSet.has(f));
        if (textCols.length > 0) {
          // Prisma accepts `mode` only on PostgreSQL; MySQL and SQLite compare
          // case-insensitively by default collation.
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

      return { rows, total, page: ctx.page, pageSize: ctx.pageSize };
    },

    async get(modelName, ctx: ItemQueryContext) {
      const delegate = getDelegate(modelName, ctx);
      const baseWhere = applyScopeToWhere(pkWhere(ctx.id, modelName, getDmmf()), ctx);
      const select = projection(modelName, ctx.select);
      const args = { where: baseWhere, ...(select ? { select } : {}) };
      const result = hasScope(ctx)
        ? await delegate.findFirst(args)
        : await delegate.findUnique(args);
      return result ?? null;
    },

    async create(modelName, ctx: MutationContext<unknown>) {
      const delegate = getDelegate(modelName, ctx);
      const data = applyScopeToData((ctx.input as Record<string, unknown>) ?? {}, ctx);
      return delegate.create({ data });
    },

    async update(modelName, ctx: MutationContext<unknown>) {
      if (!ctx.id) throw new Error("prismaAdapter: update requires ctx.id");
      const delegate = getDelegate(modelName, ctx);
      const baseWhere = applyScopeToWhere(pkWhere(ctx.id, modelName, getDmmf()), ctx);
      if (hasScope(ctx)) {
        const res = await delegate.updateMany({ where: baseWhere, data: ctx.input });
        if (res.count === 0) return null;
        const row = await delegate.findFirst({ where: baseWhere });
        return row ?? null;
      }
      return delegate.update({ where: baseWhere, data: ctx.input });
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
          await delegate.update({ where: baseWhere, data: { [softCol]: new Date() } });
        }
      } else if (hasScope(ctx)) {
        await delegate.deleteMany({ where: baseWhere });
      } else {
        await delegate.delete({ where: baseWhere });
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
        await delegate.update({ where: baseWhere, data: { [softCol]: null } });
      }
    },

    ...createMigrationMethods(prisma, opts.provider),
  };
}
