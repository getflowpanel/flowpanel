"use client";
import { cn } from "../lib/cn";

export interface ArrayCellProps {
  value: ReadonlyArray<unknown> | null | undefined;
  /** Max chips inlined before "+N more". Default 3. */
  max?: number;
  className?: string;
}

export function ArrayCell({ value, max = 3, className }: ArrayCellProps) {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="fp-text-faint">—</span>;
  }
  const shown = value.slice(0, max);
  const overflow = value.length - shown.length;
  const tooltip = value.map(formatChipValue).join(", ");
  return (
    <span
      role="img"
      className={cn("fp-inline-flex fp-flex-wrap fp-items-center fp-gap-1", className)}
      title={tooltip}
      aria-label={`${value.length} items: ${tooltip}`}
    >
      {shown.map((v, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: chip slot identity is positional within the cell.
          key={i}
          className="fp-inline-flex fp-max-w-[10rem] fp-truncate fp-rounded-full fp-border fp-border-line fp-bg-fill/50 fp-px-2 fp-py-0.5 fp-text-xs fp-text-soft"
        >
          {formatChipValue(v)}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          role="img"
          className="fp-inline-flex fp-rounded-full fp-border fp-border-line fp-bg-fill/50 fp-px-2 fp-py-0.5 fp-text-xs fp-font-medium fp-text-soft"
          aria-label={`${overflow} more`}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}

function formatChipValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
