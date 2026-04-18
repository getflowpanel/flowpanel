import { useCallback, useEffect, useRef, useState } from "react";

export type LiveStatus = "live" | "reconnecting" | "polling" | "paused";

export interface SseEvent {
  id: string;
  event: string;
  data: unknown;
}

interface StreamOptions {
  url: string;
  onEvent: (event: SseEvent) => void;
  fallbackPollingMs?: number;
  maxRetries?: number;
}

/**
 * SSE streaming hook with automatic reconnection and polling fallback.
 * Returns live connection status: "live" | "reconnecting" | "polling" | "paused".
 */
export function useFlowPanelStream({
  url,
  onEvent,
  fallbackPollingMs = 10_000,
  maxRetries = 3,
}: StreamOptions): { status: LiveStatus; reconnect: () => void } {
  const [status, setStatus] = useState<LiveStatus>("reconnecting");
  const esRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const lastEventIdRef = useRef<string | undefined>(undefined);
  const onEventRef = useRef(onEvent);

  // Keep onEvent ref up to date without triggering reconnect
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  const connect = useCallback(() => {
    if (typeof EventSource === "undefined") {
      setStatus("polling");
      return;
    }

    const esUrl = lastEventIdRef.current
      ? `${url}?lastEventId=${encodeURIComponent(lastEventIdRef.current)}`
      : url;

    const es = new EventSource(esUrl, { withCredentials: true });
    esRef.current = es;
    setStatus("reconnecting");

    es.onopen = () => {
      setStatus("live");
      retryCountRef.current = 0;
    };

    function handleEvent(eventName: string) {
      return (e: MessageEvent) => {
        lastEventIdRef.current = e.lastEventId;
        try {
          onEventRef.current({
            id: e.lastEventId,
            event: eventName,
            data: JSON.parse(e.data as string),
          });
        } catch {
          // Malformed JSON — ignore
        }
      };
    }

    es.addEventListener("run.created", handleEvent("run.created"));
    es.addEventListener("run.finished", handleEvent("run.finished"));
    es.addEventListener("run.failed", handleEvent("run.failed"));
    es.addEventListener("metrics.updated", handleEvent("metrics.updated"));
    // Heartbeat keeps connection alive, no payload needed
    es.addEventListener("heartbeat", () => {});

    es.onerror = () => {
      es.close();
      retryCountRef.current++;

      if (retryCountRef.current >= maxRetries) {
        setStatus("polling");
        return;
      }

      setStatus("reconnecting");
      // Exponential backoff: 1s, 2s, 4s, capped at 30s
      const delay = Math.min(1000 * 2 ** (retryCountRef.current - 1), 30_000);
      setTimeout(connect, delay);
    };
  }, [url, maxRetries]);

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

  // fallbackPollingMs is accepted for API compatibility but polling implementation
  // is left to consumers — the hook signals "polling" status so they can act on it.
  void fallbackPollingMs;

  return { status, reconnect };
}
