import { quoted } from "../internal/validate-shared";
import { didYouMean } from "../suggest";
import type { Adapter, ResourceIntrospection } from "../types/adapter";
import type { ResourceConfig } from "../types/resource";

function declaredWrites(resource: ResourceConfig): string[] {
  const o = resource.options;
  const out: string[] = [];
  for (const op of ["create", "update", "delete"] as const) {
    if (o[op] !== undefined && o[op]?.disabled !== true) out.push(op);
  }
  if (o.import !== undefined && o.import !== false) out.push("import");
  const editable = (o.columns ?? []).some(
    (column) => typeof column === "object" && column !== null && column.editable === true,
  );
  if (editable) out.push("columns[].editable");
  return out;
}

function introspectTarget(adapter: Adapter, ref: unknown): ResourceIntrospection | null {
  try {
    return adapter.introspect(ref);
  } catch {
    return null;
  }
}

function checkWriteTarget(
  name: string,
  resource: ResourceConfig,
  view: ResourceIntrospection | null,
  adapter: Adapter,
): void {
  const target = introspectTarget(adapter, resource.options.writeTo);
  if (!target || target.columns.length === 0) return;
  if (target.kind === "view") {
    throw new Error(
      `flowpanel: resource "${name}" sets writeTo to the view "${target.name}"; writeTo must be a table.`,
    );
  }
  const viewColumns = view?.columns.map((column) => column.name) ?? [];
  if (viewColumns.length > 0 && !viewColumns.includes(target.primaryKey)) {
    throw new Error(
      `flowpanel: resource "${name}" writes to "${target.name}", whose key "${target.primaryKey}" ` +
        `is not a column of the view "${view?.name}". Select it in the view.`,
    );
  }
  const known = target.columns.map((column) => column.name);
  const missingColumn = (field: string, via: string): never => {
    throw new Error(
      `flowpanel: resource "${name}" writes "${field}" via ${via}, but its writeTo ` +
        `"${target.name}" has no such column.${didYouMean(field, known)} Known columns: ${quoted(known)}.`,
    );
  };
  for (const mode of ["create", "update"] as const) {
    (resource.options[mode]?.fields ?? []).forEach((field, index) => {
      if (!known.includes(field.name)) missingColumn(field.name, `${mode}.fields[${index}].name`);
    });
  }
  (resource.options.columns ?? []).forEach((column, index) => {
    const def = column as { field?: unknown; editable?: unknown };
    if (typeof column !== "object" || def.editable !== true || typeof def.field !== "string")
      return;
    if (!known.includes(def.field)) missingColumn(def.field, `columns[${index}].field`);
  });
}

/**
 * A resource over a view: with `writeTo`, the write target is checked; without it, the
 * resource becomes read-only and any declared write is an error.
 */
export function viewResource(
  name: string,
  resource: ResourceConfig,
  introspection: ResourceIntrospection | null,
  adapter: Adapter,
): ResourceConfig {
  if (resource.options.writeTo !== undefined) {
    checkWriteTarget(name, resource, introspection, adapter);
    return resource;
  }
  if (introspection?.kind !== "view") return resource;
  const declared = declaredWrites(resource);
  if (declared.length > 0) {
    throw new Error(
      `flowpanel: resource "${name}" reads the view "${introspection.name}" and cannot write ` +
        `(${declared.join(", ")}); set writeTo: <table> or disable create/update/delete.`,
    );
  }
  return {
    ...resource,
    options: {
      ...resource.options,
      create: { ...resource.options.create, disabled: true },
      update: { ...resource.options.update, disabled: true },
      delete: { ...resource.options.delete, disabled: true },
    },
  };
}
