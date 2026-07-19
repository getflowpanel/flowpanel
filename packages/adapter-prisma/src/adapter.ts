import { createRequire } from "node:module";
import type {
  Adapter,
  ItemQueryContext,
  ListQueryContext,
  ListResult,
  MutationContext,
} from "@flowpanel/core";
import { FlowpanelAccessError, isFilterInValue, isFilterRangeValue } from "@flowpanel/core";
import type { PrismaDmmf } from "./introspect.js";
import { introspect } from "./introspect.js";
import { inferSchema } from "./schema.js";

const require = createRequire(import.meta.url);

export interface PrismaAdapterOptions<P = unknown> {
  prisma: P;
  dmmf?: PrismaDmmf;
}

/** Subset of the Prisma model delegate methods we invoke. */
interface PrismaDelegate {
  findMany: (args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc">;
    skip?: number;
    take?: number;
  }) => Promise<unknown[]>;
  findUnique: (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
  findFirst: (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
  count: (args: { where?: Record<string, unknown> }) => Promise<number>;
  create: (args: { data: unknown }) => Promise<Record<string, unknown>>;
  update: (args: {
    where: Record<string, unknown>;
    data: unknown;
  }) => Promise<Record<string, unknown>>;
  updateMany: (args: {
    where: Record<string, unknown>;
    data: unknown;
  }) => Promise<{ count: number }>;
  delete: (args: { where: Record<string, unknown> }) => Promise<unknown>;
  deleteMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }>;
}

/** Apply a resource's tenant `scope` predicate to a plain object, with fail-closed enforcement. */
function applyScopeToWhere(
  where: Record<string, unknown>,
  ctx: { applyScope?: (q: unknown) => unknown; scopeRequired?: boolean },
): Record<string, unknown> {
  if (!ctx.applyScope) {
    if (ctx.scopeRequired) {
      throw new FlowpanelAccessError(
        "scope required but not bound: a scope predicate is declared and global scope " +
          "is active, but the adapter received no applyScope. Refusing to run an unscoped query.",
      );
    }
    return where;
  }
  return (ctx.applyScope(where) as Record<string, unknown>) ?? where;
}

/** Subset of the Prisma client we touch — `$executeRaw{,Unsafe}`, `$queryRawUnsafe`. */
interface PrismaClientLike {
  $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
  $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<number>;
  $queryRawUnsafe: <T = unknown>(sql: string, ...values: unknown[]) => Promise<T>;
  [delegateName: string]: unknown;
}

