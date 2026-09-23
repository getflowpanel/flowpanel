"use client";
import {
  badgeProps,
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
    const props = badgeProps(format, value);
    return props ? <StatusBadge {...props} /> : "—";
  }
  return formatColumnValue(value, format, formatting);
}
