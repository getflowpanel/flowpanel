---
"@flowpanel/core": patch
---

A resource can read a database view and write to a table: `writeTo` names the table that create, update, delete and restore use, and `ResourceIntrospection.kind` reports a view. A view without `writeTo` is read-only, and a declared write, a form field its table lacks, or a table key the view does not select is an error at `defineAdmin`. `writeTarget(resource)` returns where a resource writes.

`related(resource, options)` builds a related tab in one line: `defineAdmin` infers the target's field that points at the record from its declared `reference` (none or several ask for `by`), turns `by` into the tab's filter and hidden column, and checks `by`, `hide` and `sort` against the target. `DetailTab` gains `by`, `count` and `pageSize`, and moves to `types/detail.ts` with the same exports.

`table({ resource, where, range })` narrows a resource table by a filter or a function of the context and bounds it by the picked range; both are checked at `defineAdmin`. `labels.detail.tabCount` words a counted tab.

`SectionConfig.variant: "strip"` draws a section's metric and stat widgets as one hairline-divided band without card chrome.
`DetailOptions<Row>` names a resource's record page, so a card in its own file is typed with `satisfies DetailOptions<RowOf<"user">>`. It gains `stats` (a strip under the header), `aside` (a side column) and `dateRange` (a header picker whose range reaches the strip, the aside and every widgets tab); `title`, `subtitle` and `badge` receive a `DetailHeaderContext` with `format`, `labels` and `link`, and `badge` may return several `DetailBadge`s, each with an optional `href`.
`kv` items take `field` to show a field of the card's `record`, which defaults to the viewed row on a record page.

`timeline({ kinds, query })` shows what happened, newest first, grouped under days of the admin's zone, with a chip per kind, "Older" paging by a cursor that keeps ties in order, and consecutive equal events folded into one line. `TimelineEvent`, `TimelinePage` and `TimelineOptions` are exported; `labels.timeline` and `labels.plurals.events` word it, and a timeline in a drawer tab is an error at `defineAdmin`.

`timeline.source(resource, { kind, at, by, where, title, refs })` reads a resource's rows as timeline events: `kind` is fixed or a column, a record page always AND-s the filter to the viewed record into `where` (on `by` when several fields point at it), and a dashboard source reads the picked range. `defineAdmin` checks each source's resource, fields, kind, `by` and references, that one field points at the record, and that a `where` does not set it.

`heatmap({ source: { resource, at, value, where } })` counts or sums rows per day over the last `days` days (91 by default) in the admin's zone, weeks starting on the locale's first day; on a record page the source reads only the viewed record's rows. `query` returns per-day totals instead, and `labels.heatmap` words the summary, tooltips and legend.

`checklist({ items, ordered, layout, summary })` shows what is done and what is not, with a summary of the required items; `ordered` adds each done step's date and the gap since the step before, and `precision: "day"` or a bare `YYYY-MM-DD` prints a day and measures no gap. `filled(row, labels)` makes one item per labelled field, done when it holds a value. `labels.checklist` words it, and a checklist in a drawer tab is an error at `defineAdmin`.

A `kv` item takes `long` — a paragraph across the card with its line breaks, folded after `lines` lines (6 by default) under `labels.widget.showAll` — and `empty`, printed instead of "—" when the value is missing or blank.

`ColumnDef.secondary` names another field of the row shown as a muted second line under the cell; `defineAdmin` checks that it is a column.

`groupTimeline` with `group: false` still folds consecutive events only within one calendar day of the admin's zone, as `TimelineEvent.fold` documents.
