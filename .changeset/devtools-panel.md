---
"@flowpanel/react": minor
---

DevTools panel + realtime stats introspection.

Adds `<DevToolsPanel>` — a dev-only floating panel (renders `null` under
`NODE_ENV=production`) that surfaces the live state of the shared realtime
bus: current connection status, a rolling log of the last 50 status
transitions, the set of active channels carried by the single
`EventSource`, and a running event count. Mounts via `createPortal` into
`document.body` with inline styles, so a host can drop `<DevToolsPanel />`
anywhere without depending on the admin shell or Tailwind scope. Built to
debug exactly the realtime-freeze class of bug the shared bus exists to
prevent.

To power it, `RealtimeBus` gains three read methods —
`getActiveChannels()`, `getEventCount()`, `subscribeStats(cb)` — and a new
`useRealtimeStats()` hook returns `{ channels, eventCount }` via
`useSyncExternalStore` with a referentially-stable snapshot.

New exports from `@flowpanel/react`:
- `DevToolsPanel`, `DevToolsPanelProps` (type)
- `useRealtimeStats`, `RealtimeStats` (type)
- `RealtimeBus` gains `getActiveChannels` / `getEventCount` /
  `subscribeStats` (additive — interface widening, minor).
