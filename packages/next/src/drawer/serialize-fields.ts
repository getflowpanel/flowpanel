import type { DrawerFieldList } from "@flowpanel/core";

/** One drawer row on the wire: the field, plus the label its `FieldDef` declared. */
export interface SerializedField {
  name: string;
  label?: string;
}

export type SerializedFieldList = "*" | SerializedField[];

/** Flatten a declared drawer field list and apply the request's canonical read policy. */
export function serializeFields(
  fields: DrawerFieldList<Record<string, unknown>>,
  readable: ReadonlySet<string>,
): SerializedFieldList {
  if (fields === "*") return "*";
  const out: SerializedField[] = [];
  for (const f of fields) {
    const declared = typeof f === "object" && f !== null ? f : { name: String(f) };
    const name = String(declared.name ?? "");
    if (name === "" || !readable.has(name)) continue;
    const label = (declared as { label?: string }).label;
    out.push(label !== undefined ? { name, label } : { name });
  }
  return out;
}
