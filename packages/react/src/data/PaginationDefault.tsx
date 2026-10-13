"use client";
import { DEFAULT_LABELS, formatLabel, type LabelsConfig } from "@flowpanel/core/labels";
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
  /** Plain strings supplied by the wrapper; safe for standalone registry defaults. */
  labels?: LabelsConfig["pagination"];
  /** Formats the range as the list's count is formatted: "12,041–12,053 of 12,053". */
  locale?: string;
}

/** Preserve the inherited language when a JavaScript caller passes undefined. */
export function resolvePaginationLabels(
  overrides: PaginationProps["labels"],
  base = DEFAULT_LABELS.pagination,
): typeof DEFAULT_LABELS.pagination {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(overrides ?? {}).filter(([, value]) => value !== undefined),
    ),
  };
}

/**
 * The rendered page sequence: first and last page, a window around the current one, an ellipsis over gaps.
 * The window widens at either end so the control keeps a stable width as the cursor moves.
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
  "fp-press fp-inline-flex fp-h-11 fp-w-11 fp-items-center fp-justify-center fp-rounded fp-text-soft fp-transition-colors hover:fp-bg-fill hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 disabled:fp-pointer-events-none disabled:fp-opacity-40 sm:fp-h-8 sm:fp-w-8";

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultPagination({
  page,
  pageSize,
  total,
  onChange,
  pageSizeOptions,
  onPageSizeChange,
  className,
  labels: overrides,
  locale,
}: PaginationProps) {
  const labels = resolvePaginationLabels(overrides);
  const number = new Intl.NumberFormat(locale);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const sizePicker = pageSizeOptions?.length && onPageSizeChange ? pageSizeOptions : null;
  if (pages <= 1 && !sizePicker) return null;

  const go = (next: number) => {
    if (next >= 1 && next <= pages && next !== page) onChange?.(next);
  };

  return (
    <nav
      aria-label={labels.label}
      className={cn(
        "fp-flex fp-flex-wrap fp-items-center fp-justify-center fp-gap-1 fp-border-t fp-border-line fp-px-4 fp-py-3 fp-text-sm",
        className,
      )}
    >
      <span className="fp-mr-2 fp-tabular-nums fp-text-faint">
        {`${number.format(first)}–${number.format(last)} ${labels.of} ${number.format(total)}`}
      </span>

      <button
        type="button"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
        className={STEP}
        aria-label={labels.previous}
      >
        <ChevronLeft aria-hidden className="fp-h-4 fp-w-4" />
      </button>

      {pageItems(page, pages).map((item, i) =>
        item === "gap" ? (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: a gap has no identity beyond its slot
            key={`gap-${i}`}
            aria-hidden
            className="fp-inline-flex fp-h-11 fp-w-11 fp-items-center fp-justify-center fp-text-faint sm:fp-h-8 sm:fp-w-8"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => go(item)}
            aria-label={formatLabel(labels.page, { n: item })}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              "fp-press fp-inline-flex fp-h-11 fp-min-w-11 fp-items-center fp-justify-center fp-rounded fp-px-1.5 fp-tabular-nums fp-transition-colors focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 sm:fp-h-8 sm:fp-min-w-8",
              item === page
                ? "fp-border fp-border-accent fp-font-medium fp-text-accent-ink"
                : "fp-text-soft hover:fp-bg-fill hover:fp-text-ink",
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
        aria-label={labels.next}
      >
        <ChevronRight aria-hidden className="fp-h-4 fp-w-4" />
      </button>

      {/* A native select rather than the Radix one: four options do not justify
          pulling a combobox into every table's bundle, and phones get their own
          picker for free. */}
      {sizePicker ? (
        <div className="fp-relative fp-ml-2">
          <select
            aria-label={labels.rowsPerPage}
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className="fp-h-11 fp-appearance-none fp-rounded fp-border fp-border-line fp-bg-surface fp-pl-3 fp-pr-8 fp-text-sm fp-text-ink fp-shadow-xs fp-transition-colors hover:fp-border-line-strong focus:fp-border-focus focus:fp-outline-none focus:fp-ring-2 focus:fp-ring-focus/25 sm:fp-h-8"
          >
            {sizePicker.map((n) => (
              <option key={n} value={n}>
                {formatLabel(labels.pageSize, { n })}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="fp-pointer-events-none fp-absolute fp-right-2.5 fp-top-1/2 fp-h-4 fp-w-4 -fp-translate-y-1/2 fp-text-soft fp-opacity-50"
          />
        </div>
      ) : null}
    </nav>
  );
}
