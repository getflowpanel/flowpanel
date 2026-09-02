"use client";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange?: (page: number) => void;
  /** Rendered as an `n / page` picker, but only alongside a change handler. */
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

/**
 * The rendered page sequence: always the first and last page, a window around
 * the current one, and an ellipsis wherever that skips something.
 *
 * The window widens at either end so the control keeps a stable width as the
 * cursor moves — otherwise the buttons shuffle under the pointer.
 */
export function pageItems(page: number, pages: number, siblings = 1): (number | "gap")[] {
  if (pages <= 1) return pages === 1 ? [1] : [];
  const span = siblings * 2 + 1;
  let start = Math.max(2, page - siblings);
  let end = Math.min(pages - 1, page + siblings);
  if (page - siblings <= 2) end = Math.min(pages - 1, span + 1);
  if (page + siblings >= pages - 1) start = Math.max(2, pages - span);

  const keep = new Set([1, pages]);
  for (let i = start; i <= end; i++) keep.add(i);

  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i] as number;
    const prev = sorted[i - 1];
    if (prev !== undefined && n - prev > 1) out.push("gap");
    out.push(n);
  }
  return out;
}

const STEP =
  "fp-press inline-flex h-11 w-11 items-center justify-center rounded-fp text-fp-text-2 transition-colors hover:bg-fp-bg-3 hover:text-fp-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40 disabled:pointer-events-none disabled:opacity-40 sm:h-8 sm:w-8";

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultPagination({
  page,
  pageSize,
  total,
  onChange,
  pageSizeOptions,
  onPageSizeChange,
  className,
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const sizePicker = pageSizeOptions?.length && onPageSizeChange ? pageSizeOptions : null;
  if (pages <= 1 && !sizePicker) return null;

  const go = (next: number) => {
    if (next >= 1 && next <= pages && next !== page) onChange?.(next);
  };

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-center gap-1 border-t border-fp-border-1 px-4 py-3 text-sm",
        className,
      )}
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
        className={STEP}
        aria-label="Previous page"
      >
        <ChevronLeft aria-hidden className="h-4 w-4" />
      </button>

      {pageItems(page, pages).map((item, i) =>
        item === "gap" ? (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: a gap has no identity beyond its slot
            key={`gap-${i}`}
            aria-hidden
            className="inline-flex h-11 w-11 items-center justify-center text-fp-text-3 sm:h-8 sm:w-8"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => go(item)}
            aria-label={`Page ${item}`}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              "fp-press inline-flex h-11 min-w-11 items-center justify-center rounded-fp px-1.5 tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40 sm:h-8 sm:min-w-8",
              item === page
                ? "border border-fp-accent font-medium text-fp-accent-badge-text"
                : "text-fp-text-2 hover:bg-fp-bg-3 hover:text-fp-text-1",
            )}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        disabled={page >= pages}
        onClick={() => go(page + 1)}
        className={STEP}
        aria-label="Next page"
      >
        <ChevronRight aria-hidden className="h-4 w-4" />
      </button>

      {/* A native select rather than the Radix one: four options do not justify
          pulling a combobox into every table's bundle, and phones get their own
          picker for free. */}
      {sizePicker ? (
        <div className="relative ml-2">
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className="h-11 appearance-none rounded-fp border border-fp-border-1 bg-fp-bg-1 pl-3 pr-8 text-sm text-fp-text-1 shadow-fp-xs transition-colors hover:border-fp-border-2 focus:border-fp-focus focus:outline-none focus:ring-2 focus:ring-fp-focus/25 sm:h-8"
          >
            {sizePicker.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fp-text-2 opacity-50"
          />
        </div>
      ) : null}
    </nav>
  );
}
