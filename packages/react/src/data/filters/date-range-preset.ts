import type { DateRangePreset } from "@flowpanel/core";
import { RANGE_PRESETS, toISODate } from "../Calendar";

/** The preset a committed range matches on the admin's `today`, if any, so reopening the picker shows what is applied. */
export function activePresetOf(
  named: DateRangePreset | null,
  from: Date | null,
  to: Date | null,
  today: Date,
): (typeof RANGE_PRESETS)[number]["key"] | null {
  if (named)
    return named === "MTD"
      ? "thisMonth"
      : (RANGE_PRESETS.find((p) => p.key === named)?.key ?? null);
  if (!from || !to) return null;
  const key = `${toISODate(from)}:${toISODate(to)}`;
  return (
    RANGE_PRESETS.find((p) => {
      const r = p.range(today);
      return r.from && r.to && `${toISODate(r.from)}:${toISODate(r.to)}` === key;
    })?.key ?? null
  );
}
