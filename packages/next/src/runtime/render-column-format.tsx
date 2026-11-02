import {
  type ColumnFormat,
  DEFAULT_FORMATTING,
  formatColumnValue,
  type ResolvedFormatting,
} from "@flowpanel/core";
import {
  badgeProps,
  cellTone,
  columnFormatKind,
  percentHeatLevel,
  toBooleanValue,
  urlCellParts,
} from "@flowpanel/core/format";
import {
  BooleanCell,
  HeatCell,
  RelativeTimeCell,
  StatusBadge,
  ToneText,
  UrlCell,
} from "@flowpanel/react";
import type { ReactNode } from "react";

function isMoment(value: unknown): value is Date | string | number {
  return value instanceof Date || typeof value === "string" || typeof value === "number";
}

// @flowpanel/react ships behind "use client", so a server component may create its elements but never call its functions.

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
  const tone = cellTone(value, format);
  if (tone !== null) return <ToneText tone={tone} text={text} />;
  const heat = percentHeatLevel(value, format);
  return heat === null ? text : <HeatCell level={heat} text={text} />;
}
