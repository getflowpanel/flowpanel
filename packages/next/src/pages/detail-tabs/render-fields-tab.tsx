import type {
  DetailTab,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedFormatting,
  ResourceConfig,
} from "@flowpanel/core";
import { mergeLabels, resolveFieldLabel, resolveFormatting } from "@flowpanel/core";
import { KV, KVRow, Section } from "@flowpanel/react";
import type { ReactNode } from "react";
import {
  buildDetailCells,
  type DetailCell,
  type DetailField,
  detailValue,
  selectFields,
} from "./detail-cells";

interface BlockArgs<Row> {
  row: Row;
  fields: DetailField[];
  cells: Map<string, DetailCell>;
  formatting: ResolvedFormatting;
  emptyState: string;
}

/** Inline, not a component, so the server hands the page a resolved KV block. */
function fieldsBlock<Row extends Record<string, unknown>>({
  row,
  fields,
  cells,
  formatting,
  emptyState,
}: BlockArgs<Row>): ReactNode {
  return (
    <div className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
      {fields.length === 0 ? (
        <p className="text-sm text-fp-text-3">{emptyState}</p>
      ) : (
        <KV>
          {fields.map(({ name, label }) => (
            <KVRow
              key={name}
              label={resolveFieldLabel(label ?? cells.get(name)?.label, name)}
              value={detailValue(row[name as keyof Row], cells.get(name), formatting)}
            />
          ))}
        </KV>
      )}
    </div>
  );
}

export interface FieldsTabSpec<Row> {
  fields?: DetailTab<Row>["fields"];
  sections?: DetailTab<Row>["sections"];
}

/** A key/value tab, either one flat block or one block per declared section. */
export function renderFieldsTab<Row extends Record<string, unknown>>(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  resource: ResourceConfig,
  row: Row,
  spec: FieldsTabSpec<Row>,
): ReactNode {
  const cells = buildDetailCells(resource, row, reqCtx);
  const formatting = resolveFormatting(config.formatting);
  const emptyState = mergeLabels(config.labels).detail.noFields;
  const block = (fields: DetailField[]) =>
    fieldsBlock<Row>({ row, fields, cells, formatting, emptyState });

  if (spec.sections && spec.sections.length > 0) {
    return (
      <div className="space-y-5">
        {spec.sections.map((section) => (
          <Section key={section.label} label={section.label}>
            {block(selectFields(row, section.fields))}
          </Section>
        ))}
      </div>
    );
  }
  return block(selectFields(row, spec.fields));
}
