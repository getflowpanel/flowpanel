import type * as React from "react";
import { Badge, type BadgeTone } from "./Badge.js";

/**
 * Logical status tone resolved from a raw status string. `info` is additive
 * relative to StatusDot's 4-tone palette — maps to Badge's `muted` tone.
 */
export type StatusBadgeTone = "ok" | "warn" | "err" | "info" | "muted";

export interface StatusBadgeProps {
  status: string;
  tone?: StatusBadgeTone;
  className?: string;
}

const TONE_MAP: Record<string, StatusBadgeTone> = {
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

const TONE_BADGE: Record<StatusBadgeTone, BadgeTone> = {
  ok: "ok",
  warn: "warn",
  err: "err",
  info: "muted",
  muted: "muted",
};

export function StatusBadge({ status, tone, className }: StatusBadgeProps) {
  const resolved = tone ?? TONE_MAP[status.toLowerCase()] ?? "muted";
  const extra: React.HTMLAttributes<HTMLSpanElement> = className ? { className } : {};
  return (
    <Badge tone={TONE_BADGE[resolved]} {...extra}>
      {status}
    </Badge>
  );
}
