/**
 * Custom page types — config-driven custom admin pages beyond the built-in
 * CRUD/dashboard/queue views.
 *
 * A page is a React component rendered inside the admin shell (sidebar +
 * header stay in place). The component prop stays as `unknown` at the core
 * level so this module remains React-agnostic; `@flowpanel/react` narrows
 * it to `React.ComponentType`.
 */

/** Session-like context for access rules; consumer narrows via generics. */
export type PageAccessContext = Record<string, unknown>;

/** Access rule for a page. Mirrors the resource-level access shape. */
export type PageAccessRule =
  | boolean
  | readonly string[]
  | ((ctx: PageAccessContext) => boolean | Promise<boolean>);

/** User-facing page declaration. */
export interface FlowPanelPage {
  /**
   * Path segment under the admin base path. `"reports"` mounts at `/admin/reports`.
   * Cannot collide with reserved ids (`"dashboard"`), resource ids, or queue ids.
   */
  path: string;
  /** React component (type-erased in core). */
  component: unknown;
  /** Display label in the sidebar. Defaults to Title-Cased `path`. */
  label?: string;
  /**
   * Lucide icon name (`"bar-chart-3"`) or a ReactNode. Strings are looked up
   * client-side; nodes are rendered as-is.
   */
  icon?: string | unknown;
  /** Sidebar group key. If omitted, page appears under a default "Pages" group. */
  group?: string;
  /** Access rule. If `false`, page is hidden from sidebar and route 404s. */
  access?: PageAccessRule;
}

/** Resolved page — internal representation with derived id and normalized fields. */
export interface ResolvedPage {
  /** Stable identifier used for routing + sidebar keys. Equals `path`. */
  id: string;
  path: string;
  component: unknown;
  label: string;
  icon?: string | unknown;
  group?: string;
  access?: PageAccessRule;
}

/** Client-safe page — no component, no access function. */
export interface SerializedPage {
  id: string;
  path: string;
  label: string;
  icon?: string | unknown;
  group?: string;
  /** Access evaluated to boolean for the current session. */
  allowed: boolean;
}
