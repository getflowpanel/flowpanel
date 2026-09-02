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
    return <span className="text-fp-text-3">—</span>;
  }
  const shown = value.slice(0, max);
  const overflow = value.length - shown.length;
  const tooltip = value.map(formatChipValue).join(", ");
  return (
    <span
      role="img"
      className={cn("inline-flex flex-wrap items-center gap-1", className)}
      title={tooltip}
      aria-label={`${value.length} items: ${tooltip}`}
    >
      {shown.map((v, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: chip slot identity is positional within the cell.
          key={i}
          className="inline-flex max-w-[10rem] truncate rounded-full border border-fp-border-1 bg-fp-bg-3/50 px-2 py-0.5 text-xs text-fp-text-2"
        >
          {formatChipValue(v)}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          role="img"
          className="inline-flex rounded-full border border-fp-border-1 bg-fp-bg-3/50 px-2 py-0.5 text-xs font-medium text-fp-text-2"
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
