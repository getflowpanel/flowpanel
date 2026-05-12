# @flowpanel/adapter-bullmq

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
