"use client";
import {
  type ColumnFormat,
  DEFAULT_FORMATTING,
  formatColumnValue,
  type ResolvedFormatting,
} from "@flowpanel/core/format";
import type * as React from "react";
import { StatusBadge } from "../_atoms/StatusBadge";

/** Render a declarative `ColumnFormat` cell. */
export function renderFormatCell(
  format: ColumnFormat,
  value: unknown,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
): React.ReactNode {
  if (format === "badge" || (typeof format === "object" && format.kind === "badge")) {
    if (value === null || value === undefined || value === "") return "—";
    const s = String(value);
    const tone = typeof format === "object" ? format.tones?.[s] : undefined;
    return (
      <StatusBadge
        status={s.replace(/_/g, " ")}
        className="capitalize"
        {...(tone ? { tone } : {})}
      />
    );
  }
  return formatColumnValue(value, format, formatting);
}
