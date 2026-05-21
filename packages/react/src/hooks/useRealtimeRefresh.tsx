"use client";
import { useRouter } from "next/navigation";
import * as React from "react";

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
 * Implementation note: a single `useEffect` opens one `EventSource` per
 * (deduped) channel and the cleanup closes every one. The dependency key
 * is a stable joined string rather than the raw array — a fresh
 * `[a, b]` literal each render must NOT churn subscriptions.
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
    const sources: EventSource[] = [];
    for (const ch of chs) {
      const url = `${endpoint}?channel=${encodeURIComponent(ch)}`;
      const es = new EventSource(url);
      es.onmessage = () => handleRef.current();
      // Let the browser handle auto-reconnect on transient errors instead
      // of tearing down and recreating EventSource ourselves; recreating
      // here is what produced the connection leak in the first place.
      es.onerror = () => {
        // intentionally empty — browser-level retry handles it.
      };
      sources.push(es);
    }
    return () => {
      for (const es of sources) es.close();
    };
    // `key` is a stable joined string; `endpoint` is captured by closure
    // but is also stable across renders for any real caller.
  }, [key, endpoint]);

  if (list.length === 0) return null;
  // Render nothing — the effect above owns every subscription. We still
  // return a fragment so callers can do `{useRealtimeRefresh(...)}` and
  // get a renderable node back rather than `null` they'd have to guard.
  return <></>;
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
