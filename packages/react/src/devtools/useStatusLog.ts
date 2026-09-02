"use client";
import * as React from "react";
import type { RealtimeStatus } from "../realtime/context";
import { useRealtimeBus } from "../realtime/hooks";

/** Max number of status transitions retained in the rolling log. */
export const LOG_LIMIT = 50;

export interface LogEntry {
  /** Monotonic id for stable React keys (timestamps can collide). */
  id: number;
  status: RealtimeStatus;
  /** Wall-clock time of the transition. */
  at: number;
}

/** Subscribes to the realtime bus status and keeps a bounded ring of transitions. */
export function useStatusLog(): { status: RealtimeStatus; log: LogEntry[] } {
  const bus = useRealtimeBus();
  const [status, setStatus] = React.useState<RealtimeStatus>(() => bus?.getStatus() ?? "idle");
  const [log, setLog] = React.useState<LogEntry[]>([]);
  const idRef = React.useRef(0);

  React.useEffect(() => {
    if (!bus) return;
    const initial = bus.getStatus();
    setStatus(initial);
    setLog([{ id: idRef.current++, status: initial, at: Date.now() }]);

    return bus.subscribeStatus((next) => {
      setStatus(next);
      setLog((prev) => {
        const entry: LogEntry = {
          id: idRef.current++,
          status: next,
          at: Date.now(),
        };
        const appended = [...prev, entry];
        return appended.length > LOG_LIMIT ? appended.slice(appended.length - LOG_LIMIT) : appended;
      });
    });
  }, [bus]);

  const ordered = React.useMemo(() => [...log].reverse(), [log]);
  return { status, log: ordered };
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const mmm = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${mmm}`;
}
