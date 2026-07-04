"use client";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useRealtimeBus } from "../realtime/hooks.js";

/** Widget-side realtime spec. */
export type RealtimeChannels = string | string[] | undefined;

export interface UseRealtimeRefreshOptions {
  /** Debounce window, ms. Defaults to 200ms (matches DataTable). Only applies in standalone mode (no RealtimeProvider ancestor); under a provider, the provider's refreshDebounceMs governs the refresh. */
  debounceMs?: number;
  /** Override the SSE endpoint. Default: /api/flowpanel/stream. Only applies in standalone mode (no RealtimeProvider ancestor); under a provider, the provider owns the endpoint. */
  endpoint?: string;
}

/** Stable no-op for the bus-path subscription (provider owns the refresh). */
const NOOP = (): void => undefined;

function normalizeChannels(channels: RealtimeChannels): string[] {
  if (!channels) return [];
  const arr = Array.isArray(channels) ? channels.filter(Boolean) : [channels];
  return Array.from(new Set(arr));
}

export function useRealtimeRefresh(
  channels: RealtimeChannels,
  opts: UseRealtimeRefreshOptions = {},
): React.ReactNode {
  const router = useRouter();
  const debounceMs = opts.debounceMs ?? 200;
  const endpoint = opts.endpoint ?? "/api/flowpanel/stream";
  const bus = useRealtimeBus();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const list = normalizeChannels(channels);
  const key = list.join("|");

  React.useEffect(() => {
    if (key === "") return;
    const chs = key.split("|");

    if (bus) {
      return bus.subscribe(chs, NOOP);
    }

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

  return null;
}

/** Client-side subscriber rendered alongside server-prerendered widget content. */
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
