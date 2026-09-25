---
"@flowpanel/next": patch
---

Every write path — forms, inline edits, delete, restore, import and the generated create and edit forms — goes to a resource's `writeTo` table, and an update through `writeTo` answers with the view's row.

A counted related tab shows its row count in the label, pages by its own `pageSize`, renders its `widgets` above its rows, and opens a drawer row over the record page instead of on the target's list. A count metric on a record page counts, and links to, only the rows that point at the viewed record. A drawer's widgets tab applies the same record filter to its count metrics and the same `where` and `range` to its resource tables.

A dashboard section with `variant: "strip"` renders its metrics and stats as plain cells of one `StatStrip`, and warns once in development for any other widget kind in it.
The record page renders `detail.stats` as a hairline strip and `detail.aside` beside the tabs from `lg` (below them on a phone) on every tab, with a date picker when `detail.dateRange` is set; the header, strip, aside and open tab share one widget context and one memo, and each slot fails on its own. A dashboard section or widgets tab without `columns` lays out on 12 columns when a widget sets `span`.
