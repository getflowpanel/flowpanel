import type { ResourceConfig } from "../types/resource";

/**
 * The field names a write may carry: the declared form fields, else the
 * resource's columns. `@flowpanel/next`'s generated forms and core's create
 * warning both read this, so they cannot disagree about what a form offers.
 */
export function declaredWriteFields(
  resource: ResourceConfig,
  fields: ReadonlyArray<{ name: string }> | undefined,
): string[] {
  if (fields) return fields.map((field) => field.name);
  const names: string[] = [];
  for (const column of resource.options.columns ?? []) {
    if (typeof column === "string") names.push(column);
    else if (typeof column === "number" || typeof column === "symbol") names.push(String(column));
    else if (column.field) names.push(column.field);
  }
  return names;
}
