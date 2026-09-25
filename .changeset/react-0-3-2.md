---
"@flowpanel/react": patch
---

`spanClass` covers every span from 1 to 12.
Table, widget-table and drawer cells render the new column formats: a `relative` time as a `<time>` with the exact timestamp in its tooltip, a `url` as a link that opens an absolute URL in a new tab and never opens the row by click or Enter, `{ kind: "percent", heat: true }` as a cell shaded by its value, and a `boolean` glyph that a screen reader reads as yes or no. `HeatCell`, `UrlCell`, `RelativeTimeCell` and `BooleanCell` are exported for custom cells.
A `daterange` filter chip reads a `from~to` pair of instants, as a named link writes it, as its two days in the admin's zone.
A metric card's change has a neutral band — inside ±1 % it shows no arrow and no colour — prints its percentage in the admin's locale, and shows the compared value muted beside it. A count against a base under 20 shows its absolute change (`+3`), and a `percent` metric its change in points (`+3 pp`).
`BarsCard` shows a row's share of the total with `share` (a row's own `share` wins), and marks its change against `previous` with the metric card's delta rules.
`DateRangePicker` takes `presets` to narrow and order the list it offers, and shows a custom `from`/`to` value as its two days in the admin's zone instead of a preset's name.
`NavGroup` takes `collapsible`.
`AdminNav` folds a `collapsible` group under its label with a native `<details>`, open while the group holds the current page.
A metric card's sparkline never squeezes its value: on a card too narrow for the two side by side, the sparkline moves under the value, a value longer than the whole card ends in an ellipsis, and a label that runs out of room shows its full text on hover.
