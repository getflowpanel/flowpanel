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
    return <span className="text-fp-text-3">—</span>;
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
