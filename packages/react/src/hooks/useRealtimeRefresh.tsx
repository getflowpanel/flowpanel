"use client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useApiBase } from "../_provider/ApiBaseContext";
import { useRealtimeBus } from "../realtime/hooks";
import { acquireLiveChannels } from "./useLiveChannel";

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
  const apiBase = useApiBase();
  const endpoint = opts.endpoint ?? `${apiBase}/stream`;
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

    return acquireLiveChannels(endpoint, chs, () => handleRef.current());
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
