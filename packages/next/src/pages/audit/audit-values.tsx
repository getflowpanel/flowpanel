import type {
  ColumnDef,
  ColumnFormat,
  ResolvedAdminConfig,
  ResolvedFormatting,
  ResourceConfig,
} from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import type { ReactNode } from "react";
import { type AuditTitles, referenceKey, referencesOf } from "../../runtime/audit-titles";
import { formFieldsOf } from "../../runtime/form-fields-of";
import { formatFieldValue } from "../../runtime/format-field-value";
import { moneyShape } from "../../runtime/money-field";
import { renderColumnFormat } from "../../runtime/render-column-format";

export interface FieldLook {
  format?: ColumnFormat;
  /** The `auditTitles` key of the resource the field points at. */
  reference?: string;
}

/** Each field's format as the resource's columns and forms declare it; a money field formats as money. */
export function fieldLooks(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  formatting: ResolvedFormatting,
): Map<string, FieldLook> {
  const looks = new Map<string, FieldLook>();
  const { columns } = config.adapter.introspect(writeTarget(resource));
  for (const field of formFieldsOf(resource)) {
    const name = String(field.name);
    const look: FieldLook = { ...looks.get(name) };
    if (field.type === "money") {
      const shape = moneyShape(
        field,
        columns.find((c) => c.name === name),
        formatting,
      );
      const minorUnits = shape.storage === "minor" ? shape.minorUnits : 0;
      look.format = { kind: "money", currency: shape.currency, minorUnits };
    }
    looks.set(name, look);
  }
  for (const [field, reference] of referencesOf(resource)) {
    looks.set(field, { ...looks.get(field), reference: referenceKey(reference) });
  }
  for (const column of (resource.options.columns ?? []) as Array<
    string | ColumnDef<Record<string, unknown>>
  >) {
    if (typeof column !== "object" || !column.field) continue;
    looks.set(column.field, {
      ...looks.get(column.field),
      ...(column.format !== undefined ? { format: column.format } : {}),
    });
  }
  return looks;
}

/** One side of a change as the feed prints it: empty, yes or no, a referenced record's title, or the column's format. */
export function shown(
  value: unknown,
  look: FieldLook | undefined,
  formatting: ResolvedFormatting,
  words: { empty: string; yes: string; no: string },
  references: AuditTitles,
): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="fp-italic fp-text-faint">{words.empty}</span>;
  }
  if (typeof value === "boolean" && look?.format === undefined) return value ? words.yes : words.no;
  const title = look?.reference ? references.get(look.reference)?.get(String(value)) : undefined;
  if (title !== undefined) return title;
  return look?.format !== undefined
    ? renderColumnFormat(look.format, value, formatting)
    : formatFieldValue(value);
}
