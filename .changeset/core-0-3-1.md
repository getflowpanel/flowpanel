---
"@flowpanel/core": patch
---

0.3.1 gives every widget typed reads and counts through its context, reshapes every link into one
`LinkTarget`, validates a config's names at boot, and adds four page-level widgets (timeline,
heatmap, checklist, tracker). Types now come from your own schema and session once you register
them. See the
[0.3.1 upgrade notes](https://flowpanel.tech/docs/guides/upgrade#upgrading-from-030-to-031) for
the full list; the sections below cover the rest, grouped by what you'd touch.

**Widget context.** `ctx.read(resource, { where, sort, limit, fields })` returns a registered
resource's rows under the same role, access, scope, field and soft-delete rules as its list,
memoised per request; a row carries the list's projection plus `fields`. `ctx.count` takes the
same typed `where` — `Where<R>`, keyed by the row's fields, with `{ gte, lte }` for a range and an
array for "any of" — and `{ range }`, which bounds a timestamp field by the picked period; both
are memoised by their arguments. `ctx.query(fn, ...args)` keys its memo by the function and its
arguments, and `ctx.query(fn)` calls `fn(ctx)` when `fn` declares a parameter. `ctx.id` is the
viewed record's key, `ctx.rowOf(resource)` the record typed by its resource, `ctx.format` the
admin's `date`, `dateTime`, `relative`, `number`, `money` (with `scale` for minor units),
`percent`, `duration` and `plural` formatters (`bindFormat(formatting)` builds them anywhere),
`ctx.link(target)` an href under the admin's mount (`ctx.href` is deprecated in favour of it),
`ctx.filters` the dashboard's filter values, and `ctx.dateRange` a `WidgetDateRange` with the
`previous` period and the admin's `timeZone`. `DetailTabContext` carries `read`, `rowOf`, `id`,
`format` and `link` too. `RowOf`, `CountOptions` and `WidgetDateRange` are exported.

**Types from your own sources.** Registering `schema` on `FlowpanelTypes` makes every Drizzle
table and view in it a typed resource name and row (`SchemaResources`, `AllResources`), read by
`ResourceName`, `RowOf`, `InferRow` and `ReferenceSpec`; a `FlowpanelResources` entry replaces the
schema's row of the same name. Registering `session` types `Session` everywhere, the auth presets
included, which now import `Session` and `AuthConfig` from the package index.

**Links.** `LinkTarget` is a string, `{ resource, id?, filter?, view?, tab?, range? }` or
`{ dashboard, range?, filter? }` — `filter` narrows either kind of target and `range` carries the
current range, as a field name for a resource and `true` for a dashboard —, and every widget link
takes one: `drilldown`, `href`, `seeAll`, `rowHref`, a `bars`, `funnel` or `list` row's `href`,
and the `href` of a `MetricResult`, `StatResult` or `KvResult`; a link in the config may also be a
function of the widget context. `ResourceLink` is generic over its resource, so `filter` and
`range` are keyed by that row, and `views[].filters` by the list's own row. Filter values are
values — a range, a set, a boolean, or a `daterange` preset name such as `last7d` — and
`encodeFilters` writes them into the URL, throwing on a value with no URL form.

**Validation at boot.** `defineAdmin` checks what a config names and throws with the closest name:
every static link's resource, dashboard, view, tab, filter keys and range, saved-view filter keys
and sort fields, what a count metric counts, related tabs, timeline and heatmap sources,
`secondary` columns, dashboard filters, `realtime` resources, and widgets a drawer cannot show. A
filter key must be a field the target list declares, with a value its list reads as the same rows.
`CustomOptions.label` titles a framed custom widget and names it in errors and timings.

**Enums.** `enumOf(values, entries)` declares an enum's labels and tones once and returns `format`
for a badge column, `options` for a filter or form field, and `label`, `tone` and `badge` for a
header; passing a database enum's values first makes a missing label a compile error. A select
filter or choice field without `options` on an `enumOf` badge column lists its labels, and
`EnumDef.badge(value, { href })` links the pill.

**Column formats.** Columns gain `date`, `relative`, `percent` (with `heat`), `duration` (with
`unit`), `boolean`, `url` and an object form of `number`; `percent`, `duration` and `number` take
`tones`, and `badge` takes `labels`, display text per raw value. `formatColumnValue` renders each
as text, and `formatDurationValue`, `formatPercentValue`, `formatRelativeValue`,
`formatBooleanValue`, `columnFormatKind`, `percentHeatLevel`, `urlCellParts`, `toDateValue`,
`toBooleanValue`, `badgeProps` and `cellTone` are exported for custom cells. A date cell reads a
zoneless `YYYY-MM-DD HH:mm:ss` as UTC and a boolean cell reads `1` and `0`, as `ctx.sql` rows
return them. `ColumnDef.secondary` shows another field as a muted second line, and `Span` is any
whole number from 1 to 12.

**Metrics, bars and lists.** `metric(label, { count, where, range })` counts a resource's rows and
links to exactly those rows. `compare` on `metric` and `bars` queries the previous period, or the
same range a week earlier, and shows the change; `MetricDelta` takes `previous`. `metric`, `bars`,
`stat` and `tracker` take one top-level `goodWhen` (`"up"` by default, `"neutral"` on a change); a
delta's own `goodWhen`, the 0.3.0 spelling, still wins and is deprecated. `bars()` takes `share`,
`max` and rows with `key`, `previous` and `share`. `Threshold`, `toneFor()` and `tones` on
`metric`, `stat`, `bars` and cells declare once where a number turns bad, reading which way is bad
from the order of `warn` and `err`; `defineAdmin` throws when a `goodWhen` contradicts it.
`MetricResult` and `StatResult` take a `volume`. `FunnelOptions.alertDrop` marks
the worst drop-off past it; unset, no step is toned. A `list` takes `limit` and `more`, its rows `key` (else they are keyed by
position), `count` and `since`, and `banner()` is a list ordered by severity with an `allClear`
line. A `kv` or `statGroup` resolver may return `{ value, tone?, href? }`, which wins over the
item's static `tone` and `href`.

**Four new widgets.** `timeline({ kinds, query })` shows what happened, newest first, grouped by
day in the admin's zone, with a chip per kind, cursor paging and equal events of one day folded,
each timeline on a page under its own `id`; `timeline.source(resource, { kind, at, by, where,
title, refs })` reads a resource's rows as its events. `heatmap({ source })` counts or sums rows
per day, over the last 91 days by default. `checklist({ items, ordered, layout, summary })` shows
what is done, and `filled(row, labels)` makes one item per labelled field. `tracker()` shows
status per hour or day over a window ending now. `table({ resource, where, range, filter })`
narrows a resource table. `SectionConfig.variant: "strip"` draws metrics and stats as one hairline
band. Every widget takes `maxRange`, which caps the days it queries, and `freshness` and
`coverage`, shown as one caption line under its title; `realtime` also takes `{ resource: name }`.

**Record pages and resources.** `DetailOptions<Row>` types a record page and adds `stats`, `aside`
and `dateRange`; `title`, `subtitle` and `badge` receive a `DetailHeaderContext`, and `badge` may
return several `DetailBadge`s, each with an `href`. `related(resource, options)` builds a related
tab whose filter comes from the target's `reference`, or from `by`, and `DetailTab` gains `by`,
`count`, `pageSize` and `emptyState`. A `kv` item takes `field`, `long` and `empty`. Every card's
`emptyState` takes text or any node, as `table`'s did. `FieldDef.render(row, ctx)` shows a
computed value, only to a reader who may read the field. A resource can read a database view and
write to the table `writeTo` names; a view without it is read-only, `ResourceIntrospection.kind`
reports a view, and `writeTarget(resource)` says where a resource writes.

**Dashboards.** Dashboards take `filters`, one select each, read by every widget as `ctx.filters`;
`bars`, `tracker` and `table` take `filterOnClick`, so clicking a row sets one.
`DateRangeConfig.presets` lists the presets a picker offers. `navGroup` on a dashboard, page,
resource or queue moves its sidebar entry into a named group, folded with
`{ label, collapsed: true }`.

**Analytics helpers.** `series()` folds rows into one point per hour, day, week or month in the
admin's zone, with gaps filled, a column per `by` value and the rest past `top` under `OTHER_KEY`;
`breakdown()` ranks rows with each one's share of the total and its previous value;
`presetRange()` gives a preset's bounds. A chart's `y` is optional, and `labels` on a chart, a
tracker and `breakdown()` names series and rows with a map, an `enumOf()` or a function.
`toneTextClass` and `toneFillClass` map every tone to the built-in cards' classes. The engine
helpers `@flowpanel/next` and the adapters share — zone math, timeline paging, heatmap buckets,
filter encoding and `where` checks — live behind `@flowpanel/core/internal`, which
`@flowpanel/kit` does not re-export and which is not public API.

**Labels.** `labels.plurals.results`, `selected` and `events` take a `PluralLabel`, one template
per `Intl.PluralRules` category, picked by `formatCount`; a host's string template for the same
count still wins over a base preset's plural. `labels.access` words the sign-in and access-denied
screens, and `labels.timeline`, `heatmap`, `checklist`, `detail.tabCount`, new `labels.widget`
keys and `labels.drawer.loading`, `noRows`, `noWidgets` and `chartElsewhere` word the rest;
`labels.widget.tones` is what a screen reader says for an `err`, `warn`, `ok` or `info` glyph or
dot, merged one word at a time.
`resolveFormatting` reports `timeZoneSource`, and `mergeLabels` takes an optional base preset.

**Worker.** `createPublisher` from `@flowpanel/core/publish` accepts any ioredis client and the
admin's own `{ driver: "redis", url, keyPrefix }` options, and sends
`resource(name, { action, id })` events. The transport factory the package root exported under the
same name is now `createRealtimeTransport`; the root's `createPublisher` stays as a deprecated
alias of it.

**Behaviour changes.** A Russian `formatting.locale` makes `RU_LABELS`, with its plurals, the base
the host's `labels` merge over. `duration` prints in the admin's locale with the largest units
that fit (`4.2 sec`, `2 hr 5 min`); `formatDurationCompact` keeps `2.1h` for an axis. `fillDays`
now runs through `series`: it buckets in the range's `timeZone`, reads a zoneless timestamp as
UTC, sums `Date` values as 0 and starts an epoch range at the first row's day. The worker
publisher resolves instead of rejecting when Redis fails, and reports through `onError` or one log
line per error kind. A `ctx.query` function whose first parameter is optional without a default
now receives the context. `WidgetConfig` has four new kinds — `timeline`, `heatmap`, `checklist`
and `tracker` — and a hand-built `WidgetContext` needs the new members.

**Design options.** `DashboardAction.emphasis` and `update.emphasis` pick the one primary button
on a screen; the rest are secondary. `SectionConfig.align` sets how cards in a row size, a `table`
widget takes `density`, `empty.filtered` words a list that search or filters emptied, and
`drawer.subtitle(row)` sets the line under a drawer's title. Chart options take `colors` per
series. `theme.cssVars` and `cssVarsDark` are typed `ThemeTokens`, so token names complete. The
built-in labels lose their `→`/`←` and the widget error reads "Couldn't load this widget".

**List filter defaults.** `defineAdmin` rejects a filter `defaultValue` its list would read as other rows, and a `null` view or link filter value encodes as an empty `f_<field>=` that turns a filter's default off.

**Empty search.** `ResourceOptions.empty.searched` titles a list a search left empty, and `{query}` in it or in `empty.filtered` is the search text.

**Drawer header.** The Russian `drawer.viewDetails` label reads «Открыть карточку».

**Error cards.** `labels.errors.details` names the disclosure that holds a failed card's own message.
