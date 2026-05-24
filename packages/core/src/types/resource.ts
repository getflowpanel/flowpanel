import type { ReactNode } from "react";
import type { z } from "zod";
import type { BulkAction, RowAction } from "./action.js";
import type {
  ItemQueryContext,
  ListQueryContext,
  QueryContext,
  RequestContext,
} from "./context.js";
import type { DrawerConfig } from "./drawer.js";
import type { Scope, Session } from "./session.js";

export type { DrawerConfig };

export type SelectOption = { label: string; value: string | number | boolean };

export interface ColumnDef<Row> {
  field?: keyof Row & string;
  label?: string;
  render?: (row: Row, ctx: RequestContext) => ReactNode;
  sortable?: boolean;
  width?: number | string;
  align?: "left" | "center" | "right";
  className?: string;
  hidden?: boolean;
  pinnable?: boolean;
  tone?: (row: Row) => "ok" | "warn" | "err" | null;
  /**
   * Foreign-key resolution. When set, the cell renders the looked-up label
   * (e.g. `user.email`) as a link to the target resource's drawer / detail
   * page instead of the raw foreign-key value (a uuid).
   *
   * Server-batched in `prerender-cells.ts` — one `SELECT id, <labelField>
   * FROM <target> WHERE id IN (allIdsOnPage)` per FK column per page.
   *
   * @example
   * ```ts
   * { field: "userId", reference: { resource: "users", labelField: "email" } }
   * ```
   */
  reference?: { resource: string; labelField: string };
  /**
   * When `true`, the cell becomes editable in-place: double-click to enter
   * edit mode, Enter or blur to save, Esc to cancel. The save POSTs to
   * `/api/flowpanel/<resource>/<id>/update` with `{ field, value }` and
   * reuses the resource's `update` Zod schema for validation.
   *
   * Editable cells skip the FK / array / json renderer dispatch so the
   * input shows the raw value (you can't inline-edit an FK target's label
   * — you edit the FK's id).
   */
  editable?: boolean;
}

export type FilterType =
  | "text"
  | "select"
  | "multiselect"
  | "daterange"
  | "numeric-range"
  | "boolean"
  | "tag";

export interface FilterDef<Row> {
  field: keyof Row & string;
  label?: string;
  type: FilterType;
  /**
   * Select / multiselect options.
   *
   * - `string[]` (sugar) — `["a", "b"]` is shorthand for
   *   `[{label:"a",value:"a"},{label:"b",value:"b"}]`. Best when label
   *   and value match (most enums).
   * - `SelectOption[]` — explicit shape when label and value differ
   *   (e.g. `[{label:"Free tier", value:"free"}]`).
   * - `(ctx) => Promise<SelectOption[]>` — server-fetched options. Runs
   *   on every list render; cache via `unstable_cache` if the source is
   *   slow.
   */
  options?:
    | ReadonlyArray<string>
    | SelectOption[]
    | ((ctx: QueryContext) => Promise<SelectOption[]>);
  /**
   * Default filter value applied when the user has not picked one.
   *
   * Two string values are reserved sentinels that every adapter must
   * translate at the SQL/ORM level:
   *
   * - `"__null__"`     → `WHERE <field> IS NULL`
   * - `"__notnull__"`  → `WHERE <field> IS NOT NULL`
   *
   * Use them in `options` (e.g. `{ label: "Unmapped only", value: "__null__" }`)
   * to express nullability filters in a select. Passing them as raw equality
   * (`WHERE field = '__null__'`) would always match zero rows.
   */
  defaultValue?: unknown;
  hidden?: boolean;
}

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "password"
  | "url"
  | "date"
  | "datetime"
  | "time"
  | "boolean"
  | "switch"
  | "checkbox"
  | "select"
  | "multiselect"
  | "radio"
  | "json"
  | "markdown"
  | "tags"
  | "reference"
  | "hidden"
  | "file"
  | "image"
  | "color";

