"use client";
import * as React from "react";

import { statusForAttempt } from "../realtime/context.js";

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

type Listener = (payload: unknown) => void;

interface PoolEntry {
  source: EventSource | null;
  refs: number;
  attempt: number;
  timer: ReturnType<typeof setTimeout> | null;
  status: LiveStatus;
  /** Channel → callbacks. One entry can carry several channels on one EventSource. */
  listeners: Map<string, Set<Listener>>;
  statusListeners: Set<(s: LiveStatus) => void>;
}

// Module-level Map: client-side per-browser-tab state, not cross-request server state — I-10 (no
// cross-request global state) does not apply.
const pool = new Map<string, PoolEntry>();

function keyOf(endpoint: string, channels: string[]): string {
  return `${endpoint}\n${channels.join("|")}`;
}

function setEntryStatus(entry: PoolEntry, status: LiveStatus): void {
  if (entry.status === status) return;
  entry.status = status;
  entry.statusListeners.forEach((fn) => {
    fn(status);
  });
}

function dispatch(entry: PoolEntry, channel: string | undefined, value: unknown): void {
  const targets: Set<Listener>[] = [];
  if (channel === undefined) {
    targets.push(...entry.listeners.values());
  } else {
    const set = entry.listeners.get(channel);
    if (set) targets.push(set);
  }
  for (const set of targets) {
    for (const fn of Array.from(set)) {
      try {
        fn(value);
      } catch {
        // one listener's error must not block delivery to the others.
      }
    }
  }
}

function connectEntry(key: string, endpoint: string, channels: string[], maxMs: number): void {
  const entry = pool.get(key);
  if (!entry) return;
  const params = new URLSearchParams();
  for (const ch of channels) params.append("channel", ch);
  const es = new EventSource(`${endpoint}?${params.toString()}`);
  entry.source = es;
  setEntryStatus(entry, entry.attempt === 0 ? "connecting" : statusForAttempt(entry.attempt));

  es.onopen = () => {
    entry.attempt = 0;
    setEntryStatus(entry, "live");
  };
  es.onmessage = (ev) => {
    let channel: string | undefined;
    let value: unknown;
    try {
      const parsed = ev.data === "" ? undefined : JSON.parse(ev.data);
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof (parsed as { channel?: unknown }).channel === "string"
      ) {
        channel = (parsed as { channel: string }).channel;
        value = (parsed as { payload?: unknown }).payload;
      } else {
        value = parsed;
      }
    } catch {
      value = ev.data;
    }
    dispatch(entry, channel, value);
  };
  es.onerror = () => {
    // A superseded source firing onerror is a no-op — only entry.source drives the lifecycle.
    if (entry.source !== es) {
      es.close();
      return;
    }
    if (es.readyState !== EventSource.CLOSED) {
      setEntryStatus(entry, statusForAttempt(entry.attempt));
      return;
    }
    es.close();
    entry.source = null;
    entry.attempt += 1;
    setEntryStatus(entry, statusForAttempt(entry.attempt));
    const delay = Math.min(maxMs, 500 * 2 ** Math.min(entry.attempt, 6));
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      entry.timer = null;
      connectEntry(key, endpoint, channels, maxMs);
    }, delay);
  };
}

function acquire(
  endpoint: string,
  channels: string[],
  maxMs: number,
  onMessage: Listener,
  onStatus: (s: LiveStatus) => void,
): () => void {
  const key = keyOf(endpoint, channels);
  const existing = pool.get(key);
  const entry: PoolEntry = existing ?? {
    source: null,
    refs: 0,
    attempt: 0,
    timer: null,
    status: "idle",
    listeners: new Map(),
    statusListeners: new Set(),
  };
  if (!existing) {
    pool.set(key, entry);
    connectEntry(key, endpoint, channels, maxMs);
  }
  entry.refs += 1;
  for (const ch of channels) {
    let set = entry.listeners.get(ch);
    if (!set) {
      set = new Set();
      entry.listeners.set(ch, set);
    }
    set.add(onMessage);
  }
  entry.statusListeners.add(onStatus);
  onStatus(entry.status);

  return () => {
    for (const ch of channels) {
      const set = entry.listeners.get(ch);
      if (!set) continue;
      set.delete(onMessage);
      if (set.size === 0) entry.listeners.delete(ch);
    }
    entry.statusListeners.delete(onStatus);
    entry.refs -= 1;
    if (entry.refs <= 0) {
      entry.source?.close();
      entry.source = null;
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = null;
      pool.delete(key);
    }
  };
}

/**
 * Subscribe to one or more SSE channels through the shared pool: subscribers of the same
 * endpoint + channel set share a single multiplexed EventSource. Not part of the public API.
 */
export function acquireLiveChannels(
  endpoint: string,
  channels: string[],
  onMessage: Listener,
  onStatus: (s: LiveStatus) => void = () => undefined,
  maxMs = 30_000,
): () => void {
  const list = Array.from(new Set(channels.filter(Boolean))).sort();
  if (list.length === 0) return () => undefined;
  return acquire(endpoint, list, maxMs, onMessage, onStatus);
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
    return pool.get(keyOf(endpoint, [channel]))?.status ?? "idle";
  });

  React.useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    const handleMessage = (payload: unknown) => cbRef.current(payload);
    const release = acquire(endpoint, [channel], maxMs, handleMessage, setStatus);
    return () => {
      release();
      setStatus("idle");
    };
  }, [channel, enabled, endpoint, maxMs]);

  return status;
}
