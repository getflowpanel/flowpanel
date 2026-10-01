---
"@flowpanel/core": minor
---

- Added `ctx.read`, `rowOf`, `link`, `format`, `filters` and a typed `where` for `count` to the widget context.
- Added typed resources and session from `schema` and `session` registered on `FlowpanelTypes`.
- Added `LinkTarget`, one link shape for every widget link.
- Added checks in `defineAdmin` for every name a config references, with the closest match.
- Added the `timeline`, `heatmap`, `checklist` and `tracker` widgets.
- Added `enumOf()` and the `date`, `relative`, `percent`, `duration`, `boolean` and `url` column formats.
- Added count metrics, `compare`, `goodWhen` and `Threshold` tones.
- Added `maxRange`, `freshness` and `coverage` to every widget.
- Added `detail.stats`, `detail.aside`, `related()` tabs and `FieldDef.render`.
- Added resources over database views that write through `writeTo`.
- Added dashboard `filters`, `filterOnClick`, `dateRange.presets` and `navGroup`.
- Added the `series()`, `breakdown()` and `presetRange()` helpers.
- Added Russian base labels for a Russian `formatting.locale`.
- Removed the deprecated aliases `requireRole` on resources, actions and drawer actions, `ctx.db` on actions and option resolvers, `applyScope` and `scopeRequired`, `ctx.href`, detail `header`, a delta's own `goodWhen`, `basePath`, `AdminConfig`, `runMigrationSql`, `markMigrationApplied` and the root `createPublisher` (use `access`, your own `db` import (or `unsafe: ["db"]` and `ctx.unsafe.db` on an action), `boundScope`, `ctx.link`, `title`, the metric's `goodWhen`, `paths.admin`, `AdminDefinition`, `applyMigration` and `createRealtimeTransport`); drawer `header` is now `title`.
- Changed `defineAdmin` to fail at boot on a leftover `requireRole` on a resource or action, `basePath`, or a detail or drawer `header`.
- Added `errors.connectionHint` for refused or unreachable database connections.
