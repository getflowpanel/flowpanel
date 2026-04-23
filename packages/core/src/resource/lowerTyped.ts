/**
 * Lower a `TypedResourceDefinition` (output of `defineResource`) into the
 * legacy `ResolvedResource` shape the rest of the system expects. Keeps the
 * tRPC / UI pipeline unchanged — the new builder is additive.
 *
 * Handlers from the typed builder are adapted to the legacy `(row, ctx)`
 * signature at this boundary; batch compute functions are stashed on
 * `_computesBatch` so list queries can pick them up.
 */

import type {
  TypedBulkAction,
  TypedBulkEditAction,
  TypedColumn,
  TypedResourceDefinition,
  TypedRowAction,
} from "./typedTypes";
import type {
  AccessConfig,
  FieldAccessRule,
  ResolvedAction,
  ResolvedColumn,
  ResolvedFilter,
  ResolvedResource,
  Row,
} from "./types";

export interface ResolvedResourceWithBatch extends ResolvedResource {
  _computesBatch: Record<
    string,
    (rows: readonly Row[]) => Promise<ReadonlyMap<string | number, unknown>>
  >;
  /** Flags forwarded from the typed builder. */
  _realtime: boolean;
  _export: boolean;
  _drawer?: string;
}

export function lowerTypedResource(
  key: string,
  def: TypedResourceDefinition,
): ResolvedResourceWithBatch {
  const computes: Record<string, (row: Row) => unknown> = {};
  const computesBatch: Record<
    string,
    (rows: readonly Row[]) => Promise<ReadonlyMap<string | number, unknown>>
  > = {};

  const columns: ResolvedColumn[] = def.columns.map((c) => lowerColumn(c, computes, computesBatch));

  const filters: ResolvedFilter[] = def.filters.map((f) => ({
    id: f.id,
    path: f.path,
    label: f.label,
    mode: f.mode,
    opts: f.opts,
  }));

  const handlers: Record<string, (row: Row, ctx: unknown) => Promise<unknown>> = {};
  const whens: Record<string, (row: Row) => boolean> = {};
  const actions: ResolvedAction[] = Object.entries(def.actions).map(([id, action]) =>
    lowerAction(id, action, handlers, whens),
  );

  const access: AccessConfig = def.readOnly ? { create: false, update: false, delete: false } : {};
  const fieldAccess: FieldAccessRule[] = [];

  return {
    id: key,
    modelName: def.model,
    primaryKey: def.primaryKey,
    label: def.label,
    labelPlural: def.labelPlural,
    ...(def.icon ? { icon: def.icon } : {}),
    path: def.path,
    defaultSort: def.defaultSort,
    defaultPageSize: def.defaultPageSize,
    searchFields: [...def.searchFields],
    columns,
    filters,
    actions,
    access,
    fieldAccess,
    readOnly: def.readOnly,
    _handlers: handlers,
    _computes: computes,
    _whens: whens,
    _computesBatch: computesBatch,
    _realtime: def.realtime === true,
    _export: def.export === true,
    ...(def.drawer ? { _drawer: def.drawer } : {}),
  };
}

// ─── Column lowering ─────────────────────────────────────────────────────

function lowerColumn(
  c: TypedColumn,
  computes: Record<string, (row: Row) => unknown>,
  computesBatch: Record<
    string,
    (rows: readonly Row[]) => Promise<ReadonlyMap<string | number, unknown>>
  >,
): ResolvedColumn {
  if (c.kind === "field") {
    return {
      id: c.id,
      path: c.path,
      label: c.label,
      type: "field",
      format: c.format,
      opts: c.opts,
    };
  }
  // Computed
  if (c.compute) {
    const fn = c.compute;
    computes[c.id] = (row) => fn({ row, db: null, session: null });
  }
  if (c.computeBatch) {
    const batch = c.computeBatch;
    computesBatch[c.id] = async (rows) => {
      const result = await batch({ rows, db: null, session: null });
      return result as ReadonlyMap<string | number, unknown>;
    };
  }
  return {
    id: c.id,
    path: null,
    label: c.label,
    type: "computed",
    format: c.format,
    opts: {},
    ...(c.sortExpr ? { sortExpr: c.sortExpr } : {}),
  };
}

// ─── Action lowering ─────────────────────────────────────────────────────

function lowerAction(
  id: string,
  a: TypedRowAction | TypedBulkAction | TypedBulkEditAction,
  handlers: Record<string, (row: Row, ctx: unknown) => Promise<unknown>>,
  whens: Record<string, (row: Row) => boolean>,
): ResolvedAction {
  if (a.type === "row") {
    handlers[id] = async (row, ctx) =>
      a.run({
        row,
        db: (ctx as { db?: unknown })?.db ?? null,
        session: (ctx as { session?: unknown })?.session ?? null,
      });
    if (a.disabled) {
      const disabled = a.disabled;
      whens[id] = (row) => !disabled({ row });
    }
    const confirmConfig = a.confirm
      ? {
          description:
            typeof a.confirm === "function"
              ? (row: Row) => (a.confirm as (ctx: { row: Row }) => string)({ row })
              : (a.confirm as string),
          stepUp: a.stepUp === true,
        }
      : undefined;
    return {
      id,
      type: "mutation",
      label: a.label,
      ...(a.icon ? { icon: a.icon } : {}),
      variant: a.variant === "danger" ? "danger" : "default",
      ...(confirmConfig ? { confirm: confirmConfig } : {}),
      handler: handlers[id],
      ...(whens[id] ? { when: whens[id] } : {}),
    };
  }

  if (a.type === "bulk") {
    const confirmConfig = a.confirm
      ? {
          description:
            typeof a.confirm === "function"
              ? (row: Row) =>
                  (a.confirm as (ctx: { rows: readonly Row[] }) => string)({
                    rows: row ? [row] : [],
                  })
              : (a.confirm as string),
          stepUp: a.stepUp === true,
        }
      : undefined;
    return {
      id,
      type: "bulk",
      label: a.label,
      ...(a.icon ? { icon: a.icon } : {}),
      variant: a.variant === "danger" ? "danger" : "default",
      ...(confirmConfig ? { confirm: confirmConfig } : {}),
      handler: async (rows, ctx) => {
        await a.run({
          rows,
          db: (ctx as { db?: unknown })?.db ?? null,
          session: (ctx as { session?: unknown })?.session ?? null,
        });
      },
    };
  }

  // bulkEdit — represented as a dialog action with a schema derived from fields[].
  return {
    id,
    type: "dialog",
    label: a.label,
    ...(a.icon ? { icon: a.icon } : {}),
    variant: a.variant === "danger" ? "danger" : "default",
    schema: {
      fields: a.fields.map((name) => ({ name, type: "text" as const })),
      submitLabel: "Apply",
    },
    handler: async (values, _row, ctx) => {
      await a.run({
        rows: [],
        patch: values as Partial<Row>,
        db: (ctx as { db?: unknown })?.db ?? null,
        session: (ctx as { session?: unknown })?.session ?? null,
      });
    },
  };
}

export function isTypedResourceDefinition(x: unknown): x is TypedResourceDefinition {
  return typeof x === "object" && x !== null && (x as { kind?: unknown }).kind === "typed-resource";
}
