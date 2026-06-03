"use client";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  type Callback,
  type RealtimeBus,
  RealtimeContext,
  type RealtimeProviderProps,
  type RealtimeStatus,
  type StatusListener,
} from "./context.js";

/**
 * Realtime bus provider — multiplexes many widget subscriptions onto a
 * SINGLE `EventSource` per dashboard.
 *
 * Background. Prior to this provider every widget calling
 * `useRealtimeRefresh(channels)` opened its own `EventSource` instance per
 * channel. A dashboard with 4 cards × 2 channels each ate 8 SSE slots; on
 * HTTP/1.1 the browser caps concurrent connections per origin at 6, so
 * follow-on RSC requests blocked until a slot freed. Symptom: the page
 * appears to "hang forever" after navigation.
 *
 * Contract. `subscribe(channels, cb)` registers `cb` against each channel
 * and returns an unsubscribe. Internally the provider keeps a refcount per
 * channel; whenever the active channel set changes (debounced to coalesce
 * mount/unmount bursts) it closes the prior `EventSource` and opens a new
 * one carrying ALL active channels as repeated `?channel=` query params.
 * The server-side `stream.ts` already accepts `getAll("channel")`, so this
 * is wire-compatible.
 *
 * Channel-of-origin. The current SSE wire format emits a single
 * `event: message` line without channel discrimination, so any message
 * fires every registered callback. That's fine for the `router.refresh`
 * use case — each widget debounces its own refresh.
 *
 * Types + consumer hooks live in `./context.ts` and `./hooks.ts`; this file
 * is just the EventSource lifecycle state machine.
 */

// LOC-OK: one cohesive EventSource lifecycle — openSource / scheduleReopen /
// bus / visibility + unmount effects all mutate a single `stateRef`. Splitting
// them across files would scatter tightly-coupled state, not separate concerns.
// Everything separable (types, context, consumer hooks) already lives elsewhere.

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
}

/**
 * Mounts a single shared EventSource for all descendant
 * `useRealtimeRefresh(...)` calls. Defers to an ancestor provider when one
 * already exists up-tree (so a host can mount the bus once at the layout
 * level — surviving sub-route navigation — and the per-page
 * `FlowpanelGlobals` provider becomes a no-op pass-through rather than
 * opening a second EventSource).
 *
 * @example
 * <RealtimeProvider>
 *   <DashboardShell>...</DashboardShell>
 * </RealtimeProvider>
 *
 * In Next: typically mounted by `FlowpanelGlobals`, no manual setup
 * required by hosts of `<Flowpanel config />`.
 */
export function RealtimeProvider(props: RealtimeProviderProps): React.JSX.Element {
  const parent = React.useContext(RealtimeContext);
  // A bus already exists above us — reuse it. Single connection, single
  // bus identity shared by widgets and tools (e.g. DevTools panel).
  if (parent) return <>{props.children}</>;
  return <RealtimeProviderInner {...props} />;
}

