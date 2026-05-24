---
"@flowpanel/core": minor
"@flowpanel/next": minor
"@flowpanel/adapter-drizzle": minor
"@flowpanel/adapter-prisma": minor
---

Security hardening: enforce tenant scope, role gates, and a filter/sort
allowlist across the read + mutation paths.

- **Scope predicate is now actually applied.** Previously
  `assertResourceScope` only checked that a `scope` was *declared* — the
  predicate `scope: (s, q) => q.where(eq(table.companyId, s.companyId))` was
  never run, so `list` / `get` / `update` / `delete` ignored tenant scope
  (IDOR). The runtime now binds the request's scope value to the resource
  predicate and threads it to the adapter at every query-context construction
  site (list pages, detail get, related-resource tabs, edit, inline-update,
  row/drawer actions, resource create/update/delete, dashboard + drawer table
  widgets, FK reference resolution).
- **New core context fields** (additive): `QueryContext.applyScope?`,
  `QueryContext.scopeRequired?`, and the same two on `MutationContext`. The
  adapter calls `applyScope(query)` with its own query representation.
- **Adapters are leak-proof and fail-closed.** The Drizzle adapter captures
  the scope condition via a `.where()` probe and AND-s it into `list`, `get`,
  `update`, and `delete`. The Prisma adapter merges the scope keys into the
  `where` object, switching `get` to `findFirst` and `update`/`delete` to
  `updateMany`/`deleteMany` so an out-of-scope id matches 0 rows. Both throw
  `FlowpanelAccessError` when `scopeRequired` is set but no `applyScope` was
  bound — never running an unscoped query for a scope-required resource.
- **Role gates extended to dashboards and pages.** `DashboardConfig` and
  `PageConfig` gain `requireRole?: string | string[] | ((session) => boolean)`
  (additive), mirroring `ResourceConfig`/`QueueConfig`. Enforced via
  `checkRequireRole` before dashboard / user-page render, on the related
  resource of a detail tab, and on drawer resource tabs.
- **Filter/sort allowlist.** List params now validate filter keys and the
  sort field against the resource's declared columns / filters / search,
  dropping unknown filter keys and ignoring an unknown sort field. Closes the
  unvalidated-filter/sort data-oracle on Prisma and keeps behavior consistent
  with Drizzle's column map.
