import { columnFormatKind, textWidthEm } from "@flowpanel/core/format";
import { columnLabel } from "./column-label";
import type { DataTableColumn } from "./data-table-types";
import { widthToCss } from "./format-cell";

/** The checkbox column; pinned columns start after it. */
export const SELECTION_WIDTH_PX = 48;
export const ROW_END_REM = 3.5;
export const REM_PX = 16;

const NUMERIC_KINDS = new Set<string | undefined>(["money", "number", "percent", "duration"]);
type Text = "long" | "reference" | "email" | "link" | "text";
/** A text column's narrowest and ideal rem when its values are unknown, and its turn for room: lower first. */
const TEXT: Record<Text, readonly [min: number, ideal: number, turn: number]> = {
  long: [10, 20, 1],
  reference: [9, 12, 1],
  email: [10, 16, 0],
  link: [8, 14, 0],
  text: [7, 12, 0],
};
/** A measured text column never narrows below this, or below its whole value when that is less. */
const READABLE_REM = 13;
const GUESS_TURN = 2;
/** A cell's side padding, both sides together. */
const PAD_REM = 2;

interface Box {
  field: string;
  min: number;
  ideal: number;
  text?: Text;
  turn?: number;
  css?: string;
}

/** A label's rem in the table's 12 px header type. */
const labelRem = (text: string): number => textWidthEm(text) * 0.75;

const quarter = (rem: number): number => Math.ceil(rem * 4) / 4;

/** The sort arrow and its gap, which hang into the padding unless a pin button follows them. */
const ARROW_REM = 1;

/** The header's label plus its padding, and room for a pin button and the arrow before it. */
const headRem = <Row>(column: DataTableColumn<Row>, extrasRem: number): number =>
  quarter(
    labelRem(columnLabel(column)) +
      PAD_REM +
      extrasRem +
      (extrasRem > 0 && column.sortable ? ARROW_REM : 0),
  );

/** A badge column as wide as its longest label, within 6rem to 11rem; 9rem when the labels are unknown. */
function badgeRem<Row>(column: DataTableColumn<Row>): number {
  const format = column.format;
  const labels =
    typeof format === "object" && format.kind === "badge"
      ? [...Object.values(format.labels ?? {}), ...Object.keys(format.tones ?? {})]
      : [];
  if (labels.length === 0) return 9;
  return Math.min(11, Math.max(6, quarter(Math.max(...labels.map(labelRem)) + PAD_REM + 1)));
}

function remOf(width: number | string): number | undefined {
  if (typeof width === "number") return width / REM_PX;
  const match = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(width.trim());
  if (!match) return undefined;
  return match[2] === "rem" ? Number(match[1]) : Number(match[1]) / REM_PX;
}

/** A fixed shape's narrowest and ideal rem when the server sent no values. */
function guessOf(kind: string | undefined): readonly [number, number] | undefined {
  if (kind === "boolean") return [6.5, 6.5];
  if (kind === "relative") return [8, 9];
  if (kind === "date") return [10, 11];
  return NUMERIC_KINDS.has(kind) ? [7, 8] : undefined;
}

/** Whether a column holds a number, date, flag or badge, which reads as broken when cut. */
export function fixedShape<Row>(column: DataTableColumn<Row>): boolean {
  const kind = column.format === undefined ? column.type : columnFormatKind(column.format);
  return kind === "badge" || kind === "enum" || guessOf(kind) !== undefined;
}

/** Narrowest and ideal rem: never under the header; a number, date or flag as wide as its widest value. */
function boxOf<Row>(column: DataTableColumn<Row>, headExtrasRem = 0, raisedRem = 0): Box {
  const kind = column.format === undefined ? column.type : columnFormatKind(column.format);
  const head = headRem(column, headExtrasRem) + raisedRem;
  const box = (min: number, ideal: number, extra: Partial<Box> = {}): Box => {
    const low = Math.max(min, head);
    return { field: column.field, min: low, ideal: Math.max(ideal, low), ...extra };
  };
  if (kind === "badge" || kind === "enum") {
    return box(badgeRem(column) + raisedRem, badgeRem(column) + raisedRem);
  }
  const guess = guessOf(kind);
  if (guess) {
    if (column.textRem === undefined) return box(guess[0], guess[1], { turn: GUESS_TURN });
    const fits = Math.ceil((column.textRem + PAD_REM + 0.25 + raisedRem) * 8) / 8;
    return box(fits, fits);
  }
  const text: Text =
    kind === "url" ? "link" : (column.content ?? (kind === "reference" ? "reference" : "text"));
  const [guessed, ideal, turn] = TEXT[text];
  if (column.textRem === undefined) return box(guessed, ideal, { text, turn });
  const fits = Math.min(
    text === "link" ? 20 : 26,
    column.textRem + PAD_REM + (column.editable ? 2 : 0.5),
  );
  return box(Math.min(fits, READABLE_REM), fits, { text, turn });
}

