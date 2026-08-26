import { type ColumnFormat, formatColumnValue } from "@flowpanel/core";
import { StatusBadge } from "@flowpanel/react";
import type { ReactNode } from "react";

// @flowpanel/react ships every module behind a "use client" banner, so a server
// component may create its elements but never call its functions. Only the JSX
// is mirrored here; the string formatting comes from core.

/** Render a declarative `ColumnFormat` cell on the server. */
export function renderColumnFormat(format: ColumnFormat, value: unknown): ReactNode {
  if (format === "badge" || (typeof format === "object" && format.kind === "badge")) {
    if (value === null || value === undefined || value === "") return "—";
    const status = String(value);
    const tone = typeof format === "object" ? format.tones?.[status] : undefined;
    return (
      <StatusBadge
        status={status.replace(/_/g, " ")}
        className="capitalize"
        {...(tone ? { tone } : {})}
      />
    );
  }
  return formatColumnValue(value, format);
}
