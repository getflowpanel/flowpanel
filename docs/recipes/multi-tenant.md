# Multi-tenant admin

Most SaaS admins are scoped to one tenant (workspace, organization, account).
A user on team A must never see team B's rows. FlowPanel exposes the building
blocks to enforce that — a top-level `scope` function that resolves to scalars
from the session, and a per-resource `scope` callback (or `"bypass"`) that
folds those scalars into adapter queries.

> The runtime helpers exist today (`scope` on `AdminConfig`, `scope` on
> `ResourceOptions`, `assertResourceScope` in
> [`packages/core/src/runtime/scope.ts`](../../packages/core/src/runtime/scope.ts)),
> but the *automatic* enforcement across every CRUD path is still narrow:
> `assertResourceScope` requires every resource to declare a per-resource
> `scope` (or opt out) when a global scope is configured, and the per-resource
> `scope` callback receives the scalar map and the in-flight query so the
> adapter can apply it. Widget loaders and any custom `listQuery` you write
> are **your** responsibility — `ctx.scope` is on
> [`RequestContext`](../../packages/core/src/types/context.ts) for you to
> read.

## The shape

```ts
// flowpanel.config.ts
import { defineAdmin, resource } from "flowpanel";
import { drizzleAdapter } from "flowpanel/drizzle";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { getSession } from "@/lib/auth"; // returns { userId, role, tenantId } | null

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),

  auth: {
    session: getSession,
    role: (s) => (s as { role?: string } | null)?.role ?? "guest",
    requireRole: "admin",
  },

  // Top-level scope: one function, called per request. Returns the scalar
  // fields every resource is scoped by, or null to mean "no scope active".
  // Type: (ctx: ScopeContext) => Promise<Scope> | Scope
  // Where Scope = Record<string, unknown> | null
  scope: ({ session }) => {
    const s = session as { tenantId?: string } | null;
    return s?.tenantId ? { tenantId: s.tenantId } : null;
  },

  resources: [
    resource(schema.projects, {
      label: "Projects",
      columns: ["name", "status", "createdAt"],
      // When a global `scope` is set, every resource MUST either define
      // its own per-resource scope callback or opt out with "bypass" —
      // assertResourceScope() throws otherwise. The callback receives the
      // resolved scalar map and the in-flight query so the adapter can
      // narrow it. Today this is the only spot tenant-isolation is wired:
      // your `listQuery`/`itemQuery` (and widgets) must read ctx.scope.
      scope: (scope, query) => ({ ...(query as object), tenantId: scope?.tenantId }),
    }),

    // Opt-out: admin-only, not tenant-scoped.
    resource(schema.auditLog, {
      label: "Audit log",
      columns: ["action", "actorEmail", "createdAt"],
      scope: "bypass",
      requireRole: ["superadmin"],
    }),
  ],
});
```

## What FlowPanel actually does

- `assertResourceScope()` runs at request time per resource. With a global
  `scope` configured, any resource that hasn't declared `scope: <fn> | "bypass"`
  throws a `FlowpanelAccessError` with the message
  `"Resource is missing scope. Global scope is active — every resource must
  define a scope or opt out explicitly with scope: \"bypass\"."`
  (see [`runtime/scope.ts:12-15`](../../packages/core/src/runtime/scope.ts)).
  This is the safety net that prevents a forgotten resource from silently
  leaking across tenants.
- `ctx.scope` is exposed on every handler context (`RequestContext` in
  [`types/context.ts`](../../packages/core/src/types/context.ts)). Custom
  `listQuery`, `itemQuery`, action `run` handlers, and widget queries all
  receive it.
- Per-resource `scope: (scope, query) => ...` is the integration point with
  the adapter. The exact shape of `query` depends on the adapter — the
  Drizzle adapter passes its query builder, the Prisma adapter passes the
  delegate args object. You return a narrowed query.

What FlowPanel **does not** auto-magic for you:

- It does not silently inject `tenantId` into create/update payloads. If
  the column is `NOT NULL`, your `create.fields` (or `schema`) must include
  it, or your per-resource `scope` callback must add it.
- It does not snoop into nested `include`s. Joining to another tenant's
  rows is your query's job to refuse.
- Widget loaders are not routed through resource scope. Read `ctx.scope`
  in the widget yourself.

## Widgets + dashboards

Widgets call `ctx.db` directly (see [`types/widget.ts`](../../packages/core/src/types/widget.ts)),
so they bypass the resource path. Read tenancy from the session:

```ts
import { metric, dashboard } from "flowpanel";

dashboards: [
  dashboard({
    path: "/",
    label: "Overview",
    sections: [
      {
        label: "Today",
        columns: 4,
        widgets: [
          metric("Active projects", async ({ db, session }) => {
            const tenantId = (session as { tenantId?: string } | null)?.tenantId;
            if (!tenantId) return 0;
            // your db query here, scoped to tenantId
            return /* ... */ 0;
          }),
        ],
      },
    ],
  }),
],
```

Treat the session (or `ctx.scope` inside resource handlers) as the only
safe source of scope. Never read it from a request parameter or URL.

## Testing the boundary

The exact transport (Server Actions in `@flowpanel/next`, no tRPC) means
there is no `caller(...).flowpanel.resource.list.query` shim today. The
practical way to assert isolation is an adapter-level integration test
that mounts the resource list/get/update handlers with a faked session,
or an E2E test (Playwright) that signs in as tenant-A and asserts
tenant-B rows are absent. The shipped Playwright suite in
[`packages/e2e/`](../../packages/e2e) is the model — copy a spec there.

## Checklist before shipping

- [ ] Top-level `scope` returns a scalar object (or `null`) sourced only
      from the session.
- [ ] Every resource declares either a per-resource `scope` callback OR
      `scope: "bypass"`. The runtime throws otherwise; do not rely on it
      to "fall back" to the global scope.
- [ ] `tenantId` (or your equivalent) is **not** in any user-editable
      `columns`, `filters`, or `create`/`update.fields` — the per-resource
      `scope` callback adds it.
- [ ] Every widget loader reads tenancy from `session` (or `ctx.scope`),
      never from widget input.
- [ ] Cross-tenant resources (support tools) live behind `scope: "bypass"`
      and a `requireRole` gate.

## What we deliberately don't do

- **No magic "scoped DB client."** FlowPanel doesn't wrap your Drizzle or
  Prisma client to inject filters — that's fragile (nested `include`s
  leak) and opaque. The enforcement point is the per-resource `scope`
  callback you write; widgets are your responsibility.
- **No "tenant field discovery."** You tell FlowPanel the scope explicitly.
  Silent mapping from session keys to column names is convenient right
  until it drifts from reality.
