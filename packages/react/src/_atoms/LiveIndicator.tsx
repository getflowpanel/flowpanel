"use client";
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
  idle: "bg-fp-text-3",
  connecting: "bg-fp-text-3 animate-pulse",
  live: "bg-fp-ok",
  reconnecting: "bg-fp-warn animate-pulse",
  offline: "bg-fp-text-3",
};

export function LiveIndicator({ status, className }: LiveIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={LABEL[status]}
      className={`inline-flex items-center gap-1.5 text-xs text-fp-text-3 ${className ?? ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} aria-hidden />
      {LABEL[status]}
    </div>
  );
}
