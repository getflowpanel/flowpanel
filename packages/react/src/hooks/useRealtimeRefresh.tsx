"use client";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useRealtimeBus } from "../realtime/hooks.js";

/**
 * Widget-side realtime spec. Mirrors the public widget option:
 *
 * - `string` — single SSE channel (e.g. `"resource.orders"`).
 * - `string[]` — subscribe to every listed channel; any event triggers a
 *   single debounced refresh.
 *
 * The widget DSL types this as `string | string[]`; this alias is the
 * runtime surface (allows `undefined` so consumers can pass options
 * straight through).
 */
export type RealtimeChannels = string | string[] | undefined;

export interface UseRealtimeRefreshOptions {
  /** Debounce window, ms. Defaults to 200ms (matches DataTable). */
  debounceMs?: number;
  /** Override the SSE endpoint. Default: /api/flowpanel/stream. */
  endpoint?: string;
}

/** Stable no-op for the bus-path subscription (provider owns the refresh). */
const NOOP = (): void => undefined;

function normalizeChannels(channels: RealtimeChannels): string[] {
  if (!channels) return [];
  const arr = Array.isArray(channels) ? channels.filter(Boolean) : [channels];
  // Dedupe — passing the same channel twice (or having two widget configs
  // converge on the same key) must not open multiple EventSource instances.
  return Array.from(new Set(arr));
}

/**
 * Subscribe a widget to one or more SSE channels and call
 * `router.refresh()` on any event (debounced). Returns a `ReactNode` that
 * the caller MUST render so the underlying subscriber mounts.
 *
 * Routing:
 * - If a `<RealtimeProvider>` is mounted in the tree (default in
 *   `FlowpanelGlobals`), the hook registers against the shared bus and
 *   adds zero new `EventSource` instances. This is the production path.
 * - If no provider is found, the hook falls back to opening one
 *   `EventSource` per channel directly. Strictly a backwards-compat shim
 *   for hosts that mount widgets outside `FlowpanelGlobals`.
 *
 * @example
 * const live = useRealtimeRefresh(options.realtime);
 * return (<><MetricCard ... />{live}</>);
 */
export function useRealtimeRefresh(
  channels: RealtimeChannels,
  opts: UseRealtimeRefreshOptions = {},
): React.ReactNode {
  const router = useRouter();
  const debounceMs = opts.debounceMs ?? 200;
  const endpoint = opts.endpoint ?? "/api/flowpanel/stream";
  const bus = useRealtimeBus();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable callback held in a ref so the SSE effect doesn't re-run when
  // the parent re-renders (and hands us a new debounceMs/router identity).
  const handleRef = React.useRef<() => void>(() => undefined);
  handleRef.current = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      router.refresh();
    }, debounceMs);
  };

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // Build a stable key from the channel list. A new array literal with
  // the same channels must hash to the same key, otherwise every parent
  // re-render would tear down and reopen every EventSource.
  const list = normalizeChannels(channels);
  const key = list.join("|");

  React.useEffect(() => {
    if (key === "") return;
    const chs = key.split("|");

    // Shared-bus path. One EventSource for the whole dashboard, no matter
    // how many widgets ask for realtime. The provider owns a single
    // coalesced `router.refresh()` for all widgets, so this subscription
    // only REGISTERS the channels (no-op callback) — firing a per-widget
    // refresh here too would multiply one event into N route refreshes.
    if (bus) {
      return bus.subscribe(chs, NOOP);
    }

    // Legacy path: per-channel EventSource. Retained so widgets mounted
    // outside FlowpanelGlobals (or in older host integrations) continue
    // to receive events. Will eventually be removed once all known hosts
    // mount the provider.
    const sources: EventSource[] = [];
    for (const ch of chs) {
      const url = `${endpoint}?channel=${encodeURIComponent(ch)}`;
      const es = new EventSource(url);
      es.onmessage = () => handleRef.current();
      es.onerror = () => undefined;
      sources.push(es);
    }
    return () => {
      for (const es of sources) es.close();
    };
  }, [key, endpoint, bus]);

  if (list.length === 0) return null;
  // Render nothing — the effect above owns every subscription. `null` is a
  // valid ReactNode, so callers can still do `{useRealtimeRefresh(...)}`
  // and embed the result directly without guarding.
  return null;
}

/**
 * Client-side subscriber rendered alongside server-prerendered widget
 * content. Wraps `useRealtimeRefresh` so server components (which can't
 * call hooks themselves) can wire auto-refresh by including this element
 * as a sibling in their output.
 *
 * @example
 * // In a server component (render-widget.tsx):
 * return (
 *   <>
 *     <MetricCard {...props} />
 *     {realtime ? <RealtimeRefresh channels={realtime} /> : null}
 *   </>
 * );
 */
export function RealtimeRefresh({
  channels,
  debounceMs,
}: {
  channels: RealtimeChannels;
  debounceMs?: number;
}): React.JSX.Element {
  const node = useRealtimeRefresh(channels, debounceMs !== undefined ? { debounceMs } : {});
  return <>{node}</>;
}
