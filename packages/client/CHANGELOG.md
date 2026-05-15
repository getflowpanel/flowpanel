# @flowpanel/client

## 1.0.1

### Patch Changes

- **Critical wiring fix.** `handlers()` now actually dispatches drawer GET +
  drawer-action POST, instead of returning 204/405 stubs.

  Before this patch, an app wired with the canonical 2-route shape
  (`[...route]/route.ts` for `handlers()` + `stream/route.ts` for SSE) would
  silently 404 on every drawer-row click and 405 on every drawer action.
  The client-side fetch URLs in `DrawerHost.tsx` (`GET
/api/flowpanel/drawer/<r>/<id>` and `POST /api/flowpanel/drawer/<r>/<id>/actions/<key>`)
  fell through to the catch-all stub.

  After this patch, `handlers()` is the single point of API wiring for
  admin endpoints. Two route files cover the entire surface:

  ```
  app/api/flowpanel/[...route]/route.ts   // handlers(config) — drawer GET + actions POST
  app/api/flowpanel/stream/route.ts       // stream(config) — SSE
  ```

  A new contract test (`handlers-dispatch.test.ts`) locks this against
  future drift: every fetch URL in `DrawerHost.tsx` must have a matching
  dispatch branch.

  Existing apps that explicitly wired `app/api/flowpanel/drawer/[resource]/[id]/route.ts`
  keep working — Next.js prefers the more-specific route file. But you can
  remove that file and rely on the catch-all (the `freelance-radar` example
  in this repo did exactly that).

- Updated dependencies
  - @flowpanel/core@1.0.1

## 1.0.0

### Major Changes

- 7966ada: M4a — Prisma adapter, eject CLI, theme.components, labels, motion + a11y polish.

  **New: `@flowpanel/adapter-prisma`** — DMMF runtime introspection, CRUD with soft-delete + restore + restore-list filter, parity with `@flowpanel/adapter-drizzle`. `@prisma/client` is an optional peer (5.x and 6.x supported). String-id PK coercion to `Int`/`BigInt` at the adapter boundary, with a `NaN` guard. Re-exported via `flowpanel/prisma` subpath.

  **CLI: `flowpanel eject resource <name>`** — copies a 5-file ownable scaffold under `app/admin/<name>/` (page, new, detail, edit, actions), each stamped with the eject marker `// flowpanel: ejected @ <version> — this file is yours`. ts-morph removes the matching `resource(...)` call from `flowpanel.config.ts` and appends an `// ejected: app/admin/<name>` marker comment. `doctor` exposes `checkEjectMarker` to verify. Recognises drizzle, prisma, and bare-identifier resource shapes.

  **Runtime DX: `theme.components`** — `<ComponentsProvider>` + `useComponents()` make the slot registry real. `EmptyState` and `MetricCard` are overridable from `theme.components`. `DefaultEmptyState` and `DefaultMetricCard` are now public so user wrappers can compose without recursion. The `@flowpanel/next` bridge forwards `config.theme.components` automatically.

  **Runtime DX: `labels`** — typed `LabelsConfig` (structured, not flat `Record<string,string>`) + `mergeLabels(user)` (returns `DEFAULT_LABELS` singleton when input is empty/undefined). Wired through `<LabelsProvider>` + `useLabels()`. Three internal consumers exercise the registry: BulkBar `${n} selected`, DataTable empty state, ReferencePicker empty fallback.

  **Polish — motion**: skeleton shimmer (replaces Tailwind animate-pulse), scale-in for popover/dropdown/alert-dialog content, slide-up for BulkBar; all `prefers-reduced-motion`-aware via `animation: none` cancellation.

  **Polish — a11y**: drawer accessible-name regression test guarding the Radix Dialog wrapper, `FormError` declares `aria-live="assertive"` explicitly. Axe Playwright smoke (`/admin`, `/admin/users`, `/admin/monitoring` — wcag2a+wcag2aa) and keyboard-only smoke (skip-link tab + Esc closes drawer) added to `@flowpanel/e2e`.

  **Showcase (freelance-radar)**: demos `theme.components.MetricCard` via `PriorityMetricCard` (rings the default body) + Russian `labels` for 6 chrome groups (actions, bulkBar, pagination, noResults, confirm).

  **Breaking changes from `0.3.0-alpha.1`**: none of the existing public API is removed; M4a is additive. The major bump signals API surface stabilization for 1.0.

### Minor Changes

