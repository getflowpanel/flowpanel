/**
 * Column, Filter, and Action builders for FlowPanel resources.
 */

import { getPathString, resolvePath } from "./path";
import type {
  ActionBuilder,
  ColumnBuilder,
  ComputedColumnOpts,
  ConfirmConfig,
  CustomColumnOpts,
  CustomFilterOpts,
  FieldColumnOpts,
  FilterBuilder,
  FilterOpts,
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

export function createActionBuilder<TRow>(): ActionBuilder<TRow> {
  return {
    mutation(config: MutationActionConfig<TRow, unknown>): ResolvedAction {
      const { label, icon, variant, confirm, when, handler, onSuccess } = config;

      let resolvedConfirm: ConfirmConfig | undefined;
      if (typeof confirm === "string") {
        resolvedConfirm = { title: confirm };
      } else {
        resolvedConfirm = confirm;
      }

      return {
        id: "",
        type: "mutation",
        label,
        icon,
        variant: variant ?? "default",
        confirm: resolvedConfirm,
        when: when as ((row: Row) => boolean) | undefined,
        handler: handler as (row: Row, ctx: unknown) => Promise<unknown>,
        onSuccess,
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
