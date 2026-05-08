"use client";
import * as React from "react";

export type LiveStatus = "idle" | "connecting" | "live" | "reconnecting" | "offline";

export interface UseLiveChannelOptions {
  /** Override the SSE endpoint. Default: /api/flowpanel/stream. */
  endpoint?: string;
  /** Cap on the exponential reconnect delay. Default: 30_000. */
  reconnectMaxMs?: number;
  /** Set to false to pause the subscription. Default: true. */
  enabled?: boolean;
}

/**
 * Subscribe to an SSE channel served by @flowpanel/next stream().
 *
 * Opens one EventSource per channel; on error, reconnects with exponential
 * backoff (500ms * 2^attempt, capped by `reconnectMaxMs`). When `channel` is
 * falsy or `enabled: false`, the hook is inert and returns "idle".
 *
 * @example
 * const status = useLiveChannel("resource.users", () => router.refresh());
 */
export function useLiveChannel(
  channel: string,
  onMessage: (payload: unknown) => void,
  opts: UseLiveChannelOptions = {},
): LiveStatus {
  const [status, setStatus] = React.useState<LiveStatus>("idle");
  const cbRef = React.useRef(onMessage);
  React.useEffect(() => {
    cbRef.current = onMessage;
  }, [onMessage]);

  const enabled = opts.enabled !== false && channel !== "";

  React.useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    const endpoint = opts.endpoint ?? "/api/flowpanel/stream";
    const maxMs = opts.reconnectMaxMs ?? 30_000;
    let attempt = 0;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect(): void {
      if (cancelled) return;
      const url = `${endpoint}?channel=${encodeURIComponent(channel)}`;
      es = new EventSource(url);
      setStatus(attempt === 0 ? "connecting" : "reconnecting");

      es.onopen = () => {
        attempt = 0;
        setStatus("live");
      };
      es.onmessage = (ev) => {
        try {
          cbRef.current(ev.data === "" ? undefined : JSON.parse(ev.data));
        } catch {
          cbRef.current(ev.data);
        }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        setStatus("reconnecting");
        attempt += 1;
        const delay = Math.min(maxMs, 500 * 2 ** Math.min(attempt, 6));
        timer = setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      cancelled = true;
      es?.close();
      if (timer) clearTimeout(timer);
      setStatus("offline");
    };
  }, [channel, enabled, opts.endpoint, opts.reconnectMaxMs]);

  return status;
}
