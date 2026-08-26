import type { ActionFormField } from "./action-form-field";

/** Mirror of the lossless list encoding `@flowpanel/react`'s tags / multiselect controls submit. */
function decodeList(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Read an action dialog's submitted `FormData` back into the JSON body the action route expects. */
export function readActionFormValues(
  fields: ActionFormField[],
  data: FormData,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const type = f.type ?? "text";
    const entry = data.get(f.name);
    const raw = typeof entry === "string" ? entry : "";
    if (type === "multiselect" || type === "tags") out[f.name] = decodeList(raw);
    else if (type === "boolean" || type === "checkbox" || type === "switch")
      out[f.name] = raw === "on";
    else if (type === "number") out[f.name] = raw === "" ? "" : Number(raw);
    else out[f.name] = raw;
  }
  return out;
}
