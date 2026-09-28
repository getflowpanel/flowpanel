import type { Adapter, ColumnMeta, ListQueryContext } from "@flowpanel/kit";
import { isFilterInValue, isFilterRangeValue } from "@flowpanel/kit";

export type Row = Record<string, unknown>;

/** Rows every `ctx.sql` returns, or a function given the statement and its bound values. */
export type SqlAnswer =
  | readonly Row[]
  | ((query: { text: string; values: unknown[] }) => readonly Row[] | Promise<readonly Row[]>);

export interface MemorySource {
  rows: Readonly<Record<string, readonly Row[]>>;
  nameOf: (ref: unknown) => string;
  columnsOf: (ref: unknown) => ColumnMeta[];
  sql?: SqlAnswer;
  db?: unknown;
}

const key = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value);

function order(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value !== "string") return null;
  const parsed = /^\d{4}-\d{2}-\d{2}/.test(value) ? Date.parse(value) : Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function matches(actual: unknown, expected: unknown): boolean {
  if (expected === undefined || expected === null || expected === "") return true;
  if (expected === "__null__") return actual === null || actual === undefined;
  if (expected === "__notnull__") return actual !== null && actual !== undefined;
  if (isFilterInValue(expected)) {
    return expected.values.length === 0 || expected.values.map(key).includes(key(actual));
  }
  if (isFilterRangeValue(expected)) {
    const at = order(actual);
    const low = expected.gte === undefined ? null : order(expected.gte);
    const high = expected.lte === undefined ? null : order(expected.lte);
    return at !== null && (low === null || at >= low) && (high === null || at <= high);
  }
  return key(actual) === key(expected);
}

function compare(a: unknown, b: unknown): number {
  const left = order(a);
  const right = order(b);
  if (left !== null && right !== null) return left - right;
  return key(a).localeCompare(key(b));
}

function columnType(value: unknown): ColumnMeta["type"] {
  if (value instanceof Date) return "date";
  if (typeof value === "number" || typeof value === "bigint") return "number";
  if (typeof value === "boolean") return "boolean";
  return typeof value === "object" && value !== null ? "json" : "string";
}

/** One column per key the rows carry, typed by its first value that is not null. */
export function columnsFrom(rows: readonly Row[]): ColumnMeta[] {
  const seen = new Map<string, unknown>();
  for (const row of rows) {
    for (const [name, value] of Object.entries(row)) {
      if (seen.get(name) === undefined || seen.get(name) === null) seen.set(name, value);
    }
  }
  return [...seen].map(([name, value]) => ({
    name,
    type: columnType(value),
    nullable: true,
    unique: name === "id",
    primaryKey: name === "id",
  }));
}

function statement(strings: TemplateStringsArray): string {
  return strings.reduce((text, part, index) => `${text}$${index}${part}`);
}

function readOnly(): never {
  throw new Error("flowpanel: widgetContext is read-only; a widget test cannot write rows.");
}

function searched(row: Row, ctx: ListQueryContext<unknown>): boolean {
  const term = ctx.search.toLowerCase();
  if (term === "" || !ctx.searchFields?.length) return true;
  return ctx.searchFields.some((field) =>
    key(row[field] ?? "")
      .toLowerCase()
      .includes(term),
  );
}

/** Rows in memory, filtered, sorted and paged the way the drizzle adapter reads a filter map. */
export function memoryAdapter(source: MemorySource): Adapter {
  const rowsOf = (ref: unknown): readonly Row[] => source.rows[source.nameOf(ref)] ?? [];
  return {
    kind: "memory",
    db: source.db ?? null,
    introspect: (ref) => ({
      name: source.nameOf(ref),
      columns: source.columnsOf(ref),
      primaryKey: "id",
    }),
    inferSchema: readOnly,
    async list(ref, ctx) {
      const deleted = ctx.softDelete && !ctx.includeDeleted ? ctx.softDelete.column : null;
      const found = rowsOf(ref).filter(
        (row) =>
          Object.entries(ctx.filters).every(([field, expected]) => matches(row[field], expected)) &&
          (deleted === null || row[deleted] === null || row[deleted] === undefined) &&
          searched(row, ctx),
      );
      const sort = ctx.sort;
      const field: string | null = sort ? sort.field : null;
      const sorted =
        sort && field
          ? [...found].sort((a, b) => compare(a[field], b[field]) * (sort.dir === "desc" ? -1 : 1))
          : found;
      const start = (ctx.page - 1) * ctx.pageSize;
      return {
        rows: sorted.slice(start, start + ctx.pageSize),
        total: found.length,
        page: ctx.page,
        pageSize: ctx.pageSize,
      };
    },
    async get(ref, ctx) {
      return rowsOf(ref).find((row) => key(row.id) === ctx.id) ?? null;
    },
    create: readOnly,
    update: readOnly,
    delete: readOnly,
    async sql<R = Row>(strings: TemplateStringsArray, ...values: unknown[]): Promise<R[]> {
      const text = statement(strings);
      if (source.sql === undefined) {
        throw new Error(`widgetContext: ctx.sql ran "${text}", and no \`sql\` option answers it.`);
      }
      const answer =
        typeof source.sql === "function" ? await source.sql({ text, values }) : source.sql;
      const rows: unknown[] = [...answer];
      return rows as R[];
    },
  };
}
