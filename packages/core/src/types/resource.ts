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
  options?: SelectOption[] | ((ctx: QueryContext) => Promise<SelectOption[]>);
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
}

export interface ResourceConfig {
  __kind: "resource";
  ref: unknown;
  options: ResourceOptions<any>;
}
