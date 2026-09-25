---
"@flowpanel/next": patch
---

A dashboard or detail-tab widget lays out at any span from 1 to 12.
A `kv` item with `format: "date"` or `"relative"` shows a `Date` in that format instead of a full timestamp. A numeric string under `percent` or `duration`, as Postgres returns `numeric` and `bigint`, prints as the table cell does.
Detail fields render the new column formats with the same elements the browser table uses. Drawer fields and drawer widget tables print their formats in the admin's locale and zone instead of en-US and UTC, and a drawer widget table keeps its columns' `label` and `format`.
`ctx.count` is memoised per request by resource and `where`, `ctx.query(fn, ...args)` memoises without a hand-made key, and a detail-tab, drawer or `DetailTab.render` context reads the record's key as `ctx.id` through the resource's `rowKey`.
Date presets start at midnight in `formatting.timeZone`: with `timeZone: "Europe/Moscow"`, `today` begins at 00:00 Moscow time instead of 00:00 UTC, and `yesterday`, `MTD`, `QTD` and `YTD` follow. A list's `daterange` filter reads each day in that zone too. An admin without a configured zone sees no change.
Widget contexts carry the previous period and the admin's zone, and a context for another range shares the request's counts while running its own queries.
Every widget, drawer and detail-tab context carries `format`, built once per request from the admin's `formatting`.
Named link targets resolve under `basePath`: a resource's list or record, a view applied by name, the widget's range carried to another dashboard or, bound for bound, into a `daterange` filter as a `from~to` pair of instants that the list reads exactly. An unknown resource, view or dashboard throws with the registered names, and development warns once about a literal link that spells `basePath`.
Dashboards, detail tabs and drawers resolve every widget link on the server, so the browser only receives plain hrefs.
A metric with `compare` runs its query a second time for `ctx.dateRange.previous` or the week before, in a context with its own query memo, and derives the change, the compared value and `goodWhen`; a delta the query or the `delta` option returns still wins.
Dashboards and drawers hand `bars()` its `share`, `goodWhen` and each row's `previous`.
A dashboard with `dateRange.presets` offers only those presets, and drops a `?preset=` outside them from the URL. When `from` and `to` decide the range, the picker shows those two days instead of naming a preset, and picking a preset clears them.
A widget with `maxRange` queries only the last N days of the picked range, on dashboards, detail tabs and drawers, and never compares with a period that starts before those N days; development warns once about a limit that is not whole days.
Those N days count back from now as well as from the range's end: a past range starts no earlier than N days ago, and one that ended N or more days ago runs no query and shows the widget's empty state instead of a 0 from deleted rows.
`buildNav` places each entry in the group its `navGroup` names, orders groups by their first entry, and marks a group `collapsible` when a member asks for it.
The screens shown to a signed-out reader or a role the admin does not allow read `labels.access`, so a Russian admin says «Требуется вход» and «Нет доступа» instead of English.
