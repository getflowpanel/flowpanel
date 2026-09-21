import type * as React from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Marks the state as a failure, so `@flowpanel/test`'s `smokeAdmin` finds it. */
  "data-fp-error"?: "";
}

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultEmptyState({
  title,
  description,
  action,
  "data-fp-error": failed,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      {...(failed !== undefined ? { "data-fp-error": failed } : {})}
    >
      <div className="text-base font-semibold text-fp-text-1">{title}</div>
      {description ? <div className="mt-1 text-sm text-fp-text-3">{description}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
