"use client";
import { cn } from "../lib/cn";
import type { RealtimeStatus } from "../realtime/context";

export interface LiveIndicatorProps {
  status: RealtimeStatus;
  className?: string;
}

const LABEL: Record<RealtimeStatus, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  offline: "Offline",
};

const DOT: Record<RealtimeStatus, string> = {
  idle: "fp-bg-faint",
  connecting: "fp-bg-faint fp-animate-pulse",
  live: "fp-bg-ok",
  reconnecting: "fp-bg-warn fp-animate-pulse",
  offline: "fp-bg-faint",
};

export function LiveIndicator({ status, className }: LiveIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={LABEL[status]}
      className={cn(
        "fp-inline-flex fp-items-center fp-gap-1.5 fp-text-xs fp-text-faint",
        className,
      )}
    >
      <span className={`fp-h-1.5 fp-w-1.5 fp-rounded-full ${DOT[status]}`} aria-hidden />
      {LABEL[status]}
    </div>
  );
}
