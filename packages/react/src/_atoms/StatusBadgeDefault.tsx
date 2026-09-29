import { cn } from "../lib/cn";
import { type BadgeTone, DefaultBadge } from "./BadgeDefault";

/** The status badge accepts the single {@link BadgeTone}/`Tone` vocabulary. */
export type StatusBadgeTone = BadgeTone;

export interface StatusBadgeProps {
  status: string;
  /** Text shown instead of `status`; the tone is still inferred from `status`. */
  label?: string;
  tone?: StatusBadgeTone;
  className?: string;
}

const TONE_MAP: Record<string, BadgeTone> = {
  pending: "info",
  waiting: "info",
  processing: "info",
  running: "info",
  warn: "warn",
  degraded: "warn",
  failed: "err",
  error: "err",
  rejected: "err",
  disabled: "muted",
  canceled: "muted",
  inactive: "muted",
  draft: "muted",
  archived: "muted",
};

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultStatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const resolved = tone ?? TONE_MAP[status.toLowerCase()] ?? "default";
  const compactClassName = cn("px-1.5 py-px text-xs leading-4", className);
  return (
    <DefaultBadge tone={resolved} className={compactClassName}>
      {label ?? status}
    </DefaultBadge>
  );
}
