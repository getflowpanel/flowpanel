import { createRequire } from "node:module";
import { FlowpanelAccessError } from "@flowpanel/core";
import type { PrismaDmmf } from "./introspect";

const require = createRequire(import.meta.url);

/** Subset of the Prisma model delegate methods FlowPanel invokes. */
export interface PrismaDelegate {
  findMany: (args: {
    where?: Record<string, unknown>;
    select?: Record<string, boolean>;
    orderBy?: Record<string, "asc" | "desc">;
    skip?: number;
    take?: number;
  }) => Promise<unknown[]>;
  findUnique: (args: {
    where: Record<string, unknown>;
    select?: Record<string, boolean>;
  }) => Promise<Record<string, unknown> | null>;
  findFirst: (args: {
    where: Record<string, unknown>;
    select?: Record<string, boolean>;
  }) => Promise<Record<string, unknown> | null>;
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

export interface PrismaClientLike {
  $transaction?: <T>(run: (tx: PrismaClientLike) => Promise<T>) => Promise<T>;
  $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
  $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<number>;
  $queryRawUnsafe: <T = unknown>(sql: string, ...values: unknown[]) => Promise<T>;
  [delegateName: string]: unknown;
}

/** Apply a tenant predicate to a plain Prisma object, enforcing fail-closed scope. */
export function applyScopeToWhere(
  where: Record<string, unknown>,
  ctx: {
    boundScope?: { apply(query: unknown): unknown };
    applyScope?: (query: unknown) => unknown;
    scopeRequired?: boolean;
  },
): Record<string, unknown> {
  const applyScope = ctx.boundScope?.apply ?? ctx.applyScope;
  if (!applyScope) {
    if (ctx.scopeRequired) {
      throw new FlowpanelAccessError(
        "scope required but not bound: a scope predicate is declared and global scope " +
          "is active, but the adapter received no applyScope. Refusing to run an unscoped query.",
      );
    }
    return where;
  }
  const before = { ...where };
  const scoped = applyScope(where);
  if (typeof scoped !== "object" || scoped === null || Array.isArray(scoped)) {
    throw new FlowpanelAccessError(
      "the bound Prisma scope predicate must return a where/data object. " +
        "Refusing to run an unscoped query.",
    );
  }
  const result = scoped as Record<string, unknown>;
  for (const key of Object.keys(before)) {
    if (!(key in result)) {
      throw new FlowpanelAccessError(
        `the bound Prisma scope predicate removed required key "${key}". ` +
          "Refusing to run a broadened query.",
      );
    }
  }
  const changed =
    result !== where ||
    Object.keys(result).length !== Object.keys(before).length ||
    Object.keys(before).some((key) => !Object.is(result[key], before[key]));
  if (ctx.scopeRequired && !changed) {
    throw new FlowpanelAccessError(
      "scope required but the bound Prisma predicate returned the input unchanged. " +
        "Refusing to run an unscoped query.",
    );
  }
  return result;
}

function isColumnValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value instanceof Date) return true;
  return typeof value !== "object" && typeof value !== "function";
}

/** Resolve insert data for a scoped create: only equality scope keys can supply a column value. */
export function applyScopeToData(
  input: Record<string, unknown>,
  ctx: {
    boundScope?: { apply(query: unknown): unknown };
    applyScope?: (query: unknown) => unknown;
    scopeRequired?: boolean;
  },
): Record<string, unknown> {
  const scoped = applyScopeToWhere({ ...input }, ctx);
  const data: Record<string, unknown> = { ...input };
  for (const [key, value] of Object.entries(scoped)) {
    if (key in input && Object.is(input[key], value)) continue;
    if (!isColumnValue(value)) {
      throw new FlowpanelAccessError(
        `create refused: the bound Prisma scope predicate contributed "${key}" as a filter ` +
          "rather than a single value, so it cannot be written into the new row. Use an equality " +
          `scope (e.g. { ${key}: tenantId }) on resources that allow create, or keep the filter ` +
          "scope and disable create for this resource.",
      );
    }
    data[key] = value;
  }
  return data;
}

export const MIGRATIONS_TABLE_DDL = `CREATE TABLE IF NOT EXISTS _flowpanel_migrations (
  id varchar(255) NOT NULL PRIMARY KEY,
  applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

export function loadDmmf(): PrismaDmmf {
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

export function getDelegate(prisma: PrismaClientLike, modelName: string): PrismaDelegate {
  const delegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  const delegate = prisma[delegateName];
  if (!delegate) {
    throw new Error(
      `prismaAdapter: no delegate found for model "${modelName}" (tried prisma.${delegateName}). ` +
        "Make sure the model exists in your Prisma schema.",
    );
  }
  return delegate as PrismaDelegate;
}

/** Build the primary-key predicate, coercing numeric Prisma IDs. */
export function pkWhere(id: string, modelName: string, dmmf: PrismaDmmf): Record<string, unknown> {
  const model = dmmf.datamodel.models.find((entry) => entry.name === modelName);
  const pkField = model?.fields.find((field) => field.isId);
  const name = pkField?.name ?? "id";
  if (pkField && (pkField.type === "Int" || pkField.type === "BigInt")) {
    const value = parseInt(id, 10);
    if (Number.isNaN(value)) {
      throw new Error(
        `prismaAdapter: cannot coerce id "${id}" to ${pkField.type} for model "${modelName}"`,
      );
    }
    return { [name]: value };
  }
  return { [name]: id };
}
