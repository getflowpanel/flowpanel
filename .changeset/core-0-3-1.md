---
"@flowpanel/core": patch
---

`resolveFormatting` returns `timeZoneSource: "config"` when `formatting.timeZone` is set and `"default"` when it falls back to UTC.
`ListRow` takes an optional `key`; rows without one are keyed by position.
A `kv` or `statGroup` item resolver may return a `KvResult` — `{ value, tone?, href? }` — whose fields win over the item's static `tone` and `href`.
The `badge` column format takes `labels` — display text per raw value — and `formatColumnValue` returns that label for a badge-formatted value.
`labels.plurals.results` and `labels.plurals.selected` take a `PluralLabel` — one count template per `Intl.PluralRules` category — and win over the string templates `table.result(s)` and `bulkBar.selected`; `formatCount` picks the form for a count and locale.
`DetailTab` takes `emptyState`, the text a related, widgets or fields tab shows when it has nothing to show.
`BarsOptions.max` sets the value a full bar stands for; the default is still the largest row.
`FunnelOptions.alertDrop` (default `0.5`) sets the drop-off past which the funnel's worst step is marked `warn`.
A Russian `formatting.locale` makes `RU_LABELS` the base the host's `labels` merge over; every other locale keeps English. `mergeLabels` takes an optional base preset.
`FieldDef.render(row, ctx)` lets a detail or drawer field show a computed value; it runs on the server only when the reader may read the field.
`badgeProps(format, value)` returns the props a `badge` cell hands its `StatusBadge`, shared by the server and client renderers.
`RU_LABELS` carries `plurals` for the row count and the selection count; a base preset's plural gives way when the host sets the string template for the same count.
