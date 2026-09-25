import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { toneFillClass } from "../lib/tone-classes";

export type StatusTone = Tone;

export function StatusDot({ tone = "ok", className }: { tone?: Tone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2 w-2 rounded-full", toneFillClass[tone], className)}
    />
  );
}
