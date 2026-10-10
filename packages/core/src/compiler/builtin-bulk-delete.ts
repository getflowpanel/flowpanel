import type { BulkAction } from "@flowpanel/core";
import type { ResourceConfig } from "../types/resource";

/** Marks the bulk delete the compiler injects so the runtime binds it to the resource delete path. */
export const BUILTIN_BULK_DELETE: unique symbol = Symbol.for("flowpanel.builtin.bulk-delete");

type BuiltinBulkDelete = BulkAction<unknown> & { readonly [BUILTIN_BULK_DELETE]: true };

/** Its label and confirm come from the admin's labels and `delete.confirm` when the runtime serializes it. */
export function createBuiltinBulkDelete(): BuiltinBulkDelete {
  return {
    key: "delete",
    label: "Delete",
    variant: "destructive",
    [BUILTIN_BULK_DELETE]: true,
    run: () => {
      throw new Error(
        "the injected bulk delete must be executed by the runtime, not by calling run() directly",
      );
    },
  };
}

/** Whether `action` is the compiler-injected delete the runtime must execute itself. */
export function isBuiltinBulkDelete(action: object): boolean {
  return (action as Partial<BuiltinBulkDelete>)[BUILTIN_BULK_DELETE] === true;
}

/**
 * Appends the built-in Delete to the bulk menu, after the host's own bulk actions, unless delete is
 * disabled, `delete.bulk` is `false`, or the host declared its own `delete` bulk action.
 */
export function withBuiltinBulkDelete(resource: ResourceConfig): ResourceConfig {
  const del = resource.options.delete;
  if (del?.disabled === true || del?.bulk === false) return resource;
  const declared = resource.options.bulkActions ?? [];
  if (declared.some((action) => action.key === "delete")) return resource;
  return {
    ...resource,
    options: {
      ...resource.options,
      bulkActions: [...declared, createBuiltinBulkDelete()],
    },
  };
}
