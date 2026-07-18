"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn.js";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange?: (page: number) => void;
  className?: string;
}

const PAGE_BUTTON =
  "fp-press inline-flex h-7 items-center gap-1 rounded-fp border border-fp-border-1 bg-fp-bg-1 px-2.5 font-medium text-fp-text-2 shadow-fp-xs hover:bg-fp-bg-2 hover:text-fp-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40 disabled:opacity-50 disabled:hover:bg-fp-bg-1 disabled:hover:text-fp-text-2";

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultPagination({ page, pageSize, total, onChange, className }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const prevDisabled = page <= 1;
  const nextDisabled = page >= pages;
  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-fp-border-1 px-4 py-2.5 text-xs text-fp-text-2",
        className,
      )}
    >
      <span aria-live="polite" className="tabular-nums">
        {total} total · page {page} / {pages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={prevDisabled}
          onClick={() => !prevDisabled && onChange?.(page - 1)}
          className={PAGE_BUTTON}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden className="h-3.5 w-3.5" />
          Prev
        </button>
        <button
          type="button"
          disabled={nextDisabled}
          onClick={() => !nextDisabled && onChange?.(page + 1)}
          className={PAGE_BUTTON}
          aria-label="Next page"
        >
          Next
          <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
