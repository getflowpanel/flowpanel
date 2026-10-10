"use client";
import * as React from "react";

export type Callback = (data: unknown) => void;

/** Connection status surfaced to UI. */
export type RealtimeStatus = "idle" | "connecting" | "live" | "reconnecting" | "offline";

export type StatusListener = (status: RealtimeStatus) => void;

/** How long a connection keeps failing before it reads `offline` instead of `reconnecting`. */
export const OFFLINE_AFTER_MS = 30_000;

export interface SubscribeOptions {
  /**
   * Whether this subscriber's events refresh the route under a provider. A subscriber that only
   * reads payloads, as `useLiveChannel` does, passes `false`.
   * @defaultValue true
   */
  refresh?: boolean;
}

export interface RealtimeBus {
  /** Subscribe to one or more channels. Returns an unsubscribe. */
  subscribe(channels: string[], cb: Callback, options?: SubscribeOptions): () => void;
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
  /** SSE endpoint. Defaults to the admin's mount point + `/stream`. */
  endpoint?: string;
  /** Debounce window for reopening the EventSource after channel set changes.
   * @defaultValue 50
   */
  reopenDebounceMs?: number;
  /** Debounce window for the coalesced `router.refresh()` the provider runs on incoming events.
   * @defaultValue 400
   */
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
