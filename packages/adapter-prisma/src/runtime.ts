import { FlowpanelAccessError, resolveScopeApplier } from "@flowpanel/core";
import type { PrismaDmmf } from "./introspect";

/** One `orderBy` entry: a direction, or for an optional field where its empty values go. */
export type PrismaOrderBy = Record<
  string,
  "asc" | "desc" | { sort: "asc" | "desc"; nulls: "first" | "last" }
>;

/** Subset of the Prisma model delegate methods FlowPanel invokes. */
export interface PrismaDelegate {
  findMany: (args: {
    where?: Record<string, unknown>;
    select?: Record<string, boolean>;
    orderBy?: PrismaOrderBy | PrismaOrderBy[];
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
  $queryRaw: <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  $queryRawUnsafe: <T = unknown>(sql: string, ...values: unknown[]) => Promise<T>;
  [delegateName: string]: unknown;
}

/** Apply a tenant predicate to a plain Prisma object, enforcing fail-closed scope. */
export function applyScopeToWhere(
  where: Record<string, unknown>,
  ctx: { boundScope?: { apply(query: unknown): unknown } },
): Record<string, unknown> {
  const applyScope = resolveScopeApplier(ctx);
  if (!applyScope) return where;
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
  if (!changed) {
    throw new FlowpanelAccessError(
      "the bound Prisma scope predicate returned the input unchanged. " +
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

/** The single column values a scope pins, such as `{ companyId: "c1" }`; filter-shaped keys are left out. */
function pinnedScopeValues(
  input: Record<string, unknown>,
  ctx: { boundScope?: { apply(query: unknown): unknown } },
  onFilter: (key: string) => void,
): Record<string, unknown> {
  const scoped = applyScopeToWhere({ ...input }, ctx);
  const pinned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(scoped)) {
    if (key in input && Object.is(input[key], value)) continue;
    if (!isColumnValue(value)) {
      onFilter(key);
      continue;
    }
    pinned[key] = value;
  }
  return pinned;
}

/** Resolve insert data for a scoped create: only equality scope keys can supply a column value. */
export function applyScopeToData(
  input: Record<string, unknown>,
  ctx: { boundScope?: { apply(query: unknown): unknown } },
): Record<string, unknown> {
  const pinned = pinnedScopeValues(input, ctx, (key) => {
    throw new FlowpanelAccessError(
      `create refused: the bound Prisma scope predicate contributed "${key}" as a filter ` +
        "rather than a single value, so it cannot be written into the new row. Use an equality " +
        `scope (e.g. { ${key}: tenantId }) on resources that allow create, or keep the filter ` +
        "scope and disable create for this resource.",
    );
  });
  return { ...input, ...pinned };
}

export const outOfScopeUpdate = (): FlowpanelAccessError =>
  new FlowpanelAccessError(
    "update refused: the changed row would fall outside the resource's tenant scope. " +
      "Keep the tenant column at the current scope's value.",
  );

/** Refuses an update that sets a column the scope pins to a different value, before anything is written. */
export function assertUpdateKeepsScope(
  input: Record<string, unknown>,
  ctx: { boundScope?: { apply(query: unknown): unknown } },
): void {
  const pinned = pinnedScopeValues(input, ctx, () => {});
  if (Object.keys(pinned).some((key) => key in input)) throw outOfScopeUpdate();
}

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

export async function missingAsNull<T>(write: Promise<T>): Promise<T | null> {
  try {
    return await write;
  } catch (err) {
    if (isGoneRow(err)) return null;
    throw err;
  }
}

/** An interactive transaction when the client has one; a client already inside one runs as is. */
export function inTransaction<T>(
  db: PrismaClientLike,
  run: (tx: PrismaClientLike) => Promise<T>,
): Promise<T> {
  return db.$transaction ? db.$transaction(run) : run(db);
}

const MIGRATIONS_TABLE = `_flowpanel_migrations (
  id varchar(255) NOT NULL PRIMARY KEY,
  applied_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

/** The bookkeeping table's DDL; on PostgreSQL a guarded block, so an existing table raises no NOTICE. */
export function migrationsTableDdl(provider: string): string {
  if (provider !== "postgresql") return `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE}`;
  return `DO $$ BEGIN
  IF to_regclass('_flowpanel_migrations') IS NULL THEN
    CREATE TABLE ${MIGRATIONS_TABLE};
  END IF;
END $$`;
}

type RuntimeDataModel = { models?: Record<string, object>; enums?: Record<string, object> };

const named = <T>(entries: Record<string, object>) =>
  Object.entries(entries).map(([name, value]) => ({ name, ...value })) as T[];

/** Every generated client, `prisma-client-js` or `prisma-client`, carries its schema as `_runtimeDataModel`. */
export function loadDmmf(prisma: unknown): PrismaDmmf {
  const model = (prisma as { _runtimeDataModel?: RuntimeDataModel } | null)?._runtimeDataModel;
  return checkedDmmf(
    model?.models && {
      datamodel: { models: named(model.models), enums: named(model.enums ?? {}) },
    },
  );
}

/** Prisma 7 trims the data model to names and types; introspection needs ids, nullability and defaults. */
export function checkedDmmf(dmmf: unknown): PrismaDmmf {
  if (!Array.isArray((dmmf as PrismaDmmf | undefined)?.datamodel?.models)) {
    throw new Error(
      "prismaAdapter: found no Prisma schema. Run `prisma generate` and pass the client your app creates, " +
        '`prisma: new PrismaClient()`, imported from "@prisma/client" with the prisma-client-js generator ' +
        'or from the generator\'s `output` (such as "@/app/generated/prisma/client") with prisma-client.',
    );
  }
  const field = (dmmf as PrismaDmmf).datamodel.models[0]?.fields?.[0];
  if (field !== undefined && typeof field.isId !== "boolean") {
    throw new Error(
      "prismaAdapter: Prisma.dmmf has no field metadata (isId, isRequired, defaults). " +
        "Prisma 7 removed it from the generated client; FlowPanel supports Prisma 5 and 6.",
    );
  }
  return dmmf as PrismaDmmf;
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

/** An id that cannot be the model's key, such as "abc" for an `Int @id`. */
export class InvalidIdError extends Error {}

/** Build the primary-key predicate, coercing numeric Prisma IDs. */
export function pkWhere(id: string, modelName: string, dmmf: PrismaDmmf): Record<string, unknown> {
  const model = dmmf.datamodel.models.find((entry) => entry.name === modelName);
  const pkField = model?.fields.find((field) => field.isId);
  const name = pkField?.name ?? "id";
  if (pkField && (pkField.type === "Int" || pkField.type === "BigInt")) {
    const value = parseInt(id, 10);
    if (Number.isNaN(value)) {
      throw new InvalidIdError(
        `prismaAdapter: cannot coerce id "${id}" to ${pkField.type} for model "${modelName}"`,
      );
    }
    return { [name]: value };
  }
  return { [name]: id };
}
