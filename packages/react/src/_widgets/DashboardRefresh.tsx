"use client";
import { formatLabel, type ResolvedLabels } from "@flowpanel/core/labels";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useLabels } from "../_provider/LabelsContext";

/** How often the stamp re-reads the clock. Coarser than a second, which nobody watches. */
const TICK_MS = 10_000;

export interface DashboardRefreshProps {
  /** Milliseconds between refreshes, from the dashboard's `refresh` option. */
  intervalMs: number;
  /** When the server produced the numbers, as epoch milliseconds. */
  renderedAt: number;
}

function ago(labels: ResolvedLabels, elapsedMs: number): string {
  const seconds = Math.max(0, Math.round(elapsedMs / 1000));
  if (seconds < 10) return labels.widget.justNow;
  if (seconds < 60) return formatLabel(labels.widget.secondsAgo, { n: seconds });
  return formatLabel(labels.widget.minutesAgo, { n: Math.round(seconds / 60) });
}

/** Re-renders a dashboard on its configured interval and says how old the numbers are. */
export function DashboardRefresh({
  intervalMs,
  renderedAt,
}: DashboardRefreshProps): React.JSX.Element {
  const router = useRouter();
  const labels = useLabels();
  const [now, setNow] = React.useState(renderedAt);

  React.useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(tick);
  }, []);

  React.useEffect(() => {
    if (intervalMs <= 0) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, router]);

  return (
    <span className="whitespace-nowrap text-xs text-fp-text-3" aria-live="polite">
      {formatLabel(labels.widget.updated, { ago: ago(labels, now - renderedAt) })}
    </span>
  );
}
