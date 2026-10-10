import type * as React from "react";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";

/** Alias of the single {@link Tone} vocabulary — every badge tone is a `Tone`. */
export type BadgeTone = Tone;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  default: "fp-bg-fill/50 fp-text-soft fp-border-line",
  accent: "fp-bg-accent/10 fp-text-accent-ink fp-border-accent/25",
  ok: "fp-bg-ok/10 fp-text-ok-ink fp-border-ok/25",
  warn: "fp-bg-warn/10 fp-text-warn-ink fp-border-warn/25",
  err: "fp-bg-err/10 fp-text-err-ink fp-border-err/25",
  info: "fp-bg-info/10 fp-text-info-ink fp-border-info/25",
  muted: "fp-bg-fill/50 fp-text-faint fp-border-line",
};

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultBadge({ tone = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "fp-inline-flex fp-items-center fp-gap-1 fp-rounded-sm fp-border fp-px-2 fp-py-0.5 fp-text-xs fp-font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
