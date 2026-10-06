// LOC-OK: the resource DSL type surface (ColumnDef / FieldDef / ColumnFormat / FilterDef / ResourceOptions) lives in one file.
import type { ReactNode } from "react";
import type { z } from "zod";
import type { ActionEmphasis, BulkAction, RowAction } from "./action";
import type { QueryContext, RequestContext } from "./context";
import type { NavGroupRef } from "./dashboard";
import type { DetailOptions } from "./detail";
import type { DrawerConfig } from "./drawer";
import type { IconName } from "./icon";
import type { FieldAccessMap, ResourceAccess } from "./policy";
import type { ReferenceSpec } from "./registry";
import type { Scope, Session } from "./session";
import type { Threshold } from "./threshold";
import type { ListFilters } from "./where";
import type { Tone } from "./widget";

export type {
  DetailBadge,
  DetailHeaderContext,
  DetailOptions,
  DetailTab,
  DetailTabContext,
} from "./detail";
export type { DrawerConfig };

export type SelectOption = { label: string; value: string | number | boolean };

/** Declarative column cell formatter. */
export type ColumnFormat =
  | "badge"
  | "money"
  | "number"
  | "date"
  | "relative"
  | "percent"
  | "duration"
  | "boolean"
  | "url"
  | {
      kind: "badge";
      /** Tone per raw value. */
      tones?: Record<string, Tone>;
      /** Display text per raw value, e.g. `{ admin: "Админ" }`; tones stay keyed by the raw value. */
      labels?: Record<string, string>;
    }
  | { kind: "money"; currency?: string; scale?: number }
  | {
      kind: "number";
      /** Colour the cell by value. */
      tones?: Threshold;
    }
  | {
      kind: "date";
      /** Show the clock as well as the day. */
      time?: boolean;
      /** The value is a calendar day stored as midnight UTC, as a SQL `date` column is; show that day in every time zone. */
      calendarDay?: boolean;
    }
  | {
      kind: "percent";
      /** Most decimals shown, a whole number from 0 to 20.
       * @defaultValue 1
       */
      digits?: number;
      /** Shade the cell by its value from 0 to 1, as a retention grid does. */
      heat?: boolean;
      /** Colour the cell by value, compared with the stored number. */
      tones?: Threshold;
    }
  | {
      kind: "duration";
      /** What the stored number counts.
       * @defaultValue "ms"
       */
      unit?: "ms" | "s";
      /** Colour the cell by value, compared with the stored number. */
      tones?: Threshold;
    }
  | {
      kind: "boolean";
      /** Words for true and false.
       * @defaultValue `✓` and `✕`
       */
      labels?: { true?: string; false?: string };
    }
  | {
      kind: "url";
      /** Link text for every row.
       * @defaultValue the URL's host and path
       */
      label?: string;
    };

