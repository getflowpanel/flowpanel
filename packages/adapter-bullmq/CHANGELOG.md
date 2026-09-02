# @flowpanel/adapter-bullmq

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

- 52606de: Fix scoped create, the bull-board token gate and repeated introspection in the adapters.

  `prismaAdapter.create` passed the resolved scope predicate straight to Prisma as
  `data`. That only happens to work for plain equality scopes: a scope returning
  `{ companyId: { in: [...] } }`, `{ OR: [...] }` or any other filter operator
  produced invalid insert data and every create failed with a raw Prisma
  validation error. Create now resolves insert data separately from the where
  predicate — equality scope keys are written into the new row (still overriding
  client input, so a hand-crafted foreign tenant id cannot win) and a scope that
  contributes a filter rather than a single value is refused up front with a
  `FlowpanelAccessError` naming the key and the fix, mirroring how the drizzle
  adapter refuses a create that lands outside its tenant scope.

  `startBoardServer` required a token on _every_ request, but only the iframe's
  document URL carries `?token=`. bull-board is a SPA, so its own scripts, styles
  and `/api/queues` polls arrived without one, got 401, and the embedded board
  rendered blank for every queue even with a correct token. A valid token now
  mints an HttpOnly, SameSite=Lax session cookie that authorizes the rest of the
  board session; the cookie value is derived from the token, so the raw secret
  never lands in a cookie jar and the value stays valid across restarts and
  replicas. A missing, wrong or forged credential still gets nothing, and
  `auth.token` remains required — there is still no unauthenticated mode.

  `introspect()` rebuilt full column metadata on every call in both adapters, and
  a single list render calls it repeatedly — resource exposure, the list page
  twice, once per reference column and once per autocomplete keystroke, with an
  extra linear DMMF scan on Prisma. Both adapters now memoize per ref (a `WeakMap`
  on the drizzle table, a `WeakMap` on the DMMF holding a per-model `Map` on
  Prisma). Schemas are static for a process lifetime, so the entry is reused for
  the whole process; the returned introspection and its columns are frozen because
  one object is now shared by every caller.

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

## 0.1.0

First public release. BullMQ queue dashboards for FlowPanel, backed by bull-board.
