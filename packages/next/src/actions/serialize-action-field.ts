import type { FieldDef } from "@flowpanel/core";
import { toWireOptions } from "../runtime/select-options";
import type { ActionFormField } from "./action-form-field";

export function serializeActionFormField(f: FieldDef<Record<string, unknown>>): ActionFormField {
  const out: ActionFormField = { name: f.name };
  if (f.label !== undefined) out.label = f.label;
  if (f.help !== undefined) out.help = f.help;
  if (f.placeholder !== undefined) out.placeholder = f.placeholder;
  if (f.type !== undefined) out.type = f.type;
  if (f.required !== undefined) out.required = f.required;
  if (Array.isArray(f.options)) out.options = toWireOptions(f.options);
  return out;
}

/** Serializes a row/bulk action's `form` array, or `undefined` when unset/empty. */
export function serializeActionForm(
  form: FieldDef<Record<string, unknown>>[] | undefined,
): ActionFormField[] | undefined {
  if (!form || form.length === 0) return undefined;
  return form.map(serializeActionFormField);
}