export interface ColumnDef<Row> {
  /** Row property this column reads. Omit only when `render` supplies the cell. */
  field?: keyof Row & string;
  /**
   * Another field of the row, shown as a muted second line under the cell — the email under a name.
   * It is loaded with the row; sort and search still use `field`. Ignored on a `reference` column.
   */
  secondary?: keyof Row & string;
  /** Header text. Defaults to a humanized `field`. */
  label?: string;
  /** Custom cell renderer. Runs on the server; receives the request context. */
  render?: (row: Row, ctx: RequestContext) => ReactNode;
  /** Allow clicking the header to sort by this column. */
  sortable?: boolean;
  /** Fixed column width, in px when a number. */
  width?: number | string;
  /** Horizontal cell alignment. Defaults to `"left"`. */
  align?: "left" | "center" | "right";
  /** Extra classes on every cell in this column. */
  className?: string;
  /** Keep the column out of the table (still available to export and drawer). */
  hidden?: boolean;
  /** Declarative cell formatting — use instead of `render` where it fits. */
  format?: ColumnFormat;
  /** Resolve a foreign key to a label from another resource. */
  reference?: ReferenceSpec;
  /** Allow editing this cell inline from the list. */
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
  /** Row property this filter narrows. */
  field: keyof Row & string;
  /** Control label. Defaults to a humanized `field`. */
  label?: string;
  /** Which control to render, and how the value is encoded in the URL. */
  type: FilterType;
  /** Choices for `select` / `multiselect`. A function is resolved per request. */
  options?:
    | ReadonlyArray<string>
    | SelectOption[]
    | ((ctx: QueryContext) => Promise<SelectOption[]>);
  /**
   * Applied while the URL names no value for the filter: the list, its count, pages, export and API all read it.
   * Clearing the control writes an empty `f_<field>=` so the default stays off; a view or link turns it off with `null`.
   */
  defaultValue?: unknown;
  /** Apply the filter, and its `defaultValue`, without showing a control for it. */
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
  | "color";

export interface FieldDef<Row> {
  /** Row property this field writes. */
  name: keyof Row & string;
  /** Field label. Defaults to a humanized `name`. */
  label?: string;
  /** Hint rendered under the control. */
  help?: string;
  /** Placeholder text for empty inputs. */
  placeholder?: string;
  /**
   * Which control to render. Omitted, a declared field renders as `"text"` — or `"reference"` when `reference` is set.
   * The adapter's column type is consulted only by a fully generated form, and only maps number, boolean, date and json.
   */
  type?: FieldType;
  /** Choices for `select` / `multiselect` / `radio`. A function resolves per request. */
  options?:
    | ReadonlyArray<string>
    | SelectOption[]
    | ((ctx: QueryContext) => Promise<SelectOption[]>);
  /** Turn the field into a searchable picker over another resource. */
  reference?: ReferenceSpec;
  /** Require a value. The form marks it, and the server rejects a create that leaves it empty or an edit that clears it. */
  required?: boolean;
  /** Render non-editable. Enforced server-side, not just in the UI. */
  readOnly?: boolean | ((values: Partial<Row>) => boolean);
  /** Leave the field out of the form entirely. */
  hidden?: boolean | ((values: Partial<Row>) => boolean);
  /** Restrict who may see and write this field. Enforced on every write route. */
  requireRole?: string | string[] | ((session: Session | null) => boolean);
  /** Per-field validation, run server-side after the resource schema. */
  validate?:
    | z.ZodTypeAny
    | ((value: unknown, values: Partial<Row>) => string | null | Promise<string | null>);
  /** Value used when creating, for keys the operator left empty. */
  defaultValue?: unknown | ((ctx: QueryContext) => Promise<unknown>);
  /** Width in a 12-column form grid. Defaults to full width. */
  span?: 1 | 2 | 3 | 4 | 6 | 12;
  /** Fieldset heading this field is grouped under. */
  group?: string;
  /** Detail pages and drawers only: what the field shows instead of its value — a join or a computed label. */
  render?: (row: Row, ctx: RequestContext) => ReactNode | Promise<ReactNode>;
}

/** One page of rows, as returned by `Adapter.list`. */
export interface ListResult<Row> {
  rows: Row[];
  /** Total matching rows across every page — drives the pagination control. */
  total: number;
  /** 1-based index of the page in `rows`. */
  page: number;
  pageSize: number;
}

export interface ResourceOptions<Row> {
  /** URL segment and registry key. Defaults to the adapter's table name. */
  name?: string;
  /** Singular label shown in headings and buttons. */
  label?: string;
  /** Label for exactly one row, e.g. `"Customer"`, used in record, create and edit titles. Falls back to `label`, then the resource name made singular: `order_items` reads "Order item". */
  labelOne?: string;
  /** Plural label shown in the nav and list title. */
  plural?: string;
  /** Serializable Lucide icon rendered in navigation and the command palette. */
  icon?: IconName;
  /** Keep the resource out of the navigation — its routes still work. */
  hidden?: boolean;
  /** Sidebar group for this resource. Default: the Resources group. */
  navGroup?: NavGroupRef;

  /**
   * Additional fields shared by list and detail presentation. Declare render
   * dependencies explicitly; callbacks never receive an undeclared DB row.
   */
  expose?: (keyof Row & string)[];

  /** Columns of the list table, in order; a bare string is a field name. Omitted, `defineAdmin` fills it in introspection order. */
  columns?: (keyof Row | ColumnDef<Row>)[];
  /** Fields the search box queries. Without this, search is disabled. */
  search?: (keyof Row & string)[];
  /** Filter controls above the list. A bare string always renders a text filter — declare a `FilterDef` for any other control. */
  filters?: (keyof Row | FilterDef<Row>)[];
  /** Sort applied when the URL carries none. */
  defaultSort?: { field: keyof Row & string; dir: "asc" | "desc" };
  /** Rows per page.
   * @defaultValue 20
   */
  pageSize?: number;
  /** Row height preset for the list table.
   * @defaultValue "comfortable"
   */
  density?: "comfortable" | "compact";
  /**
   * What a row click — and Enter on the focused row — does. A row the projection cannot identify never acts.
   * @defaultValue `"drawer"` when `drawer` is configured, otherwise `"detail"`
   */
  rowClick?: "detail" | "drawer" | false;
  /** Property holding each row's unique id.
   * @defaultValue "id"
   */
  rowKey?: keyof Row & string;

