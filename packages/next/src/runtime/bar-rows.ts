import type { BarRow, BarsWidget, WidgetContext } from "@flowpanel/core";
import { OTHER_KEY } from "@flowpanel/core";
import { thresholdTone } from "./threshold-tone";
import { comparisonRange, rangedContext } from "./widget-context";

const identity = (row: BarRow): string => row.key ?? row.label;

function named(row: BarRow, ctx: WidgetContext): BarRow {
  return row.key === OTHER_KEY && row.label === OTHER_KEY
    ? { ...row, label: ctx.labels.widget.other }
    : row;
}

/** Rows with `previous` from the compared rows by `key`, else `label`; a row they lack had 0 unless they fold "Other". */
export function joinPrevious(rows: readonly BarRow[], before: readonly BarRow[]): BarRow[] {
  const values = new Map(before.map((row) => [identity(row), row.value]));
  const folded = before.some((row) => row.key === OTHER_KEY);
  return rows.map((row) => {
    if (row.previous !== undefined) return row;
    const previous = values.get(identity(row)) ?? (folded ? undefined : 0);
    return previous === undefined ? row : { ...row, previous };
  });
}

function comparedRows(widget: BarsWidget, ctx: WidgetContext): Promise<BarRow[]> | null {
  const compare = widget.options.compare;
  if (!compare) return null;
  const range = comparisonRange(ctx, typeof compare === "object" ? compare.against : undefined);
  if (range === null) return null;
  return widget.options.query(rangedContext(ctx, { ...range, preset: "custom" }));
}

/** A `bars()` card's rows: its query, the compared period joined in, the folded rest named. */
export async function barRows(widget: BarsWidget, ctx: WidgetContext): Promise<BarRow[]> {
  const [rows, before] = await Promise.all([widget.options.query(ctx), comparedRows(widget, ctx)]);
  const joined = before === null ? rows : joinPrevious(rows, before);
  const tones = widget.options.tones;
  const scale = 10 ** (widget.options.minorUnits ?? 0);
  return joined.map((stored) => {
    const row =
      scale === 1
        ? stored
        : {
            ...stored,
            value: stored.value / scale,
            ...(stored.previous === undefined ? {} : { previous: stored.previous / scale }),
          };
    const tone = row.tone ?? thresholdTone(row.value, tones, undefined, widget.options.goodWhen);
    return named(tone ? { ...row, tone } : row, ctx);
  });
}
