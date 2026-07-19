"use client";

/** Rendered by every runtime chart when the query returns zero rows —
    a blank axis frame reads as a bug, this reads as a state. */
export function ChartEmptyState({ height }: { height: number }) {
  return (
    <div
      className="flex w-full flex-col items-center justify-center gap-2 rounded-fp border border-dashed border-fp-border-2 text-fp-text-3"
      style={{ height }}
    >
      <svg
        width="28"
        height="20"
        viewBox="0 0 28 20"
        fill="none"
        aria-hidden="true"
        className="opacity-60"
      >
        <rect x="1" y="11" width="5" height="8" rx="1.5" fill="currentColor" opacity="0.5" />
        <rect x="11" y="6" width="5" height="13" rx="1.5" fill="currentColor" opacity="0.7" />
        <rect x="21" y="1" width="5" height="18" rx="1.5" fill="currentColor" />
      </svg>
      <span className="text-xs font-medium">No data yet</span>
    </div>
  );
}
