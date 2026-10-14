import type { FieldDef, ResourceConfig } from "@flowpanel/core";
import { humanize } from "@flowpanel/core";
import { columnDefs } from "./column-defs";

/** The label a field shows: its form field's, else its column's, else its name humanized. */
export function fieldLabels(
  resource: ResourceConfig | undefined,
  fields: readonly FieldDef<Record<string, unknown>>[] = [],
): (name: string) => string {
  const labels = new Map<string, string>();
  for (const column of resource ? columnDefs(resource) : []) {
    if (column.field && column.label) labels.set(column.field, column.label);
  }
  for (const field of fields) if (field.label) labels.set(field.name, field.label);
  return (name) => labels.get(name) ?? humanize(name);
}
