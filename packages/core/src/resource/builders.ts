/**
 * Column, Filter, and Action builders for FlowPanel resources.
 */

import { getPathString, resolvePath } from "./path";
import type {
  ActionBuilder,
  ActionDownloadResult,
  BulkActionConfig,
  CollectionActionConfig,
  ColumnBuilder,
  ComputedColumnOpts,
  ConfirmConfig,
  CustomColumnOpts,
  CustomFilterOpts,
  DialogActionConfig,
  FieldColumnOpts,
  FilterBuilder,
  FilterOpts,
  LinkActionConfig,
  MutationActionConfig,
  PathFn,
  ResolvedAction,
  ResolvedColumn,
  ResolvedFilter,
  Row,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a camelCase or single-word string to Title Case.
 * e.g. "createdAt" → "Created At", "userId" → "User Id", "email" → "Email"
 */
export function titleCase(s: string): string {
  // Insert a space before each uppercase letter that follows a lowercase letter
  const spaced = s.replace(/([a-z])([A-Z])/g, "$1 $2");
  // Capitalize the first letter of each word
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns the last segment of a dot-separated path string.
 * e.g. "user.email" → "email", "email" → "email"
 */
export function lastSegment(path: string): string {
  const idx = path.lastIndexOf(".");
  return idx === -1 ? path : path.slice(idx + 1);
}

// ---------------------------------------------------------------------------
// ColumnBuilder
// ---------------------------------------------------------------------------

export function createColumnBuilder<TRow>(): ColumnBuilder<TRow> {
  return {
    field(pathFn: PathFn<TRow>, opts?: FieldColumnOpts): ResolvedColumn {
      const path = resolvePath(pathFn);
      const pathStr = getPathString(path);
      const segment = lastSegment(pathStr);
      const label = opts?.label ?? titleCase(segment);
      const { label: _label, format, ...restOpts } = opts ?? {};

      return {
        id: pathStr,
        path: pathStr,
        label,
        type: "field",
        format: format ?? "auto",
        opts: restOpts,
      };
    },

    computed(name: string, opts: ComputedColumnOpts<TRow>): ResolvedColumn {
      const { label, format, compute, render, sortExpr, opts: extraOpts } = opts;
      return {
        id: name,
        path: null,
        label,
        type: "computed",
        format: format ?? "auto",
        opts: extraOpts ?? {},
        compute: compute as (row: Row) => unknown,
        render,
        sortExpr,
      };
    },

    custom(opts: CustomColumnOpts): ResolvedColumn {
      const { id, label, render, format, opts: extraOpts } = opts;
      return {
        id,
        path: null,
        label,
        type: "custom",
        format: format ?? "auto",
        opts: extraOpts ?? {},
        render,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// FilterBuilder
// ---------------------------------------------------------------------------

export function createFilterBuilder<TRow>(): FilterBuilder<TRow> {
  return {
    filter(pathFn: PathFn<TRow>, opts?: FilterOpts): ResolvedFilter {
      const path = resolvePath(pathFn);
      const pathStr = getPathString(path);
      const segment = lastSegment(pathStr);
      const label = opts?.label ?? titleCase(segment);
      const { label: _label, mode, ...restOpts } = opts ?? {};

      return {
        id: pathStr,
        path: pathStr,
        label,
        mode: mode ?? "auto",
        opts: restOpts,
      };
    },

    custom(opts: CustomFilterOpts): ResolvedFilter {
      const { id, label, mode, toWhere, render, opts: extraOpts } = opts;
      return {
        id,
        path: id,
        label,
        mode,
        opts: extraOpts ?? {},
        toWhere,
        render,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// ActionBuilder
// ---------------------------------------------------------------------------

function resolveConfirm(confirm: string | ConfirmConfig | undefined): ConfirmConfig | undefined {
  if (confirm === undefined) return undefined;
  if (typeof confirm === "string") return { title: confirm };
  return confirm;
}

export function createActionBuilder<TRow>(): ActionBuilder<TRow> {
  return {
    mutation(config: MutationActionConfig<TRow, unknown>): ResolvedAction {
      const { label, icon, variant, confirm, when, handler, onSuccess } = config;
      return {
        id: "",
        type: "mutation",
        label,
        icon,
        variant: variant ?? "default",
        confirm: resolveConfirm(confirm),
        when: when as ((row: Row) => boolean) | undefined,
        handler: handler as (row: Row, ctx: unknown) => Promise<unknown>,
        onSuccess,
      };
    },

    bulk(config: BulkActionConfig<TRow, unknown>): ResolvedAction {
      const { label, icon, variant, confirm, handler, onSuccess } = config;
      return {
        id: "",
        type: "bulk",
        label,
        icon,
        variant: variant ?? "default",
        confirm: resolveConfirm(confirm),
        handler: handler as (rows: Row[], ctx: unknown) => Promise<ActionDownloadResult | void>,
        onSuccess,
      };
    },

    collection(config: CollectionActionConfig<unknown>): ResolvedAction {
      const { label, icon, variant, confirm, handler, onSuccess } = config;
      return {
        id: "",
        type: "collection",
        label,
        icon,
        variant: variant ?? "default",
        confirm: resolveConfirm(confirm),
        handler: handler as (ctx: unknown) => Promise<ActionDownloadResult | void>,
        onSuccess,
      };
    },

    link(config: LinkActionConfig<TRow>): ResolvedAction {
      const { label, icon, href, external, when } = config;
      return {
        id: "",
        type: "link",
        label,
        icon,
        variant: "default",
        href: href as string | ((row: Row) => string),
        external,
        when: when as ((row: Row) => boolean) | undefined,
      };
    },

    dialog(config: DialogActionConfig<TRow, unknown>): ResolvedAction {
      const { label, icon, variant, schema, confirm, handler, onSuccess, when } = config;
      return {
        id: "",
        type: "dialog",
        label,
        icon,
        variant: variant ?? "default",
        schema,
        confirm: resolveConfirm(confirm),
        handler: handler as (
          values: Record<string, unknown>,
          row: Row | null,
          ctx: unknown,
        ) => Promise<ActionDownloadResult | void>,
        onSuccess,
        when: when as ((row: Row) => boolean) | undefined,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Shorthand resolvers
// ---------------------------------------------------------------------------

/**
 * Converts an array of PathFns into ResolvedColumns using c.field() for each.
 */
export function resolveShorthandColumns<TRow>(paths: PathFn<TRow>[]): ResolvedColumn[] {
  const c = createColumnBuilder<TRow>();
  return paths.map((p) => c.field(p));
}

/**
 * Converts an array of PathFns into ResolvedFilters using f.filter() for each.
 */
export function resolveShorthandFilters<TRow>(paths: PathFn<TRow>[]): ResolvedFilter[] {
  const f = createFilterBuilder<TRow>();
  return paths.map((p) => f.filter(p));
}
