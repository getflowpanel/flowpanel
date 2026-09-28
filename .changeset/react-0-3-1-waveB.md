---
"@flowpanel/react": patch
---

`useAdminDrawer` keeps the drawer's own tab in `?drawerTab=` and still reads `?tab=`, so a drawer opened over a record page leaves the page's tab alone when it switches tabs or closes.

`StatStrip` draws numbers as one band divided by hairlines, two per line on a phone, and `MetricCard` and `StatCard` take `plain` to drop their frame inside it; the change, the previous value, the sparkline and the link stay.
`PageHeader` takes `badges`, several pills in order, each an optional link; `badge` still renders one.

`TimelineCard` renders kind chips with `aria-current`, day groups, folded lines and bodies in `<details>`, and paging, with no client state.

`HeatmapCard` draws weeks of day cells shaded in four quartile steps, with month and weekday labels, a legend and an accessible summary.

`ChecklistCard` draws a mark per item, dates and gaps, a summary bar and a `steps` layout that runs in a row from `md`.

`KvCardItem` takes `long`, `rest` and `more`: a long value spans the card, keeps its line breaks and shows `rest` inside a `<details>` fold.

`DataTableColumn.secondary` shows a muted second line under plain, formatted and prerendered cells, in the table and in the phone card list.

`TimelineCard` hides the WebKit disclosure marker on a folded line's `<summary>`, matching the admin nav.
