import type { FilterInValue, FilterRangeValue } from "./context";

/**
 * One value of a `where`: equality, `"__null__"` or `"__notnull__"`, `{ gte, lte }` for a
 * range, or an array of strings or numbers for "any of". A boolean is matched as a plain
 * value, never inside an array. The adapter's own `{ op: "in" }` and `{ op: "range" }`
 * shapes are accepted as they are.
 */
export type WhereValue =
  | string
  | number
  | boolean
  | Date
  | { gte?: number | Date; lte?: number | Date }
  | readonly (string | number)[]
  | FilterInValue
  | FilterRangeValue;

/**
 * Filters keyed by the row's own fields, so a misspelt field is a compile error instead of a
 * silently dropped filter. Any keys while the row is untyped; for a union of rows, the fields
 * of any one of them.
 */
export type Where<R> = R extends unknown
  ? string extends keyof R
    ? Record<string, unknown>
    : { [K in keyof R & string]?: WhereValue | null | undefined }
  : never;

/** Which rows `ctx.read` returns, and in what order. */
export interface ReadOptions<R = Record<string, unknown>> {
  where?: Where<R>;
  sort?: { field: keyof R & string; dir: "asc" | "desc" };
  /**
   * How many rows at most; a larger number stops at 1000.
   * @defaultValue 100
   */
  limit?: number;
  /**
   * Fields beyond the list's projection, as `detail.expose` names them. A row carries the list's
   * declared columns, `expose`, `rowKey` and these; any other property is `undefined`, even though
   * the row type lists it.
   */
  fields?: (keyof R & string)[];
  /**
   * The timestamp field that receives the widget's `ctx.dateRange`, as `ResourceLink.range`
   * does for a link. A whole history, as on a record page, adds no bound.
   */
  range?: keyof R & string;
}

/** How `ctx.count` narrows beyond its `where`. */
export interface CountOptions<R = Record<string, unknown>> {
  /**
   * The timestamp field that receives the widget's `ctx.dateRange`, as `ResourceLink.range`
   * does for a link. A whole history, as on a record page, adds no bound.
   */
  range?: keyof R & string;
}
