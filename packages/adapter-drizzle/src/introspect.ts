import type { ColumnMeta, ResourceIntrospection } from "@flowpanel/core";
import { entityKind, isView } from "drizzle-orm";
import { columnsOf, refName } from "./columns";

const memo = new WeakMap<object, ResourceIntrospection>();

export function introspect(table: unknown): ResourceIntrospection {
  const cached = memo.get(table as object);
  if (cached) return cached;

  const view = isView(table);
  const cols = columnsOf(table);
  const columns: ColumnMeta[] = [];
  let primaryKey = "id";

  // biome-ignore lint/suspicious/noExplicitAny: drizzle column objects are not publicly typed; raw is read via runtime-guarded property access.
  for (const [name, raw] of Object.entries<any>(cols)) {
    const meta: ColumnMeta = {
      name,
      type: mapType(raw),
      nullable: !raw.notNull,
      unique: !!raw.isUnique,
      primaryKey: !!raw.primary,
      readable: true,
      writableOnCreate: !view && raw.generated === undefined,
      writableOnUpdate: !view && raw.generated === undefined && !raw.primary,
      generated: raw.generated !== undefined,
      hasDefault: raw.hasDefault === true || raw.default !== undefined,
    };
    if (raw.enumValues) meta.enumValues = raw.enumValues;
    if (meta.type === "number") meta.integer = isInteger(raw);
    if (raw.primary) primaryKey = name;
    columns.push(meta);
  }

  const keyColumns = view ? undefined : compositeKey(table, cols);
  const result = freeze({
    name: refName(table),
    columns,
    primaryKey,
    ...(keyColumns ? { keyColumns } : {}),
    ...(view ? { kind: "view" as const } : {}),
  });
  memo.set(table as object, result);
  return result;
}

const EXTRA_CONFIG_BUILDER = Symbol.for("drizzle:ExtraConfigBuilder");
const EXTRA_CONFIG_COLUMNS = Symbol.for("drizzle:ExtraConfigColumns");

/** The property names of a table-level `primaryKey({ columns })`, which no column flags as primary. */
function compositeKey(table: unknown, cols: Record<string, unknown>): string[] | undefined {
  const source = table as Record<symbol, unknown>;
  const builder = source[EXTRA_CONFIG_BUILDER];
  if (typeof builder !== "function") return undefined;
  const extra: unknown = builder(source[EXTRA_CONFIG_COLUMNS]);
  const values: unknown[] = Array.isArray(extra)
    ? extra.flat(1)
    : Object.values(typeof extra === "object" && extra !== null ? extra : {});
  for (const value of values) {
    const kind = (value as { constructor?: Record<symbol, unknown> } | null)?.constructor?.[
      entityKind
    ];
    if (typeof kind !== "string" || !kind.endsWith("PrimaryKeyBuilder")) continue;
    const keyed = (value as { columns?: unknown[] }).columns ?? [];
    const names = keyed.flatMap((column) => {
      const dbName = (column as { name?: unknown } | null)?.name;
      const name = Object.entries(cols).find(
        ([, col]) => (col as { name?: unknown } | null)?.name === dbName,
      )?.[0];
      return name ? [name] : [];
    });
    return names.length === keyed.length && names.length > 0 ? names : undefined;
  }
  return undefined;
}

// Memoized: one object is shared by every caller, so it must not be mutable.
function freeze(intro: ResourceIntrospection): ResourceIntrospection {
  for (const column of intro.columns) Object.freeze(column);
  Object.freeze(intro.columns);
  return Object.freeze(intro);
}

/** A `numeric`/`decimal` column Drizzle reads and writes as text, such as `numeric(10, 2)`. */
export function isDecimalText(column: unknown): boolean {
  return (
    fieldOf(column, "dataType") === "string" &&
    /numeric|decimal/i.test(String(fieldOf(column, "columnType") ?? ""))
  );
}

/** An integer, serial or bigint column of any dialect, such as `PgInteger` or `MySqlBigInt53`. */
function isInteger(column: unknown): boolean {
  return /(?:Int|Integer|Serial)(?:53|64)?$/i.test(String(fieldOf(column, "columnType") ?? ""));
}

function fieldOf(column: unknown, key: "dataType" | "columnType"): unknown {
  return typeof column === "object" && column !== null && key in column
    ? Reflect.get(column, key)
    : undefined;
}

// biome-ignore lint/suspicious/noExplicitAny: drizzle column internals are not publicly typed; col.dataType / col.columnType are read via runtime-guarded String() coercion.
function mapType(col: any): ColumnMeta["type"] {
  const dt = String(col.dataType ?? "").toLowerCase();
  const ct = String(col.columnType ?? "").toLowerCase();

  if (col.enumValues) return "enum";
  if (ct.includes("array")) return "array";
  if (dt.includes("json") || ct.includes("json")) return "json";
  if (dt.includes("bool") || ct.includes("bool")) return "boolean";
  if (isDecimalText(col)) return "number";
  if (
    dt.includes("int") ||
    dt.includes("numeric") ||
    dt.includes("decimal") ||
    dt.includes("real") ||
    dt.includes("double") ||
    dt.includes("number")
  )
    return "number";
  if (dt.includes("time") || dt.includes("date")) return "date";
  return "string";
}
