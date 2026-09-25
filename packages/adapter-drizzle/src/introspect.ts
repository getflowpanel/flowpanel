import type { ColumnMeta, ResourceIntrospection } from "@flowpanel/core";
import { isView } from "drizzle-orm";
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
    if (raw.primary) primaryKey = name;
    columns.push(meta);
  }

  const result = freeze({
    name: refName(table),
    columns,
    primaryKey,
    ...(view ? { kind: "view" as const } : {}),
  });
  memo.set(table as object, result);
  return result;
}

// Memoized: one object is shared by every caller, so it must not be mutable.
function freeze(intro: ResourceIntrospection): ResourceIntrospection {
  for (const column of intro.columns) Object.freeze(column);
  Object.freeze(intro.columns);
  return Object.freeze(intro);
}

// biome-ignore lint/suspicious/noExplicitAny: drizzle column internals are not publicly typed; col.dataType / col.columnType are read via runtime-guarded String() coercion.
function mapType(col: any): ColumnMeta["type"] {
  const dt = String(col.dataType ?? "").toLowerCase();
  const ct = String(col.columnType ?? "").toLowerCase();

  if (col.enumValues) return "enum";
  if (ct.includes("array")) return "array";
  if (dt.includes("json") || ct.includes("json")) return "json";
  if (dt.includes("bool") || ct.includes("bool")) return "boolean";
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
