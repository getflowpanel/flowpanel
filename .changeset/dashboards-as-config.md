---
"@flowpanel/core": minor
"@flowpanel/react": minor
"@flowpanel/next": patch
"@flowpanel/charts": minor
---

A founder dashboard is now configuration. Five new builders cover what used to
need a `custom()` widget and a React file: `stat()` for one number with a hint,
`kv()` for the facts about one thing, `bars()` for a ranked breakdown, `funnel()`
for stages, and `list()` for a short feed. Each takes counts and labels only —
the card sizes its own bars, derives each funnel step's share of the first step
and its drop-off from the one before, formats values through the admin's
`formatting`, and marks a `tone` on the item it belongs to. A `metric()` query
may now return a `MetricResult` instead of a bare value, so the tone, sublabel,
delta and drilldown a number implies travel with it; the static options remain
the fallbacks. `MetricDelta.goodWhen: "down"` reads a fall as the good news, for
churn, cost and latency.

`table()` finally honours what it declared. `columns` accepts a `WidgetColumn`
object as well as a bare key, so a column the widget's own `query` produced gets
a header, a `format`, an alignment and a width, while a bare key still takes the
resource's declared header and format. `rowKey` names the identifying field and
defaults to the resource's own key, or `"id"` for a `query`. `rowHref` turns rows
into links, computed once per row on the server and pushed through the router, so
a dashboard table no longer needs a hand-written anchor in a cell. `seeAll` links
the card heading to the resource's list.

`WidgetContext` gained three things a config needs and could not reach. `href`
builds a link under the admin's own `basePath`, with `?f_<field>=` for a filter
and `?tab=` for a tab, so no config hand-types `/admin/…`. `query(key, fn)`
memoises for the request, so two widgets that need the same figure query once.
`labels` is the resolved `LabelsConfig`, and every string these widgets can show
now comes from a new `widget` label group with an English default and a Russian
entry. `row` is present when a widget sits in a detail tab.

`dashboard({ refresh: "60s" })` re-renders the page on that interval, pauses
while the browser tab is hidden, and shows how old the numbers are next to the
date picker. `previousRange()` and `fillDays()` are two pure helpers for the
shape dashboard queries keep needing: the comparison period a delta is measured
against, and one point per day across a range so a chart draws a flat stretch
where nothing happened. Bucketing stays in SQL, where the dialect belongs.

Charts read better empty and better on first paint. A chart with no rows takes
its wording from `labels.widget.empty` rather than a hard-coded English string,
and the "charts package not installed" notice does the same. `ChartRenderer`
holds a skeleton of the chart's own height until it mounts, so the
server-rendered page reserves the space instead of showing an axis frame that
collapses on hydration.

`formatNumber` moved to `@flowpanel/core` next to `formatColumnValue`, and takes
the admin's resolved `formatting` rather than a locale string, so `currency` reads
the configured ISO code instead of a hard-coded USD — one dashboard no longer
prints two currencies for the same money. `@flowpanel/react` re-exports it
unchanged in name, and `MetricCard` hands the resolved formatting to its slot as a
new optional `formatting` prop, which keeps `DefaultMetricCard` a pure renderer.
A server component may now call the formatter directly; calling the old
`@flowpanel/react` export from a server module threw under RSC, which is what made
`kv({ items: [{ format: "currency" }] })` fail in a real Next app. `StatGroupCard`
became a client component for the same reason every other card is one: it reads
the configured formatting.

Two defaults changed. `pieChart`'s `showLegend` now defaults to `true`: a pie
without a legend cannot be read, and the old default made every chart config
carry the same line. Pass `showLegend: false` to keep the previous look.
`table()`'s `emptyState` and `limit` were declared and ignored; both now apply,
so a table that used to show "No data" shows the configured string or
`labels.widget.empty`, and a `query` whose rows exceed a configured `limit` is
capped. A `TableWidget` rendered by hand with no `emptyState` now shows
`labels.noResults` rather than the literal "No data".
