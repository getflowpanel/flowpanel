---
"@flowpanel/react": patch
---

Fix EventSource leak in `RealtimeRefresh`: SSE channels opened by
realtime-enabled widgets now close cleanly on unmount.

Symptom (radar dogfood): every `/admin` page refresh accumulated more
concurrent `/api/flowpanel/stream` connections — dev logs showed 5+
overlapping streams after a handful of reloads, saturating the Node
event loop and stretching tRPC RTT past 5s. Pages would eventually
hang waiting for a free slot.

Fix:

- `useRealtimeRefresh` now opens its `EventSource` instances inside a
  single `useEffect`, and its cleanup closes every one. Previously the
  per-channel subscriber children relied on `useLiveChannel`'s reconnect
  loop, which silently replaced the live socket on transient errors —
  so the cleanup path's `es.close()` raced against an already-nulled ref.
- Channels are deduped (`new Set(channels)`) before subscribing.
  Passing `["new-orders", "new-orders"]` no longer opens two streams.
- Effect dependency is a stable joined string key
  (`channels.join("|")`), so re-rendering a parent with a fresh
  `[a, b]` array literal does not churn subscriptions.
- `onerror` is now a no-op; the browser's built-in EventSource reconnect
  is sufficient and won't accumulate sockets.

No public API change. The widget DSL `realtime: string | string[]` and
the `<RealtimeRefresh>` server-render escape hatch behave identically
to before, just without the leak.