- **FlowPanel 1.0** — public API frozen.

  This release contains documentation + OSS hygiene + type tests. No
  runtime code changes from `1.0.0-beta.2`.

  **Documentation:**

  - 5 ADRs (`docs/adr/`) catalogue the major design decisions: TypeScript
    module augmentation for `db` typing, the Publisher abstraction with
    memory + Redis drivers, the three eject targets (no fourth),
    `exactOptionalPropertyTypes` discipline, and the two-ORM adapter
    decision.
  - 12 public-API invariants (`docs/invariants.md`) covering purity of
    `defineAdmin`, the `Adapter.kind` discriminant, builder stability,
    server/client bundle isolation, SSE channel naming, eject markers,
    bundle budgets, semver discipline, no globals, slot append-only,
    labels forward-compat.
  - Root `README.md` rewritten with the actual 1.0 API surface and a
    real working config example.

  **OSS hygiene:**

  - `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` (Contributor
    Covenant 2.1), `CODEOWNERS`, structured issue templates (bug + feature),
    PR template with public-API impact + DCO checklist.

  **Type tests:**

  - tsd suites for `@flowpanel/core` (10 assertions covering builders,
    `Adapter.kind`, `LabelsConfig`, `RealtimeConfig`),
    `@flowpanel/adapter-drizzle` (3 assertions), and
    `@flowpanel/adapter-prisma` (2 assertions). Run via
    `pnpm -r test:types`. React tsd is deferred to 1.0.x due to
    peer-dep type-resolution complexity.

  **What's deferred to 1.0.x / 1.1:**

  - fumadocs documentation site at `apps/docs/` (the markdown docs in
    `docs/{guides,reference,recipes}/` are complete and shipped).
  - `flowpanel eject dashboard` and `flowpanel eject layout` (resource
    eject ships now; the others reject with "not yet implemented").
  - Prometheus `/metrics` endpoint.
  - `/admin/_audit` dashboard preset.
  - Visual regression tests (`toHaveScreenshot`).

- 27b81ca: M3 — Queues + Realtime + Drizzle MySQL/SQLite + DX polish.

  Realtime (§13):

  - `Publisher` with memory + Redis drivers; `createPublisher({ driver, url?, keyPrefix? })`.
  - SSE broker at `/admin/api/_stream?channel=<name>`: per-connection subscribe, 15s heartbeat comment, AbortSignal cleanup.
  - `useLiveChannel(channel, handler)` React hook with exponential reconnect (cap 30s).
  - `<LiveIndicator>` atom + `<DataTable realtime="resource.<name>">` auto-refresh.
  - `publish(channel, payload?)` / `publishResource(name, event)` server APIs.
  - `AdminConfig.realtime` field; `bindPublisher(config)` wires the singleton.
  - Resource mutations auto-publish `resource.<name>` via `@flowpanel/next` apply-action-result helper.

  Queues (§15):

  - `queue(ref, { label, boardUrl, key?, requireRole? })` builder; `queuesByKey` in `ResolvedAdminConfig`.
  - New package `@flowpanel/adapter-bullmq`: `bullmqAdapter(queues)` + `startBoardServer({ queues, port, basePath? })` (Express-mounted bull-board).
  - `/admin/queues/<key>` iframe page that embeds the user's bull-board.

  Rate limiting (§17):

  - `createRateLimiter({ driver: "memory" | "redis", limit, windowMs, keyPrefix? })`.
  - Wired into `buildRequestContext`: 429 returned after limit exceeded.

  DataTable (§2.1 — deferred items now shipped):

  - Column resize via pointer drag; per-column widths persist via `columnWidths` / `onColumnWidthsChange`.
  - Column pinning left/right with sticky positioning; `pinnedColumns` / `onPinnedColumnsChange`.

  Drizzle adapter (§2.1):

  - MySQL 8 integration suite (`testcontainers/mysql`).
  - SQLite integration suite (`better-sqlite3` `:memory:`).
  - Dialect branch for non-RETURNING `INSERT`/`UPDATE`: MySQL/SQLite use insert-then-select-by-pk; Postgres keeps `.returning()`.
  - Count expression dialect-conditional: `count(*)::int` on PG, `count(*)` elsewhere.
  - `create` on non-RETURNING dialects now throws a descriptive error if PK is missing from input (auto-increment PKs not yet supported — explicit PK required).

  Developer experience:

  - `InferDB = FlowpanelTypes extends { db: infer D } ? D : unknown` now threads through `ActionContext` (DrawerAction / RowAction / BulkAction). `ctx.db` in action handlers is strongly typed via the `declare module "@flowpanel/core" { interface FlowpanelTypes { db: typeof db } }` augmentation — no casts.

  E2E harness:

  - Retired M1-era `FlowPanelUI` mock app under `packages/e2e/app/**`; Playwright `webServer` now boots `examples/freelance-radar` directly.
  - Added `m3-realtime.spec.ts`: cross-tab smoke that soft-deletes a user in tab A and asserts tab B's list drops within 2s.

  Showcase (freelance-radar):

  - `realtime: { driver: "memory" }` enabled by default.
  - `Monitoring` dashboard with per-queue health metrics + realtime-live jobs table.
  - 3 BullMQ queues (scraper / emails / billing); `flowpanel:board` script.
  - `Disable user` drawer action now performs a real soft-delete.

