"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import type { RealtimeStatus } from "../realtime/context";
import { useRealtimeStats } from "../realtime/hooks";
import { formatTime, LOG_LIMIT, useStatusLog } from "./useStatusLog";

/** Dev-only floating panel for debugging a FlowPanel dashboard. */

const STATUS_DOT_CLASS: Record<RealtimeStatus, string> = {
  idle: "fp-bg-faint",
  connecting: "fp-bg-faint",
  live: "fp-bg-ok",
  reconnecting: "fp-bg-warn",
  offline: "fp-bg-faint",
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
        "fp-inline-block fp-h-2 fp-w-2 fp-rounded-full",
        STATUS_DOT_CLASS[status],
        PULSING.has(status) && "fp-animate-pulse",
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
    <div className="fp-border-t fp-border-line fp-px-3 fp-py-2.5">
      <div className="fp-mb-1.5 fp-text-xs fp-text-soft">{title}</div>
      {children}
      {hint ? <div className="fp-mt-1.5 fp-text-[10px] fp-text-faint">{hint}</div> : null}
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
    <div
      data-flowpanel-portal=""
      className="fp-fixed fp-bottom-4 fp-right-4 fp-z-50 fp-font-mono fp-text-ink"
    >
      {open ? (
        <div
          role="dialog"
          aria-label="FlowPanel DevTools"
          className="fp-mb-2 fp-max-h-[70vh] fp-w-80 fp-overflow-auto fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-shadow-md"
        >
          <div className="fp-flex fp-items-center fp-justify-between fp-px-3 fp-py-2.5">
            <strong className="fp-text-xs">FlowPanel DevTools</strong>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close DevTools"
              className="-fp-mr-2 fp-inline-flex fp-size-11 fp-cursor-pointer fp-items-center fp-justify-center fp-border-none fp-bg-transparent fp-text-sm fp-leading-none fp-text-soft sm:fp-size-9"
            >
              ×
            </button>
          </div>

          <Section title="Realtime status">
            <div className="fp-flex fp-items-center fp-gap-2">
              <StatusDot status={status} />
              <span className="fp-text-[13px]">{STATUS_LABEL[status]}</span>
            </div>
          </Section>

          <Section title="Status log" hint={`last ${LOG_LIMIT} transitions`}>
            {log.length === 0 ? (
              <div className="fp-text-[11px] fp-text-faint">No transitions yet.</div>
            ) : (
              <ul className="fp-m-0 fp-list-none fp-p-0">
                {log.map((e) => (
                  <li
                    key={e.id}
                    className="fp-flex fp-items-center fp-gap-2 fp-py-0.5 fp-text-[11px]"
                  >
                    <span className="fp-text-faint fp-tabular-nums">{formatTime(e.at)}</span>
                    <StatusDot status={e.status} />
                    <span>{STATUS_LABEL[e.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Active channels" hint={`${channels.length} on one EventSource`}>
            {channels.length === 0 ? (
              <div className="fp-text-[11px] fp-text-faint">No active channels.</div>
            ) : (
              <ul className="fp-m-0 fp-list-none fp-p-0">
                {channels.map((ch) => (
                  <li key={ch} className="fp-py-px fp-text-[11px] fp-tabular-nums">
                    {ch}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Events received" hint="since panel mounted">
            <div className="fp-text-xl fp-font-semibold fp-tabular-nums">{eventCount}</div>
          </Section>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle FlowPanel DevTools"
        aria-expanded={open}
        className="fp-ml-auto fp-flex fp-min-h-11 fp-cursor-pointer fp-items-center fp-gap-1.5 fp-rounded-full fp-border fp-border-line fp-bg-surface fp-px-3 fp-py-1.5 fp-text-xs fp-font-semibold fp-text-ink fp-shadow-md"
      >
        <StatusDot status={status} />
        fp
      </button>
    </div>
  );

  return createPortal(node, document.body);
}
