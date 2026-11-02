import type { DrawerFieldList, RequestContext } from "@flowpanel/core";
import type { ReactNode } from "react";

export type FieldRender = (row: never, ctx: RequestContext) => ReactNode | Promise<ReactNode>;

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

/** Every readable field that declares its own `render`, across the drawer's field lists. */
export function fieldRenders(
  lists: ReadonlyArray<DrawerFieldList<Record<string, unknown>> | undefined>,
  readable: ReadonlySet<string>,
): Map<string, FieldRender> {
  const out = new Map<string, FieldRender>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const f of list) {
      if (typeof f !== "object" || f === null || typeof f.render !== "function") continue;
      if (readable.has(String(f.name))) out.set(String(f.name), f.render as FieldRender);
    }
  }
  return out;
}
