"use client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useLiveChannel } from "../hooks/useLiveChannel";
import type { RealtimeStatus } from "../realtime/context";

/** A list's live channel: refreshes the route on its events and reports the connection's state. */
export function useTableLive(
  realtime: string | { channel: string; debounceMs?: number } | undefined,
): { configured: boolean; status: RealtimeStatus } {
  const router = useRouter();
  const config = typeof realtime === "string" ? { channel: realtime } : realtime;
  const channel = config?.channel ?? "";
  const debounceMs = config?.debounceMs ?? 200;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEvent = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), debounceMs);
  }, [router, debounceMs]);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const status = useLiveChannel(channel, onEvent);
  return { configured: config !== undefined, status };
}
