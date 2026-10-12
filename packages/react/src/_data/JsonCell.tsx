"use client";
import * as React from "react";
import { cn } from "../lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export interface JsonCellProps {
  value: unknown;
  className?: string;
}

export function JsonCell({ value, className }: JsonCellProps) {
  const [open, setOpen] = React.useState(false);
  if (value === null || value === undefined) {
    return <span className="fp-text-faint">—</span>;
  }
  if (typeof value !== "object") {
    return <span className={className}>{String(value)}</span>;
  }

  const hint = Array.isArray(value) ? `Array(${value.length})` : "{…}";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "fp-inline-flex fp-items-center fp-gap-1 fp-rounded-sm fp-bg-canvas fp-px-2 fp-py-0.5 fp-font-mono fp-text-xs fp-text-soft hover:fp-bg-fill",
            className,
          )}
          aria-label="View JSON"
        >
          <span>{hint}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="fp-max-h-[24rem] fp-w-[min(28rem,90vw)] fp-overflow-auto fp-p-3 fp-font-mono fp-text-xs"
        align="start"
      >
        <pre className="fp-whitespace-pre-wrap fp-break-words fp-text-ink">{stringify(value)}</pre>
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
