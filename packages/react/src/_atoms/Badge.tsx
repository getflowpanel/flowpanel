import type * as React from "react";
import { cn } from "../lib/cn.js";

export type BadgeTone = "default" | "accent" | "ok" | "warn" | "err" | "muted";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  default: "bg-fp-bg-2 text-fp-text-1 border-fp-border-1",
  accent: "bg-fp-accent/10 text-fp-accent border-fp-accent/30",
  ok: "bg-fp-ok/10 text-fp-ok border-fp-ok/30",
  warn: "bg-fp-warn/10 text-fp-warn border-fp-warn/30",
  err: "bg-fp-err/10 text-fp-err border-fp-err/30",
  muted: "bg-fp-bg-2 text-fp-text-3 border-fp-border-1",
};

export function Badge({ tone = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-fp-sm border px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
