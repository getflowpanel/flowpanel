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
  renderDetailFields,
  selectFields,
} from "./detail-cells";

interface BlockArgs<Row> {
  row: Row;
  fields: DetailField[];
  cells: Map<string, DetailCell>;
  formatting: ResolvedFormatting;
  rendered: Map<string, ReactNode>;
  emptyState: string;
}

/** Inline, not a component, so the server hands the page a resolved KV block. */
function fieldsBlock<Row extends Record<string, unknown>>({
  row,
  fields,
  cells,
  formatting,
  rendered,
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
              value={
                rendered.has(name)
                  ? rendered.get(name)
                  : detailValue(row[name as keyof Row], cells.get(name), formatting)
              }
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
  emptyState?: string;
}

/** A key/value tab, either one flat block or one block per declared section. */
export async function renderFieldsTab<Row extends Record<string, unknown>>(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  resource: ResourceConfig,
  row: Row,
  spec: FieldsTabSpec<Row>,
): Promise<ReactNode> {
  const cells = buildDetailCells(resource, row, reqCtx);
  const formatting = resolveFormatting(config.formatting);
  const emptyState = spec.emptyState ?? mergeLabels(config.labels).detail.noFields;
  const sections = spec.sections?.length
    ? spec.sections.map((section) => ({ ...section, list: selectFields(row, section.fields) }))
    : null;
  const flat = sections ? [] : selectFields(row, spec.fields);
  const rendered = await renderDetailFields(
    row,
    sections ? sections.flatMap((section) => section.list) : flat,
    reqCtx,
  );
  const block = (fields: DetailField[]) =>
    fieldsBlock<Row>({ row, fields, cells, formatting, rendered, emptyState });

  if (sections) {
    return (
      <div className="space-y-5">
        {sections.map((section) => (
          <Section key={section.label} label={section.label}>
            {block(section.list)}
          </Section>
        ))}
      </div>
    );
  }
  return block(flat);
}
