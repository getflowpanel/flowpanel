# @flowpanel/core

## 0.3.0

### Minor Changes

- 072f37b: Dashboards and detail pages are configuration: `stat`, `kv`, `bars`, `funnel`, `list`, a `table` whose `columns`, `rowKey`, `rowHref`, `emptyState`, `limit` and `seeAll` are honoured, `detail.title`/`subtitle`/`badge`, and tabs with `sections`, `widgets`, `hide` and `sort`. `WidgetContext` gains `href`, `query`, `labels`, `row`, `sql` and `count`; `formatting` applies to every number and date. `rowClick: "detail"` is the default for a resource with `detail` and no `drawer`, `pieChart.showLegend` defaults to `true`, `withBetterAuth` joins the auth presets, `@flowpanel/core/publish` is the realtime client for workers, and the unused `audit.retention` is removed.

## 0.2.0

### Minor Changes

- 2804944: The config surface now declares only what the runtime reads: options and public API that no surface reached are gone, and `auth.session` receives the request. Column formatting and the fail-closed scope rule each have one definition instead of a copy per package.

## 0.1.0

First public release. Core types and runtime for FlowPanel: `defineAdmin`, the `resource` / `dashboard` / widget builders, and the runtime for tenant scope, role gates, audit, and rate limiting.
