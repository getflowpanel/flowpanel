import { type MoneyStorage, parseMoney } from "@flowpanel/core/format";

/** A control's name and resolved type — the two things that decide how its value decodes. */
export interface FormFieldShape {
  name: string;
  type?: string | undefined;
  /** `money` only: digits after the decimal point, and how the column holds the amount. */
  minorUnits?: number | undefined;
  storage?: MoneyStorage | undefined;
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

/** A `money` amount as its column takes it, or the text as typed when it is not one, for the server to reject. */
function readMoney(raw: string, shape: FormFieldShape): number | string {
  if (raw.trim() === "") return "";
  const parsed = parseMoney(raw, {
    minorUnits: shape.minorUnits ?? 2,
    ...(shape.storage ? { storage: shape.storage } : {}),
  });
  return parsed ?? raw;
}

/**
 * Reads submitted `FormData` back into the values the server expects, following what each control actually posts.
 * A checkbox posts `"on"` or nothing; tags/multiselect controls post one JSON array under a single name.
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
    else if (type === "money") out[f.name] = readMoney(raw, f);
    else out[f.name] = raw;
  }
  return out;
}
