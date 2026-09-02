# @flowpanel/eslint-plugin

## 0.2.0

### Minor Changes

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

## 0.1.0

First public release. ESLint rules that enforce FlowPanel config idioms — server-import boundaries, column-keyword typos, shorthand filters, unique resource names, and audited-action confirms.