  /** Side panel opened for a single row. */
  drawer?: DrawerConfig<Row>;
  /** Full-page view at `<paths.admin>/<resource>/<id>`. */
  detail?: DetailOptions<Row>;

  /** Validation for writes. Overrides the schema inferred from the adapter. */
  schema?: z.ZodTypeAny | { create?: z.ZodTypeAny; update?: z.ZodTypeAny };
  /**
   * The table that create, update, delete and restore write to, when the resource reads a view.
   * Omitted on a view: the resource is read-only, and a declared create/update/delete/import is an error at `defineAdmin`.
   */
  writeTo?: unknown;
  /** Create form. `disabled` removes the route, not just the button. */
  create?: { disabled?: boolean; fields?: FieldDef<Row>[]; defaultValues?: Partial<Row> };
  /** Edit form. `disabled` removes the route, not just the button. */
  update?: {
    disabled?: boolean;
    fields?: FieldDef<Row>[];
    /** Additional readable values available to edit-form hidden/readOnly predicates; never a control, default or write. */
    expose?: (keyof Row & string)[];
    /**
     * How the record page's edit button reads: `"primary"` fills it with the accent.
     * @defaultValue "secondary"
     */
    emphasis?: ActionEmphasis;
  };
  /** Delete behaviour. Set `softDelete` to a timestamp column to keep rows recoverable. */
  delete?: { disabled?: boolean; softDelete?: keyof Row & string; confirm?: string };

  /** Per-row actions, rendered inline or in the row's menu. */
  // biome-ignore lint/suspicious/noExplicitAny: a resource stores heterogeneous action payloads; each payload remains exact on the action returned by rowAction().
  actions?: RowAction<Row, any, any>[];
  /** Actions applied to a selection of rows. */
  // biome-ignore lint/suspicious/noExplicitAny: a resource stores heterogeneous action payloads; each payload remains exact on the action returned by bulkAction().
  bulkActions?: BulkAction<Row, any, any>[];

  /** How the admin-wide `scope` narrows this resource. `"bypass"` opts out explicitly. */
  scope?: "bypass" | ((scope: Scope, query: unknown) => unknown);
  /** Canonical operation-level authorization. */
  access?: ResourceAccess<Row>;
  /** Canonical read/write policy for declared fields. */
  fieldAccess?: FieldAccessMap<Row>;

  /** Export button, off unless set. `formats` defaults to `["csv"]`; `fields` defaults to the visible columns. */
  export?: { formats?: ("csv" | "json")[]; fields?: (keyof Row & string)[] } | false;
  /** Import button. Off unless set; rows are created through the normal write path. */
  import?: { formats?: ("csv" | "json")[]; fields?: (keyof Row & string)[] } | false;

  /** Opt this resource out of the admin-wide audit sink. */
  audit?: boolean;
  /** Refresh the list when the channel fires. `true` uses `resource.<name>`. */
  realtime?: boolean | string;
  /** Filter / sort presets offered as a dropdown above the list. */
  views?: Array<{
    name: string;
    description?: string;
    /** Filter values keyed by the row's fields: a value, a preset name for a `daterange`, `{ gte, lte }` or an array. */
    filters?: ListFilters<Row>;
    sort?: { field: keyof Row & string; dir: "asc" | "desc" };
    search?: string;
  }>;
  /** What the list shows when there are no rows at all. */
  empty?: {
    /** Serializable Lucide icon rendered above the empty-state title. */
    icon?: IconName;
    title?: string;
    description?: string;
    action?: { label: string; href: string };
    /**
     * Title when search or filters leave no rows; a button beside it clears them. `{query}` is
     * the search text. Default: `labels.widget.filtered`.
     */
    filtered?: string;
    /**
     * Title when a search leaves no rows, in place of `filtered`, e.g. `"Nothing found for «{query}»"`.
     * Default: `filtered`.
     */
    searched?: string;
  };
}

export interface ResourceConfig<
  Ref = unknown,
  // biome-ignore lint/suspicious/noExplicitAny: the non-generic registry intentionally erases heterogeneous row types; `resource()` preserves the concrete row type.
  Row = any,
  Options extends ResourceOptions<Row> = ResourceOptions<Row>,
> {
  __kind: "resource";
  ref: Ref;
  options: ResourceOptions<Row> & Options;
}

/** Type-erased resource used only at heterogeneous registry boundaries. */
// biome-ignore lint/suspicious/noExplicitAny: intentional variance erasure; concrete builders preserve all three generic arguments.
export type AnyResourceConfig = ResourceConfig<any, any, any>;
