import type { ColumnMeta, ResourceIntrospection } from "@flowpanel/core";
import { getTableColumns, getTableName } from "drizzle-orm";

export function introspect(table: unknown): ResourceIntrospection {
  // biome-ignore lint/suspicious/noExplicitAny: drizzle Table internals are not publicly typed; the value is a runtime Drizzle table guarded by getTableColumns.
  const cols = getTableColumns(table as any);
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
      writableOnCreate: raw.generated === undefined,
      writableOnUpdate: raw.generated === undefined && !raw.primary,
      generated: raw.generated !== undefined,
    };
    if (raw.enumValues) meta.enumValues = raw.enumValues;
    if (raw.primary) primaryKey = name;
    columns.push(meta);
  }

  // biome-ignore lint/suspicious/noExplicitAny: drizzle Table internals are not publicly typed; the value is a runtime Drizzle table guarded by getTableName.
  return { name: getTableName(table as any), columns, primaryKey };
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
