import type * as React from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** A glyph above the title, such as a resource's `empty.icon`. */
  icon?: React.ReactNode;
  /** Marks the state as a failure, so `@flowpanel/kit/test`'s `smokeAdmin` finds it. */
  "data-fp-error"?: "";
}

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultEmptyState({
  title,
  description,
  action,
  icon,
  "data-fp-error": failed,
}: EmptyStateProps) {
  return (
    <div
      className="fp-flex fp-flex-col fp-items-center fp-justify-center fp-py-16 fp-text-center"
      {...(failed !== undefined ? { "data-fp-error": failed } : {})}
    >
      {icon ? (
        <div
          className="fp-mb-3 fp-flex fp-h-12 fp-w-12 fp-items-center fp-justify-center fp-rounded-full fp-bg-fill/60 fp-text-2xl fp-text-soft"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <div className="fp-text-base fp-font-semibold fp-text-ink">{title}</div>
      {description ? <div className="fp-mt-1 fp-text-sm fp-text-faint">{description}</div> : null}
      {action ? <div className="fp-mt-4">{action}</div> : null}
    </div>
  );
}
