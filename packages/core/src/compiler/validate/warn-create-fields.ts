import { declaredWriteFields } from "../../internal/write-fields";
import { resolveOperationAccess } from "../../policy/access";
import type { ColumnMeta, ResourceIntrospection } from "../../types/adapter";
import type { ResourceConfig } from "../../types/resource";

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
  if (resolveOperationAccess(resource.options.access, "create") === false) return [];
  const filled = filledOnCreate(resource);
  return introspection.columns
    .filter((column) => isRequiredInput(column) && !filled.has(column.name))
    .map(
      (column) =>
        `resource ${name}: create is enabled but required column \`${column.name}\` ` +
        "has no field; creation will always fail",
    );
}

const PRINTED = Symbol.for("@flowpanel/core.printedDevWarnings");
const shared = globalThis as typeof globalThis & { [PRINTED]?: Set<string> };

/** Remembers printed lines on `globalThis`, which Next.js dev keeps across recompiles. */
function firstInProcess(line: string): boolean {
  const printed = shared[PRINTED] ?? new Set<string>();
  shared[PRINTED] = printed;
  if (printed.has(line)) return false;
  printed.add(line);
  return true;
}

/** `next dev` reads the config again in a jest-worker child for each static-params pass. */
const inWorker = (): boolean => /jest-worker[\\/]processChild/.test(process.argv[1] ?? "");

/** Prints `line` once per process in development, from the server rather than its workers. */
export function printDevWarning(line: string): void {
  if (process.env.NODE_ENV !== "development" || inWorker()) return;
  if (firstInProcess(line)) console.warn(line);
}

export function warnOnceInDevelopment(warnings: readonly string[]): void {
  for (const warning of warnings) printDevWarning(`[flowpanel] ${warning}`);
}

export function resetDevWarningsForTests(): void {
  shared[PRINTED]?.clear();
}