### Patch Changes

- Updated dependencies
- Updated dependencies [2650344]
- Updated dependencies [27b81ca]
- Updated dependencies [7966ada]
  - @flowpanel/core@1.0.0

## 1.0.0-beta.2

### Major Changes

- M4a — Prisma adapter, eject CLI, theme.components, labels, motion + a11y polish.

  **New: `@flowpanel/adapter-prisma`** — DMMF runtime introspection, CRUD with soft-delete + restore + restore-list filter, parity with `@flowpanel/adapter-drizzle`. `@prisma/client` is an optional peer (5.x and 6.x supported). String-id PK coercion to `Int`/`BigInt` at the adapter boundary, with a `NaN` guard. Re-exported via `flowpanel/prisma` subpath.

  **CLI: `flowpanel eject resource <name>`** — copies a 5-file ownable scaffold under `app/admin/<name>/` (page, new, detail, edit, actions), each stamped with the eject marker `// flowpanel: ejected @ <version> — this file is yours`. ts-morph removes the matching `resource(...)` call from `flowpanel.config.ts` and appends an `// ejected: app/admin/<name>` marker comment. `doctor` exposes `checkEjectMarker` to verify. Recognises drizzle, prisma, and bare-identifier resource shapes.

  **Runtime DX: `theme.components`** — `<ComponentsProvider>` + `useComponents()` make the slot registry real. `EmptyState` and `MetricCard` are overridable from `theme.components`. `DefaultEmptyState` and `DefaultMetricCard` are now public so user wrappers can compose without recursion. The `@flowpanel/next` bridge forwards `config.theme.components` automatically.

  **Runtime DX: `labels`** — typed `LabelsConfig` (structured, not flat `Record<string,string>`) + `mergeLabels(user)` (returns `DEFAULT_LABELS` singleton when input is empty/undefined). Wired through `<LabelsProvider>` + `useLabels()`. Three internal consumers exercise the registry: BulkBar `${n} selected`, DataTable empty state, ReferencePicker empty fallback.

  **Polish — motion**: skeleton shimmer (replaces Tailwind animate-pulse), scale-in for popover/dropdown/alert-dialog content, slide-up for BulkBar; all `prefers-reduced-motion`-aware via `animation: none` cancellation.

  **Polish — a11y**: drawer accessible-name regression test guarding the Radix Dialog wrapper, `FormError` declares `aria-live="assertive"` explicitly. Axe Playwright smoke (`/admin`, `/admin/users`, `/admin/monitoring` — wcag2a+wcag2aa) and keyboard-only smoke (skip-link tab + Esc closes drawer) added to `@flowpanel/e2e`.

  **Showcase (freelance-radar)**: demos `theme.components.MetricCard` via `PriorityMetricCard` (rings the default body) + Russian `labels` for 6 chrome groups (actions, bulkBar, pagination, noResults, confirm).

  **Breaking changes from `0.3.0-alpha.1`**: none of the existing public API is removed; M4a is additive. The major bump signals API surface stabilization for 1.0.

### Patch Changes

- Updated dependencies
  - @flowpanel/core@1.0.0-beta.2

## 0.3.0-alpha.1

### Minor Changes

