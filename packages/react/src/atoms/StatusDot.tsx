import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { toneFillClass } from "../lib/tone-classes";

export type StatusTone = Tone;

export function StatusDot({ tone = "ok", className }: { tone?: Tone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "fp-inline-block fp-h-2 fp-w-2 fp-rounded-full",
        toneFillClass[tone],
        className,
      )}
    />
  );
}
