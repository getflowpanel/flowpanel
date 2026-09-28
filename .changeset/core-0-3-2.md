---
"@flowpanel/core": patch
---

`Span` is any whole number from 1 to 12, so a row of five cards or a 5 / 2 / 5 split no longer has to borrow from its neighbours.
`ColumnFormat` adds `date` (`{ kind: "date", time }`), `relative`, `percent` (`{ kind: "percent", digits, heat }`), `duration` (`{ kind: "duration", unit }`), `boolean` (`{ kind: "boolean", labels }`) and `url` (`{ kind: "url", label }`); `formatColumnValue` renders each as text. `formatDurationValue`, `formatPercentValue`, `formatRelativeValue`, `formatBooleanValue`, `columnFormatKind`, `percentHeatLevel` and `urlCellParts` are exported for custom cells.
A `date` or `relative` cell reads a zoneless `YYYY-MM-DD HH:mm:ss` as UTC, as `ctx.sql` rows do, so the server and every browser print the same time; a string that is not an ISO date stays text. A `boolean` cell reads SQLite's `1` and `0` as true and false.
`formatNumber` renders `duration` in the admin's locale with the largest units that fit — `4.2 sec`, `2 hr 5 min` — instead of `4s` or `2.1h`. `formatDurationCompact` keeps only the largest unit, `2.1h`, for a chart axis.
`toDateValue` and `toBooleanValue` are exported, so a custom cell reads a zoneless timestamp as UTC and SQLite's `1` and `0` as true and false, as the built-in cells do.
`WidgetContext` gains `id`, the viewed record's key as a string, and `query` also takes a function and its arguments — `ctx.query(loadFacts, ctx.db, ctx.id)` — keying the memo by them. `DetailTabContext` carries `id` as well.
`ctx.dateRange` is a `WidgetDateRange`: the picked range plus `previous` — the same stretch one day, month, quarter or year back for `today`, `yesterday`, `MTD`, `QTD` and `YTD`, the span of the same length before it otherwise, `null` over a detail tab's whole history — and `timeZone`, the admin's `formatting.timeZone`. `fillDays` buckets in the range's own `timeZone` when no `timeZone` option is passed, so `fillDays(rows, ctx.dateRange, …)` follows the admin's zone.
`ctx.format` gives a widget the admin's formatters — `date`, `dateTime`, `relative`, `number`, `money`, `percent`, `duration` and `plural` — bound to `formatting`, and `bindFormat(formatting)` builds the same object anywhere. `money` takes `scale` for minor units and prints whole units unless `digits` asks for more, as a `currency` metric does. `DetailTabContext` carries `format` too.
`LinkTarget` names a link instead of spelling a path: a string as written, `{ resource, id?, filter?, view?, tab?, range? }`, or `{ dashboard, range? }`. `ctx.link(target)` resolves one to an href under the admin's mount, and `DetailTabContext` carries `link`.
Every widget link accepts a `LinkTarget`: `drilldown`, `href`, `seeAll`, `rowHref`, the `href` of a `bars`, `funnel` or `list` row, and the `href` of a `MetricResult`, `StatResult` or `KvResult`. A link set in the config may also be a function of the widget context.
`MetricDelta` takes `previous`, the value compared against, and `goodWhen: "neutral"`; `labels.widget.previous` words the compared value and `labels.widget.points` a rate's change in percentage points.
`metric()` takes `compare: true` or `compare: { goodWhen, against }` to query the previous period, or with `against: "weekAgo"` the same range a week earlier, and show the change against it; `labels.widget.vsPrevious` and `labels.widget.vsWeekAgo` word the comparison.
`bars()` takes `share` to show each row's part of the total, `goodWhen` for the direction of good news, a row's `previous` to mark its change, and a row's `share` for its part of a total the query did not return in full.
`DateRangeConfig.presets` lists the presets a dashboard's picker offers; `preset` defaults to its first entry.
Every widget takes `maxRange`, a number of days such as `"30d"`, that caps the date range it queries.
`navGroup` on a dashboard, page, resource or queue moves its sidebar entry into a named group — a label, or `{ label, collapsed: true }` for a group that folds.
`labels.access` words the sign-in and access-denied screens: `signInTitle`, `signInDescription`, `deniedTitle` and `deniedDescription`, in English by default and in Russian in `RU_LABELS`.
