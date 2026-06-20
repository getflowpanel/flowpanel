import type { FieldDef } from "@flowpanel/core";
import type { ActionFormField } from "./action-form-field.js";

export function serializeActionFormField(f: FieldDef<Record<string, unknown>>): ActionFormField {
  const out: ActionFormField = { name: f.name };
  if (f.label !== undefined) out.label = f.label;
  if (f.help !== undefined) out.help = f.help;
  if (f.placeholder !== undefined) out.placeholder = f.placeholder;
  if (f.type !== undefined) out.type = f.type;
  if (f.required !== undefined) out.required = f.required;
  if (Array.isArray(f.options)) {
    out.options = f.options.map((o) =>
      typeof o === "string" ? { label: o, value: o } : { label: o.label, value: String(o.value) },
    );
  }
  return out;
}

/** Serializes a row/bulk action's `form` array, or `undefined` when unset/empty. */
export function serializeActionForm(
  form: FieldDef<Record<string, unknown>>[] | undefined,
): ActionFormField[] | undefined {
  if (!form || form.length === 0) return undefined;
  return form.map(serializeActionFormField);
}
