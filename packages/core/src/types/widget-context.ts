import type { WidgetDateRange } from "./dashboard";
import type { PluralLabel, ResolvedLabels } from "./labels";
import type { InferDB, ResourceName, RowOf } from "./registry";
import type { Session } from "./session";
import type { CountOptions, ReadOptions, Where } from "./where";

type MomentInput = Date | string | number | null | undefined;
type NumberInput = number | null | undefined;

/**
 * The admin's own formatters, bound to its `formatting`, so a widget never
 * hard-codes a locale, a zone or a currency. A missing value prints `"—"`.
 */
export interface WidgetFormat {
  /** The calendar day in the admin's zone; a `YYYY-MM-DD` string is that day. */
  date(value: MomentInput): string;
  /** Day and clock, as a table cell shows a timestamp. */
  dateTime(value: MomentInput): string;
  /** How long ago — `5 minutes ago`, `yesterday`. `now` defaults to the current time. */
  relative(value: MomentInput, now?: Date): string;
  /** A number with the locale's grouping and at most `digits` decimals. */
  number(value: NumberInput, digits?: number): string;
  /** An amount divided by `scale`, in `currency` (default `formatting.currency`), `digits` decimals (0). */
  money(
    value: NumberInput,
    options?: { currency?: string; digits?: number; scale?: number },
  ): string;
  /** A fraction as a percentage — `0.42` is `42%`. */
  percent(value: NumberInput, digits?: number): string;
  /** Milliseconds as the largest units that fit — `2 hr 5 min`. */
  duration(ms: NumberInput): string;
  /** A count in the plural form the locale picks; `{n}` is the formatted count. */
  plural(count: number, label: string | PluralLabel): string;
}

/** `true` while `N` is still a union of names, as in a bare `ResourceLink`. */
type ManyNames<N, All = N> = N extends unknown ? ([All] extends [N] ? false : true) : never;

/** A registered resource's list or record, named instead of spelled as a path. */
export interface ResourceLink<N extends ResourceName = ResourceName> {
  resource: N;
  /** One record's page instead of the list. */
  id?: string | number;
  /**
   * List filters keyed by the target's fields: a value, `{ gte, lte }` or an array, written as
   * the list's own `f_<field>` URL keys. Any keys while the link does not name one resource.
   */
  filter?: true extends ManyNames<N> ? Record<string, unknown> : Where<RowOf<N>>;
  /** A view from the resource's `views`, applied by name before `filter`. */
  view?: string;
  /** A detail tab, with `id`. */
  tab?: string;
  /** A `daterange` filter field that receives the widget's range, bound for bound. */
  range?: true extends ManyNames<N> ? string : keyof RowOf<N> & string;
}

/** A `ResourceLink` whose `filter` and `range` are keyed by its own resource's row. */
export type AnyResourceLink = { [N in ResourceName]: ResourceLink<N> }[ResourceName];

/** A dashboard or page, named by its configured `path`. */
export interface DashboardLink {
  dashboard: string;
  /**
   * Carry the widget's range: the preset, or `from` and `to` for a custom range.
   * @defaultValue true
   */
  range?: boolean;
  /** Dashboard filters the link sets, by key; a link carries no filter implicitly. */
  filters?: Record<string, string>;
}

/**
 * Where a link goes. A string is used as written — an external URL or a route of the host app;
 * an object is resolved under the admin's mount.
 */
export type LinkTarget = string | AnyResourceLink | DashboardLink;

/** A link on a widget option: a target, or one computed from the widget context. */
export type Link = LinkTarget | ((ctx: WidgetContext) => LinkTarget | null | undefined);

/** Server-side context passed to every widget `query` function. */
export interface WidgetContext<DB = InferDB> {
  /** Your database client, exactly as handed to the adapter. */
  db: DB;
  session: Session | null;
  /** The picked range, the period before it and the admin's zone, resolved to dates. */
  dateRange: WidgetDateRange;
  /** The dashboard's active filters by key; `{}` on a record page or with none set. Bind them as parameters. */
  filters: Readonly<Record<string, string>>;
  req: Request;
  /** Row of the record being viewed when the widget sits in a detail tab. */
  row?: Record<string, unknown>;
  /**
   * The viewed record's key as a string — `row[rowKey]`, `rowKey` defaulting to
   * `"id"`. Absent on a dashboard, and when the key is not a string or a number.
   */
  id?: string;
  /** Mount-aware link builder; never hand-type `"/admin/…"` in a config. */
  href: (
    resource: ResourceName,
    id?: string | number,
    opts?: { filter?: Record<string, unknown>; tab?: string },
  ) => string;
  /** Resolve a link target to an href, for the props of a custom widget. */
  link: (target: LinkTarget) => string;
  /**
   * Memoises a query per request: a key and a thunk, or a function and its arguments.
   * Arguments match by value for strings, numbers, booleans and dates, by identity otherwise.
   * A function passed alone that declares a parameter is called with this context:
   * `query(hourly)` runs `hourly(ctx)` once per context.
   */
  query: {
    <T>(key: string, fn: () => Promise<T>): Promise<T>;
    <A extends unknown[], T>(fn: (...args: A) => Promise<T>, ...args: A): Promise<T>;
    <T>(fn: (ctx: WidgetContext<DB>) => Promise<T>): Promise<T>;
  };
  /** The admin's resolved chrome strings, so a widget never hard-codes English. */
  labels: ResolvedLabels;
  /** The admin's formatters — locale, zone and currency from `formatting`. */
  format: WidgetFormat;
  /**
   * One read-only statement, as a tagged template. Every interpolated value is
   * bound as a parameter, so `${input}` can never change the statement.
   * `Date` binds as an ISO-8601 string and `bigint` as decimal text. Throws when
   * the configured adapter implements no `sql` capability.
   *
   * Runs exactly the statement you write: no tenant scope, no access rule and no
   * soft-delete filter are applied. Add those predicates yourself, or use
   * `count` and resource reads, which do.
   */
  sql: <Row = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<Row[]>;
  /**
   * Rows of a registered resource matching `where`, under the same role, access and scope
   * checks as its list; `range` bounds a timestamp field by `ctx.dateRange`. Memoised per request
   * by resource, `where` and range; a resource the session may not read counts `0`, and so does an
   * `undefined`, `null` or `""` value, with a development warning. A misspelt field throws,
   * whatever its value.
   */
  count: <N extends ResourceName>(
    resource: N,
    where?: Where<RowOf<N>>,
    options?: CountOptions<RowOf<N>>,
  ) => Promise<number>;
  /**
   * Rows of a registered resource under the same role, access, scope, field and soft-delete
   * rules as its list. Memoised per request by resource and options; a resource the session may
   * not read returns `[]`. A misspelt field, an `undefined`, `null` or `""` value, or an unknown
   * resource throws instead of widening the read. Rows carry the list's declared columns,
   * `expose` and `fields`; any other property is `undefined`, even though the row type lists it.
   */
  read: <N extends ResourceName>(
    resource: N,
    options?: ReadOptions<RowOf<N>>,
  ) => Promise<RowOf<N>[]>;
  /**
   * The record this card shows, typed by its resource. Throws on a dashboard, which has no
   * record, and on another resource's card; the message names both.
   */
  rowOf: <N extends ResourceName>(resource: N) => RowOf<N>;
}
