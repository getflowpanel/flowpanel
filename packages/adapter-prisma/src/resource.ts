import type { ResourceAdapter, FindManyArgs, ModelMetadata, Row } from "@flowpanel/core";
import { normalizedFiltersToPrismaWhere } from "./filters";

type PrismaDelegate = {
  findMany(args: unknown): Promise<Row[]>;
  findUnique(args: unknown): Promise<Row | null>;
  count(args: unknown): Promise<number>;
  create(args: unknown): Promise<Row>;
  update(args: unknown): Promise<Row>;
  delete(args: unknown): Promise<Row>;
};

type PrismaClientLike = Record<string, unknown>;

function toLowerFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Build a nested orderBy from a dot-path like "user.email".
 * "user.email" → { user: { email: "asc" } }
 */
function buildOrderBy(field: string, dir: "asc" | "desc"): Record<string, unknown> {
  const parts = field.split(".");
  let result: Record<string, unknown> = {};
  let current = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const nested: Record<string, unknown> = {};
    current[parts[i]!] = nested;
    current = nested;
  }
  current[parts[parts.length - 1]!] = dir;
  return result;
}

function getDelegate(prisma: PrismaClientLike, model: string): PrismaDelegate {
  const key = toLowerFirst(model);
  const delegate = prisma[key];
  if (!delegate) {
    throw new Error(`Prisma delegate not found for model "${model}" (key: "${key}")`);
  }
  return delegate as PrismaDelegate;
}

export function createPrismaResourceAdapter(
  prisma: PrismaClientLike,
  models: Map<string, ModelMetadata>,
  enums: Map<string, string[]>,
): ResourceAdapter {
  return {
    getModelNames(): string[] {
      return Array.from(models.keys());
    },

    getModelMetadata(model: string): ModelMetadata {
      const meta = models.get(model);
      if (!meta) {
        throw new Error(`Model metadata not found for "${model}"`);
      }
      return meta;
    },

    getEnumValues(enumName: string): string[] {
      return enums.get(enumName) ?? [];
    },

    async findMany(model: string, args: FindManyArgs): Promise<{ data: Row[]; total: number }> {
      const delegate = getDelegate(prisma, model);
      const where = args.where ? normalizedFiltersToPrismaWhere(args.where) : undefined;
      const orderBy = args.orderBy ? buildOrderBy(args.orderBy.field, args.orderBy.dir) : undefined;

      const prismaArgs: Record<string, unknown> = {
        ...(where !== undefined && { where }),
        ...(orderBy !== undefined && { orderBy }),
        ...(args.skip !== undefined && { skip: args.skip }),
        ...(args.take !== undefined && { take: args.take }),
        ...(args.include !== undefined && { include: args.include }),
      };

      const [data, total] = await Promise.all([
        delegate.findMany(prismaArgs),
        delegate.count({ ...(where !== undefined && { where }) }),
      ]);

      return { data, total };
    },

    async findUnique(
      model: string,
      args: { where: Record<string, unknown>; include?: Record<string, unknown> },
    ): Promise<Row | null> {
      const delegate = getDelegate(prisma, model);
      return delegate.findUnique({
        where: args.where,
        ...(args.include !== undefined && { include: args.include }),
      });
    },

    async count(
      model: string,
      args: { where?: import("@flowpanel/core").NormalizedFilter[] },
    ): Promise<number> {
      const delegate = getDelegate(prisma, model);
      const where = args.where ? normalizedFiltersToPrismaWhere(args.where) : undefined;
      return delegate.count({ ...(where !== undefined && { where }) });
    },

    async create(model: string, args: { data: Record<string, unknown> }): Promise<Row> {
      const delegate = getDelegate(prisma, model);
      return delegate.create({ data: args.data });
    },

    async update(
      model: string,
      args: { where: Record<string, unknown>; data: Record<string, unknown> },
    ): Promise<Row> {
      const delegate = getDelegate(prisma, model);
      return delegate.update({ where: args.where, data: args.data });
    },

    async delete(model: string, args: { where: Record<string, unknown> }): Promise<Row> {
      const delegate = getDelegate(prisma, model);
      return delegate.delete({ where: args.where });
    },
  };
}
