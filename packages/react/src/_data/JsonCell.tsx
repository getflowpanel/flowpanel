"use client";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";

/**
 * Renders a `jsonb` object (or any non-primitive value) as a "View JSON"
 * trigger that pops a preformatted detail view. Keeps row height fixed
 * — the structured payload only paints on demand.
 *
 * For known-shape arrays use `<ArrayCell>` instead; this is the fallback
 * for opaque objects.
 */
export interface JsonCellProps {
  value: unknown;
  className?: string;
}

export function JsonCell({ value, className }: JsonCellProps) {
  const [open, setOpen] = React.useState(false);
  if (value === null || value === undefined) {
    return <span className="text-fp-text-3">—</span>;
  }
  // Primitive fallthrough — render inline; popover is overkill.
  if (typeof value !== "object") {
    return <span className={className}>{String(value)}</span>;
  }

  // We stringify on demand inside the popover so very large blobs don't pay
  // the cost until the user actually asks. The button still shows a short
  // type hint so the table isn't all "View JSON" buttons.
  const hint = Array.isArray(value) ? `Array(${value.length})` : "{…}";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-fp-sm bg-fp-bg-2 px-2 py-0.5 font-mono text-xs text-fp-text-2 hover:bg-fp-bg-3",
            className,
          )}
          aria-label="View JSON"
        >
          <span>{hint}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-[24rem] w-[min(28rem,90vw)] overflow-auto p-3 font-mono text-xs"
        align="start"
      >
        <pre className="whitespace-pre-wrap break-words text-fp-text-1">{stringify(value)}</pre>
      </PopoverContent>
    </Popover>
  );
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
