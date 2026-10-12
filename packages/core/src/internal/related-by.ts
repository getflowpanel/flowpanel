import type { ResourceConfig } from "@flowpanel/core";
import { FlowpanelConfigError } from "../types/config-error";

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

/** The one field of the target that points at `parent`, or none, or several. */
export function pointingField(
  target: ResourceConfig,
  parent: string,
): Exclude<RecordField, { kind: "own" }> {
  const candidates = referencingFields(target, parent);
  if (candidates.length === 1) return { kind: "one", field: candidates[0] as string };
  return candidates.length === 0 ? { kind: "none" } : { kind: "many", candidates };
}

/** `own` when the `where` already names a referencing field; else the one field, none or several. */
export function recordField(
  target: ResourceConfig,
  parent: string,
  whereKeys: readonly string[],
): RecordField {
  const candidates = referencingFields(target, parent);
  if (candidates.some((field) => whereKeys.includes(field))) return { kind: "own" };
  return pointingField(target, parent);
}

/** The error for a record-page read that cannot tell which field points at the record; `pick` names how to choose. */
export function recordFieldError(
  site: string,
  target: string,
  parent: string,
  found: Extract<RecordField, { kind: "none" | "many" }>,
  pick: "where" | "by" = "where",
): FlowpanelConfigError {
  if (found.kind === "many") {
    return new FlowpanelConfigError(
      site,
      `it reads "${target}" on a "${parent}" card, and several of its columns point at a ` +
        `"${parent}" (${found.candidates.join(", ")}). ` +
        (pick === "by" ? "Pass by." : "Name one in where."),
    );
  }
  return new FlowpanelConfigError(
    site,
    `it reads "${target}" on a "${parent}" card, but none of its columns declares ` +
      `reference: { resource: "${parent}" }, so it would read every row. ` +
      (pick === "by"
        ? "Pass by, or add the reference."
        : "Add the reference, or name the field in where."),
  );
}
