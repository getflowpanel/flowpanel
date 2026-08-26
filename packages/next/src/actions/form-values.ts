/** A control's name and resolved type — the two things that decide how its value decodes. */
export interface FormFieldShape {
  name: string;
  type?: string | undefined;
}

const LIST_TYPES = new Set(["multiselect", "tags"]);
const BOOLEAN_TYPES = new Set(["boolean", "checkbox", "switch"]);

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

/**
 * Read submitted `FormData` back into the values the server expects, following what each
 * control actually posts: a checkbox posts `"on"` when ticked and nothing at all when
 * cleared, and the tags / multiselect controls post one JSON array under a single name.
 */
export function readFormValues(
  fields: readonly FormFieldShape[],
  data: FormData,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const type = f.type ?? "text";
    const entry = data.get(f.name);
    const raw = typeof entry === "string" ? entry : "";
    if (LIST_TYPES.has(type)) out[f.name] = decodeList(raw);
    else if (BOOLEAN_TYPES.has(type)) out[f.name] = raw === "on" || raw === "true";
    else if (type === "number") out[f.name] = raw === "" ? "" : Number(raw);
    else out[f.name] = raw;
  }
  return out;
}
