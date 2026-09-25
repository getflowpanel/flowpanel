---
"@flowpanel/next": patch
---

`ctx.read` throws on a misspelt field, an `undefined`, `null` or `""` value, an open range and an unknown resource instead of reading every row, and on an array that holds a boolean instead of reading the opposite rows, reads nothing for an empty set, defaults to 100 rows and stops at 1000 with a development warning. `ctx.count` names the closest resource for a typo, and both say how to register a schema table that is not a resource yet.

`ctx.count` hands the adapter `{ gte, lte }` as a range and an array as a set instead of an equality it cannot match, counts `0` for a `null` or `""` value as it already did for `undefined`, with a development warning, and counts an empty set as `0` without a query. A misspelt key still throws first, even when its value is missing. A ranged count or read memoises per bounds, so `compare` counts the earlier period again.

Saved views, link filters and `ctx.href` filters take values — a range, a set, a boolean — and are written through one encoder. A `daterange` filter value may be a preset name such as `last7d`, resolved on every request in the admin's zone, so a saved view can say "the last seven days".

`ctx.rowOf` throws on a dashboard and on another resource's card, naming both, and reaches every widget of a detail widgets tab and `DetailTab.render`.

A widget that fails names itself by label, kind and place — `«Конвейер» (custom, /system section 2 widget 1): …` — in its error card outside production, in the server log and in the Sentry `widget.id` tag. In development a page logs one line of its widgets that took 300 ms or more, slowest first, with their memo hits. A link computed by a function suggests the closest resource, view or dashboard when it names a missing one, and a count metric whose function `where` its list would read differently warns once. A widget's `redirect()` or `notFound()` still reaches Next instead of becoming an error card.
