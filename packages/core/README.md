# @flowpanel/core

Core types, builders, and runtime for FlowPanel.

[![npm](https://img.shields.io/npm/v/@flowpanel/core.svg)](https://www.npmjs.com/package/@flowpanel/core)

> Most users should depend on **`flowpanel`** (the umbrella package) — it re-exports everything from `@flowpanel/core` and the other workspace packages. Depend on `@flowpanel/core` directly only when publishing your own FlowPanel adapter or extension.

## What's here

- **`defineAdmin(config)`** — the config entry point.
- **Builders:** `resource`, `dashboard`, `page`, `metric`, `table`, `custom`, `statGroup`, `queue`.
- **Types:** `Adapter`, `AdminConfig`, `ResolvedAdminConfig`, `WidgetContext`, `ActionContext`, `LabelsConfig`, `ThemeConfig`, `FlowpanelTypes`, `Session`, `Scope`, errors.
- **Runtime:** `createPublisher` (memory + Redis), `createRateLimiter` (memory + Redis), `runWithRequestContext`, `emitAudit`, `checkRequireRole`, `assertResourceScope`, `resolveDateRange`.

## Subpath exports

- `@flowpanel/core` — main entry
- `@flowpanel/core/labels` — `LabelsConfig` + `mergeLabels` (pure data, safe in client bundles)
- `@flowpanel/core/auth` — `withClerk`, `withNextAuth`, `withLucia`

## Documentation

<https://flowpanel.dev>

## License

MIT
