"use client";
import {
  badgeProps,
  type ColumnFormat,
  cellTone,
  columnFormatKind,
  DEFAULT_FORMATTING,
  formatColumnValue,
  percentHeatLevel,
  type ResolvedFormatting,
  toBooleanValue,
  urlCellParts,
} from "@flowpanel/core/format";
import type * as React from "react";
import { StatusBadge } from "../_atoms/StatusBadge";
import { BooleanCell, HeatCell, RelativeTimeCell, ToneText, UrlCell } from "./FormatCells";

function isMoment(value: unknown): value is Date | string | number {
  return value instanceof Date || typeof value === "string" || typeof value === "number";
}

/** Render a declarative `ColumnFormat` cell. */
export function renderFormatCell(
  format: ColumnFormat,
  value: unknown,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
): React.ReactNode {
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
