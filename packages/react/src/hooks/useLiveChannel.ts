"use client";
import * as React from "react";
import { useLatest } from "../lib/use-latest";
import { useApiBase } from "../provider/ApiBaseContext";
import type { RealtimeBus, RealtimeStatus } from "../realtime/context";
import { acquireEngine, peekEngineStatus, releaseEngine } from "../realtime/engine-pool";
import { useRealtimeBus } from "../realtime/hooks";

/** The same states as `RealtimeStatus`, under the name 0.3 shipped. */
export type LiveStatus = RealtimeStatus;

export interface UseLiveChannelOptions {
  /** Override the SSE endpoint. Defaults to the admin's mount point + `/stream`. */
  endpoint?: string;
  /**
   * Cap on the exponential reconnect delay when no provider is mounted.
   * When instances share a connection, the first acquirer's value wins for that connection's lifetime.
   * @defaultValue 30_000
   */
  reconnectMaxMs?: number;
  /** Set to false to pause the subscription. Default: true. */
  enabled?: boolean;
  /** Under `RealtimeProvider`, also refresh the route on each event, coalesced and held while the tab is hidden. */
  refresh?: boolean;
}

/**
 * The connection a hook joins: the admin's shared one under `RealtimeProvider`, else one shared
 * per endpoint. Either way the same engine runs the reconnects and reports the status.
 */
export function useRealtimeConnection(endpoint: string | undefined, reconnectMaxMs?: number) {
  const bus = useRealtimeBus();
  const apiBase = useApiBase();
  const own = bus === null || endpoint !== undefined;
  const url = endpoint ?? `${apiBase}/stream`;
  return React.useMemo(
    () => ({
      initialStatus: (): RealtimeStatus =>
        own ? peekEngineStatus(url) : (bus?.getStatus() ?? "idle"),
      join: (): { bus: RealtimeBus; leave: () => void } => {
        if (!own && bus) return { bus, leave: () => undefined };
        return { bus: acquireEngine(url, reconnectMaxMs), leave: () => releaseEngine(url) };
      },
    }),
    [own, url, bus, reconnectMaxMs],
  );
}

/** Subscribe to an SSE channel served by the admin's stream route and read its payloads. */
export function useLiveChannel(
  channel: string,
  onMessage: (payload: unknown) => void,
  opts: UseLiveChannelOptions = {},
): RealtimeStatus {
  const cbRef = useLatest(onMessage);
  const enabled = opts.enabled !== false && channel !== "";
  const refresh = opts.refresh === true;
  const connection = useRealtimeConnection(opts.endpoint, opts.reconnectMaxMs);
  const [status, setStatus] = React.useState<RealtimeStatus>(() =>
    enabled ? connection.initialStatus() : "idle",
  );

  React.useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    const { bus, leave } = connection.join();
    const offMessages = bus.subscribe([channel], (payload) => cbRef.current(payload), {
      refresh,
    });
    setStatus(bus.getStatus());
    const offStatus = bus.subscribeStatus(setStatus);
    return () => {
      offStatus();
      offMessages();
      leave();
      setStatus("idle");
    };
  }, [channel, enabled, refresh, connection, cbRef]);

  return status;
}
