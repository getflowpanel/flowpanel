# FlowPanel

> One typed config → full admin panel for your Next.js app. Drizzle or Prisma. Realtime. Queues. Eject when you outgrow it.

[![npm](https://img.shields.io/npm/v/flowpanel.svg)](https://www.npmjs.com/package/flowpanel)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/Ch4m4/flowpanel/actions/workflows/ci.yml/badge.svg)](https://github.com/Ch4m4/flowpanel/actions/workflows/ci.yml)

## Install

```bash
pnpm add flowpanel
pnpm flowpanel init
pnpm flowpanel dev
```

Visit `http://localhost:3000/admin`. Done.

`flowpanel init` detects your stack (Next.js, Drizzle/Prisma, auth) and scaffolds the config + 6 wiring files. `flowpanel dev` starts Next.js (and bull-board if `REDIS_URL` is set).

## Use

```ts
// flowpanel.config.ts
import { defineAdmin, resource, dashboard, metric, table } from "flowpanel";
import { drizzleAdapter } from "flowpanel/drizzle";
import { withClerk } from "flowpanel/auth";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

declare module "@flowpanel/core" {
  interface FlowpanelTypes {
    db: typeof db;
  }
}

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth: withClerk({ requireRole: "admin" }),
  realtime: { driver: "memory" },

  resources: [
    resource(schema.users, {
      label: "Users",
      columns: ["email", "role", "plan", "createdAt"],
      search: ["email"],
      filters: [{ field: "plan", type: "select", options: [/* ... */] }],
      drawer: { fields: "*" },
      delete: { softDelete: "deletedAt" },
    }),
  ],

  dashboards: [
    dashboard({
      path: "/",
      label: "Overview",
      sections: [{
        label: "Today",
        columns: 3,
        widgets: [
          metric("Users",   async ({ db }) => db.$count(schema.users)),
          metric("Active",  async ({ db }) => /* ... */ 0),
          table({ resource: "users", limit: 10, realtime: "resource.users" }),
        ],
      }],
    }),
  ],
});
```

That's the whole admin. Run `pnpm dev`, navigate to `/admin`. The realtime
table refreshes across tabs when anyone mutates a user; the drawer opens
on row click; soft-deleted rows are filtered out automatically.

## What you get

- **Type-safe CRUD** from your Drizzle or Prisma schema. `ctx.db` is your
  real client — autocomplete and all.
- **Dashboards** — `metric()`, `table()`, `areaChart()`, `barChart()`,
  `lineChart()`, `pieChart()`, `statGroup()`, `custom()`.
- **Drawer + detail pages** for every resource. URL-synced
  (`?drawer=users:abc123`), focus-trapped, ESC-closable.
- **Server Actions** with optimistic updates. Soft-delete + restore.
  Bulk actions. Confirm dialogs. CSV/JSON export.
- **Realtime via SSE.** Memory driver for dev, Redis pub/sub for prod —
  a one-field config switch.
- **BullMQ queues** — `queue(myQueue, { label: "Scraper" })` mounts a
  bull-board iframe at `/admin/queues/scraper`.
- **Filters, sort, pagination, column resize, column pin, bulk select.**
  All URL-synced for shareable links.
- **Three customization tiers** (spec §8): props → `theme.components`
  overrides (10 slots: Button, Badge, Avatar, StatusBadge, EmptyState,
  MetricCard, PageHeader, Pagination, ConfirmDialog, SkeletonTable) → eject (`flowpanel eject resource users`).
- **First-class auth** — `withClerk`, `withNextAuth`, `withLucia` from
  `flowpanel/auth`. Or write your own 4-field `AuthConfig`.
- **i18n** — `labels` config localizes built-in chrome (BulkBar,
  pagination, drawer, confirm, palette).
- **A11y** — WCAG 2.2 AA. Focus traps, aria-live, skip-to-content,
  keyboard navigation. `prefers-reduced-motion` respected.

## Packages

| Package                          | Purpose                                                                |
| -------------------------------- | ---------------------------------------------------------------------- |
| [`flowpanel`](packages/flowpanel) | Umbrella package — re-exports the others via subpaths                  |
| [`@flowpanel/core`](packages/core) | `defineAdmin`, builders, types, runtime helpers                       |
| [`@flowpanel/next`](packages/next) | Next.js App Router bridge — page + API + SSE handlers                 |
| [`@flowpanel/react`](packages/react) | UI primitives — `<AdminShell>`, `<DataTable>`, `<Drawer>`, hooks    |
| [`@flowpanel/charts`](packages/charts) | Lazy-loaded chart widgets (recharts)                              |
| [`@flowpanel/client`](packages/client) | Client-side hooks (live channels, useAdminTable)                  |
| [`@flowpanel/cli`](packages/cli) | `init`, `eject`, `migrate`, `doctor`                                  |
| [`@flowpanel/adapter-drizzle`](packages/adapter-drizzle) | Drizzle adapter (Postgres, MySQL, SQLite)        |
| [`@flowpanel/adapter-prisma`](packages/adapter-prisma) | Prisma adapter — DMMF runtime introspection        |
| [`@flowpanel/adapter-bullmq`](packages/adapter-bullmq) | BullMQ queue adapter + bull-board server          |

All ten ship together at the same version (1.0+).

## Eject when you outgrow it

```bash
pnpm flowpanel eject resource users
```

5-file scaffold lands at `app/admin/users/{page,new,[id],[id]/edit,actions}.tsx`,
each stamped with the marker `// flowpanel: ejected @ 1.0.0 — this file is yours`.
The runtime stops rendering the resource; your code does. `flowpanel.config.ts`
is auto-edited to comment out the matching `resource(...)` entry.

Three eject targets, no fourth: `resource`, `dashboard`, `layout`. See
[ADR 0003](docs/adr/0003-eject-three-targets.md) for the rationale.

## Stack

- Next.js 15 + React 19 (App Router only)
- Drizzle 0.30+ or Prisma 5+/6 (pick one per project)
- Postgres, MySQL, SQLite (any combination, dialect-aware)
- Optional: ioredis (realtime), bullmq (queues), @prisma/client

## Documentation

**<https://flowpanel.dev>** — full reference, recipes, and getting-started guide.

In-repo: [Public-API invariants](docs/invariants.md) · [ADRs](docs/adr/) · [Spec](docs/spec/flowpanel-v1.0.md)

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md). All commits signed (DCO).

## License

[MIT](LICENSE) © FlowPanel contributors
