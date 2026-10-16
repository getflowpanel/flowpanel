import type { ColumnDef, ColumnFormat, ColumnMeta, RequestContext } from "@flowpanel/core";
import {
  columnFormatKind,
  DEFAULT_FORMATTING,
  formatColumnValue,
  formatDateValue,
  type ResolvedFormatting,
  toDateValue,
  urlCellParts,
} from "@flowpanel/core/format";
import { createElement, Fragment, isValidElement, type ReactNode } from "react";
import { cellText, columnContent, textRem, widestRem } from "./column-content";

/** Wire-safe column metadata derived from a resource's `ColumnDef[]`. */
export interface PrerenderedColumn<Row> {
  /** Row property, or `__cell_<i>` for a field-less column whose `render` supplies the cell. */
  field: keyof Row & string;
  label?: string;
  sortable?: boolean;
  width?: number | string;
  align?: "left" | "center" | "right";
  className?: string;
  hidden?: boolean;
  type?: ColumnMeta["type"];
  /** Mirrors `ColumnDef.editable`. When true, the cell renders as `<InlineEditCell>`. */
  editable?: boolean;
  /** Mirrors `ColumnDef.format`. Plain data, so it crosses to the client verbatim. */
  format?: ColumnFormat;
  /** Mirrors `ColumnDef.secondary`; dropped on a `reference` column. */
  secondary?: keyof Row & string;
  /** What a text column holds, which sizes it in the table. */
  content?: "long" | "email" | "link";
  /** The widest value on this page in rem as the cell shows it, which sizes the column. */
  textRem?: number;
}

export interface PrerenderResult<Row> {
  /** Column metadata stripped of `render`. Indexed identically to `prerenderedCells[i]`. */
  columns: PrerenderedColumn<Row>[];
  /** Server-prerendered cell content, `[rowIndex][colIndex]` against `columns`. */
  prerenderedCells: (ReactNode | undefined)[][] | undefined;
}

export interface PrerenderOptions {
  /** Drop columns whose `hidden` flag is truthy. */
  dropHidden?: boolean;
  /** Default value for `sortable` when a `ColumnDef` doesn't set it. */
  defaultSortable?: boolean;
  /** Adapter introspection keyed by column name. */
  metaByField?: ReadonlyMap<string, ColumnMeta>;
  /** The admin's locale and zone, so a number or date is measured as the cell shows it. */
  formatting?: ResolvedFormatting;
}

/** Synthetic column key for a field-less `render` column, stable across renders. */
function syntheticColumnKey(index: number): string {
  return `__cell_${index}`;
}

function warnFieldlessColumn(index: number): void {
  if (process.env.NODE_ENV === "production") return;
  console.warn(
    `[flowpanel] column #${index} declares neither \`field\` nor a \`render\`+\`label\` pair — skipped.`,
  );
}

/** A value as its cell shows it, for measuring; a reference waits for its label, and a badge is sized by all its labels. */
function shownText<Row>(
  column: PrerenderedColumn<Row>,
  raw: unknown,
  formatting: ResolvedFormatting,
): string {
  if (raw === null || raw === undefined || raw === "" || column.type === "reference") return "";
  if (column.format !== undefined) {
    if (columnFormatKind(column.format) === "badge") return "";
    return (
      urlCellParts(raw, column.format)?.text ?? formatColumnValue(raw, column.format, formatting)
    );
  }
  if (typeof raw === "boolean") return "✓";
  const date = column.type === "date" ? toDateValue(raw) : null;
  if (date) return formatDateValue(date, formatting);
  return typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
}

/** A rendered cell travels in an array, so React asks it for a key; a JSX `render` rarely gives one. */
function keyed(node: ReactNode, index: number): ReactNode {
  return isValidElement(node) && node.key === null
    ? createElement(Fragment, { key: index }, node)
    : node;
}

/** The table sizes columns in px and rem, so any other unit throws its widths off. */
const warnedWidths = new Set<string>();

