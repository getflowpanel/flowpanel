import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export interface FailureCardProps {
  /** The card title of what failed, such as a widget's label. */
  heading?: string;
  title: string;
  hint: string;
  /** Outside production only: what a developer checks, and the error's own message. */
  devHint?: string | null;
  detail?: { summary: string; text: string } | null;
  /** Inside a `StatStrip`, without the card's own frame. */
  plain?: boolean;
  /** Retry, and the request ID with its copy button. */
  actions: ReactNode;
}

/** What a failed read shows in place of its data: what failed, what to do, and the ID that ties it to the server log. */
export function FailureCard({
  heading,
  title,
  hint,
  devHint,
  detail,
  plain,
  actions,
}: FailureCardProps) {
  return (
    <div
      role="alert"
      data-fp-error=""
      {...(plain ? { "data-plain": "" } : {})}
      className={cn(
        "fp-h-full fp-w-full fp-bg-surface",
        !plain && "fp-rounded-lg fp-border fp-border-line fp-shadow-xs",
      )}
    >
      {heading ? (
        <div className="fp-px-4 fp-pt-4 fp-text-sm fp-font-medium fp-text-soft">{heading}</div>
      ) : null}
      <div className="fp-p-4">
        <p className="fp-text-sm fp-font-medium fp-text-err-ink">{title}</p>
        <p className="fp-mt-1 fp-text-sm fp-text-soft">{hint}</p>
        {devHint ? <p className="fp-mt-2 fp-text-xs fp-text-faint">{devHint}</p> : null}
        {detail ? (
          <details className="fp-mt-2 fp-text-xs fp-text-faint">
            <summary className="fp-cursor-pointer">{detail.summary}</summary>
            <p className="fp-mt-1 fp-break-words fp-font-mono">{detail.text}</p>
          </details>
        ) : null}
        <div className="fp-mt-3 fp-flex fp-flex-wrap fp-items-center fp-gap-x-3 fp-gap-y-2">
          {actions}
        </div>
      </div>
    </div>
  );
}
