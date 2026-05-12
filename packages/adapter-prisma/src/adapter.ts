import { createRequire } from "node:module";
import type {
  Adapter,
  ItemQueryContext,
  ListQueryContext,
  ListResult,
  MutationContext,
} from "@flowpanel/core";
import { introspect } from "./introspect.js";
import { inferSchema } from "./schema.js";
import type { PrismaDmmf } from "./introspect.js";

const require = createRequire(import.meta.url);

export interface PrismaAdapterOptions<P = unknown> {
  prisma: P;
  dmmf?: PrismaDmmf;
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

function getDelegate(prisma: any, modelName: string): any {
  const delegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  const delegate = prisma[delegateName];
  if (!delegate) {
    throw new Error(
      `prismaAdapter: no delegate found for model "${modelName}" (tried prisma.${delegateName}). ` +
        `Make sure the model exists in your Prisma schema.`,
    );
  }
  return delegate;
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

export function prismaAdapter<P>(opts: PrismaAdapterOptions<P>): Adapter<P> {
  let _dmmf: PrismaDmmf | undefined = opts.dmmf;

  function getDmmf(): PrismaDmmf {
    if (!_dmmf) _dmmf = loadDmmf();
    return _dmmf;
  }

  return {
    kind: "prisma",
    db: opts.prisma,

    introspect: (ref: unknown) => {
      const modelName = ref as string;
      return introspect(modelName, getDmmf());
    },

    inferSchema: (ref: unknown) => {
      const modelName = ref as string;
      return inferSchema(modelName, getDmmf());
    },

    async list(ref: unknown, ctx: ListQueryContext<any>): Promise<ListResult<any>> {
      const modelName = ref as string;
      const delegate = getDelegate(opts.prisma, modelName);
      const dmmf = getDmmf();

      // Build where clause
      const where: Record<string, any> = {};

      for (const [k, v] of Object.entries(ctx.filters ?? {})) {
        if (v === undefined || v === null || v === "") continue;
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

      // Order by
      let orderBy: any = undefined;
      if (ctx.sort) {
        orderBy = { [ctx.sort.field]: ctx.sort.dir };
      }

      const skip = (ctx.page - 1) * ctx.pageSize;
      const take = ctx.pageSize;

      const [rows, total] = await Promise.all([
        delegate.findMany({ where, orderBy, skip, take }),
        delegate.count({ where }),
      ]);

      return { rows, total, page: ctx.page, pageSize: ctx.pageSize };
    },

    async get(ref: unknown, ctx: ItemQueryContext): Promise<any | null> {
      const modelName = ref as string;
      const delegate = getDelegate(opts.prisma, modelName);
      const id = coerceId(ctx.id, modelName, getDmmf());
      const result = await delegate.findUnique({ where: { id } });
      return result ?? null;
    },

    async create(ref: unknown, ctx: MutationContext<any>): Promise<any> {
      const modelName = ref as string;
      const delegate = getDelegate(opts.prisma, modelName);
      return delegate.create({ data: ctx.input });
    },

    async update(ref: unknown, ctx: MutationContext<any>): Promise<any> {
      if (!ctx.id) throw new Error("prismaAdapter: update requires ctx.id");
      const modelName = ref as string;
      const delegate = getDelegate(opts.prisma, modelName);
      const id = coerceId(ctx.id, modelName, getDmmf());
      return delegate.update({ where: { id }, data: ctx.input });
    },

    async delete(ref: unknown, ctx: MutationContext<any>): Promise<void> {
      if (!ctx.id) throw new Error("prismaAdapter: delete requires ctx.id");
      const modelName = ref as string;
      const delegate = getDelegate(opts.prisma, modelName);
      const id = coerceId(ctx.id, modelName, getDmmf());
      const softCol = ctx.softDelete?.column;
      if (softCol) {
        await delegate.update({
          where: { id },
          data: { [softCol]: new Date() },
        });
      } else {
        await delegate.delete({ where: { id } });
      }
    },

    async restore(ref: unknown, ctx: MutationContext<any>): Promise<void> {
      const softCol = ctx.softDelete?.column;
      if (!softCol)
        throw new Error("prismaAdapter: restore requires ctx.softDelete to be configured");
      if (!ctx.id) throw new Error("prismaAdapter: restore requires ctx.id");
      const modelName = ref as string;
      const delegate = getDelegate(opts.prisma, modelName);
      const id = coerceId(ctx.id, modelName, getDmmf());
      await delegate.update({
        where: { id },
        data: { [softCol]: null },
      });
    },
  };
}
