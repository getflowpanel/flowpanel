---
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/react": minor
---

Widget `realtime` option now actually subscribes — previously the field was
declared on `MetricOptions`, `TableWidgetOptions`, `ChartOptionsBase`,
`PieChartOptions`, and `CustomOptions` but ignored at runtime, so a dashboard
widget like `metric("Orders", q, { realtime: "resource.orders" })` never
auto-refreshed.

- New shared hook `useRealtimeRefresh(channels)` and a client wrapper
  `<RealtimeRefresh channels={...} />` in `@flowpanel/react`. Both accept
  `string | string[]` and trigger a debounced `router.refresh()` on SSE
  events (200ms default, configurable). The wrapper lets server components
  (Metric, StatGroup, Custom, charts) opt in without becoming client-side.
- `renderWidget` in `@flowpanel/next` mounts `<RealtimeRefresh>` alongside
  every widget kind when `options.realtime` is set.
- `TableWidget` (React) gained an optional `realtime` prop, forwarded by
  `renderWidget` from `widget.options.realtime`.
- `serializeWidget` and the drawer host propagate `realtime` to widgets
  mounted inside drawer tabs.
- `StatGroupOptions` gains `realtime?: string | string[]` so every widget
  kind exposes the same option surface.
