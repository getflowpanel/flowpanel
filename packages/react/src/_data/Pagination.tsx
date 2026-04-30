"use client";
import { cn } from "../lib/cn.js";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange?: (page: number) => void;
  className?: string;
}

export function Pagination({ page, pageSize, total, onChange, className }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const prevDisabled = page <= 1;
  const nextDisabled = page >= pages;
  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-fp-border-1 px-4 py-2 text-xs text-fp-text-2",
        className,
      )}
    >
      <span aria-live="polite">
        {total} total · page {page} / {pages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={prevDisabled}
          onClick={() => !prevDisabled && onChange?.(page - 1)}
          className="rounded-fp-sm border border-fp-border-1 px-2 py-1 transition-colors hover:bg-fp-bg-2 disabled:opacity-50 disabled:hover:bg-transparent"
          aria-label="Previous page"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={nextDisabled}
          onClick={() => !nextDisabled && onChange?.(page + 1)}
          className="rounded-fp-sm border border-fp-border-1 px-2 py-1 transition-colors hover:bg-fp-bg-2 disabled:opacity-50 disabled:hover:bg-transparent"
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}