export interface FieldDef<Row> {
  name: keyof Row & string;
  label?: string;
  help?: string;
  placeholder?: string;
  type?: FieldType;
  options?: SelectOption[] | ((ctx: QueryContext) => Promise<SelectOption[]>);
  reference?: { resource: string; labelField: string };
  required?: boolean;
  readOnly?: boolean | ((values: Partial<Row>) => boolean);
  hidden?: boolean | ((values: Partial<Row>) => boolean);
  validate?:
    | z.ZodTypeAny
    | ((value: unknown, values: Partial<Row>) => string | null | Promise<string | null>);
  defaultValue?: unknown | ((ctx: QueryContext) => Promise<unknown>);
  transform?: { in?: (v: unknown) => unknown; out?: (v: unknown) => unknown };
  span?: 1 | 2 | 3 | 4 | 6 | 12;
  group?: string;
}

export interface DetailTab<Row> {
  key: string;
  label: string;
  icon?: string;
  hidden?: (row: Row) => boolean;
  fields?: (keyof Row | FieldDef<Row>)[] | "*";
  resource?: string;
  filter?: (row: Row) => Record<string, unknown>;
  render?: (row: Row) => ReactNode;
}

export interface ListResult<Row> {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ResourceOptions<Row> {
  name?: string;
  label?: string;
  plural?: string;
  icon?: string;
  hidden?: boolean;

  columns: (keyof Row | ColumnDef<Row>)[];
  search?: (keyof Row & string)[];
  filters?: (keyof Row | FilterDef<Row>)[];
  defaultSort?: { field: keyof Row & string; dir: "asc" | "desc" };
  pageSize?: number;
  density?: "comfortable" | "compact";
  rowClick?: "drawer" | "detail" | ((row: Row) => string | undefined) | false;
  rowKey?: keyof Row & string;

  drawer?: DrawerConfig;
  detail?: {
    header?: (row: Row) => ReactNode;
    tabs?: DetailTab<Row>[];
    fields?: (keyof Row | FieldDef<Row>)[] | "*";
  };

  schema?: z.ZodTypeAny | { create?: z.ZodTypeAny; update?: z.ZodTypeAny };
  create?: { disabled?: boolean; fields?: FieldDef<Row>[]; defaultValues?: Partial<Row> };
  update?: { disabled?: boolean; fields?: FieldDef<Row>[] };
  delete?: { disabled?: boolean; softDelete?: keyof Row & string; confirm?: string };

  actions?: RowAction<Row>[];
  bulkActions?: BulkAction<Row>[];

  scope?: "bypass" | ((scope: Scope, query: unknown) => unknown);
  requireRole?: string | string[] | ((session: Session | null) => boolean);

  listQuery?: (ctx: ListQueryContext<Row>) => Promise<ListResult<Row>>;
  itemQuery?: (ctx: ItemQueryContext) => Promise<Row | null>;

  export?: { formats?: ("csv" | "json")[]; fields?: (keyof Row & string)[] } | false;

  audit?: boolean;
  realtime?: boolean | string;
  /**
   * Saved filter / sort presets surfaced as a dropdown above the list. The
   * dropdown reads from this static list plus any user-defined views
   * persisted in `localStorage` (keyed by resource name).
   *
   * Each view is a snapshot of filters + sort + search — applied verbatim
   * to the URL when selected. Static views are read-only; user-defined
   * views are editable from the dropdown UI.
   *
   * @example
   * ```ts
   * views: [
   *   { name: "Active high-budget", filters: { isActive: true, budgetMin: { gte: 50000 } } },
   *   { name: "Stale (>30d)", filters: { isActive: false }, sort: { field: "scrapedAt", dir: "desc" } },
   * ]
   * ```
   */
  views?: Array<{
    name: string;
    description?: string;
    filters?: Record<string, unknown>;
    sort?: { field: keyof Row & string; dir: "asc" | "desc" };
    search?: string;
  }>;
  /**
   * Override the empty-state shown when the list is empty (no filters
   * applied — i.e. genuinely "no rows yet" rather than "no matches").
   * Both fields are optional; either alone renders sensibly.
   *
   * @example
   * ```ts
   * empty: {
   *   icon: "📭",
   *   title: "No orders yet",
   *   description: "Scrapers will populate this list when they run.",
   *   action: { label: "Run scraper now", href: "/admin/scraper_runs/new" },
   * }
   * ```
   */
  empty?: {
    icon?: string;
    title?: string;
    description?: string;
    action?: { label: string; href: string };
  };
}

export interface ResourceConfig {
  __kind: "resource";
  ref: unknown;
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous resource registry — the row type is intentionally erased so a `ResourceConfig` accepts any concrete `ResourceOptions<Row>`.
  options: ResourceOptions<any>;
}
