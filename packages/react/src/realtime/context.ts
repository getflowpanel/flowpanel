"use client";
import * as React from "react";

/**
 * Shared types + React context for the realtime bus. Split out from
 * `RealtimeProvider.tsx` (the EventSource state machine) and `hooks.ts`
 * (the consumer hooks) so both can depend on the contract without a
 * circular import, and so the provider file stays focused on the one
 * cohesive lifecycle it owns.
 */

export type Callback = (data: unknown) => void;

/**
 * Connection status surfaced to UI. Matches `LiveStatus` from
 * `useLiveChannel` so existing `<LiveIndicator>` consumers can render
 * the bus state without translation.
 *
 * - `idle` — no widget has subscribed yet (no channels).
 * - `connecting` — EventSource is opening.
 * - `live` — EventSource is open and receiving events.
 * - `reconnecting` — EventSource errored; the browser is auto-retrying.
 * - `offline` — the EventSource closed and the browser is NOT retrying
 *   (permanent failure, e.g. the endpoint returned a non-2xx). The bus stays
 *   `live` across tab switches — it keeps the single connection open when
 *   hidden — so backgrounding never produces this; only a dead socket does.
 */
export type RealtimeStatus = "idle" | "connecting" | "live" | "reconnecting" | "offline";

export type StatusListener = (status: RealtimeStatus) => void;

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
  /**
   * Subscribe to stats changes — fired when the active channel set changes
   * or an event is received. Powers the DevTools panel; not needed for
   * normal widget refresh. Returns an unsubscribe.
   */
  subscribeStats(cb: () => void): () => void;
}

export interface RealtimeProviderProps {
  /** SSE endpoint. Default: `/api/flowpanel/stream`. */
  endpoint?: string;
  /**
   * Debounce window for reopening the EventSource after channel set
   * changes. Coalesces React mount bursts (especially StrictMode's
   * double-mount in dev) into a single connection. Default 50ms.
   */
  reopenDebounceMs?: number;
  /**
   * Debounce window for the coalesced `router.refresh()` the provider runs
   * on incoming events. ALL widgets share this single refresh instead of
   * each firing its own — a burst of events during one scrape batch
   * collapses to one route refresh. Larger = fewer refreshes under load,
   * slightly staler UI. Default 400ms.
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
