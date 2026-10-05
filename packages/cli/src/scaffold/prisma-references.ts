import type { TableDescription } from "./describe-schema";

const PRISMA_RESOURCE = /resource\(\s*["'](\w+)["']\s*,\s*(?:\{\s*name:\s*["']([^"']+)["'])?/g;

/** Model → the name each Prisma resource in the config is registered under. */
export function registeredPrismaNames(configSource: string): Map<string, string> {
  return new Map(
    [...configSource.replace(/^\s*\/\/.*$/gm, "").matchAll(PRISMA_RESOURCE)].map((m) => [
      m[1] ?? "",
      m[2] ?? m[1] ?? "",
    ]),
  );
}

/** Points each foreign key at the resource its model is registered under, and leaves a key to an unlisted model plain. */
export function linkPrismaReferences(
  model: TableDescription,
  name: string,
  registered: ReadonlyMap<string, string>,
): TableDescription {
  const columns = model.columns.map((column) => {
    const target = column.references?.table;
    if (!column.references || !target) return column;
    const resource = target === model.exportName ? name : registered.get(target);
    if (resource !== undefined)
      return { ...column, references: { ...column.references, table: resource } };
    const { references: _references, ...plain } = column;
    return plain;
  });
  return { ...model, columns };
}