function warnUnreadWidth(field: string, width: number | string): void {
  if (process.env.NODE_ENV === "production" || typeof width === "number") return;
  if (/^\d+(?:\.\d+)?(?:px|rem)$/.test(width.trim()) || warnedWidths.has(field)) return;
  warnedWidths.add(field);
  console.warn(
    `[flowpanel] column "${field}" has width "${width}"; use a number of px or a "px" or "rem" string so the other columns fit.`,
  );
}

export function prerenderResourceCells<Row>(
  columnDefs: ReadonlyArray<keyof Row | ColumnDef<Row>>,
  rows: ReadonlyArray<Row>,
  reqCtx: RequestContext,
  options: PrerenderOptions = {},
): PrerenderResult<Row> {
  const {
    dropHidden = false,
    defaultSortable,
    metaByField,
    formatting = DEFAULT_FORMATTING,
  } = options;
  const columns: PrerenderedColumn<Row>[] = [];
  const renderFns: (((row: Row) => ReactNode) | null)[] = [];

  for (const [index, c] of columnDefs.entries()) {
    if (typeof c === "string" || typeof c === "number" || typeof c === "symbol") {
      const field = String(c) as keyof Row & string;
      const col: PrerenderedColumn<Row> = { field };
      if (defaultSortable !== undefined) col.sortable = defaultSortable;
      const content = columnContent(field);
      if (content) col.content = content;
      const meta = metaByField?.get(field);
      if (meta) col.type = meta.type;
      columns.push(col);
      renderFns.push(null);
      continue;
    }
    const def = c as ColumnDef<Row>;
    if (dropHidden && def.hidden) continue;
    const field = String(def.field ?? "");
    const fieldless = field === "";
    if (fieldless && !(def.render && def.label)) {
      warnFieldlessColumn(index);
      continue;
    }
    const out: PrerenderedColumn<Row> = {
      field: (fieldless ? syntheticColumnKey(index) : field) as keyof Row & string,
    };
    if (def.label) out.label = def.label;
    const sortable = fieldless ? false : (def.sortable ?? defaultSortable);
    if (sortable !== undefined) out.sortable = sortable;
    if (def.width !== undefined) {
      out.width = def.width;
      warnUnreadWidth(field, def.width);
    }
    if (def.align) out.align = def.align;
    if (def.className) out.className = def.className;
    if (def.hidden !== undefined) out.hidden = def.hidden;
    if (!fieldless) {
      if (def.editable === true) out.editable = true;
      const content = def.reference ? undefined : columnContent(field);
      if (content) out.content = content;
      if (def.format !== undefined) out.format = def.format;
      if (def.secondary !== undefined && !def.reference) out.secondary = def.secondary;
      if (def.reference) out.type = "reference";
      else {
        const meta = metaByField?.get(field);
        if (meta) out.type = meta.type;
      }
    }
    columns.push(out);
    if (def.render) {
      const fn = def.render;
      renderFns.push((row: Row) => fn(row, reqCtx));
    } else {
      renderFns.push(null);
    }
  }

  const hasAnyRenderer = renderFns.some((fn) => fn !== null);
  const prerenderedCells: (ReactNode | undefined)[][] | undefined = hasAnyRenderer
    ? rows.map((row) => renderFns.map((fn, index) => (fn ? keyed(fn(row), index) : undefined)))
    : undefined;

  columns.forEach((column, index) => {
    const widest = widestRem(
      rows.map((row, rowIndex) => {
        const cell = prerenderedCells?.[rowIndex]?.[index];
        const shown = cellText(cell);
        // An element gets 1rem more: rendered cells are often badges or carry an icon.
        const own = shown
          ? textRem(shown) + (isValidElement(cell) ? 1 : 0)
          : textRem(shownText(column, row[column.field], formatting));
        // The muted second line is set in 12 px type, under the cell's 14 px.
        const second = column.secondary === undefined ? "" : row[column.secondary];
        return Math.max(own, typeof second === "string" ? (textRem(second) * 12) / 14 : 0);
      }),
    );
    if (widest !== undefined) column.textRem = widest;
  });
  return { columns, prerenderedCells };
}
