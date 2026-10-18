import type {
  DetailTab,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedFormatting,
  ResourceConfig,
} from "@flowpanel/core";
import { mergeLabels, resolveFormatting } from "@flowpanel/core";
import { KV, KVRow, Section } from "@flowpanel/react";
import type { ReactNode } from "react";
import { fieldLabels, namedFields } from "../../runtime/field-labels";
import { markdownFields } from "../../runtime/markdown";
import {
  buildDetailCells,
  type DetailCell,
  type DetailField,
  detailValue,
  renderDetailFields,
  selectFields,
  withReferenceCells,
} from "./detail-cells";

interface BlockArgs<Row> {
  row: Row;
  fields: DetailField[];
  cells: Map<string, DetailCell>;
  formatting: ResolvedFormatting;
  rendered: Map<string, ReactNode>;
  emptyState: string;
  labelOf: (name: string) => string;
}

/** Inline, not a component, so the server hands the page a resolved KV block. */
function fieldsBlock<Row extends Record<string, unknown>>({
  row,
  fields,
  cells,
  formatting,
  rendered,
  emptyState,
  labelOf,
}: BlockArgs<Row>): ReactNode {
  return (
    <div className="fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-p-6">
      {fields.length === 0 ? (
        <p className="fp-text-sm fp-text-faint">{emptyState}</p>
      ) : (
        <KV>
          {fields.map(({ name, label }) => (
            <KVRow
              key={name}
              label={label ?? labelOf(name)}
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
  const formatting = resolveFormatting(config.formatting);
  const emptyState = spec.emptyState ?? mergeLabels(config.labels).detail.noFields;
  const sections = spec.sections?.length
    ? spec.sections.map((section) => ({ ...section, list: selectFields(row, section.fields) }))
    : null;
  const flat = sections ? [] : selectFields(row, spec.fields);
  const shown = sections ? sections.flatMap((section) => section.list) : flat;
  const [cells, rendered] = await Promise.all([
    withReferenceCells(
      config,
      reqCtx,
      resource,
      row,
      new Set(shown.map((field) => field.name)),
      buildDetailCells(resource, row, reqCtx, namedFields(config)),
    ),
    renderDetailFields(row, shown, reqCtx, markdownFields(resource)),
  ]);
  const block = (fields: DetailField[]) =>
    fieldsBlock<Row>({
      row,
      fields,
      cells,
      formatting,
      rendered,
      emptyState,
      labelOf: fieldLabels(resource, [], namedFields(config)),
    });

  if (sections) {
    return (
      <div className="fp-space-y-5">
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
