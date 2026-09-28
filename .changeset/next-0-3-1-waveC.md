---
"@flowpanel/next": patch
---

A chart without `y` plots every column of its first row except `x`, and its legend and tooltip name each series from `labels`, with the folded rest as `labels.widget.other`; no function in `labels` reaches the client. A `bars()` row keyed `OTHER_KEY` reads `labels.widget.other`. Date presets resolve through core's zone helpers.
A `bars()` widget with `compare` runs its query again for the previous period, or the same range a week back, in a context with its own memo. It joins rows by `key`, else by `label`, and never overwrites a row's own `previous`; a row the earlier period lacks shows no change, and nothing is compared past `maxRange` or over a whole history.
Metrics, stats, bars and server-rendered cells take their tone from `tones` when neither the result nor the widget sets one, in drawers too.
A widget whose range ended before its `maxRange` horizon renders an `ExpiredCard` — `—` and "No data: kept for N days" — instead of its empty state, and a drawer shows the same words. A range cut at the horizon, the data's age from `freshness.at` (warned past `warnAfter`) or `coverage` shows as the card's caption, computed beside the widget's query.
A `tracker()` queries its own window in the admin's zone, with "now" fixed per request. It folds the rows into blocks, titles each with its time, value and observations, and tones a row by the worst of its last three blocks.
Lists and banners are ordered, limited and formatted on the server: `count` in the admin's locale, `since` relative, and the rest folded into a linked "N more" line. Dashboards and drawers share that path.
`DashboardFilters` puts a dashboard's filters beside the date picker as `f_<key>` URL values with a "Clear filters" button. Contexts carry them into compared, capped and tracker periods. A bar, tracker row or table row with `filter` links to the current dashboard filtered by it, keeping the range, and an empty card under an active filter says so and links to clear it.

A chart without `y` now plots only the numeric keys of its first row — a label or other non-numeric column is left out. A `tracker()` block's value prints through core's `formatNumber`, so `bytes` formats the same as everywhere else.
