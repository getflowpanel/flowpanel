# @flowpanel/core

## 0.3.0

### Minor Changes

- Added the `stat`, `kv`, `bars`, `funnel`, `list` and `table` widgets for dashboards and detail pages.
- Added `detail.title`, `subtitle`, `badge` and detail tabs with `sections`, `widgets`, `hide` and `sort`.
- Added `href`, `query`, `labels`, `row`, `sql` and `count` to `WidgetContext`.
- Added `withBetterAuth` and `@flowpanel/core/publish`, the realtime client for workers.
- Changed `formatting` to apply to every number and date.
- Changed `rowClick` to default to `"detail"` for a resource with `detail` and no `drawer`.
- Removed the unused `audit.retention`.

## 0.2.0

### Minor Changes

- Removed config options and public API the runtime never read.
- Changed `auth.session` to receive the request.

## 0.1.0

First public release. Core types and runtime for FlowPanel: `defineAdmin`, the `resource` / `dashboard` / widget builders, and the runtime for tenant scope, role gates, audit, and rate limiting.
