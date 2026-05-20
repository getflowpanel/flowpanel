# FlowPanel Documentation

One typed config → full admin panel for your Next.js app. Drizzle or
Prisma. Realtime. Queues. Eject when you outgrow it.

The canonical Markdown lives here under `docs/`. The published site
(<https://flowpanel.dev>) renders the same files from
`apps/docs/src/content/docs/` via Astro Starlight.

## Guides

- [Getting started](./guides/getting-started.md) — install, scaffold, run your first admin

## Reference

- [Resources](./reference/resources.md) — columns, filters, drawer, scope, audit
- [Dashboards](./reference/dashboard.md) — sections, widget builders, dateRange, charts
- [Actions](./reference/actions.md) — `RowAction`, `BulkAction`, `ActionResult`
- [Realtime](./reference/realtime.md) — pub/sub drivers and SSE wiring
- [Queues](./reference/queues.md) — BullMQ + bull-board setup
- [Shell](./reference/shell.md) — `sidebar` / `tabs` / `bare` modes, mobile drawer
- [Theme](./reference/theme.md) — `theme.components` slots, tokens, dark mode
- [Command palette](./reference/command-palette.md) — built-in groups and ⌘K config
- [Adapters](./reference/adapters.md) — Drizzle / Prisma feature matrix
- [Next.js handlers](./reference/handler.md) — `handlers(config)` + `stream(config)`
- [Errors](./reference/errors.md) — typed error hierarchy and `onError` hook
- [Metrics](./reference/metrics.md) — pointer to dashboard `metric()` (helper module is WIP)
- [CLI](./reference/cli.md) — `init`, `migrate`, `doctor`, `eject`, `dev`, `new`
- [Typing `ctx.db`](./reference/types-augmentation.md) — `FlowpanelTypes` augmentation

## Recipes

- [Multi-tenant admin](./recipes/multi-tenant.md) — scope-based row-level security
- [JSON / JSONB editor](./recipes/jsonb-editor.md) — read, edit, filter shaped JSON columns
- [File uploads](./recipes/file-uploads.md) — WIP, planned for v1.1

## Specs and contracts

- [Public-API invariants](./invariants.md) — the contract surface FlowPanel commits to from 1.0
- [ADRs](./adr/) — architectural decisions and their rationales
- [Spec v1.0](./spec/flowpanel-v1.0.md) — frozen scope and module-by-module spec