function boxesOf<Row>(
  columns: ReadonlyArray<DataTableColumn<Row>>,
  overrides: Readonly<Record<string, number>>,
  pinned: ReadonlySet<string>,
  headExtrasRem: number,
  raised: Readonly<Record<string, number>>,
): Box[] {
  return columns.map((column): Box => {
    const override = overrides[column.field];
    if (override !== undefined) {
      const rem = override / REM_PX;
      return { field: column.field, min: rem, ideal: rem, css: `${override}px` };
    }
    if (column.width !== undefined) {
      const rem = remOf(column.width);
      return rem === undefined
        ? { field: column.field, min: 12, ideal: 12, css: widthToCss(column.width) ?? "" }
        : { field: column.field, min: rem, ideal: rem, css: `${rem}rem` };
    }
    const { turn, ...box } = boxOf(column, headExtrasRem, (raised[column.field] ?? 0) / REM_PX);
    if (pinned.has(column.field)) return { ...box, min: box.ideal };
    return turn === undefined ? box : { ...box, turn };
  });
}

/** A pinned column's width in px, for the offset of the pinned column after it: dragged, set, else its ideal. */
export function pinnedPx<Row>(
  column: DataTableColumn<Row>,
  override?: number,
  {
    headExtrasRem = 0,
    raisedPx = 0,
  }: { headExtrasRem?: number; raisedPx?: number | undefined } = {},
): number {
  if (override !== undefined) return override;
  if (column.width !== undefined) return (remOf(column.width) ?? 12) * REM_PX;
  return boxOf(column, headExtrasRem, raisedPx / REM_PX).ideal * REM_PX;
}

/** Who takes the width left at their ideals: long text and references, else the first text column, else every column. */
function takersOf(boxes: Box[], pinned: ReadonlySet<string>): Box[] {
  const flexible = boxes.filter((box) => box.turn !== undefined && box.text !== undefined);
  const named = flexible.filter((box) => box.text === "long" || box.text === "reference");
  if (named.length > 0) return named;
  if (flexible[0]) return [flexible[0]];
  const guessed = boxes.filter((box) => box.turn !== undefined);
  return guessed.length > 0
    ? guessed
    : boxes.filter((box) => box.css === undefined && !pinned.has(box.field));
}

export interface TableWidths {
  /** Each column's CSS width, measured against the scroller with `cqw`. */
  widths: Map<string, string>;
  /** Below this the scroller scrolls sideways, with every column at its narrowest. */
  minWidth: string;
}

/** Columns grow from their narrowest to their ideal in turns as the frame widens. */
export function layoutColumns<Row>(
  columns: ReadonlyArray<DataTableColumn<Row>>,
  {
    overrides = {},
    pinned = new Set<string>(),
    extrasRem = 0,
    headExtrasRem = 0,
    raised = {},
  }: {
    overrides?: Readonly<Record<string, number>>;
    pinned?: ReadonlySet<string>;
    extrasRem?: number;
    /** Room each header needs beside its label, such as the pin button. */
    headExtrasRem?: number;
    /** Px a column's narrowest width rises by, where the browser found its header or a value cut. */
    raised?: Readonly<Record<string, number>>;
  } = {},
): TableWidths {
  const boxes = boxesOf(columns, overrides, pinned, headExtrasRem, raised);
  let reached = extrasRem + boxes.reduce((sum, box) => sum + box.min, 0);
  const minWidth = `${reached.toFixed(3)}rem`;
  const widths = new Map<string, string>();
  for (const box of boxes) widths.set(box.field, box.css ?? `${box.ideal}rem`);
  for (let turn = 0; turn <= GUESS_TURN; turn++) {
    const growing = boxes.filter((box) => box.turn === turn && box.ideal > box.min);
    const need = growing.reduce((sum, box) => sum + box.ideal - box.min, 0);
    for (const box of growing) {
      const share = (box.ideal - box.min) / need;
      widths.set(
        box.field,
        `calc(clamp(${box.min.toFixed(3)}rem, ${(share * 100).toFixed(3)}cqw + ${(box.min - reached * share).toFixed(3)}rem, ${box.ideal.toFixed(3)}rem))`,
      );
    }
    reached += need;
  }
  const takers = takersOf(boxes, pinned);
  const weight = takers.reduce((sum, box) => sum + box.ideal, 0);
  for (const box of takers) {
    const share = box.ideal / weight;
    widths.set(
      box.field,
      `calc(${widths.get(box.field)} + max(0rem, ${(share * 100).toFixed(3)}cqw - ${(reached * share).toFixed(3)}rem))`,
    );
  }
  return { widths, minWidth };
}
