import { columnFormatKind } from "@flowpanel/core/format";
import { columnLabel } from "./column-label";
import type { DataTableColumn } from "./data-table-types";
import { widthToCss } from "./format-cell";

/** The checkbox column; pinned columns start after it. */
export const SELECTION_WIDTH_PX = 48;
export const ROW_END_REM = 3.5;
export const ROW_END_WIDTH = `${ROW_END_REM}rem`;
export const REM_PX = 16;

const NUMERIC_KINDS = new Set<string | undefined>(["money", "number", "percent", "duration"]);
type Text = "long" | "reference" | "email" | "link" | "text";
/** A text column's narrowest and ideal rem when its values are unknown, and its turn for room: lower first. */
const TEXT: Record<Text, readonly [min: number, ideal: number, turn: number]> = {
  long: [10, 20, 0],
  reference: [9, 12, 0],
  email: [10, 16, 1],
  link: [8, 14, 1],
  text: [7, 12, 2],
};
const COMFORT_TURN = 3;
/** A value this narrow is never cut: it costs little room, and a cut badge or code reads as broken. */
const SHORT_REM = 11;

interface Box {
  field: string;
  min: number;
  ideal: number;
  text?: Text;
  turn?: number;
  css?: string;
}

/** A label's rem in the table's small type; CJK and other wide scripts count double. */
const labelRem = (text: string): number =>
  [...text].reduce((sum, char) => sum + (char > "\u2e7f" ? 90 : 45), 0) / 100;

/** A badge column as wide as its longest label or its header, within 6rem to 11rem; 9rem when the labels are unknown. */
function badgeRem<Row>(column: DataTableColumn<Row>): number {
  const format = column.format;
  const labels =
    typeof format === "object" && format.kind === "badge"
      ? [...Object.values(format.labels ?? {}), ...Object.keys(format.tones ?? {})]
      : [];
  if (labels.length === 0) return 9;
  const longest = Math.max(...labels.map(labelRem), labelRem(column.label ?? column.field));
  return Math.min(11, Math.max(6, Math.ceil((longest + 3) * 2) / 2));
}

function remOf(width: number | string): number | undefined {
  if (typeof width === "number") return width / REM_PX;
  const match = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(width.trim());
  if (!match) return undefined;
  return match[2] === "rem" ? Number(match[1]) : Number(match[1]) / REM_PX;
}

/** Narrowest and ideal rem by kind; a text column's ideal fits the longest value the server saw. */
function boxOf<Row>(column: DataTableColumn<Row>, first: boolean): Box {
  const kind = column.format === undefined ? column.type : columnFormatKind(column.format);
  const header = labelRem(columnLabel(column)) + 3;
  const box = (min: number, ideal: number, extra: Partial<Box> = {}): Box => {
    const low = Math.max(min, header);
    return { field: column.field, min: low, ideal: Math.max(ideal, low), ...extra };
  };
  if (kind === "boolean") return box(6.5, 6.5);
  const badge = badgeRem(column);
  if (kind === "badge" || kind === "enum") return box(badge, badge);
  if (kind === "relative") return box(8, 9, { turn: COMFORT_TURN });
  if (kind === "date") return box(10, 11, { turn: COMFORT_TURN });
  if (NUMERIC_KINDS.has(kind)) return box(7, 8, { turn: COMFORT_TURN });
  const text: Text =
    kind === "url" ? "link" : (column.content ?? (kind === "reference" ? "reference" : "text"));
  const [min, ideal, turn] = TEXT[text];
  const fits =
    column.textRem === undefined
      ? ideal
      : Math.min(text === "link" ? 20 : 26, column.textRem + 2.5);
  return box(fits <= SHORT_REM ? fits : min, fits, { text, turn: first ? 0 : turn });
}

function boxesOf<Row>(
  columns: ReadonlyArray<DataTableColumn<Row>>,
  overrides: Readonly<Record<string, number>>,
  pinned: ReadonlySet<string>,
): Box[] {
  const named = columns.some((column) => column.content === "long");
  const boxes = columns.map((column, index): Box => {
    const override = overrides[column.field];
    if (override !== undefined) {
      const rem = override / REM_PX;
      return { field: column.field, min: rem, ideal: rem, css: `${override}px` };
    }
    if (column.width !== undefined) {
      const rem = remOf(column.width);
      return rem === undefined
        ? { field: column.field, min: 12, ideal: 12, css: widthToCss(column.width) ?? "" }
        : { field: column.field, min: rem, ideal: rem };
    }
    const { turn, ...box } = boxOf(column, index === 0 && !named);
    if (pinned.has(column.field)) return { ...box, min: box.ideal };
    return turn === undefined ? box : { ...box, turn };
  });
  const neighbours = Math.max(
    0,
    ...boxes.filter((box) => box.text === "text" && box.turn !== undefined).map((box) => box.min),
  );
  for (const box of boxes) {
    if (box.text === "long") box.min = Math.min(box.ideal, Math.max(box.min, neighbours));
  }
  return boxes;
}

/** A pinned column's width in px, for the offset of the pinned column after it: dragged, set, else its ideal. */
export function pinnedPx<Row>(column: DataTableColumn<Row>, override?: number): number {
  const rem = column.width === undefined ? boxOf(column, false).ideal : (remOf(column.width) ?? 12);
  return override ?? rem * REM_PX;
}

/** Who takes the width left at their ideals: long text and references, else the first column, links, any text, numbers and dates. */
function takersOf(boxes: Box[]): Box[] {
  const flexible = boxes.filter((box) => box.turn !== undefined && box.text !== undefined);
  const named = flexible.filter((box) => box.text === "long" || box.text === "reference");
  if (named.length > 0) return named;
  const first = flexible.find((box) => box.field === boxes[0]?.field);
  if (first) return [first];
  const wide = flexible.filter((box) => box.text === "email" || box.text === "link");
  if (wide.length > 0) return wide;
  return flexible.length > 0 ? flexible : boxes.filter((box) => box.turn !== undefined);
}

export interface TableWidths {
  /** Each column's CSS width, measured against the scroller with `cqw`. */
  widths: Map<string, string>;
  /** Below this the scroller scrolls sideways, with every column at its narrowest. */
  minWidth: string;
}

/** Columns grow from their narrowest to their ideal in turns as the frame widens; see `TEXT` for the order. */
export function layoutColumns<Row>(
  columns: ReadonlyArray<DataTableColumn<Row>>,
  {
    overrides = {},
    pinned = new Set<string>(),
    extrasRem = 0,
  }: {
    overrides?: Readonly<Record<string, number>>;
    pinned?: ReadonlySet<string>;
    extrasRem?: number;
  } = {},
): TableWidths {
  const boxes = boxesOf(columns, overrides, pinned);
  let reached = extrasRem + boxes.reduce((sum, box) => sum + box.min, 0);
  const minWidth = `${reached.toFixed(3)}rem`;
  const widths = new Map<string, string>();
  for (const box of boxes) widths.set(box.field, box.css ?? `${box.ideal}rem`);
  for (let turn = 0; turn <= COMFORT_TURN; turn++) {
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
  const takers = takersOf(boxes);
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
