import { declaredWriteFields } from "./internal/write-fields";
import type { ColumnMeta, ResourceIntrospection } from "./types/adapter";
import type { ResourceConfig } from "./types/resource";

/** A column an insert must carry: not nullable, not generated, not defaulted. */
function isRequiredInput(column: ColumnMeta): boolean {
  return (
    !column.nullable &&
    column.generated !== true &&
    column.hasDefault !== true &&
    column.primaryKey === false &&
    column.writableOnCreate !== false
  );
}

/** What a create write can carry: the offered fields plus the server's own defaults. */
function filledOnCreate(resource: ResourceConfig): Set<string> {
  const create = resource.options.create;
  const filled = new Set(declaredWriteFields(resource, create?.fields));
  for (const name of Object.keys(create?.defaultValues ?? {})) filled.add(name);
  return filled;
}

/** One line per required column a create form cannot fill, in config order. */
export function createFieldWarnings(
  name: string,
  resource: ResourceConfig,
  introspection: ResourceIntrospection,
): string[] {
  if (resource.options.create?.disabled === true) return [];
  const filled = filledOnCreate(resource);
  return introspection.columns
    .filter((column) => isRequiredInput(column) && !filled.has(column.name))
    .map(
      (column) =>
        `resource ${name}: create is enabled but required column \`${column.name}\` ` +
        "has no field; creation will always fail",
    );
}

const printed = new Set<string>();

/** Dev-only, once per process: the same config is compiled on every request. */
export function warnCreateFieldsOnce(warnings: readonly string[]): void {
  if (process.env.NODE_ENV !== "development") return;
  for (const warning of warnings) {
    if (printed.has(warning)) continue;
    printed.add(warning);
    console.warn(`[flowpanel] ${warning}`);
  }
}
