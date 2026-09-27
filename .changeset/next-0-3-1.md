---
"@flowpanel/next": patch
---

0.3.1 makes widget reads and links safe by construction, opens a related tab's rows, renders
four new widgets, and reads and writes through a resource's `writeTo` table everywhere. See the
[0.3.1 upgrade notes](https://flowpanel.tech/docs/guides/upgrade#upgrading-from-030-to-031) for
the full list; the sections below cover the rest, grouped by what you'd touch.

**Widget context.** `ctx.read` throws on a misspelt field, an unknown resource, an `undefined`,
`null` or `""` value, an open range and a boolean inside an array, reads nothing for an empty
set, and returns 100 rows by default and at most 1000, with a development warning. `ctx.count`
passes ranges and sets to the adapter, counts `0` for an empty set without a query, and names the
closest resource on a typo; both say how to register a schema table that is not a resource yet.
Counts, reads and `ctx.query(fn, ...args)` are memoised per request, a ranged count per bounds.
Every widget, drawer and detail-tab context carries `id` (read through the resource's `rowKey`),
`format`, `link`, `filters`, the previous period and the admin's zone; `ctx.rowOf` throws on a
dashboard and on another resource's card. `adminWidgetContext(config, options)` builds the
context a widget receives in an admin, and `resolveWidget(widget, ctx)` returns the props its
card would receive.

**Links.** Links resolve on the server, so the browser only receives plain hrefs. A named target
opens a resource's list or record, a saved view by name, another dashboard with the widget's
range, or a list's `daterange` filter as a `from~to` pair of instants it reads exactly. An
unknown resource, view or dashboard throws with the registered names, a function link suggests
the closest one, and development warns once about a literal link that spells `basePath`, never
about one `ctx.href` built. Saved views, link filters and `ctx.href` filters take values through
one encoder, and a `daterange` preset name such as `last7d` is resolved on every request in the
admin's zone.

**Dashboards.** A metric or bars widget with `compare` runs its query again for the previous
period, or the same range a week back, in a context with its own memo, and derives the change; a
delta the query returns still wins, and bars join rows by `key`, else by `label`. Changing a
dashboard filter or the range drops every timeline's `?<id>.before=` page. Development warns once
about a `kv` field item on a dashboard without a `record` and about `filterOnClick` bars whose
rows carry no `key`, and the `maxRange`, `warnAfter` and tracker `window` warnings name their
widget. A dashboard with `dateRange.presets` offers only those presets, drops a `?preset=`
outside them and still honours `dateRange.default`; an unreadable `?from=` or `?to=` falls back
to the default range instead of failing the page; the picker shows a custom `from`/`to` as two
days. `DashboardFilters` puts a dashboard's filters beside the date picker as `f_<key>` URL
values with a "Clear filters" button, a bar, tracker row or table row with `filterOnClick` links
to the dashboard filtered by it, and an empty card under a filter — a timeline, heatmap and
checklist included — says so and links to clear it. A section with `variant: "strip"` renders its metrics and
stats in one `StatStrip`. A widget lays out at any span from 1 to 12, and a section or widgets
tab without `columns` uses 12 columns once a widget sets `span`. `realtime: { resource }`
subscribes a widget, dashboard, widget table or drawer card to that resource's channel.

**Widgets.** A chart without `y` plots the numeric columns of its first row, naming each series
from `labels` and a folded rest as `labels.widget.other`; no function in `labels` reaches the
client. Server-rendered badge cells show `format.labels[value]`. Metrics, stats, bars and cells
take their tone from `tones` when nothing else sets one. A widget with `maxRange` queries only
the last N days of the picked range, counted back from now as well as from the range's end, and
never compares with a period before them; a range that ended before that horizon runs no query
and shows `—` with "No data: kept for N days". A cut range, `freshness` or `coverage` shows as
the card's caption. A `tracker()` queries its own window in the admin's zone and tones a row by
the worst of its last three blocks. Lists and banners are ordered, limited and formatted on the
server, the rest folded into a linked "N more" line. A timeline merges its lists by time, reads
its chips and page from `?<id>.kind=` and `?<id>.before=`, and reads its sources in parallel
through each resource's own authorization; a source row opens its first `refs` record the way
that resource opens, and a host `where` on the source's `at` combines with the page bound. A
heatmap source reads at most 10,000 rows and throws past that, naming `query`. A checklist and a
long `kv` value are resolved and folded on the server. `bars()` passes `max`, `share`, `goodWhen`
and each row's `previous`, and `funnel()` its `alertDrop`, on the dashboard and in the drawer.

**Record pages.** `detail.stats` renders as a hairline strip and `detail.aside` beside the tabs
(below them on a phone), with a date picker when `detail.dateRange` is set; the header, strip,
aside and open tab share one context and memo, and each slot fails on its own. A counted related
tab shows its count in the label, pages by its own `pageSize`, renders its `widgets` above its
rows, and its rows open like the target's own list — its detail page, or its drawer over the
record page — also on Enter. A count metric on a record page, or in a drawer's widgets tab,
counts and links to the viewed record's rows only, and a drawer's resource tables apply their
`where` and `range`. A count metric whose function `where` its list would read differently warns
once in development. Detail and drawer fields show `FieldDef.render` output and every column
format, drawer fields and drawer tables in the admin's locale and zone; a `kv` item with
`format: "date"` or `"relative"` formats a `Date`, a numeric string under `percent` or `duration`
prints as the table does, and the drawer renders a `statGroup` with the dashboard's card. A tab's
`emptyState` replaces the generic empty label. List pages and related tabs load a column's
`secondary` field with the row. Detail tab triggers carry `data-fp-tab`.

**Writes and navigation.** Every write path — forms, inline edits, delete, restore, import and
the generated forms — goes to a resource's `writeTo` table, and an update through `writeTo`
answers with the view's row. `buildNav` places entries in their `navGroup` and marks a group
`collapsible` when a member asks for it.

**Behaviour changes.** Date presets start at midnight in `formatting.timeZone` — with
`"Europe/Moscow"`, `today` begins at 00:00 Moscow time instead of 00:00 UTC — and a list's
`daterange` filter reads each day in that zone; an admin without a zone sees no change. A related
row opens its target instead of staying inert. `ctx.count` counts `0` for a `null` or `""` value,
as it already did for `undefined`, with a development warning. The sign-in and access-denied
screens read `labels.access`, in Russian for a Russian admin. `tailwind-merge` moves to
`^3.0.0`, so server-rendered classes merge Tailwind v4 utilities correctly.

**Fixes.** A widget that fails names itself by label, kind and place in its error card outside
production, in the server log and in the Sentry `widget.id` tag, and development logs one line
of the widgets that took 300 ms or more. A widget's `redirect()` or `notFound()` reaches Next
instead of becoming an error card. A detail fields tab leaves out a field the reader may not read
instead of showing it empty, a related tab whose rows cannot be identified stays inert, a drawer
field render that throws falls back to the column's `render`, a drawer cell whose render returns
a client component shows the cell its list row already rendered instead of failing, and a
record-page field render that throws is logged and shows the formatted value instead of failing
the page. Custom and query-error cards share the widget card's frame and fill their slot's
height; an expired widget and one that fails inside a strip, on a dashboard or in a record page's
`stats`, drop that frame, and `WidgetErrorBoundary` takes `plain` for it. "Clear filters" is a
full-size touch target on a phone.

**Design.** `flowpanelMetadata(config)` and `runtime.metadata` title each admin page the caller
may open, and nothing for a visitor who is not signed in; the page renders a `theme-color` meta
per scheme. Dashboard actions and the edit button are secondary unless one is
`emphasis: "primary"`, with a development warning for two, and drawer actions are always
secondary. A host that sets `theme.accent` or `accentDark` without its own `--fp-data` keeps
its bars, sparklines and heat cells in that accent. An empty list tells no
data from no matches and offers to clear the filters, a table or list card keeps its own height
in a row, the drawer's subtitle is `drawer.subtitle(row)` or the resource's label with a skeleton
title while it loads, and a 404 marks no nav item.
