/**
 * `defineResource(table, options)` — the typed resource builder.
 *
 * Two overloads:
 *   1. `defineResource(table, opts)`  — Drizzle table or Prisma delegate
 *      (metadata is inferred via an adapter bridge registered at adapter load).
 *   2. `defineResource(metadata, opts)` — raw `ModelMetadata` (tests + power users).
 *
 * The builder walks the column/filter/action selectors synchronously at config-
 * load time, so any reference to a non-existent column throws immediately — you
 * don't wait until a user opens the admin for a typo to surface.
 */

import { titleCase } from "./builders";
import { isColumnRef, isComputedColumnInput } from "./columnRefs";
import { createTableProxy } from "./tableProxy";
import type {
  DefineResourceOptions,
  TypedAction,
  TypedColumn,
  TypedColumnInput,
  TypedComputedColumn,
  TypedFieldColumn,
  TypedFilter,
  TypedResourceDefinition,
} from "./typedTypes";
import type { FieldMetadata, ModelMetadata } from "./types";

// biome-ignore lint/suspicious/noExplicitAny: cross-package bridge — adapters register inferMetadata here
type AdapterBridge = { inferMetadata: (table: unknown) => ModelMetadata };

// biome-ignore lint/suspicious/noExplicitAny: cross-package bridge
const globalsAny = globalThis as any;

function resolveMetadata(tableOrMeta: unknown): ModelMetadata {
  if (isModelMetadata(tableOrMeta)) return tableOrMeta;

  const drizzle = globalsAny.__FP_DRIZZLE_TYPED__ as AdapterBridge | undefined;
  if (drizzle?.inferMetadata) {
    try {
      return drizzle.inferMetadata(tableOrMeta);
    } catch {
      /* fall through */
    }
  }
  const prisma = globalsAny.__FP_PRISMA_TYPED__ as AdapterBridge | undefined;
  if (prisma?.inferMetadata) {
    try {
      return prisma.inferMetadata(tableOrMeta);
    } catch {
      /* fall through */
    }
  }
  throw new Error(
    "defineResource: could not infer metadata from the first argument. " +
      "Pass a Drizzle table, a Prisma delegate, or a raw ModelMetadata object. " +
      "If you passed a table, make sure @flowpanel/adapter-drizzle or @flowpanel/adapter-prisma " +
      "is imported before defineResource is called so its metadata bridge is registered.",
  );
}

function isModelMetadata(x: unknown): x is ModelMetadata {
  if (typeof x !== "object" || x === null) return false;
  const obj = x as Record<string, unknown>;
  return (
    typeof obj.name === "string" && typeof obj.primaryKey === "string" && Array.isArray(obj.fields)
  );
}

function pluralize(name: string): string {
  // Simple English pluralizer — users override via `labelPlural` for edge cases.
  if (/(s|x|z|ch|sh)$/i.test(name)) return `${name}es`;
  if (/[^aeiou]y$/i.test(name)) return `${name.slice(0, -1)}ies`;
  return `${name}s`;
}

function inferFilterMode(meta: FieldMetadata): TypedFilter["mode"] {
  if (meta.enumValues?.length) return "enum";
  switch (meta.type) {
    case "boolean":
      return "boolean";
    case "int":
    case "float":
      return "range";
    case "datetime":
      return "dateRange";
    case "string":
      return "text";
    case "relation":
      return "relation";
    default:
      return "auto";
  }
}

