"use client";
import type { ColumnFormat } from "@flowpanel/core";
import { humanize, KV, KVRow, renderFormatCell, useFormatting } from "@flowpanel/react";
import type { ReactNode } from "react";
import { formatFieldValue } from "../runtime/format-field-value";
import type { SerializedField, SerializedFieldList } from "./serialize-fields";

function fieldEntries(
  row: Record<string, unknown>,
  fields: SerializedFieldList,
): SerializedField[] {
  if (fields === "*") return Object.keys(row).map((name) => ({ name }));
  return fields;
}

export interface DrawerFieldsViewProps {
  row: Record<string, unknown>;
  fields: SerializedFieldList;
  prerendered: Record<string, string>;
  labels: Record<string, string>;
  formats: Record<string, ColumnFormat>;
  /** The cell the list already drew for this field, so the drawer reads like the row it opened from. */
  listCell: (field: string) => ReactNode | undefined;
}

/** One label and value per field, formatted as the list's column formats it. */
export function DrawerFieldsView({
  row,
  fields,
  prerendered,
  labels,
  formats,
  listCell,
}: DrawerFieldsViewProps) {
  const formatting = useFormatting();
  return (
    <KV>
      {fieldEntries(row, fields).map(({ name: k, label }) => {
        const html = prerendered[k];
        const cell = listCell(k);
        const format = formats[k];
        return (
          <KVRow
            key={k}
            label={label ?? labels[k] ?? humanize(k)}
            value={
              html !== undefined ? (
                // biome-ignore lint/security/noDangerouslySetInnerHtml: server-prerendered from the resource's own column render
                <span dangerouslySetInnerHTML={{ __html: html }} />
              ) : cell !== undefined ? (
                cell
              ) : format !== undefined ? (
                renderFormatCell(format, row[k], formatting)
              ) : (
                formatFieldValue(row[k])
              )
            }
          />
        );
      })}
    </KV>
  );
}
