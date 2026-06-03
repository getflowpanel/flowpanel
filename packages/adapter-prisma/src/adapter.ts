// LOC-OK: prisma adapter — list/get/create/update/delete plus filter, sort and
// scope handling form one cohesive query layer (mirrors adapter-drizzle).
import { createRequire } from "node:module";
import type {
  Adapter,
  ItemQueryContext,
  ListQueryContext,
  ListResult,
  MutationContext,
} from "@flowpanel/core";
import { FlowpanelAccessError } from "@flowpanel/core";
import type { PrismaDmmf } from "./introspect.js";
import { introspect } from "./introspect.js";
import { inferSchema } from "./schema.js";

const require = createRequire(import.meta.url);

export interface PrismaAdapterOptions<P = unknown> {
  prisma: P;
  dmmf?: PrismaDmmf;
}

/**
 * Subset of the Prisma model delegate methods we invoke. Generated delegates
 * (`prisma.user`, `prisma.post`, …) carry far richer types per model, but the
 * adapter operates dynamically by model name, so we narrow to the call shapes
 * we actually need at runtime.
 */
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

/**
 * Apply a resource's tenant `scope` predicate to a prisma `where` object,
 * with fail-closed enforcement. The pre-bound `ctx.applyScope` merges the
 * tenant keys into the passed `where` and returns it (the spec contract is
 * `scope: (s, where) => ({ ...where, companyId: s.companyId })`).
 *
 * The user predicate MUST spread the incoming `where`. A predicate that
 * returns only `{ companyId: s.companyId }` (dropping `...where`) would
 * discard the search, filter, and soft-delete clauses already accumulated
 * here — silently widening list results past those constraints.
 *
 * When `ctx.scopeRequired` is set but `ctx.applyScope` is missing, throw
 * rather than run an unscoped query for a scope-required resource.
 */
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

function coerceId(id: string, modelName: string, dmmf: PrismaDmmf): string | number {
  const model = dmmf.datamodel.models.find((m) => m.name === modelName);
  const pkField = model?.fields.find((f) => f.isId);
  if (pkField && (pkField.type === "Int" || pkField.type === "BigInt")) {
    const n = parseInt(id, 10);
    if (Number.isNaN(n)) {
      throw new Error(
        `prismaAdapter: cannot coerce id "${id}" to ${pkField.type} for model "${modelName}"`,
      );
    }
    return n;
  }
  return id;
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

      // Build where clause
      const where: Record<string, unknown> = {};

      for (const [k, v] of Object.entries(ctx.filters ?? {})) {
        if (v === undefined || v === null || v === "") continue;
        // Reserved sentinels for IS NULL / IS NOT NULL filters. See
        // `FilterDef` JSDoc in `@flowpanel/core` types/resource.ts.
        if (v === "__null__") {
          where[k] = null;
          continue;
        }
        if (v === "__notnull__") {
          where[k] = { not: null };
          continue;
        }
        where[k] = v;
      }

      // Search: OR across all string (non-enum) columns
      if (ctx.search) {
        const intro = introspect(modelName, dmmf);
        const textCols = intro.columns.filter((c) => c.type === "string" && !c.enumValues);
        if (textCols.length > 0) {
          // NOTE: `mode: "insensitive"` is honored by Postgres only.
          // Prisma silently ignores it on MySQL/SQLite (the LIKE comparison
          // will be case-sensitive there). Document this in the user-facing
          // 1.0 release notes; revisit per-dialect behavior in 1.1.
          where.OR = textCols.map((c) => ({
            [c.name]: { contains: ctx.search, mode: "insensitive" },
          }));
        }
      }

      // Soft-delete exclusion
      const softCol = ctx.softDelete?.column;
      if (softCol) {
        where[softCol] = null;
      }

      // Tenant scope: merge the scope predicate's keys into `where` (fail-closed).
      const scopedWhere = applyScopeToWhere(where, ctx);

      // Order by
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
      const id = coerceId(ctx.id, modelName, getDmmf());
      // Fail-closed scope check + merge. When a scope is bound we use
      // `findFirst` so the tenant keys (non-unique) are honored — a `get`
      // of an out-of-scope id then returns null instead of the row.
      const baseWhere = applyScopeToWhere({ id }, ctx);
      const result = ctx.applyScope
        ? await delegate.findFirst({ where: baseWhere })
        : await delegate.findUnique({ where: baseWhere });
      return result ?? null;
    },

    async create(modelName, ctx: MutationContext<unknown>) {
      const delegate = getDelegate(prisma, modelName);
      return delegate.create({ data: ctx.input });
    },

    async update(modelName, ctx: MutationContext<unknown>) {
      if (!ctx.id) throw new Error("prismaAdapter: update requires ctx.id");
      const delegate = getDelegate(prisma, modelName);
      const id = coerceId(ctx.id, modelName, getDmmf());
      const baseWhere = applyScopeToWhere({ id }, ctx);
      // With a bound scope, `updateMany` honors the (non-unique) tenant keys:
      // an out-of-scope id matches 0 rows. We then re-read the row scoped to
      // return it (mirrors the `update` return shape); a 0-row update yields
      // null so callers (e.g. resource-actions) surface a not-found.
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
      const id = coerceId(ctx.id, modelName, getDmmf());
      const baseWhere = applyScopeToWhere({ id }, ctx);
      const softCol = ctx.softDelete?.column;
      // With a bound scope, the `*Many` variants honor the (non-unique)
      // tenant keys so an out-of-scope id affects 0 rows.
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
      const id = coerceId(ctx.id, modelName, getDmmf());
      // With a bound scope, `updateMany` honors the (non-unique) tenant keys
      // so a restore of an out-of-scope id affects 0 rows (mirrors `delete`).
      const baseWhere = applyScopeToWhere({ id }, ctx);
      if (ctx.applyScope) {
        await delegate.updateMany({ where: baseWhere, data: { [softCol]: null } });
      } else {
        await delegate.update({ where: baseWhere, data: { [softCol]: null } });
      }
    },

    // ── Migration bookkeeping (used by `flowpanel migrate`) ──────────────
    // `prisma.$executeRawUnsafe` runs SQL as-is; `prisma.$executeRaw`
    // template-tags template values as bound parameters natively.

    async runMigrationSql(rawSql: string): Promise<void> {
      await prisma.$executeRawUnsafe(rawSql);
    },

    async listAppliedMigrations(): Promise<Set<string>> {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS _flowpanel_migrations (
          id text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )`,
      );
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
