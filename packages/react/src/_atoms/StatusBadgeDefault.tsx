import type * as React from "react";
import { type BadgeTone, DefaultBadge } from "./BadgeDefault";

/** The status badge accepts the single {@link BadgeTone}/`Tone` vocabulary. */
export type StatusBadgeTone = BadgeTone;

export interface StatusBadgeProps {
  status: string;
  tone?: StatusBadgeTone;
  className?: string;
}

const TONE_MAP: Record<string, BadgeTone> = {
  active: "ok",
  enabled: "ok",
  success: "ok",
  succeeded: "ok",
  completed: "ok",
  healthy: "ok",
  pending: "warn",
  waiting: "warn",
  warn: "warn",
  degraded: "warn",
  processing: "warn",
  failed: "err",
  error: "err",
  rejected: "err",
  disabled: "err",
  canceled: "err",
  inactive: "muted",
  draft: "muted",
  archived: "muted",
};

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultStatusBadge({ status, tone, className }: StatusBadgeProps) {
  const resolved = tone ?? TONE_MAP[status.toLowerCase()] ?? "muted";
  const extra: React.HTMLAttributes<HTMLSpanElement> = className ? { className } : {};
  return (
    <DefaultBadge tone={resolved} {...extra}>
      {status}
    </DefaultBadge>
  );
}