function RealtimeProviderInner({
  endpoint = "/api/flowpanel/stream",
  reopenDebounceMs = 50,
  refreshDebounceMs = 400,
  children,
}: RealtimeProviderProps): React.JSX.Element {
  const router = useRouter();
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
    };
  }

  // Coalesced route refresh. ALL widgets share this one debounced
  // `router.refresh()` — a burst of events during a single scrape batch
  // collapses to one RSC refetch instead of one-per-widget. Held in a ref
  // so the SSE effect closures stay stable across renders.
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

  // Fan out a stats change (channel set or event count) to DevTools
  // subscribers. Kept separate from status so a chatty event stream
  // doesn't churn status consumers.
  const notifyStats = React.useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    for (const listener of state.statsListeners) {
      try {
        listener();
      } catch {
        // listeners must not break the bus
      }
    }
  }, []);

  // Centralised status setter — fans out to every listener and is a no-op
  // when status hasn't actually changed (avoids spurious re-renders on
  // subscribers that read status via `useSyncExternalStore`).
  const setStatus = React.useCallback((next: RealtimeStatus) => {
    const state = stateRef.current;
    if (!state) return;
    if (state.status === next) return;
    state.status = next;
    for (const listener of state.statusListeners) {
      try {
        listener(next);
      } catch {
        // listeners must not break the bus
      }
    }
  }, []);

  // Open or recreate the EventSource to match the current channel set.
  // Idempotent: bails when the active source already matches the desired
  // signature, so React StrictMode double-invokes don't churn the socket.
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
    const url = `${endpoint}?${params.toString()}`;

    setStatus("connecting");
    const es = new EventSource(url);
    state.source = es;
    state.activeSig = sig;
    notifyStats(); // channel set changed

    // Per-source flag. The browser's native auto-reconnect after a transient
    // drop fires `onopen` AGAIN on this SAME source — that's a genuine
    // catch-up, so we refetch current state once. The FIRST open of a source
    // is never a catch-up: it's either the initial load or a deliberate
    // channel-set reopen, and in both cases the page is already fresh. Held
    // per-source (not on shared state) so a channel-set reopen — which builds
    // a brand-new source — never inherits a stale "already connected" bit and
    // fires a redundant refresh.
    let openedBefore = false;
    es.onopen = () => {
      setStatus("live");
      if (!openedBefore) {
        openedBefore = true;
        return;
      }
      // A second open on the same source = browser auto-reconnect → catch up,
      // but defer while backgrounded (mirrors onmessage) so a background
      // reconnect never refreshes a hidden tab.
      if (state.isHidden) state.pendingWhileHidden = true;
      else scheduleRefresh();
    };
    es.onmessage = (ev) => {
      setStatus("live");
      state.eventCount += 1;
      let payload: unknown;
      try {
        payload = ev.data ? JSON.parse(ev.data as string) : undefined;
      } catch {
        payload = undefined;
      }
      // Snapshot to avoid mid-iteration mutation if a callback unsubscribes.
      // Per-subscriber callbacks are typically no-ops now (the provider owns
      // the coalesced refresh below); they remain for any consumer that
      // wants the raw payload.
      const allCallbacks: Callback[] = [];
      for (const set of state.callbacks.values()) {
        for (const cb of set) allCallbacks.push(cb);
      }
      for (const cb of allCallbacks) {
        try {
          cb(payload);
        } catch {
          // Subscriber threw — swallow so other callbacks still fire.
        }
      }
      // One coalesced route refresh for all widgets — but only while the tab
      // is visible. A backgrounded tab defers; on return we fire a single
      // catch-up refresh (see the visibility effect) so we never burn an RSC
      // refetch on a dashboard nobody is looking at.
      if (state.isHidden) state.pendingWhileHidden = true;
      else scheduleRefresh();
      notifyStats(); // event count bumped
    };

    // The browser auto-reconnects on transient errors (readyState CONNECTING);
    // we surface "reconnecting" so users see the heartbeat blip. A CLOSED
    // socket means the browser has GIVEN UP (e.g. the endpoint returned a
    // non-2xx) — surface that as "offline" rather than a perpetual reconnect.
    es.onerror = () => {
      setStatus(es.readyState === EventSource.CLOSED ? "offline" : "reconnecting");
    };
  }, [endpoint, setStatus, notifyStats, scheduleRefresh]);

  // Schedule a reopen on the next debounce tick. Multiple subscribe /
  // unsubscribe calls in the same React commit collapse to one reopen.
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

  // Stable bus identity for the whole provider lifetime — context consumers
  // compare by reference, so a fresh object on every render would invalidate
  // every subscriber's effect.
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

  // Keep the single multiplexed EventSource OPEN across tab switches. With one
  // shared connection a backgrounded tab costs exactly one socket — far inside
  // the browser's per-origin budget — so the old close-on-hidden / reopen-on-
  // show dance bought nothing and cost a reconnect (plus a catch-up refresh)
  // every time the user glanced at another tab. Instead we just track
  // visibility and defer refreshes: on return, fire ONE catch-up refresh iff an
  // event landed while we were away.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    // Seed from the CURRENT visibility — the provider can mount in a tab that
    // is already backgrounded (cmd-click into a new tab, a restored session),
    // and no visibilitychange fires after such a mount.
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

  // Unmount cleanup. Required so unmounting the provider (e.g. route
  // change away from /admin) actually closes the live socket.
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
