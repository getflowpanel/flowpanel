"use client";
import * as React from "react";

/** Shared types + React context for the realtime bus. */

export type Callback = (data: unknown) => void;

/** Connection status surfaced to UI. */
export type RealtimeStatus = "idle" | "connecting" | "live" | "reconnecting" | "offline";

export type StatusListener = (status: RealtimeStatus) => void;

/** Consecutive failed attempts before a connection is reported as `offline` (~30s of backoff). */
export const OFFLINE_AFTER_ATTEMPTS = 6;

/** Status to surface while retrying: `offline` once the failures stop being plausibly transient. */
export function statusForAttempt(attempt: number): RealtimeStatus {
  return attempt >= OFFLINE_AFTER_ATTEMPTS ? "offline" : "reconnecting";
}

export interface RealtimeBus {
  /** Subscribe to one or more channels. Returns an unsubscribe. */
  subscribe(channels: string[], cb: Callback): () => void;
  /** Read current connection status (snapshot). */
  getStatus(): RealtimeStatus;
  /** Subscribe to status transitions. Returns an unsubscribe. */
  subscribeStatus(cb: StatusListener): () => void;
  /** Snapshot of channels currently carried by the open EventSource (sorted). */
  getActiveChannels(): string[];
  /** Total realtime messages received since the bus mounted. */
  getEventCount(): number;
  /** Subscribe to stats changes — fired when the active channel set changes or an event is received. */
  subscribeStats(cb: () => void): () => void;
}

export interface RealtimeProviderProps {
  /** SSE endpoint. Default: `/api/flowpanel/stream`. */
  endpoint?: string;
  /** Debounce window for reopening the EventSource after channel set changes. */
  reopenDebounceMs?: number;
  /** Debounce window for the coalesced `router.refresh()` the provider runs on incoming events. */
  refreshDebounceMs?: number;
  children: React.ReactNode;
}

export interface RealtimeStats {
  /** Channels currently carried by the open EventSource (sorted). */
  channels: string[];
  /** Total messages received since the bus mounted. */
  eventCount: number;
}

export const RealtimeContext = React.createContext<RealtimeBus | null>(null);
