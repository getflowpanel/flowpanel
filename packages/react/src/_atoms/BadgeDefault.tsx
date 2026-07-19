import type * as React from "react";
import { cn } from "../lib/cn.js";
import type { Tone } from "../lib/format.js";

/** Alias of the single {@link Tone} vocabulary — every badge tone is a `Tone`. */
export type BadgeTone = Tone;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  default: "bg-fp-bg-3/50 text-fp-text-2 border-fp-border-1",
  accent: "bg-fp-accent/10 text-fp-accent-badge-text border-fp-accent/25",
  ok: "bg-fp-ok/10 text-fp-ok-text border-fp-ok/25",
  warn: "bg-fp-warn/10 text-fp-warn-text border-fp-warn/25",
  err: "bg-fp-err/10 text-fp-err-text border-fp-err/25",
  info: "bg-fp-info/10 text-fp-info-text border-fp-info/25",
  muted: "bg-fp-bg-3/50 text-fp-text-3 border-fp-border-1",
};

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultBadge({ tone = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
