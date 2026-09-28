---
"@flowpanel/next": patch
---

Every write path — forms, inline edits, delete, restore, import and the generated create and edit forms — goes to a resource's `writeTo` table, and an update through `writeTo` answers with the view's row.

A counted related tab shows its row count in the label, pages by its own `pageSize`, renders its `widgets` above its rows, and opens a drawer row over the record page instead of on the target's list. A count metric on a record page counts, and links to, only the rows that point at the viewed record. A drawer's widgets tab applies the same record filter to its count metrics and the same `where` and `range` to its resource tables.

A dashboard section with `variant: "strip"` renders its metrics and stats as plain cells of one `StatStrip`, and warns once in development for any other widget kind in it.
The record page renders `detail.stats` as a hairline strip and `detail.aside` beside the tabs from `lg` (below them on a phone) on every tab, with a date picker when `detail.dateRange` is set; the header, strip, aside and open tab share one widget context and one memo, and each slot fails on its own. A dashboard section or widgets tab without `columns` lays out on 12 columns when a widget sets `span`.

A timeline merges its lists by time on the server, reads its chips and page from `?<id>.kind=` and `?<id>.before=`, and names a detail tab's timeline after the tab.

Timeline sources are read in parallel with the host query, one authorized read per source and page, sorted by time and merged; references resolve in one read per source, and an unreadable source adds nothing.

A heatmap source reads at most 10,000 rows through the resource's own authorization and throws past that, naming `query`.

A checklist resolves its items per request and formats dates, gaps and the summary on the server.

A long `kv` value is folded on the server, the same on a dashboard, a record page and in a drawer; an `empty` text is muted.

The list page and related tabs load a column's `secondary` field with the row and pass it to the table; a `reference` column keeps its label alone.

A timeline's non-finite `pageSize` (e.g. `NaN`) falls back to the default instead of rendering an empty card.

A timeline source row that opens a drawer no longer trips the "spells the admin's mount path" warning; its first `refs` record now opens following that resource's own detail/drawer rule, falls back to the row's own link when the ref value is null, and a host `where` bound on the source's `at` column combines with the page bound instead of being dropped.
