"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn.js";
import type { RealtimeStatus } from "../realtime/context.js";
import { useRealtimeStats } from "../realtime/hooks.js";
import { formatTime, LOG_LIMIT, useStatusLog } from "./useStatusLog.js";

/** Dev-only floating panel for debugging a FlowPanel dashboard. */

const STATUS_DOT_CLASS: Record<RealtimeStatus, string> = {
  idle: "bg-fp-text-3",
  connecting: "bg-fp-text-3",
  live: "bg-fp-ok",
  reconnecting: "bg-fp-warn",
  offline: "bg-fp-text-3",
};

const STATUS_LABEL: Record<RealtimeStatus, string> = {
  idle: "Idle",
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  offline: "Offline",
};

const PULSING: ReadonlySet<RealtimeStatus> = new Set<RealtimeStatus>([
  "connecting",
  "reconnecting",
]);

function StatusDot({ status }: { status: RealtimeStatus }): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        STATUS_DOT_CLASS[status],
        PULSING.has(status) && "animate-pulse",
      )}
    />
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="border-t border-fp-border-1 px-3 py-2.5">
      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-fp-text-2">{title}</div>
      {children}
      {hint ? <div className="mt-1.5 text-[10px] text-fp-text-3">{hint}</div> : null}
    </div>
  );
}

export interface DevToolsPanelProps {
  /** Initial open state of the panel. Default `false`. */
  defaultOpen?: boolean;
}

/** Floating "fp" button (bottom-right) that toggles the DevTools panel. */
export function DevToolsPanel({
  defaultOpen = false,
}: DevToolsPanelProps): React.JSX.Element | null {
  const [open, setOpen] = React.useState(defaultOpen);
  const [mounted, setMounted] = React.useState(false);
  const { status, log } = useStatusLog();
  const { channels, eventCount } = useRealtimeStats();

  React.useEffect(() => setMounted(true), []);

  if (process.env.NODE_ENV === "production") return null;
  if (!mounted || typeof document === "undefined") return null;

  const node = (
    <div className="fixed bottom-4 right-4 z-50 font-mono text-fp-text-1">
      {open ? (
        <div
          role="dialog"
          aria-label="FlowPanel DevTools"
          className="mb-2 max-h-[70vh] w-80 overflow-auto rounded-fp border border-fp-border-1 bg-fp-bg-1 shadow-lg"
        >
          <div className="flex items-center justify-between px-3 py-2.5">
            <strong className="text-xs">FlowPanel DevTools</strong>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close DevTools"
              className="cursor-pointer border-none bg-transparent text-sm leading-none text-fp-text-2"
            >
              ×
            </button>
          </div>

          <Section title="Realtime status">
            <div className="flex items-center gap-2">
              <StatusDot status={status} />
              <span className="text-[13px]">{STATUS_LABEL[status]}</span>
            </div>
          </Section>

          <Section title="Status log" hint={`last ${LOG_LIMIT} transitions`}>
            {log.length === 0 ? (
              <div className="text-[11px] text-fp-text-3">No transitions yet.</div>
            ) : (
              <ul className="m-0 list-none p-0">
                {log.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 py-0.5 text-[11px]">
                    <span className="text-fp-text-3 tabular-nums">{formatTime(e.at)}</span>
                    <StatusDot status={e.status} />
                    <span>{STATUS_LABEL[e.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Active channels" hint={`${channels.length} on one EventSource`}>
            {channels.length === 0 ? (
              <div className="text-[11px] text-fp-text-3">No active channels.</div>
            ) : (
              <ul className="m-0 list-none p-0">
                {channels.map((ch) => (
                  <li key={ch} className="py-px text-[11px] tabular-nums">
                    {ch}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Events received" hint="since panel mounted">
            <div className="text-xl font-semibold tabular-nums">{eventCount}</div>
          </Section>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle FlowPanel DevTools"
        aria-expanded={open}
        className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-full border border-fp-border-1 bg-fp-bg-1 px-3 py-1.5 text-xs font-semibold text-fp-text-1 shadow-lg"
      >
        <StatusDot status={status} />
        fp
      </button>
    </div>
  );

  return createPortal(node, document.body);
}
