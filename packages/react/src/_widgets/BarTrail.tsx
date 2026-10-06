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
}

/** The right-hand side of a bar row: its value, its share and its change. */
export function BarTrail(props: BarTrailProps) {
  const { value, previous, share, format, goodWhen, formatting, pointsLabel } = props;
  const print = deltaPrint(format, formatting, pointsLabel);
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
    <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
      <span className="text-fp-text-1">{print.value(value)}</span>
      {share === undefined ? null : (
        <span data-share="" className="w-10 text-right text-fp-text-3">
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
