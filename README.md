# FlowPanel

> One typed config → full admin panel for your Next.js app. Drizzle or Prisma. Realtime. Queues. Eject when you outgrow it.

[![npm](https://img.shields.io/npm/v/flowpanel.svg)](https://www.npmjs.com/package/flowpanel)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/Ch4m4/flowpanel/actions/workflows/ci.yml/badge.svg)](https://github.com/Ch4m4/flowpanel/actions/workflows/ci.yml)

## Install

```bash
pnpm add flowpanel
pnpm flowpanel init
```

`flowpanel init` detects your stack (Next.js, Drizzle/Prisma, auth) and scaffolds:

- `flowpanel.config.ts`
- `app/admin/[[...slug]]/page.tsx`
- `app/api/flowpanel/[...route]/route.ts`
- `app/api/flowpanel/stream/route.ts`

## Use

```ts
// flowpanel.config.ts
import { defineAdmin, resource, dashboard, metric, table } from "flowpanel";
import { drizzleAdapter } from "flowpanel/drizzle";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { getSession } from "@/lib/auth";

declare module "@flowpanel/core" {
  interface FlowpanelTypes {
    db: typeof db;
  }
}

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth: {
    session: () => getSession(),
    role: (s) => s?.role ?? "guest",
    requireRole: "admin",
  },
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
  overrides → eject (`flowpanel eject resource users`).
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

- [Getting started](docs/guides/getting-started.md)
- Reference: [resources](docs/reference/resources.md) · [dashboard](docs/reference/dashboard.md) · [actions](docs/reference/actions.md) · [realtime](docs/reference/realtime.md) · [queues](docs/reference/queues.md) · [theme](docs/reference/theme.md) · [adapters](docs/reference/adapters.md)
- Recipes: [file uploads](docs/recipes/file-uploads.md) · [JSONB editor](docs/recipes/jsonb-editor.md) · [multi-tenant](docs/recipes/multi-tenant.md)
- [Public-API invariants](docs/invariants.md)
- [ADRs](docs/adr/)

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md). All commits signed (DCO).

## License

[MIT](LICENSE) © FlowPanel contributors
