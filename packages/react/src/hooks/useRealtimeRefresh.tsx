"use client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useLatest } from "../lib/use-latest";
import { useRealtimeBus } from "../realtime/hooks";
import { useRealtimeConnection } from "./useLiveChannel";

/** Widget-side realtime spec. */
export type RealtimeChannels = string | string[] | undefined;

export interface UseRealtimeRefreshOptions {
  /** Debounce window in standalone mode (no RealtimeProvider ancestor). Under a provider, the provider's refreshDebounceMs governs refreshes.
   * @defaultValue 200
   */
  debounceMs?: number;
  /** Override the SSE endpoint. Only applies in standalone mode; under a provider, the provider owns it. */
  endpoint?: string;
}

/** Stable no-op for the provider path, where the provider runs the refresh. */
const NOOP = (): void => undefined;

function normalizeChannels(channels: RealtimeChannels): string[] {
  if (!channels) return [];
  const arr = Array.isArray(channels) ? channels.filter(Boolean) : [channels];
  return Array.from(new Set(arr));
}

/** Refreshes the route when any of `channels` publishes. */
export function useRealtimeRefresh(
  channels: RealtimeChannels,
  opts: UseRealtimeRefreshOptions = {},
): React.ReactNode {
  const router = useRouter();
  const debounceMs = opts.debounceMs ?? 200;
  const provided = useRealtimeBus() !== null;
  const connection = useRealtimeConnection(provided ? undefined : opts.endpoint);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useLatest(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => router.refresh(), debounceMs);
  });

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const key = normalizeChannels(channels).join("|");

  React.useEffect(() => {
    if (key === "") return;
    const { bus, leave } = connection.join();
    const off = bus.subscribe(key.split("|"), provided ? NOOP : () => refreshRef.current());
    return () => {
      off();
      leave();
    };
  }, [key, connection, provided, refreshRef]);

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
