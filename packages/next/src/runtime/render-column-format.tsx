import {
  badgeProps,
  type ColumnFormat,
  columnFormatKind,
  DEFAULT_FORMATTING,
  formatColumnValue,
  percentHeatLevel,
  type ResolvedFormatting,
  toBooleanValue,
  urlCellParts,
} from "@flowpanel/core";
import { BooleanCell, HeatCell, RelativeTimeCell, StatusBadge, UrlCell } from "@flowpanel/react";
import type { ReactNode } from "react";

function isMoment(value: unknown): value is Date | string | number {
  return value instanceof Date || typeof value === "string" || typeof value === "number";
}

// @flowpanel/react ships every module behind a "use client" banner, so a server
// component may create its elements but never call its functions. Only the JSX
// is mirrored here; the string formatting comes from core.

/** Render a declarative `ColumnFormat` cell on the server, as `renderFormatCell` does on the client. */
export function renderColumnFormat(
  format: ColumnFormat,
  value: unknown,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
): ReactNode {
  if (format === "badge" || (typeof format === "object" && format.kind === "badge")) {
    const props = badgeProps(format, value);
    return props ? <StatusBadge {...props} /> : "—";
  }
  if (value === null || value === undefined || value === "") return "—";
  if (columnFormatKind(format) === "relative" && isMoment(value)) {
    return <RelativeTimeCell value={value} formatting={formatting} />;
  }
  const glyphs =
    format === "boolean" ||
    (typeof format === "object" && format.kind === "boolean" && !format.labels);
  const flag = glyphs ? toBooleanValue(value) : null;
  if (flag !== null) return <BooleanCell value={flag} />;
  const link = urlCellParts(value, format);
  if (link) return <UrlCell href={link.href} text={link.text} />;
  const text = formatColumnValue(value, format, formatting);
  const heat = percentHeatLevel(value, format);
  return heat === null ? text : <HeatCell level={heat} text={text} />;
}
