"use client";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useApiBase } from "../_provider/ApiBaseContext";
import { backoffDelay, DEFAULT_RECONNECT_MAX_MS } from "./backoff";
import {
  type Callback,
  type RealtimeBus,
  RealtimeContext,
  type RealtimeProviderProps,
  type RealtimeStatus,
  type StatusListener,
  statusForAttempt,
} from "./context";
import { readFrame } from "./frame";

// LOC-OK: one cohesive EventSource lifecycle.

interface BusState {
  /** Channel → number of active subscribers. */
  counts: Map<string, number>;
  /** Channel → set of callbacks (snapshot for dispatch). */
  callbacks: Map<string, Set<Callback>>;
  /** Currently open EventSource (or null). */
  source: EventSource | null;
  /** Channel signature matching the open source — `"a|b|c"` sorted. */
  activeSig: string;
  /** Pending reopen scheduled via setTimeout. */
  reopenTimer: ReturnType<typeof setTimeout> | null;
  /** Last known document visibility — gates refresh while backgrounded. */
  isHidden: boolean;
  /** Connection status (latest). */
  status: RealtimeStatus;
  /** Set of UI subscribers for status transitions. */
  statusListeners: Set<StatusListener>;
  /** Total messages received since mount — surfaced in DevTools. */
  eventCount: number;
  /** Set of subscribers for stats (channel-set / event-count) changes. */
  statsListeners: Set<() => void>;
  /** Pending coalesced `router.refresh()` timer. */
  refreshTimer: ReturnType<typeof setTimeout> | null;
  /** An event arrived while the tab was hidden — refresh once on return. */
  pendingWhileHidden: boolean;
  /** Consecutive reconnect attempts since the last successful open. */
  attempt: number;
  /** Pending reconnect scheduled via setTimeout after a CLOSED socket. */
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

/** Mounts a single shared EventSource for all descendant `useRealtimeRefresh(...)` calls. */
export function RealtimeProvider(props: RealtimeProviderProps): React.JSX.Element {
  const parent = React.useContext(RealtimeContext);
  if (parent) return <>{props.children}</>;
  return <RealtimeProviderInner {...props} />;
}

function RealtimeProviderInner({
  endpoint,
  reopenDebounceMs = 50,
  refreshDebounceMs = 400,
  children,
}: RealtimeProviderProps): React.JSX.Element {
  const router = useRouter();
  const apiBase = useApiBase();
  const streamUrl = endpoint ?? `${apiBase}/stream`;
  const stateRef = React.useRef<BusState | null>(null);
  if (stateRef.current === null) {
    stateRef.current = {
      counts: new Map(),
      callbacks: new Map(),
      source: null,
      activeSig: "",
      reopenTimer: null,
      isHidden: false,
      status: "idle",
      statusListeners: new Set(),
      eventCount: 0,
      statsListeners: new Set(),
      refreshTimer: null,
      pendingWhileHidden: false,
      attempt: 0,
      reconnectTimer: null,
    };
  }

  const scheduleRefresh = React.useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    if (state.refreshTimer) clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(() => {
      const s = stateRef.current;
      if (!s) return;
      s.refreshTimer = null;
      router.refresh();
    }, refreshDebounceMs);
  }, [router, refreshDebounceMs]);

  const notifyStats = React.useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    for (const listener of state.statsListeners) {
      try {
        listener();
      } catch {}
    }
  }, []);

  const setStatus = React.useCallback((next: RealtimeStatus) => {
    const state = stateRef.current;
    if (!state) return;
    if (state.status === next) return;
    state.status = next;
    for (const listener of state.statusListeners) {
      try {
        listener(next);
      } catch {}
    }
  }, []);

  const openSource = React.useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    if (typeof window === "undefined") return;

    const channels = Array.from(state.counts.keys()).sort();
    const sig = channels.join("|");

    if (state.source && state.activeSig === sig) return;

    if (state.source) {
      state.source.close();
      state.source = null;
    }

    if (channels.length === 0) {
      state.activeSig = "";
      setStatus("idle");
      notifyStats();
      return;
    }

    const params = new URLSearchParams();
    for (const ch of channels) params.append("channel", ch);
    const url = `${streamUrl}?${params.toString()}`;

    setStatus(state.attempt === 0 ? "connecting" : statusForAttempt(state.attempt));
    const es = new EventSource(url);
    state.source = es;
    state.activeSig = sig;
    notifyStats(); // channel set changed

    let openedBefore = false;
    es.onopen = () => {
      state.attempt = 0;
      setStatus("live");
      if (!openedBefore) {
        openedBefore = true;
        return;
      }
      if (state.isHidden) state.pendingWhileHidden = true;
      else scheduleRefresh();
    };
    es.onmessage = (ev) => {
      setStatus("live");
      state.eventCount += 1;
      const frame = readFrame(ev.data);
      if (!frame) {
        notifyStats();
        return;
      }
      const { channel, payload } = frame;
      const set = state.callbacks.get(channel);
      if (set) {
        for (const cb of Array.from(set)) {
          try {
            cb(payload);
          } catch {}
        }
      }
      if (state.isHidden) state.pendingWhileHidden = true;
      else scheduleRefresh();
      notifyStats(); // event count bumped
    };

    es.onerror = () => {
      // A stale source (superseded by a newer open()) firing onerror is a full
      // no-op: don't touch status, attempt count, or the timer — only state.source drives it.
      if (state.source !== es) {
        es.close();
        return;
      }
      if (es.readyState !== EventSource.CLOSED) {
        setStatus(statusForAttempt(state.attempt));
        return;
      }
      es.close();
      state.source = null;
      state.activeSig = "";
      const delay = backoffDelay(state.attempt, DEFAULT_RECONNECT_MAX_MS);
      state.attempt += 1;
      setStatus(statusForAttempt(state.attempt));
      if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
      state.reconnectTimer = setTimeout(() => {
        state.reconnectTimer = null;
        openSource();
      }, delay);
    };
  }, [streamUrl, setStatus, notifyStats, scheduleRefresh]);

  const scheduleReopen = React.useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    if (state.reopenTimer) clearTimeout(state.reopenTimer);
    state.reopenTimer = setTimeout(() => {
      const s = stateRef.current;
      if (!s) return;
      s.reopenTimer = null;
      openSource();
    }, reopenDebounceMs);
  }, [openSource, reopenDebounceMs]);

  const bus = React.useMemo<RealtimeBus>(
    () => ({
      getStatus() {
        return stateRef.current?.status ?? "idle";
      },
      subscribeStatus(cb) {
        const state = stateRef.current;
        if (!state) return () => undefined;
        state.statusListeners.add(cb);
        return () => {
          state.statusListeners.delete(cb);
        };
      },
      getActiveChannels() {
        const state = stateRef.current;
        if (!state) return [];
        return Array.from(state.counts.keys()).sort();
      },
      getEventCount() {
        return stateRef.current?.eventCount ?? 0;
      },
      subscribeStats(cb) {
        const state = stateRef.current;
        if (!state) return () => undefined;
        state.statsListeners.add(cb);
        return () => {
          state.statsListeners.delete(cb);
        };
      },
      subscribe(channels, cb) {
        const state = stateRef.current;
        if (!state) return () => undefined;
        const list = Array.from(new Set(channels.filter(Boolean)));
        if (list.length === 0) return () => undefined;

        for (const ch of list) {
          state.counts.set(ch, (state.counts.get(ch) ?? 0) + 1);
          let set = state.callbacks.get(ch);
          if (!set) {
            set = new Set();
            state.callbacks.set(ch, set);
          }
          set.add(cb);
        }
        scheduleReopen();

        return () => {
          const s = stateRef.current;
          if (!s) return;
          for (const ch of list) {
            const count = s.counts.get(ch) ?? 0;
            if (count <= 1) s.counts.delete(ch);
            else s.counts.set(ch, count - 1);
            const set = s.callbacks.get(ch);
            if (set) {
              set.delete(cb);
              if (set.size === 0) s.callbacks.delete(ch);
            }
          }
          scheduleReopen();
        };
      },
    }),
    [scheduleReopen],
  );

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const seed = stateRef.current;
    if (seed) seed.isHidden = document.visibilityState === "hidden";
    const onVisibility = () => {
      const state = stateRef.current;
      if (!state) return;
      const hidden = document.visibilityState === "hidden";
      state.isHidden = hidden;
      if (!hidden && state.pendingWhileHidden) {
        state.pendingWhileHidden = false;
        scheduleRefresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [scheduleRefresh]);

  React.useEffect(() => {
    return () => {
      const state = stateRef.current;
      if (!state) return;
      if (state.reopenTimer) {
        clearTimeout(state.reopenTimer);
        state.reopenTimer = null;
      }
      if (state.refreshTimer) {
        clearTimeout(state.refreshTimer);
        state.refreshTimer = null;
      }
      if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer);
        state.reconnectTimer = null;
      }
      if (state.source) {
        state.source.close();
        state.source = null;
      }
      state.activeSig = "";
      state.counts.clear();
      state.callbacks.clear();
      state.statusListeners.clear();
      state.statsListeners.clear();
    };
  }, []);

  return <RealtimeContext.Provider value={bus}>{children}</RealtimeContext.Provider>;
}
