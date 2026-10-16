"use client";
import {
  formatPercentValue,
  type NumericFormat,
  type ResolvedFormatting,
} from "@flowpanel/core/format";
import { deltaPrint, describeDelta, type GoodWhen, MOOD_TEXT } from "./delta";

export interface BarTrailProps {
  value: number;
  previous?: number | undefined;
  /** This row's part of the rows' total, when the card shows shares. */
  share?: number | undefined;
  format?: NumericFormat | undefined;
  goodWhen?: GoodWhen | undefined;
  formatting: ResolvedFormatting;
  /** `labels.widget.points`, for a `percent` row's change. */
  pointsLabel: string;
  /** `labels.widget.fresh`, for a row the compared period did not have. */
  freshLabel: string;
}

/** The right-hand side of a bar row: its value, its share and its change. */
export function BarTrail(props: BarTrailProps) {
  const { value, previous, share, format, goodWhen, formatting, pointsLabel, freshLabel } = props;
  const print = deltaPrint(format, formatting, pointsLabel, freshLabel);
  const change =
    previous === undefined
      ? null
      : describeDelta(
          {
            value: previous === 0 ? Math.sign(value) : (value - previous) / Math.abs(previous),
            previous,
            goodWhen,
          },
          value,
          format,
          print,
        );
  return (
    <span className="fp-flex fp-shrink-0 fp-items-baseline fp-gap-2 fp-tabular-nums">
      <span className="fp-text-ink">{print.value(value)}</span>
      {share === undefined ? null : (
        <span data-share="" className="fp-w-10 fp-text-right fp-text-faint">
          {formatPercentValue(share, formatting, 0)}
        </span>
      )}
      {change === null ? null : (
        <span
          data-delta={change.mood}
          className={change.material ? MOOD_TEXT[change.mood] : MOOD_TEXT.flat}
        >
          {change.text}
        </span>
      )}
    </span>
  );
}
