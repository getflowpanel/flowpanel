"use client";

/**
 * StatusBanner — health strip with a pulsing dot. Edit freely.
 *
 * Use it at the top of a dashboard page or CustomWidget to communicate
 * overall system state ("All systems operational", "Degraded", etc).
 */

export type StatusBannerKind = "ok" | "warn" | "error";

export interface StatusBannerProps {
  status?: StatusBannerKind;
  message: string;
}

const TONE: Record<StatusBannerKind, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  error: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
};

const DOT: Record<StatusBannerKind, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  error: "bg-red-500",
};

export function StatusBanner({ status = "ok", message }: StatusBannerProps) {
  return (
    <div
      role="status"
      className={"flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm " + TONE[status]}
    >
      <span className="relative inline-flex h-2 w-2">
        <span
          className={"absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 " + DOT[status]}
          aria-hidden
        />
        <span className={"relative inline-flex h-2 w-2 rounded-full " + DOT[status]} />
      </span>
      <span className="font-medium">{message}</span>
    </div>
  );
}
