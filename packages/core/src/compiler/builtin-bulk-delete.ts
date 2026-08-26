import type { BulkAction } from "../types/action";

/** Marks the bulk delete the compiler injects so the runtime binds it to the resource delete path. */
export const BUILTIN_BULK_DELETE: unique symbol = Symbol.for("flowpanel.builtin.bulk-delete");

type BuiltinBulkDelete = BulkAction<unknown> & { readonly [BUILTIN_BULK_DELETE]: true };

export const builtinBulkDelete: BuiltinBulkDelete = {
  key: "delete",
  label: "Delete",
  variant: "destructive",
  confirm: { title: "Delete selected items?", description: "This cannot be undone." },
  [BUILTIN_BULK_DELETE]: true,
  run: () => {
    throw new Error(
      "the injected bulk delete must be executed by the runtime, not by calling run() directly",
    );
  },
};

/** Whether `action` is the compiler-injected delete the runtime must execute itself. */
export function isBuiltinBulkDelete(action: object): boolean {
  return (action as Partial<BuiltinBulkDelete>)[BUILTIN_BULK_DELETE] === true;
}
