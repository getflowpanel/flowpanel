import type { ResourceConfig } from "../types/resource";

/** The target's columns whose `reference` points at `parent`, in declaration order. */
export function referencingFields(target: ResourceConfig, parent: string): string[] {
  const out: string[] = [];
  for (const column of target.options.columns ?? []) {
    if (typeof column !== "object" || column === null) continue;
    const def = column as { field?: unknown; reference?: { resource?: unknown } };
    if (def.reference?.resource === parent && typeof def.field === "string") out.push(def.field);
  }
  return out;
}

/** How rows of a target point at a record of `parent`. */
export type RecordField =
  | { kind: "own" }
  | { kind: "one"; field: string }
  | { kind: "none" }
  | { kind: "many"; candidates: string[] };

/** `own` when the `where` already names a referencing field; else the one field, none or several. */
export function recordField(
  target: ResourceConfig,
  parent: string,
  whereKeys: readonly string[],
): RecordField {
  const candidates = referencingFields(target, parent);
  if (candidates.some((field) => whereKeys.includes(field))) return { kind: "own" };
  if (candidates.length === 1) return { kind: "one", field: candidates[0] as string };
  return candidates.length === 0 ? { kind: "none" } : { kind: "many", candidates };
}

/**
 * Why a record-page read cannot tell which field points at the record; `null` when it can.
 * `pick` is what the host sets to choose: a count metric's `where`, or a source's `by`.
 */
export function recordFieldError(
  site: string,
  target: string,
  parent: string,
  found: RecordField,
  pick: "where" | "by" = "where",
): string | null {
  if (found.kind === "many") {
    return (
      `flowpanel: ${site} reads "${target}" on a "${parent}" card, and several of its columns ` +
      `point at a "${parent}" (${found.candidates.join(", ")}); ` +
      (pick === "by" ? "pass by." : "name one in where.")
    );
  }
  if (found.kind === "none") {
    return (
      `flowpanel: ${site} reads "${target}" on a "${parent}" card, but none of its columns ` +
      `declares reference: { resource: "${parent}" }, so it would read every row. Add the ` +
      (pick === "by" ? "reference." : "reference, or name the field in where.")
    );
  }
  return null;
}