- M3 — Queues + Realtime + Drizzle MySQL/SQLite + DX polish.

  Realtime (§13):

  - `Publisher` with memory + Redis drivers; `createPublisher({ driver, url?, keyPrefix? })`.
  - SSE broker at `/admin/api/_stream?channel=<name>`: per-connection subscribe, 15s heartbeat comment, AbortSignal cleanup.
  - `useLiveChannel(channel, handler)` React hook with exponential reconnect (cap 30s).
  - `<LiveIndicator>` atom + `<DataTable realtime="resource.<name>">` auto-refresh.
  - `publish(channel, payload?)` / `publishResource(name, event)` server APIs.
  - `AdminConfig.realtime` field; `bindPublisher(config)` wires the singleton.
  - Resource mutations auto-publish `resource.<name>` via `@flowpanel/next` apply-action-result helper.

  Queues (§15):

  - `queue(ref, { label, boardUrl, key?, requireRole? })` builder; `queuesByKey` in `ResolvedAdminConfig`.
  - New package `@flowpanel/adapter-bullmq`: `bullmqAdapter(queues)` + `startBoardServer({ queues, port, basePath? })` (Express-mounted bull-board).
  - `/admin/queues/<key>` iframe page that embeds the user's bull-board.

  Rate limiting (§17):

  - `createRateLimiter({ driver: "memory" | "redis", limit, windowMs, keyPrefix? })`.
  - Wired into `buildRequestContext`: 429 returned after limit exceeded.

  DataTable (§2.1 — deferred items now shipped):

  - Column resize via pointer drag; per-column widths persist via `columnWidths` / `onColumnWidthsChange`.
  - Column pinning left/right with sticky positioning; `pinnedColumns` / `onPinnedColumnsChange`.

  Drizzle adapter (§2.1):

  - MySQL 8 integration suite (`testcontainers/mysql`).
  - SQLite integration suite (`better-sqlite3` `:memory:`).
  - Dialect branch for non-RETURNING `INSERT`/`UPDATE`: MySQL/SQLite use insert-then-select-by-pk; Postgres keeps `.returning()`.
  - Count expression dialect-conditional: `count(*)::int` on PG, `count(*)` elsewhere.
  - `create` on non-RETURNING dialects now throws a descriptive error if PK is missing from input (auto-increment PKs not yet supported — explicit PK required).

  Developer experience:

  - `InferDB = FlowpanelTypes extends { db: infer D } ? D : unknown` now threads through `ActionContext` (DrawerAction / RowAction / BulkAction). `ctx.db` in action handlers is strongly typed via the `declare module "@flowpanel/core" { interface FlowpanelTypes { db: typeof db } }` augmentation — no casts.

  E2E harness:

  - Retired M1-era `FlowPanelUI` mock app under `packages/e2e/app/**`; Playwright `webServer` now boots `examples/freelance-radar` directly.
  - Added `m3-realtime.spec.ts`: cross-tab smoke that soft-deletes a user in tab A and asserts tab B's list drops within 2s.

  Showcase (freelance-radar):

  - `realtime: { driver: "memory" }` enabled by default.
  - `Monitoring` dashboard with per-queue health metrics + realtime-live jobs table.
  - 3 BullMQ queues (scraper / emails / billing); `flowpanel:board` script.
  - `Disable user` drawer action now performs a real soft-delete.

### Patch Changes

- Updated dependencies [2650344]
- Updated dependencies
  - @flowpanel/core@0.3.0-alpha.1

## 0.2.5-alpha.0

### Patch Changes

- M2.5 backfill closing spec §2.1 / §19 gaps before M3 realtime lands.

  **Core + adapter**

  - `FlowpanelTypes` augmentation interface + `InferDB` helper: bind adapter's `db` type into every `WidgetContext` without per-callsite generics (spec §21).
  - `Adapter<DB>` + `WidgetContext<DB>` generic.
  - Soft-delete support in Drizzle: `delete.softDelete` column auto-filters list, UPDATE on delete, new `adapter.restore()`.
  - `toCsv` / `toJson` row serializers (RFC 4180) reused by adapter export.
  - `defineAdmin` auto-injects `BulkAction { key: "delete" }` when delete enabled and `bulkActions` undefined.

  **Next runtime**

  - `FilterBar` server-to-client pipeline; 7 filter primitives (text/select/multi/daterange/numeric/boolean/tag) wired via `useAdminTable` URL-sync hook.
  - DataTable: row selection + column-visibility + density toggle + bulk bar; `columnVisibility` prop.
  - `applyActionResult` helper: publish + revalidate; respects `refresh === false`.
  - `publish()` + `publishResource()` (memory driver; Redis driver in M3).
  - Auto-publish `resource.<name>` on built-in create/update/delete.
  - Drawer: real action executor (replaces 501 stub) with ActionContext; `triggerDownload` client utility; widget tabs render server-resolved payloads (metric, table, stat-group, chart descriptor, custom fallback).

  **React primitives**

  - 5 feedback: Toast + ToastProvider + useToast (sonner), ConfirmDialog (Radix AlertDialog), SkeletonTable, HealthBanner, ErrorState.
  - 5 data-input: ReferencePicker (cmdk+Popover async FK), TagInput, JsonEditor, FormSection, AsyncSelect.
  - 5 atoms: TimeAgo, StatusBadge, CopyButton, Sparkline, Avatar.
  - Shell: Breadcrumbs, DetailShell, SectionLabel, Divider; PageHeader.breadcrumbs prop.
  - Field dispatches `type=json|tags|textarea` to new primitives.

- Updated dependencies
  - @flowpanel/core@0.2.5-alpha.0
