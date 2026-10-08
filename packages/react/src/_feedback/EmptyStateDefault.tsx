import type * as React from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** A glyph above the title, such as a resource's `empty.icon`. */
  icon?: React.ReactNode;
  /** Marks the state as a failure, so `@flowpanel/test`'s `smokeAdmin` finds it. */
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
      className="flex flex-col items-center justify-center py-16 text-center"
      {...(failed !== undefined ? { "data-fp-error": failed } : {})}
    >
      {icon ? (
        <div
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-fp-bg-3/60 text-2xl text-fp-text-2"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <div className="text-base font-semibold text-fp-text-1">{title}</div>
      {description ? <div className="mt-1 text-sm text-fp-text-3">{description}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
