"use client";
import type { LiveStatus } from "../hooks/useLiveChannel.js";

export interface LiveIndicatorProps {
  status: LiveStatus;
  className?: string;
}

const LABEL: Record<LiveStatus, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  offline: "Offline",
};

const DOT: Record<LiveStatus, string> = {
  idle: "bg-fp-text-3",
  connecting: "bg-fp-text-3 animate-pulse",
  live: "bg-green-500",
  reconnecting: "bg-yellow-500 animate-pulse",
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
