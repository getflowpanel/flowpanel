"use client";
import * as React from "react";

import {
  type RealtimeBus,
  RealtimeContext,
  type RealtimeStats,
  type RealtimeStatus,
} from "./context.js";

/** Returns the active `RealtimeBus`, or `null` if no provider is mounted. */
export function useRealtimeBus(): RealtimeBus | null {
  return React.useContext(RealtimeContext);
}

/**
 * Subscribe to the bus's connection status. Renders a `<LiveIndicator>`
 * without each consumer wiring its own `EventSource`.
 *
 * @example
 * const status = useRealtimeStatus();
 * return <LiveIndicator status={status} />;
 */
export function useRealtimeStatus(): RealtimeStatus {
  const bus = useRealtimeBus();
  // useSyncExternalStore is the canonical way to subscribe a component to
  // an external mutable store; React handles tearing protection during
  // concurrent renders, which we'd otherwise need to reinvent.
  return React.useSyncExternalStore(
    React.useCallback(
      (onChange) => {
        if (!bus) return () => undefined;
        return bus.subscribeStatus(onChange);
      },
      [bus],
    ),
    () => bus?.getStatus() ?? "idle",
    () => "idle",
  );
}

const EMPTY_STATS: RealtimeStats = { channels: [], eventCount: 0 };

/**
 * Subscribe to bus stats (active channels + total event count). Powers the
 * DevTools panel. Returns a stable empty snapshot when no provider is
 * mounted. The returned object identity changes only when the underlying
 * values change, so consumers re-render no more than necessary.
 */
export function useRealtimeStats(): RealtimeStats {
  const bus = useRealtimeBus();
  // Cache the last snapshot so getSnapshot returns a referentially-stable
  // object until channels/eventCount actually change — required by
  // useSyncExternalStore to avoid an infinite render loop.
  const cacheRef = React.useRef<RealtimeStats>(EMPTY_STATS);
  return React.useSyncExternalStore(
    React.useCallback(
      (onChange) => {
        if (!bus) return () => undefined;
        return bus.subscribeStats(onChange);
      },
      [bus],
    ),
    () => {
      if (!bus) return EMPTY_STATS;
      const channels = bus.getActiveChannels();
      const eventCount = bus.getEventCount();
      const prev = cacheRef.current;
      if (
        prev.eventCount === eventCount &&
        prev.channels.length === channels.length &&
        prev.channels.every((c, i) => c === channels[i])
      ) {
        return prev;
      }
      const next: RealtimeStats = { channels, eventCount };
      cacheRef.current = next;
      return next;
    },
    () => EMPTY_STATS,
  );
}
