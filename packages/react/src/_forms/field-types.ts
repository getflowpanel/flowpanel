import type { FieldType } from "@flowpanel/core";

/** A `FieldDef` resolved to a serializable form-field spec. */
export interface ResolvedField {
  name: string;
  label: string;
  type: FieldType;
  help?: string;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  /** Field width on the form's 12-column grid (`sm`+); defaults to full width. */
  span?: 1 | 2 | 3 | 4 | 6 | 12;
  /** Section label; consecutive fields sharing a `group` render under one heading. */
  group?: string;
  /** Render the control non-editable (resolved server-side; also enforced on the write path). */
  readOnly?: boolean;
  /** Initial value for create forms (already resolved server-side — plain data only). */
  defaultValue?: unknown;
}
