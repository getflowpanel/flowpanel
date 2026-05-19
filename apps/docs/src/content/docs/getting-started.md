---
title: 'Getting started'
description: 'One typed config → full admin panel on top of your Next.js App Router app.'
---


FlowPanel turns one typed config into a full admin panel on top of your
Next.js App Router app. You bring the ORM, the auth, and the database;
FlowPanel renders lists, drawers, dashboards, queues, and realtime.

## Prerequisites

- Next.js `>= 15` (App Router) and React `>= 19`
- Drizzle `>= 0.30` **or** Prisma `>= 5` (pick one per project)
- Postgres, MySQL, or SQLite — any dialect your adapter supports
- Optional: `ioredis` for the Redis realtime driver, `bullmq` for queues

`flowpanel init` detects which ORM is installed and scaffolds the
matching config — `drizzleAdapter({ db, schema })` for Drizzle,
`prismaAdapter({ prisma })` for Prisma. The rest of this guide uses the
Drizzle path; the Prisma path is identical except for the adapter import
and instantiation.

## Install

```bash
pnpm add flowpanel drizzle-orm
# or: pnpm add flowpanel @prisma/client
```

`flowpanel` is the umbrella package; it re-exports `defineAdmin`,
builders, the Drizzle/Prisma adapter helpers, the auth presets, and the
chart builders via subpaths (`flowpanel/drizzle`, `flowpanel/prisma`,
`flowpanel/auth`, `flowpanel/charts`).

For BullMQ queues add the adapter explicitly:

```bash
pnpm add @flowpanel/adapter-bullmq bullmq
```

## Scaffold

```bash
pnpm flowpanel init
```

The CLI detects your stack and writes six files (overwrite-prompted if
they already exist):

| File | Purpose |
|---|---|
| `flowpanel.config.ts` | Your typed config — `defineAdmin({ ... })`. |
| `app/admin/[[...slug]]/page.tsx` | Mounts the admin shell at `/admin`. |
| `app/api/flowpanel/[...route]/route.ts` | Catch-all route — drawer GETs and drawer actions. |
| `app/api/flowpanel/stream/route.ts` | SSE endpoint for realtime channels. |
| `styles/admin.css` | The `--fp-*` token sheet. |
| `flowpanel/migrations/0001_init.sql` | Initial audit + tracking tables. |

Pass `--yes` to accept detected defaults for CI.

## Migrate

```bash
pnpm flowpanel migrate
```

Applies the SQL files in `flowpanel/migrations/` against the database
your adapter is configured for. Idempotent — re-running is a no-op.

## First resource

Open `flowpanel.config.ts` and register one `resource(...)` per table you
want to surface. The first argument is the raw Drizzle table or Prisma
delegate; the adapter handles introspection.

```ts
// flowpanel.config.ts
import { defineAdmin, resource } from "flowpanel";
import { drizzleAdapter } from "flowpanel/drizzle";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

declare module "@flowpanel/core" {
  interface FlowpanelTypes {
    db: typeof db;
  }
}

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth: {
    session: async () => /* your session lookup */ null,
    role: (s) => (s as { role?: string } | null)?.role ?? "guest",
    requireRole: "admin",
  },

  resources: [
    resource(schema.users, {
      label: "Users",
      columns: ["email", "plan", "status", "createdAt"],
      search: ["email"],
      filters: [
        {
          field: "plan",
          type: "select",
          label: "Plan",
          options: [
            { label: "Free", value: "free" },
            { label: "Pro",  value: "pro"  },
          ],
        },
        { field: "createdAt", type: "daterange", label: "Joined" },
      ],
      defaultSort: { field: "createdAt", dir: "desc" },
      rowClick: "drawer",
      delete: { softDelete: "deletedAt" },
      drawer: { width: "lg", fields: "*" },
    }),
  ],
});
```

`columns` is required. Filter `type` is one of `text | select |
multiselect | daterange | numeric-range | boolean | tag`. The full
option set is `ResourceOptions<Row>` — see [Resources](./reference/resources/).

## First dashboard

```ts
import { dashboard, defineAdmin, metric, resource, table } from "flowpanel";
import { areaChart } from "flowpanel/charts";
import { sql } from "drizzle-orm";

defineAdmin({
  // ...
  dashboards: [
    dashboard({
      path: "/",
      label: "Overview",
      dateRange: { preset: "last7d" },
      sections: [
        {
          label: "Today",
          columns: 3,
          widgets: [
            metric("Users", async ({ db }) => {
              const rows = await db
                .select({ c: sql<number>`count(*)::int` })
                .from(schema.users);
              return Number(rows[0]?.c ?? 0);
            }),
            metric("Active", async ({ db }) => 0),
            table({ resource: "users", limit: 10, rowClick: "drawer" }),
          ],
        },
      ],
    }),
  ],
});
```

Widgets are async functions; they receive `{ db, session, dateRange,
req }` and return resolved data. Chart builders (`areaChart`,
`barChart`, `lineChart`, `pieChart`) live in `flowpanel/charts`.

## Realtime

```ts
defineAdmin({
  // ...
  realtime: { driver: "memory" },          // default for dev
  // or:
  realtime: { driver: "redis", url: process.env.REDIS_URL!, keyPrefix: "fp:" },
});
```

Then opt a resource in:

```ts
resource(schema.users, { realtime: true /* publishes "resource.users" */ });
```

Every successful mutation publishes `{ action, id? }` on
`resource.<name>`. The SSE handler scaffolded at
`app/api/flowpanel/stream/route.ts` forwards subscriptions to the
browser. Widgets that take `realtime: "resource.users"` auto-invalidate
when the channel fires.

Full reference: [Realtime](./reference/realtime/).

## Run it

```bash
pnpm dev
```

Open `http://localhost:3000/admin`.

## Where to go next

- [Resources](./reference/resources/) — columns, filters, drawer, scope, audit
- [Dashboard](./reference/dashboard/) — sections, widget builders, dateRange
- [Actions](./reference/actions/) — `RowAction`, `BulkAction`, `ActionResult`
- [Adapters](./reference/adapters/) — Drizzle/Prisma feature matrix
- [Queues](./reference/queues/) — BullMQ + bull-board setup
- [Realtime](./reference/realtime/) — pub/sub drivers and SSE wiring
- [Theme](./reference/theme/) — `theme.components` slots and `--fp-*` tokens
- [Multi-tenant](./recipes/multi-tenant/) — scope-based row-level security
- [JSONB editor](./recipes/jsonb-editor/) — JSON/JSONB column patterns
