import type { EnumDef } from "../builders/enum-of";

/** Names for the keys of a series or a breakdown: a map, an `enumOf()`, or a function. */
export type KeyLabels = Readonly<Record<string, string>> | EnumDef | ((key: string) => string);

/** Whether a labels value is an `enumOf()` definition rather than a plain map. */
export function isEnumDef(value: unknown): value is EnumDef {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { label?: unknown; values?: unknown };
  return typeof candidate.label === "function" && Array.isArray(candidate.values);
}

/** The text a key prints as; a key with no name prints as itself. */
export function keyLabel(labels: KeyLabels | undefined, key: string): string {
  if (labels === undefined) return key;
  if (typeof labels === "function") return labels(key);
  if (isEnumDef(labels)) return labels.label(key);
  return labels[key] ?? key;
}
