---
"@flowpanel/react": patch
---

`spanClass` covers every span from 1 to 12.
Table, widget-table and drawer cells render the new column formats: a `relative` time as a `<time>` with the exact timestamp in its tooltip, a `url` as a link that opens an absolute URL in a new tab and never opens the row by click or Enter, `{ kind: "percent", heat: true }` as a cell shaded by its value, and a `boolean` glyph that a screen reader reads as yes or no. `HeatCell`, `UrlCell`, `RelativeTimeCell` and `BooleanCell` are exported for custom cells.
A `daterange` filter chip reads a `from~to` pair of instants, as a named link writes it, as its two days in the admin's zone.
