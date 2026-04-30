import type { ColumnMeta, ResourceIntrospection } from "@flowpanel/core";
import { getTableColumns, getTableName } from "drizzle-orm";

export function introspect(table: unknown): ResourceIntrospection {
  const cols = getTableColumns(table as any);
  const columns: ColumnMeta[] = [];
  let primaryKey = "id";

  for (const [name, raw] of Object.entries<any>(cols)) {
    const meta: ColumnMeta = {
      name,
      type: mapType(raw),
      nullable: !raw.notNull,
      unique: !!raw.isUnique,
      primaryKey: !!raw.primary,
    };
    if (raw.enumValues) meta.enumValues = raw.enumValues;
    if (raw.primary) primaryKey = name;
    columns.push(meta);
  }

  return { name: getTableName(table as any), columns, primaryKey };
}

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
