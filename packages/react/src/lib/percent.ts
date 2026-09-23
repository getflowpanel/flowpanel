import { DEFAULT_FORMATTING, type ResolvedFormatting } from "@flowpanel/core/format";

/** A share as a percentage with exactly `digits` decimals in the admin's locale. */
export function formatPercent(
  share: number,
  digits: number,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
): string {
  return new Intl.NumberFormat(formatting.locale, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(share);
}
