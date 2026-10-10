"use client";
import type { EmptyStateProps } from "../feedback/EmptyStateDefault";

/** The table's own empty state, which a host's `EmptyState` slot replaces. */
export function TableEmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="fp-flex fp-flex-col fp-items-center fp-justify-center fp-py-16 fp-text-center">
      {icon ? (
        <div
          className="fp-mb-3 fp-flex fp-h-12 fp-w-12 fp-items-center fp-justify-center fp-rounded-full fp-bg-fill/60 fp-text-2xl fp-text-soft"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <div className="fp-text-base fp-font-medium fp-text-ink">{title}</div>
      {description ? <div className="fp-mt-1 fp-text-sm fp-text-faint">{description}</div> : null}
      {action ? <div className="fp-mt-4">{action}</div> : null}
    </div>
  );
}