function resolveColumnInput<TRow>(input: TypedColumnInput<TRow>): TypedColumn<TRow> {
  if (isColumnRef(input)) {
    const last = input.path.split(".").pop() ?? input.path;
    const col: TypedFieldColumn = {
      kind: "field",
      id: input.path,
      path: input.path,
      label: titleCase(last),
      format: "auto",
      opts: {},
      ...(input.metadata.enumValues ? { enumValues: input.metadata.enumValues } : {}),
      ...(input.metadata.relationModel ? { relationModel: input.metadata.relationModel } : {}),
    };
    return col;
  }

  if (isComputedColumnInput(input)) {
    const col: TypedComputedColumn<TRow> = {
      kind: "computed",
      id: input.id,
      label: input.label ?? titleCase(input.id),
      format: (input.format as TypedComputedColumn["format"]) ?? "auto",
      sortExpr: input.sortExpr,
      compute: input.compute as TypedComputedColumn<TRow>["compute"],
      computeBatch: input.computeBatch as TypedComputedColumn<TRow>["computeBatch"],
    };
    return col;
  }

  throw new Error(
    "defineResource: columns selector returned a value that is neither a ColumnRef " +
      "(e.g. `u.email`) nor a ComputedColumnInput (object with `id` and `compute`/`computeBatch`).",
  );
}

// ─── Public overloads ─────────────────────────────────────────────────────

/**
 * Declare a typed resource backed by a Drizzle table or Prisma delegate.
 *
 * Pass the row type as the first generic — this drives `u.xxx` column
 * selection and action callbacks. The first argument is kept deliberately
 * wide (`unknown`) so the row type is not inferred from Drizzle/Prisma's
 * internal delegate/table types (which carry method shapes, not columns).
 *
 * @example
 *   import type { User } from "@prisma/client";
 *   const userResource = defineResource<User>(prisma.user, {
 *     columns: (u) => [u.id, u.email],
 *   });
 *
 * @example
 *   import { type InferSelectModel } from "drizzle-orm";
 *   import { users } from "./db/schema";
 *   type UserRow = InferSelectModel<typeof users>;
 *   const userResource = defineResource<UserRow>(users, {
 *     columns: (u) => [u.id, u.email],
 *   });
 */
export function defineResource<TRow, TSession = unknown>(
  tableOrMetadata: unknown,
  options: DefineResourceOptions<TRow, TRow, TSession>,
): TypedResourceDefinition<TRow> {
  const metadata = resolveMetadata(tableOrMetadata);
  const proxy = createTableProxy<TRow>(metadata);

  // Columns
  const rawColumns = options.columns(proxy);
  const columns: TypedColumn<TRow>[] = rawColumns.map((c) =>
    resolveColumnInput<TRow>(c as TypedColumnInput<TRow>),
  );

  // Filters
  const rawFilters = options.filters?.(proxy) ?? [];
  const filters: TypedFilter[] = rawFilters.map((ref) => {
    if (!isColumnRef(ref)) {
      throw new Error(
        "defineResource: filters selector must return ColumnRef[] — e.g. `(u) => [u.plan, u.createdAt]`. " +
          "Computed filters are not supported yet; wrap custom logic in a custom page instead.",
      );
    }
    const mode = inferFilterMode(ref.metadata);
    const last = ref.path.split(".").pop() ?? ref.path;
    return {
      id: ref.path,
      path: ref.path,
      label: titleCase(last),
      mode,
      opts: ref.metadata.enumValues ? { options: [...ref.metadata.enumValues] } : {},
    };
  });

  // Actions (pass-through normalization — validation happens in Task 5 tests)
  const actions: Record<string, TypedAction<TRow>> = {};
  for (const [id, action] of Object.entries(options.actions ?? {})) {
    actions[id] = action as TypedAction<TRow>;
  }

  const label = options.label ?? metadata.name;
  const labelPlural = options.labelPlural ?? pluralize(label);

  return {
    kind: "typed-resource",
    model: metadata.name,
    primaryKey: metadata.primaryKey,
    label,
    labelPlural,
    icon: options.icon,
    path: options.path ?? metadata.name.toLowerCase(),
    defaultSort: options.defaultSort,
    defaultPageSize: options.defaultPageSize ?? 50,
    searchFields: options.searchFields ?? [],
    columns,
    filters,
    actions,
    drawer: options.drawer,
    realtime: options.realtime,
    export: options.export,
    readOnly: options.readOnly,
  };
}
