---
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/react": minor
"@flowpanel/kit": minor
"@flowpanel/charts": minor
"@flowpanel/cli": minor
"@flowpanel/client": minor
"@flowpanel/eslint-plugin": minor
"@flowpanel/adapter-drizzle": minor
"@flowpanel/adapter-prisma": minor
"@flowpanel/adapter-bullmq": minor
---

`defineAdmin` now compiles one immutable definition shared by generated pages,
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
