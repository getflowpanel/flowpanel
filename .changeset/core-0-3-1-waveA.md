---
"@flowpanel/core": patch
---

`enumOf(values, entries)` declares an enum's labels and tones once and returns plain data: `format` for a badge column, `options` for a filter or a form field, and `label`, `tone` and `badge` for a header. Passing a database enum's values first makes a missing label a compile error.

`WidgetContext.read(resource, { where, sort, limit, fields })` returns rows of a registered resource under the same role, access, scope, field and soft-delete rules as its list, memoised per request; `DetailTabContext` carries it too. A row carries the list's projection plus `fields`. `Where<R>` keys a filter by the row's fields (any row's, for a union of names), and a `where` takes `{ gte, lte }` for a range and an array of strings or numbers for "any of"; a boolean is matched as a plain value. `RowOf<N>` names a registered resource's row.

`WidgetContext.count` takes a typed `where` and `{ range }`, which bounds a timestamp field by `ctx.dateRange`; `ctx.read` takes `range` too. `CountOptions` is exported.

`ResourceLink` is generic over the resource it names, so a link's `filter` and `range` are keyed by that resource's row, and `views[].filters` is keyed by the list's own row. `encodeFilters` writes filter values into the list's URL — a range of dates as `from~to` instants, of numbers as `min:max`, a set as `a,b` — and throws on a value with no URL form instead of writing `[object Object]`.

`metric(label, { count, where, range }, options)` counts rows of a resource: the value is `ctx.count`, `compare` counts the period before with the same scope, and the card links to exactly the rows it counted unless it has a `drilldown` of its own; a missing `where` value leaves the card without a link. `MetricCount` and `MetricCountSource` are exported, and `MetricWidget.source` keeps what a count metric counts.

Registering `schema` on `FlowpanelTypes` makes every Drizzle table and view in it a typed resource name and row (`SchemaResources`, `AllResources`), which `ResourceName`, `RowOf`, `InferRow` and `ReferenceSpec` read; a `FlowpanelResources` entry replaces the schema's row under the same name instead of intersecting with it. Registering `session` types `Session` everywhere, the auth presets included: `@flowpanel/core/auth` now imports `Session` and `AuthConfig` from the package index instead of declaring its own copies. `WidgetContext.rowOf(resource)` returns the card's record typed by its resource, and `DetailTabContext` carries it.

`defineAdmin` checks every static link a widget carries — resource, dashboard, view, tab, `filter` keys and `range` — what a count metric counts, saved-view filter keys and sort fields, and a related tab's `hide` and `sort.field`, and throws with the closest name; a filter key must also be a field the target list declares, with a value its list reads as the same rows (`filterShapeProblem`). `CustomOptions.label` titles a framed custom widget and names it in errors and timings.
