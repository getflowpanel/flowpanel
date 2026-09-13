import type { ColumnDef, RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { ReferenceCell } from "@flowpanel/react";
import type { ReactNode } from "react";
import { buildHref } from "./href";
import type { PrerenderedColumn } from "./prerender-cells";
import { resolveReferences } from "./resolve-references";

/** Overlay resolved foreign-key labels on the server-prerendered cell matrix. */
export function applyReferenceCells<Row extends Record<string, unknown>>(
  config: ResolvedAdminConfig,
  columnDefs: ReadonlyArray<keyof Row | ColumnDef<Row>>,
  columns: ReadonlyArray<PrerenderedColumn<Row>>,
  rows: ReadonlyArray<Row>,
  prerenderedCells: (ReactNode | undefined)[][] | undefined,
  labelsByField: ReadonlyMap<string, ReadonlyMap<string, unknown>>,
): (ReactNode | undefined)[][] | undefined {
  const cells = prerenderedCells
    ? prerenderedCells.map((row) => row.slice())
    : labelsByField.size > 0
      ? rows.map(() => Array(columns.length).fill(undefined) as ReactNode[])
      : undefined;
  if (!cells || labelsByField.size === 0) return cells;

  const columnIndex = new Map<string, number>();
  columns.forEach((column, index) => {
    columnIndex.set(column.field, index);
  });

  const references = new Map<string, { resource: string; labelField: string }>();
  for (const column of columnDefs) {
    if (typeof column !== "object") continue;
    const field = String(column.field ?? "");
    if (column.reference && field) references.set(field, column.reference);
  }

  rows.forEach((row, rowIndex) => {
    const rowCells = cells[rowIndex];
    if (!rowCells) return;
    for (const [field, labels] of labelsByField) {
      const index = columnIndex.get(field);
      const reference = references.get(field);
      if (index === undefined || !reference) continue;

      const raw = row[field];
      if (raw === null || raw === undefined) {
        rowCells[index] = <span className="text-fp-text-3">—</span>;
        continue;
      }
      const id = String(raw);
      const label = labels.get(id);
      if (label === undefined) continue;
      rowCells[index] = (
        <ReferenceCell label={String(label)} href={buildHref(config, reference.resource, id)} />
      );
    }
  });

  return cells;
}

/** Replace a widget table's foreign-key cells with the referenced row's label. */
export async function withReferenceCells<Row extends Record<string, unknown>>(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  columnDefs: ReadonlyArray<string | ColumnDef<Row>>,
  rows: Row[],
  columns: PrerenderedColumn<Row>[],
  prerenderedCells: (ReactNode | undefined)[][] | undefined,
): Promise<(ReactNode | undefined)[][] | undefined> {
  const labelsByField = await resolveReferences<Row>(
    config,
    reqCtx,
    columnDefs as ReadonlyArray<keyof Row | ColumnDef<Row>>,
    rows,
  );
  if (labelsByField.size === 0) return prerenderedCells;
  return applyReferenceCells<Row>(
    config,
    columnDefs as ReadonlyArray<keyof Row | ColumnDef<Row>>,
    columns,
    rows,
    prerenderedCells,
    labelsByField,
  );
}
