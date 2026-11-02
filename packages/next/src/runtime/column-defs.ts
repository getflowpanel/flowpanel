import type { ColumnDef, ResourceConfig } from "@flowpanel/core";

type Row = Record<string, unknown>;

export function isColumnDef(column: unknown): column is ColumnDef<Row> {
  return typeof column === "object" && column !== null;
}

/** A resource's column objects; a bare field name carries no options. */
export function columnDefs(resource: ResourceConfig): ColumnDef<Row>[] {
  return (resource.options.columns ?? []).filter(isColumnDef);
}