// Prisma exposes no datasource provider at runtime, so this DDL uses only the
// subset of types and defaults postgres, mysql and sqlite all accept.
export const MIGRATIONS_TABLE_DDL = `CREATE TABLE IF NOT EXISTS _flowpanel_migrations (
  id varchar(255) NOT NULL PRIMARY KEY,
  applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

function loadDmmf(): PrismaDmmf {
  try {
    const { Prisma } = require("@prisma/client");
    return Prisma.dmmf as PrismaDmmf;
  } catch {
    throw new Error(
      "prismaAdapter: could not load DMMF from @prisma/client. " +
        "Make sure @prisma/client is installed and `prisma generate` has been run.",
    );
  }
}

function getDelegate(prisma: PrismaClientLike, modelName: string): PrismaDelegate {
  const delegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  const delegate = prisma[delegateName];
  if (!delegate) {
    throw new Error(
      `prismaAdapter: no delegate found for model "${modelName}" (tried prisma.${delegateName}). ` +
        `Make sure the model exists in your Prisma schema.`,
    );
  }
  return delegate as PrismaDelegate;
}

/** `{ [<the model's @id field>]: <id coerced to that field's type> }`. */
function pkWhere(id: string, modelName: string, dmmf: PrismaDmmf): Record<string, unknown> {
  const model = dmmf.datamodel.models.find((m) => m.name === modelName);
  const pkField = model?.fields.find((f) => f.isId);
  const name = pkField?.name ?? "id";
  if (pkField && (pkField.type === "Int" || pkField.type === "BigInt")) {
    const n = parseInt(id, 10);
    if (Number.isNaN(n)) {
      throw new Error(
        `prismaAdapter: cannot coerce id "${id}" to ${pkField.type} for model "${modelName}"`,
      );
    }
    return { [name]: n };
  }
  return { [name]: id };
}

export function prismaAdapter<P>(opts: PrismaAdapterOptions<P>): Adapter<P, string> {
  let _dmmf: PrismaDmmf | undefined = opts.dmmf;
  const prisma = opts.prisma as PrismaClientLike;

  function getDmmf(): PrismaDmmf {
    if (!_dmmf) _dmmf = loadDmmf();
    return _dmmf;
  }

  return {
    kind: "prisma",
    db: opts.prisma,

    introspect: (modelName) => introspect(modelName, getDmmf()),

    inferSchema: (modelName) => inferSchema(modelName, getDmmf()),

    async list(modelName, ctx: ListQueryContext<unknown>): Promise<ListResult<unknown>> {
      const delegate = getDelegate(prisma, modelName);
      const dmmf = getDmmf();

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
          where.OR = textCols.map((name) => ({
            [name]: { contains: ctx.search, mode: "insensitive" },
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
          ...(orderBy ? { orderBy } : {}),
          skip,
          take,
        }),
        delegate.count({ where: scopedWhere }),
      ]);

      return { rows, total, page: ctx.page, pageSize: ctx.pageSize };
    },

    async get(modelName, ctx: ItemQueryContext) {
      const delegate = getDelegate(prisma, modelName);
      const baseWhere = applyScopeToWhere(pkWhere(ctx.id, modelName, getDmmf()), ctx);
      const result = ctx.applyScope
        ? await delegate.findFirst({ where: baseWhere })
        : await delegate.findUnique({ where: baseWhere });
      return result ?? null;
    },

    async create(modelName, ctx: MutationContext<unknown>) {
      const delegate = getDelegate(prisma, modelName);
      const data = applyScopeToWhere((ctx.input as Record<string, unknown>) ?? {}, ctx);
      return delegate.create({ data });
    },

    async update(modelName, ctx: MutationContext<unknown>) {
      if (!ctx.id) throw new Error("prismaAdapter: update requires ctx.id");
      const delegate = getDelegate(prisma, modelName);
      const baseWhere = applyScopeToWhere(pkWhere(ctx.id, modelName, getDmmf()), ctx);
      if (ctx.applyScope) {
        const res = await delegate.updateMany({ where: baseWhere, data: ctx.input });
        if (res.count === 0) return null;
        const row = await delegate.findFirst({ where: baseWhere });
        return row ?? null;
      }
      return delegate.update({ where: baseWhere, data: ctx.input });
    },

    async delete(modelName, ctx: MutationContext<unknown>): Promise<void> {
      if (!ctx.id) throw new Error("prismaAdapter: delete requires ctx.id");
      const delegate = getDelegate(prisma, modelName);
      const baseWhere = applyScopeToWhere(pkWhere(ctx.id, modelName, getDmmf()), ctx);
      const softCol = ctx.softDelete?.column;
      if (softCol) {
        if (ctx.applyScope) {
          await delegate.updateMany({ where: baseWhere, data: { [softCol]: new Date() } });
        } else {
          await delegate.update({ where: baseWhere, data: { [softCol]: new Date() } });
        }
      } else if (ctx.applyScope) {
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
      const delegate = getDelegate(prisma, modelName);
      const baseWhere = applyScopeToWhere(pkWhere(ctx.id, modelName, getDmmf()), ctx);
      if (ctx.applyScope) {
        await delegate.updateMany({ where: baseWhere, data: { [softCol]: null } });
      } else {
        await delegate.update({ where: baseWhere, data: { [softCol]: null } });
      }
    },

    async runMigrationSql(rawSql: string): Promise<void> {
      await prisma.$executeRawUnsafe(rawSql);
    },

    async listAppliedMigrations(): Promise<Set<string>> {
      await prisma.$executeRawUnsafe(MIGRATIONS_TABLE_DDL);
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM _flowpanel_migrations`,
      );
      const ids = new Set<string>();
      for (const r of rows) ids.add(r.id);
      return ids;
    },

    async markMigrationApplied(id: string): Promise<void> {
      await prisma.$executeRaw`INSERT INTO _flowpanel_migrations (id) VALUES (${id})`;
    },
  };
}
