# @flowpanel/adapter-drizzle

## 0.2.0

### Minor Changes

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

- 52606de: Remove public API that no runtime surface ever reached, before 0.2 freezes it.

  `runMutationPipeline` and its `MutationPipelineStage`, `MutationPipeline` and
  `PostCommitEffect` types are gone from `@flowpanel/core`. They were documented
  as the one ordered mutation runner shared by generated pages, HTTP handlers and
  headless surfaces; nothing called them, and all four real mutation surfaces
  order their own stages.

  `FieldDef.visibleWhen` and `FieldDef.disabledWhen` are gone, along with the
  `UiCondition` AST and `evaluateUiCondition`. No form renderer read them:
  `resolve-form-fields` builds each `ResolvedField` explicitly and the client
  field spec has no slot for a condition tree.

  `ColumnDef.select` is gone. It was validated at compile time and folded into a
  projection nothing consulted at runtime. A `render` column that declares no
  `field` still fails compilation, with the message adjusted accordingly.

  `AdapterCapabilities` keeps only `version`. The `projections`, `transactions`,
  `atomicImport`, `returningRows` and `migrations` flags, the redundant
  `AdapterV2.transaction` redeclaration, the `adapterCapabilities` v1 bridge and
  `assertAdapterCapabilities` are removed — no runtime code branched on a flag,
  and the only consumer was a self-consistency check over the flags themselves.
  The shipped drizzle and prisma adapters now declare `capabilities: { version: 2 }`.
  `Adapter.transaction` is untouched.

  `CompiledResource.clientProjection` and `serverProjection`, the
  `collectResourceExposure` collector that built them, and `getCompiledAdmin` are
  removed from `@flowpanel/core`. The doc comment claiming the projections were
  shared by every runtime surface was false — `@flowpanel/next` derives its own
  field allowlists.

  `projectRow` is removed from `@flowpanel/next`. It was a synchronous twin of
  `projectAuthorizedRow` with only test callers, carrying a weaker field-policy
  check that would have leaked fields under a request-scoped `read` rule.
  `projectAuthorizedRow` and `declaredRowFields` are unchanged.

  The `no-server-import-in-client` ESLint rule inspects bare specifiers again.
  It had been narrowed to app-local specifiers, so a package's server subpath —
  including the one this framework itself publishes — imported from a
  `"use client"` file passed silently. `next/server` remains allowed.

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

- 12fdd08: Reject migration SQL that would silently break the adapter's own guarantees.

  Drizzle's `applyMigration` wraps a file's statements and the applied-marker in
  one transaction, yet a `COMMIT` inside the file sailed through and split that
  boundary without a word. Both adapters now share one policy, exported from the
  core-internal SQL lexer: client directives (`DELIMITER`, `SOURCE`, psql and
  sqlite dot commands, `GO`) and transaction-control statements are refused
  loudly before any SQL runs. Previously the two adapters had drifted — Prisma
  refused what Drizzle accepted.

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

- 12fdd08: Make list search behave the same on every supported database.

  The Prisma adapter passed `mode: "insensitive"` unconditionally, but Prisma
  accepts `mode` only on PostgreSQL — any `?search=` against a SQLite or MySQL
  resource threw `Unknown argument 'mode'` and 500'd the page. The flag is now
  sent only to PostgreSQL; MySQL and SQLite already compare case-insensitively
  under their default collations. A real-client integration test now searches on
  SQLite so this class of provider-only argument can't ship green again.

  The Drizzle adapter interpolated the raw query into `LIKE '%…%'`, so searching
  for `100%` matched every row. `%`, `_` and the escape character are now escaped
  and the pattern runs with an explicit `ESCAPE`, on all three dialects.

- cb7374d: Give the fail-closed scope rule one definition.

  Both first-party adapters resolved the bound tenant predicate themselves, with
  the same fallback chain and the same refusal — down to an identical two-line
  message. A hardening change to either was invisible to the other, and a
  third-party adapter had only prose to copy from.

  `resolveScopeApplier(ctx)` in `@flowpanel/core` is now that rule: it returns the
  bound predicate, `null` when the resource declares no scope, and throws
  `FlowpanelAccessError` when a scope is required but absent. Both adapters call
  it, and `docs/reference/runtime-contracts` states the obligation for anyone
  writing a third.

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
- Updated dependencies [4157802]
- Updated dependencies [12fdd08]
- Updated dependencies [cb7374d]
- Updated dependencies [cb7374d]
- Updated dependencies [e0e7b5d]
- Updated dependencies [52606de]
- Updated dependencies [52606de]
- Updated dependencies [cb7374d]
- Updated dependencies [efc7e36]
- Updated dependencies [52606de]
  - @flowpanel/core@0.2.0

## 0.1.0

First public release. Drizzle ORM adapter for FlowPanel — Postgres, MySQL, and SQLite, with schema introspection, scoped queries, and soft-delete.
