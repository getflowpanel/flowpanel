# @flowpanel/charts

## 0.2.0

### Minor Changes

- e0e7b5d: `defineAdmin` now compiles one immutable definition shared by generated pages,
  the v1 JSON API and request-scoped protected controllers. `createFlowpanel`
  binds that definition once and exposes its page, six HTTP handlers, typed
  controllers, serializable client metadata and realtime publisher. Expected
  failures use a stable `FlowpanelResult` envelope with safe codes, messages,
  request IDs and optional field errors.

  Authorization is enforced through one ordered pipeline: admin and resource
  access, operation policy, read-only mode, field read/write policy, tenant
  scope, validation and adapter execution. Drizzle and Prisma operations fail
  closed when a required scope cannot be bound. Post-commit audit, realtime and
  revalidation failures are warnings rather than false mutation failures.

  Forms are conform-based and validated end to end from `FieldDef`. Import and
  export, typed row/bulk/drawer/dashboard actions, soft delete, field-level RBAC
  and empty-field database defaults all use the same hardened write path.
  Realtime frames every SSE message as `{ channel, payload }` and shares one
  EventSource per endpoint/channel pair.

  The generated UI gets an isolated 2026 design system: namespaced light/dark
  tokens, responsive tables and actions, accessible labels and focus behavior,
  an icon registry, chart palette, polished shell and explicit component slots.
  FlowPanel styling no longer depends on or mutates a host application's global
  `.dark` class or root variables.

  The CLI now plans filesystem changes before writing. `init`, `doctor`, `new`,
  `migrate` and `eject` expose machine-readable and dry-run modes where
  applicable; filesystem writes are atomic and rollback-safe, reruns are
  idempotent, and conflicting source files are never overwritten implicitly.
  Migration SQL and bookkeeping now pass through one adapter operation. Drizzle
  splits ordinary multi-statement files, serializes and rechecks applied IDs at
  the database boundary, and uses transactional DDL where the database supports
  it. MySQL statements run individually under an advisory lock, while its
  implicit DDL commits remain explicitly non-rollbackable. `.env.local` and
  `.env` load consistently, diagnostics are concise by default, and the packed
  CLI is tested in clean npm projects on Linux and Windows.
  Custom adapters should add `applyMigration(id, sql)`; the deprecated
  `runMigrationSql` plus `markMigrationApplied` pair remains a warned, non-atomic
  upgrade fallback.

  The canonical ScrapeAI demo is a focused seven-screen competitive-price
  intelligence story with deterministic relational data, Admin/Support personas,
  a responsive operations dashboard and human review workflow. The synchronized
  documentation covers every public export, separates generated-UI compatibility
  responses from the structured v1 protocol, and is verified against source in
  CI.

  Breaking: the supported framework baseline is Next.js `^16.3.0`; `Tone`
  replaces per-surface tone vocabularies; `useAdminMutation` drops the unused
  `optimistic` option; and SSE consumers must read the channel envelope instead
  of a bare payload. The optional chart runtime is an explicit peer of
  `@flowpanel/next`, so strict package managers resolve dashboard charts instead
  of silently rendering a missing-package fallback.

### Patch Changes

- cb7374d: Stop the build racing itself into a package with no typings.

  `@flowpanel/charts`, `@flowpanel/next` and `@flowpanel/react` each build two
  tsup configs concurrently, and in each the first config declared `clean: true`.
  Whichever finished first had its output deleted by the other — which is how
  `@flowpanel/next` came to ship `client.js` with no `client.d.ts`, leaving
  `@flowpanel/kit` unable to typecheck its own `./next/client` re-export. The
  build now clears `dist` once before tsup starts, the way `@flowpanel/core`
  already did.

- 52606de: Delete modules and types no surface reached, before 0.2 freezes them.

  `Sheet` and `Tooltip` are gone from `@flowpanel/react`. Both were complete
  Radix primitive families that FlowPanel itself never rendered — the shipped
  slide-over is `Drawer`, and nothing anywhere drew a tooltip. Removing the
  tooltip family also drops `@radix-ui/react-tooltip` from the install. The
  `Dialog`, `Popover`, `Select` and `DropdownMenu` families are untouched: they
  are used, and trimming individual members would leave a documented primitive
  set that cannot be composed.

  `AdapterCapabilities` and `AdapterV2` are gone from `@flowpanel/core`, along
  with the optional `Adapter.capabilities` field and the
  `capabilities: { version: 2 }` literal both shipped adapters wrote. Nothing
  ever read the value; a version marker no runtime consults is not a contract. `bindAdapterScope`
  and `BoundAdapterScope` — the parts of that module that carry real meaning —
  stay, and now live in `types/bound-scope.ts` rather than a file named after a
  type that no longer exists.

  Internally: `@flowpanel/adapter-bullmq` no longer declares `@flowpanel/core` as
  a dependency it never imported, an orphaned `Kbd` component is deleted, four
  guard helpers superseded by `withGuards` are removed from `@flowpanel/next`, and
  the chart tick formatter's six-case switch collapses to the two-way branch it
  always was.

- cb7374d: Collapse helpers that existed in more than one copy. No behaviour changes.

  Six routes hand-wrote the 404 that `notFoundResponse` already produces, so
  their bodies drifted from its terse shape and skipped its development-mode
  server log naming the registered resources. They call the helper now.

  `findPropertyByName` and `asStringLiteral` were declared three and two times
  across the lint rules; both live in `ast-utils`.

  `@flowpanel/react` re-exports `NumericFormat` and `Tone` from `@flowpanel/core`
  rather than mirroring the unions, so adding a variant in core can no longer leave
  the two vocabularies disagreeing. The import is type-only and keeps the client
  bundle free of core's runtime.

- efc7e36: Build every package with the same script, and drop unused dev dependencies.

  `core`, `next`, `react` and `charts` cleaned `dist` with a shell
  `rm -rf dist && tsup`, which fails on Windows — a contributor there could not
  run `pnpm build` at all. The multi-config packages clear `dist` once from the
  config module instead, and every package's build script is now plain `tsup`.

  `testcontainers` was declared by both adapters but imported by neither (the
  `@testcontainers/postgresql` and `@testcontainers/mysql` modules bring it
  themselves), `pg` and `@types/pg` were declared by the Drizzle adapter whose
  PostgreSQL tests use `postgres`, and `@typescript-eslint/parser` was declared by
  the ESLint plugin, which reaches it through `@typescript-eslint/rule-tester`.

- Updated dependencies [12fdd08]
- Updated dependencies [52606de]
- Updated dependencies [f54f815]
- Updated dependencies [12fdd08]
- Updated dependencies [4157802]
- Updated dependencies [12fdd08]
- Updated dependencies [cb7374d]
- Updated dependencies [cb7374d]
- Updated dependencies [e0e7b5d]
- Updated dependencies [52606de]
- Updated dependencies [52606de]
- Updated dependencies [cb7374d]
- Updated dependencies [cb7374d]
- Updated dependencies [efc7e36]
- Updated dependencies [52606de]
  - @flowpanel/core@0.2.0
  - @flowpanel/react@0.2.0

## 0.1.0

First public release. Recharts-backed chart widgets (area, bar, line, pie) for FlowPanel dashboards, loaded lazily.
