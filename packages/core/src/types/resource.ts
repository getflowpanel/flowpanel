// LOC-OK: the resource DSL type surface (ColumnDef / FieldDef / ColumnFormat /
import type { ReactNode } from "react";
import type { z } from "zod";
import type { BulkAction, RowAction } from "./action.js";
import type { QueryContext, RequestContext } from "./context.js";
import type { DrawerConfig } from "./drawer.js";
import type { ReferenceSpec, ResourceName } from "./registry.js";
import type { Scope, Session } from "./session.js";
import type { Tone } from "./widget.js";

export type { DrawerConfig };

export type SelectOption = { label: string; value: string | number | boolean };

/** Declarative column cell formatter. */
export type ColumnFormat =
  | "badge"
  | "money"
  | "number"
  | { kind: "badge"; tones?: Record<string, Tone> }
  | { kind: "money"; currency?: string; scale?: number };

export interface ColumnDef<Row> {
  /** Row property this column reads. Omit only when `render` supplies the cell. */
  field?: keyof Row & string;
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
  /** Applied until the operator picks a value of their own. */
  defaultValue?: unknown;
  /** Apply the filter without showing a control for it. */
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
  /** Which control to render. Inferred from the column type when omitted. */
  type?: FieldType;
  /** Choices for `select` / `multiselect` / `radio`. A function resolves per request. */
  options?:
    | ReadonlyArray<string>
    | SelectOption[]
    | ((ctx: QueryContext) => Promise<SelectOption[]>);
  /** Turn the field into a searchable picker over another resource. */
  reference?: ReferenceSpec;
  /** Mark the field required in the form. Server-side validation still comes from `schema`. */
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
}

export interface DetailTab<Row> {
  /** Stable identifier, used as the tab's URL fragment. */
  key: string;
  /** Tab label. */
  label: string;
  /** Lucide icon name. */
  icon?: string;
  /** Hide the tab for rows that should not show it. */
  hidden?: (row: Row) => boolean;
  /** Field list to render as a key/value view. `"*"` shows every column. */
  fields?: (keyof Row | FieldDef<Row>)[] | "*";
  /** Render rows of a related resource instead of fields. */
  resource?: ResourceName;
  /** Filter applied to `resource`, derived from the row being viewed. */
  filter?: (row: Row) => Record<string, unknown>;
  /** Render arbitrary content instead of fields or a related resource. */
  render?: (row: Row) => ReactNode;
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
  /** Plural label shown in the nav and list title. */
  plural?: string;
  /** Not rendered: nav entries carry a label and an href only. */
  icon?: string;
  /** Keep the resource out of the navigation — its routes still work. */
  hidden?: boolean;

  /** Columns of the list table, in order. A bare string is a field name. */
  columns: (keyof Row | ColumnDef<Row>)[];
  /** Fields the search box queries. Without this, search is disabled. */
  search?: (keyof Row & string)[];
  /** Filter controls above the list. A bare string infers the control from the column type. */
  filters?: (keyof Row | FilterDef<Row>)[];
  /** Sort applied when the URL carries none. */
  defaultSort?: { field: keyof Row & string; dir: "asc" | "desc" };
  /** Rows per page. Defaults to 20. */
  pageSize?: number;
  /** Row height preset for the list table. Defaults to `"comfortable"`. */
  density?: "comfortable" | "compact";
  /** Open the row's drawer when its row is clicked. Requires `drawer`. */
  rowClick?: "drawer" | false;
  /** Property holding each row's unique id. Defaults to `"id"`. */
  rowKey?: keyof Row & string;

  /** Side panel opened for a single row. */
  drawer?: DrawerConfig<Row>;
  /** Full-page view at `/<basePath>/<resource>/<id>`. */
  detail?: {
    header?: (row: Row) => ReactNode;
    tabs?: DetailTab<Row>[];
    fields?: (keyof Row | FieldDef<Row>)[] | "*";
  };

  /** Validation for writes. Overrides the schema inferred from the adapter. */
  schema?: z.ZodTypeAny | { create?: z.ZodTypeAny; update?: z.ZodTypeAny };
  /** Create form. `disabled` removes the route, not just the button. */
  create?: { disabled?: boolean; fields?: FieldDef<Row>[]; defaultValues?: Partial<Row> };
  /** Edit form. `disabled` removes the route, not just the button. */
  update?: { disabled?: boolean; fields?: FieldDef<Row>[] };
  /** Delete behaviour. Set `softDelete` to a timestamp column to keep rows recoverable. */
  delete?: { disabled?: boolean; softDelete?: keyof Row & string; confirm?: string };

  /** Per-row actions, rendered inline or in the row's menu. */
  actions?: RowAction<Row>[];
  /** Actions applied to a selection of rows. */
  bulkActions?: BulkAction<Row>[];

  /** How the admin-wide `scope` narrows this resource. `"bypass"` opts out explicitly. */
  scope?: "bypass" | ((scope: Scope, query: unknown) => unknown);
  /** Restrict the whole resource to a role. Enforced on every route. */
  requireRole?: string | string[] | ((session: Session | null) => boolean);

  /** Export button. `false` removes it. Defaults to CSV and JSON of the visible columns. */
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
    filters?: Record<string, unknown>;
    sort?: { field: keyof Row & string; dir: "asc" | "desc" };
    search?: string;
  }>;
  /** What the list shows when there are no rows at all. */
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
