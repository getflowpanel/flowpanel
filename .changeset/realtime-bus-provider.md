---
"@flowpanel/react": minor
"@flowpanel/next": minor
---

Realtime bus — one shared `EventSource` per dashboard.

Adds `<RealtimeProvider>` (now wrapped automatically by `FlowpanelGlobals`)
that multiplexes every descendant `useRealtimeRefresh(channels)` call onto
a single SSE connection. Channels are refcounted; the connection reopens
debounced (default 50ms) when the active channel set changes. The single
connection stays open across tab switches — with one multiplexed socket a
backgrounded tab costs one connection, well inside the browser's per-origin
budget — so switching tabs no longer triggers a reconnect.

Fixes the freeze on dashboards with several realtime widgets. Prior
behaviour opened one `EventSource` per channel per widget — a 4-card
dashboard with two channels each ate 8 of the browser's 6-connection
HTTP/1.1 budget on top of any tRPC subscription elsewhere in the app,
causing subsequent RSC navigations to stall indefinitely.

Coalesced refresh. The provider owns a single debounced `router.refresh()`
(default 400ms, `refreshDebounceMs`) shared by all widgets — a burst of
events during one scrape batch collapses to ONE route refetch instead of
one-per-widget. On the bus path `useRealtimeRefresh` only registers its
channels; the provider drives the refresh.

Reconnect catch-up. A genuine reconnect — the browser's native auto-retry
firing `onopen` again on the SAME source after a transient drop — triggers
one refresh so the dashboard reflects events published while disconnected.
This is tracked per-source, so a deliberate channel-set reopen (e.g. on
navigation) is NOT mistaken for a drop and never fires a redundant refresh.
A backgrounded tab defers its refresh and runs a single catch-up on return
(only if an event actually arrived while hidden). The realtime model
re-fetches current state, so one refresh is a complete catch-up;
individually-missed events don't matter. The first connect skips it (the
server-rendered page is already fresh).

Pass-through nesting. `RealtimeProvider` defers to an ancestor provider
when one already exists up-tree. Mount it once at a persistent layout
(so the single connection survives sub-route navigation) and the per-page
`FlowpanelGlobals` provider becomes a no-op pass-through instead of opening
a second `EventSource`.

Backwards-compatible. `useRealtimeRefresh` falls back to the legacy
per-channel `EventSource` path (with its own `debounceMs` refresh) when no
provider is mounted, so hosts that bypass `FlowpanelGlobals` keep working
unchanged. Note: `RealtimeProvider` now calls `useRouter()`, so it must be
rendered within a Next.js app-router context (always true in real apps;
tests must mock `next/navigation`).

New exports from `@flowpanel/react`:
- `RealtimeProvider` (component)
- `RealtimeProviderProps` (type)
- `RealtimeBus` (type)
- `RealtimeStatus` (type — alias-compatible with `LiveStatus`)
- `useRealtimeBus()` (hook)
- `useRealtimeStatus()` (hook — subscribe to `idle | connecting | live |
  reconnecting | offline`; wire directly into existing `<LiveIndicator>`).

`RealtimeProviderProps` gains `refreshDebounceMs`. `FlowpanelGlobals` gains
an optional `realtimeEndpoint` prop for hosts that mount the stream route
under a non-default path.

Unit tests cover single-source multiplexing, debounced reopen on
channel-set change, coalesced single refresh regardless of widget count,
reconnect catch-up (refresh on re-open, not first open), cleanup on
last-subscriber unmount, and the legacy fallback path.
