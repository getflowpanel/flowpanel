/**
 * useLive — subscribe to a FlowPanel realtime channel (e.g. `resource.user`).
 *
 * Opens an EventSource against the tRPC stream endpoint and fires `onEvent`
 * whenever an event with a matching name arrives. Returns the live status.
 *
 * Typical usage with tanstack query:
 *
 *   const qc = useQueryClient();
 *   useLive("resource.user", () => qc.invalidateQueries({ queryKey: ["resource.list", "user"] }));
 *
 * The server opts in per-resource via `defineResource({ realtime: true })`;
 * without the flag, the mutation path never publishes. `useLive` subscribes
 * regardless — if no events ever arrive, the hook is cheap (one open SSE
 * connection shared across the app is typical).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveStatus } from "./useFlowPanelStream";

export interface LiveEvent<TData = unknown> {
  id: string;
  channel: string;
  data: TData;
}

export interface UseLiveOptions<TData = unknown> {
  /** Channel name, e.g. "resource.user" or "widget.mrr". */
  channel: string;
  /** Fired whenever an event on that channel arrives. */
  onEvent?: (event: LiveEvent<TData>) => void;
  /** Stream endpoint URL. Defaults to "/api/flowpanel/stream". */
  url?: string;
  /** Retry backoff cap before falling back to "polling" status. */
  maxRetries?: number;
}

export function useLive<TData = unknown>({
  channel,
  onEvent,
  url = "/api/flowpanel/stream",
  maxRetries = 3,
}: UseLiveOptions<TData>): { status: LiveStatus; reconnect: () => void } {
  const [status, setStatus] = useState<LiveStatus>("reconnecting");
  const esRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  });

  const connect = useCallback(() => {
    if (typeof EventSource === "undefined") {
      setStatus("polling");
      return;
    }

    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;
    setStatus("reconnecting");

    es.onopen = () => {
      setStatus("live");
      retryCountRef.current = 0;
    };

    es.addEventListener(channel, (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data as string) as TData;
        onEventRef.current?.({ id: e.lastEventId, channel, data: parsed });
      } catch {
        // Malformed JSON — ignore.
      }
    });

    es.addEventListener("heartbeat", () => {});

    es.onerror = () => {
      es.close();
      retryCountRef.current++;
      if (retryCountRef.current >= maxRetries) {
        setStatus("polling");
        return;
      }
      setStatus("reconnecting");
      const delay = Math.min(1000 * 2 ** (retryCountRef.current - 1), 30_000);
      setTimeout(connect, delay);
    };
  }, [url, channel, maxRetries]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);

  const reconnect = useCallback(() => {
    esRef.current?.close();
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  return { status, reconnect };
}
