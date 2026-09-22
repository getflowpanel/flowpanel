---
"@flowpanel/core": minor
---

Dashboards and detail pages are configuration: `stat`, `kv`, `bars`, `funnel`, `list`, a `table` whose `columns`, `rowKey`, `rowHref`, `emptyState`, `limit` and `seeAll` are honoured, `detail.title`/`subtitle`/`badge`, and tabs with `sections`, `widgets`, `hide` and `sort`. `WidgetContext` gains `href`, `query`, `labels`, `row`, `sql` and `count`; `formatting` applies to every number and date. `rowClick: "detail"` is the default for a resource with `detail` and no `drawer`, `pieChart.showLegend` defaults to `true`, `withBetterAuth` joins the auth presets, `@flowpanel/core/publish` is the realtime client for workers, and the unused `audit.retention` is removed.
