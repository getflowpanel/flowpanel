---
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/react": patch
---

The entity card is configuration. The detail page's header has three slots
instead of one callback that had to carry everything: `detail.title(row)` for the
`h1`, `detail.subtitle(row)` for the line under it, and `detail.badge(row)` for a
status pill beside the title, toned from the shared `Tone` vocabulary. Each one
may return `null` to leave its slot empty, and a nullish `title` still falls back
to the resource's singular label and the readable row key. `detail.header` keeps
working and is deprecated in favour of `title`, which wins when both are declared.
`detail.fields`, declared but never read, now chooses and orders the fields of the
no-tabs key/value block.

A detail tab declares one kind of content and they resolve in a fixed order:
`render`, `widgets`, `resource`, fields. `sections` groups fields into titled
blocks and wins over a flat `fields` list on the same tab; every field either list
names is a declared dependency, loaded when that tab is the one in view. `widgets`
puts dashboard widgets in a tab, in the dashboard's own grid and each in the same
`WidgetErrorBoundary` a dashboard gives them, with `ctx.row` set to the record
being viewed — one widget model, two hosts. A rejected widget query costs that one
card, not the record page. `widgets: []` renders an empty tab instead of quietly
falling through to the other modes. `render` now receives a
second argument, a `DetailTabContext` carrying `db`, `session`, `dateRange`,
`href`, `labels` and the per-request `query` memo; the row it receives is still
the projected one, because the projection rules are not relaxed for convenience.

A related tab is finally a usable history. Reference columns resolve to the
referenced row's label through the same helper a list page and a table widget use,
rather than showing a raw foreign key. `hide` drops columns before anything renders
and projects those fields out of the rows the browser receives, keeping only the
row key the table needs for identity — which is what you want for the parent key
every row in the tab shares.
`sort` sets the tab's order, falling back to the target's `defaultSort` and then
its primary key, and a header click re-sorts through the URL under
`relatedSort.<tab key>` as `<field>.<asc|desc>` — bounded to a visible column the
target really has, so a hand-edited URL cannot ask the adapter for a column that
does not exist. An "Open list →" link above the table leads to the target's own
list page with the relationship already applied as `?f_<field>=<value>`, so the
full paginated list is one click away — and the link is omitted rather than
fabricated when the list page would not honour the filter, which is the case for a
non-scalar filter value or a field the target does not declare. The tab in view remains the `?tab=` search
parameter; the reference page said "fragment" and was wrong.

Narrow screens stop squeezing the heading: the detail and dashboard headers wrap,
so actions drop below the title instead of crushing it at 390px.
`PageHeaderProps` gains a `badge` slot for custom header components.

Drawer rows keep their labels. `serializeFields` now returns `{ name, label? }`
per field rather than a bare name, so a `FieldDef.label` declared on a drawer tab
survives to the client instead of being humanised back into a guess. The drawer
also renders `stat`, `kv`, `bars`, `funnel` and `list` widgets with the same cards
the dashboard uses, rather than reporting them unsupported; `custom` and chart
widgets still carry their honest reason.

New label keys: `related.openList`, `detail.noFields` and
`detail.unknownResource`, with English defaults and Russian translations.
