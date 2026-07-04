"use client";
import * as React from "react";

export type LiveStatus = "idle" | "connecting" | "live" | "reconnecting" | "offline";

export interface UseLiveChannelOptions {
  /** Override the SSE endpoint. Default: /api/flowpanel/stream. */
  endpoint?: string;
  /**
   * Cap on the exponential reconnect delay. Default: 30_000.
   * When multiple hook instances share a connection (same endpoint+channel), the first
   * acquirer's value wins for the lifetime of that shared entry; later joiners' values are ignored.
   */
  reconnectMaxMs?: number;
  /** Set to false to pause the subscription. Default: true. */
  enabled?: boolean;
}

interface PoolEntry {
  source: EventSource | null;
  refs: number;
  attempt: number;
  timer: ReturnType<typeof setTimeout> | null;
  status: LiveStatus;
  listeners: Set<(payload: unknown) => void>;
  statusListeners: Set<(s: LiveStatus) => void>;
}

// Module-level Map: client-side per-browser-tab state, not cross-request server state — I-10 (no
// cross-request global state) does not apply.
const pool = new Map<string, PoolEntry>();

function keyOf(endpoint: string, channel: string): string {
  return `${endpoint}\n${channel}`;
}

function setEntryStatus(entry: PoolEntry, status: LiveStatus): void {
  entry.status = status;
  entry.statusListeners.forEach((fn) => {
    fn(status);
  });
}

function connectEntry(key: string, endpoint: string, channel: string, maxMs: number): void {
  const entry = pool.get(key);
  if (!entry) return;
  const url = `${endpoint}?channel=${encodeURIComponent(channel)}`;
  const es = new EventSource(url);
  entry.source = es;
  setEntryStatus(entry, entry.attempt === 0 ? "connecting" : "reconnecting");

  es.onopen = () => {
    entry.attempt = 0;
    setEntryStatus(entry, "live");
  };
  es.onmessage = (ev) => {
    let value: unknown;
    try {
      const parsed = ev.data === "" ? undefined : JSON.parse(ev.data);
      value =
        parsed &&
        typeof parsed === "object" &&
        typeof (parsed as { channel?: unknown }).channel === "string"
          ? (parsed as { payload?: unknown }).payload
          : parsed;
    } catch {
      value = ev.data;
    }
    entry.listeners.forEach((fn) => {
      try {
        fn(value);
      } catch {
        // one listener's error must not block delivery to the others.
      }
    });
  };
  es.onerror = () => {
    entry.source?.close();
    entry.source = null;
    setEntryStatus(entry, "reconnecting");
    entry.attempt += 1;
    const delay = Math.min(maxMs, 500 * 2 ** Math.min(entry.attempt, 6));
    entry.timer = setTimeout(() => connectEntry(key, endpoint, channel, maxMs), delay);
  };
}

function acquire(
  endpoint: string,
  channel: string,
  maxMs: number,
  onMessage: (payload: unknown) => void,
  onStatus: (s: LiveStatus) => void,
): () => void {
  const key = keyOf(endpoint, channel);
  const existing = pool.get(key);
  const entry: PoolEntry =
    existing ??
    (() => {
      const created: PoolEntry = {
        source: null,
        refs: 0,
        attempt: 0,
        timer: null,
        status: "idle",
        listeners: new Set(),
        statusListeners: new Set(),
      };
      pool.set(key, created);
      connectEntry(key, endpoint, channel, maxMs);
      return created;
    })();
  entry.refs += 1;
  entry.listeners.add(onMessage);
  entry.statusListeners.add(onStatus);
  onStatus(entry.status);

  return () => {
    entry.listeners.delete(onMessage);
    entry.statusListeners.delete(onStatus);
    entry.refs -= 1;
    if (entry.refs <= 0) {
      entry.source?.close();
      if (entry.timer) clearTimeout(entry.timer);
      pool.delete(key);
    }
  };
}

/** Subscribe to an SSE channel served by @flowpanel/next stream(). */
export function useLiveChannel(
  channel: string,
  onMessage: (payload: unknown) => void,
  opts: UseLiveChannelOptions = {},
): LiveStatus {
  const cbRef = React.useRef(onMessage);
  React.useEffect(() => {
    cbRef.current = onMessage;
  }, [onMessage]);

  const enabled = opts.enabled !== false && channel !== "";
  const endpoint = opts.endpoint ?? "/api/flowpanel/stream";
  const maxMs = opts.reconnectMaxMs ?? 30_000;

  const [status, setStatus] = React.useState<LiveStatus>(() => {
    if (!enabled) return "idle";
    return pool.get(keyOf(endpoint, channel))?.status ?? "idle";
  });

  React.useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    const handleMessage = (payload: unknown) => cbRef.current(payload);
    const release = acquire(endpoint, channel, maxMs, handleMessage, setStatus);
    return () => {
      release();
      setStatus("offline");
    };
  }, [channel, enabled, endpoint, maxMs]);

  return status;
}
