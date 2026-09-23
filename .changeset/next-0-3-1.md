---
"@flowpanel/next": patch
---

A `kv` or `statGroup` item resolver may return `{ value, tone, href }`, resolved on the server for the dashboard and the drawer.
Server-rendered badge cells show `format.labels[value]` when set.
A related detail-tab row opens like it does on the target's own list: its detail page for `rowClick: "detail"`, the target's list with the row's drawer open for `"drawer"`, and nothing when the list's rows are inert. Enter on the focused row opens it too.
A detail tab's `emptyState` replaces the generic empty label on related, widgets and fields tabs.
A `bars()` widget passes its `max` to the card on the dashboard and in the drawer.
A `funnel()` widget passes its `alertDrop` to the card on the dashboard and in the drawer.
Detail and drawer fields show `FieldDef.render` output; the drawer prerenders its output like a column `render`.
The drawer renders a `statGroup` with the dashboard's `StatGroupCard`, so its tones, links and number formats match the dashboard.
A detail fields tab leaves out a declared field the reader may not read instead of showing it empty, and a related tab whose rows cannot be identified stays inert.
A drawer field render that throws falls back to the column's `render` for that field, and detail field renders run only for fields the projected row carries.
