# Multi-tenant admin

Most SaaS admins are scoped to one tenant (workspace, organization, account).
A user on team A must never see team B's rows — not through list, not through
a crafted `get`, not through search, not through a filter twist on an action.

FlowPanel enforces this through **one function** in `security.rowLevel`. Every
CRUD endpoint applies it. The rest of this page shows the whole pattern end
to end.

## The whole thing, in one config

```ts
// flowpanel.config.ts
import { defineFlowPanel, defineResource } from "@flowpanel/core";
import { prismaAdapter } from "@flowpanel/adapter-prisma";
import { prisma } from "./lib/prisma";
import { getSession } from "./lib/auth"; // returns { userId, role, tenantId }

export const flowpanel = defineFlowPanel({
  appName: "My SaaS",
  adapter: prismaAdapter({ prisma }),

  security: {
    auth: { getSession },

    // The heart of the pattern: one function, called once per request,
    // returns the scalar fields every resource query must be scoped by.
    rowLevel: {
      filter: (session, ctx) => {
        // Per-resource dispatch via ctx.resource — rarely needed, but
        // there for the case where one resource is NOT scoped (e.g. a
        // global `audit_log` table only admins see).
        if (ctx.resource === "auditLog") return {}; // no scope

        return { tenantId: session.tenantId };
      },
    },
  },

  resources: {
    // The `tenantId` column must exist on each scoped table. FlowPanel
    // won't invent it — it's enforced only if it's there.
    project: defineResource<Project>(prisma.project, {
      columns: (p) => [p.name, p.status, p.createdAt],
      // No mention of tenantId here — rowLevel handles it invisibly.
    }),

    invoice: defineResource<Invoice>(prisma.invoice, {
      columns: (i) => [i.number, i.amount, i.status],
    }),

    // Opt-out: admin-only, not tenant-scoped.
    auditLog: defineResource<AuditLog>(prisma.auditLog, {
      access: { list: ["superadmin"] },
      columns: (a) => [a.action, a.actorEmail, a.createdAt],
    }),
  },
});
```

## What FlowPanel enforces for you

For **every** resource where `rowLevel.filter` returns a scalar:

| Endpoint | Behaviour |
|---|---|
| `list` | Injects `WHERE tenantId = :t` into the query. No way to see other tenants' rows. |
| `get` | Fetches the row, then compares `row.tenantId` to the scope. Non-match returns `NOT_FOUND` (indistinguishable from "missing" — no probing). |
| `update`/`delete` | Same pre-fetch check. Action on a row outside scope = `NOT_FOUND`. |
| `create` | Injects the scalar into the payload before INSERT. A user can't escape their tenant even by forging a tenantId in the form body. |
| `action` / `actionDialog` | Pre-fetches the row and applies the same check. |
| `actionBulk` | Filters `recordIds` through the scope via the `in` operator; rows outside scope never reach the handler. |

This means: in practice, `tenantId` is **never** in any column, filter, form
field, or action payload. The developer never writes it. The enforcement is
the same one block, in the same place, for everything.

## Testing the boundary

Add a test that proves tenant-A cannot see tenant-B:

```ts
// tests/multi-tenant.test.ts
import { describe, expect, it } from "vitest";
import { caller } from "./test-utils"; // boilerplate helper

describe("multi-tenant", () => {
  it("tenant A user cannot list tenant B projects", async () => {
    const a = caller({ userId: "u1", tenantId: "tenant-a" });
    const b = caller({ userId: "u2", tenantId: "tenant-b" });

    await a.flowpanel.resource.create.mutate({
      resourceId: "project",
      data: { name: "A's project" },
    });
    await b.flowpanel.resource.create.mutate({
      resourceId: "project",
      data: { name: "B's project" },
    });

    const visibleToA = await a.flowpanel.resource.list.query({
      resourceId: "project",
      page: 1,
    });
    const names = visibleToA.data.map((r) => r.name);
    expect(names).toContain("A's project");
    expect(names).not.toContain("B's project");
  });

  it("tenant A cannot get tenant B project by id", async () => {
    const a = caller({ userId: "u1", tenantId: "tenant-a" });
    const b = caller({ userId: "u2", tenantId: "tenant-b" });

    const bProject = await b.flowpanel.resource.create.mutate({
      resourceId: "project",
      data: { name: "B's secret" },
    });

    // Indistinguishable from "project does not exist".
    await expect(
      a.flowpanel.resource.get.query({ resourceId: "project", recordId: bProject.id }),
    ).rejects.toThrow(/Record not found/);
  });

  it("tenant A cannot update tenant B record even with forged payload", async () => {
    const a = caller({ userId: "u1", tenantId: "tenant-a" });
    const b = caller({ userId: "u2", tenantId: "tenant-b" });

    const bProject = await b.flowpanel.resource.create.mutate({
      resourceId: "project",
      data: { name: "B's" },
    });

    // Forge tenantId in payload — still blocked by row pre-fetch.
    await expect(
      a.flowpanel.resource.update.mutate({
        resourceId: "project",
        recordId: bProject.id,
        data: { name: "hacked", tenantId: "tenant-a" },
      }),
    ).rejects.toThrow(/Record not found/);
  });
});
```

Run `pnpm test:integration` with a real Postgres (the bundled CI matrix
covers this). One green run on Day 1 is worth a lot more than hoping the
middleware is doing its job.

## Widgets + dashboards

Widgets bypass the resource router — they read `ctx.db` directly. That
means `rowLevel` cannot reach them automatically. The pattern:

```ts
dashboard: (w) => [
  w.metric({
    label: "Active projects",
    value: async (ctx) => {
      const tenantId = ctx.session.tenantId; // <- always from the session
      return ctx.db.project.count({
        where: { tenantId, archived: false },
      });
    },
  }),
],
```

Treat `ctx.session.tenantId` as the only safe source of scope in widget
loaders. Never read it from a request parameter or URL.

## What we deliberately don't do

- **No magic "scoped DB client."** FlowPanel doesn't wrap your Prisma or
  Drizzle client to inject filters — that's fragile (nested `include`s
  leak) and opaque. The enforcement is visible in the resource router;
  widgets are your responsibility.
- **No "tenant field discovery."** You tell FlowPanel the scope explicitly.
  Silent mapping from session keys to column names is convenient right
  until it drifts from reality.

## Checklist before shipping

- [ ] `tenantId` (or your equivalent) is **NOT** in any resource's
      `columns`, `filters`, or form fields.
- [ ] `rowLevel.filter` returns a scalar for every tenant-scoped
      resource and `{}` for the rest.
- [ ] Three integration tests above pass on a real Postgres.
- [ ] Every widget loader derives scope from `ctx.session`, never from
      widget input.
- [ ] If you expose cross-tenant resources (support/admin tools), they
      are in a separate config or gated by an `access` role check.
