# FlowPanel

The admin panel for modern Next.js SaaS. One config, zero UI code — CRUD resources, dashboards, queues, and pipeline observability with a polished shadcn-based interface.

[![npm](https://img.shields.io/npm/v/@flowpanel/core)](https://www.npmjs.com/package/@flowpanel/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/Ch4m4/flowpanel/actions/workflows/ci.yml/badge.svg)](https://github.com/Ch4m4/flowpanel/actions/workflows/ci.yml)

## Preview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FlowPanel / my-saas                         ⌘K   🔔    avatar ▾              │
├──────────────┬──────────────────────────────────────────────────────────────┤
│ Overview     │  Users           [New user]  [Export CSV]         123 rows   │
│ Monitoring   │  ─────────────────────────────────────────────────────────── │
│   Runs       │  ☐  email                role    plan    created at  ≡      │
│   Queues     │  ☐  ada@example.com      admin   pro     2026-04-03         │
│ Data         │  ☑  grace@example.com    editor  pro     2026-04-02   ⋯     │
│   Users      │      └─ 42 selected  [Archive] [Change plan] [Delete]       │
│   Orgs       │  ☐  linus@example.com    viewer  free    2026-04-01         │
│   Payments   │  …                                                           │
│ Dashboards   │                                                              │
│   Revenue  ▸ │  Dashboards • KPIs                        30d ▾  live ●      │
│   Growth     │  ┌─ MRR ──────┐ ┌─ Signups ──┐ ┌─ AI spend ─────────┐       │
│              │  │  $34.2k    │ │   1,284    │ │ ▇▇▆▅▄▃▂▁ gpt-4     │       │
│              │  │  +8.2% vs… │ │   +12% wk  │ │ ▂▃▅▆▇█ claude-3    │       │
│              │  └────────────┘ └────────────┘ └────────────────────┘       │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

Rendered screenshots land on the docs site when we cut the first public release candidate. In the meantime, clone `examples/freelance-radar` (Drizzle) or `examples/next-prisma-saas` (Prisma), run `docker compose up && pnpm dev`, and the real UI is at `/admin`.

## What you get

- **CRUD resources** inferred from Prisma or Drizzle. Path proxies (`(p) => p.user.email`) keep everything type-safe.
- **Five action kinds** — `a.mutation`, `a.bulk`, `a.collection`, `a.link`, `a.dialog`. Type-to-confirm for destructive ops.
- **Dashboard widgets** — metric, list, chart (SVG, no chart lib), and custom React components. Server-side data loaders so secrets stay off the wire.
- **Queue inspection** — BullMQ adapter out of the box. Retry, remove, pause, drain, and live status.
- **Pipeline observability** — stages, run log, AI cost, SSE live updates.
- **Polished 2026 UI** — shadcn + Tailwind, dark / light / system theme, responsive sidebar, command palette (⌘K), keyboard shortcuts, accessible dialogs, toast notifications.
- **Security built in** — auth middleware, rate limiting, audit log, row-level security, role-based access on every operation and action.

## Quick start

```bash
pnpm add @flowpanel/core @flowpanel/react @flowpanel/adapter-prisma
pnpm flowpanel init       # detects ORM, models, tRPC router
pnpm dev
# → http://localhost:3000/admin
```

```ts
// flowpanel.config.ts
import type { User } from "@prisma/client";
import { defineFlowPanel, defineResource } from "@flowpanel/core";
import { prisma } from "./lib/prisma";

export const flowpanel = defineFlowPanel({
  appName: "My SaaS",
  adapter: prisma,                       // auto-detects Prisma client
  pipeline: { stages: [] },

  resources: {
    user: defineResource<User>(prisma.user, {
      columns: (u) => [u.email, u.role, u.createdAt],
      filters: (u) => [u.role],
      searchFields: ["email", "name"],
      actions: (a) => ({
        archive: a.mutation({
          label: "Archive",
          confirm: { title: "Archive user?", typeToConfirm: "ARCHIVE" },
          handler: async (row, ctx) => {
            await ctx.db.user.update({ where: { id: row.id }, data: { archivedAt: new Date() } });
          },
        }),
      }),
    }),
  },

  dashboard: (w) => [
    w.metric({ label: "Users",   value: async (ctx) => ctx.db.user.count() }),
    w.metric({ label: "Active",  value: async (ctx) => ctx.db.user.count({ where: { archivedAt: null } }) }),
  ],

  security: { auth: { getSession } },
});
```

## Works the same with Drizzle

```ts
import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { users } from "./schema";
import { db } from "./db";

defineFlowPanel({
  adapter: drizzleAdapter({ db }),
  resources: {
    user: resource(users, { columns: [(p) => p.email, (p) => p.role] }),
  },
  // …same everything else
});
```

## Packages

| Package | Purpose |
|---|---|
| [`@flowpanel/core`](packages/core) | Config, tRPC router, resource resolver, widget/queue engines |
| [`@flowpanel/react`](packages/react) | `<FlowPanelUI>`, resource UI, dashboard, queue views — all shadcn-based |
| [`@flowpanel/adapter-prisma`](packages/adapter-prisma) | Prisma `ResourceAdapter` (CRUD, metadata, filter IR) |
| [`@flowpanel/adapter-drizzle`](packages/adapter-drizzle) | Drizzle `ResourceAdapter` |
| [`@flowpanel/queue-bullmq`](packages/queue-bullmq) | BullMQ queue adapter |
| [`@flowpanel/cli`](packages/cli) | `init`, `scaffold`, `migrate`, `doctor`, `dev` |

## CLI

```bash
flowpanel init              # scaffold config, page, tRPC, tailwind
flowpanel scaffold <Model>  # add a new resource from your schema
flowpanel dev               # watch + validate config
flowpanel migrate           # apply pipeline schema migrations
flowpanel doctor            # health check
flowpanel status            # quick overview
```

## Documentation

- **[Getting started](docs/guides/getting-started.md)**
- **[Resources](docs/reference/resources.md)** — columns, filters, access
- **[Actions](docs/reference/actions.md)** — all five kinds
- **[Dashboard](docs/reference/dashboard.md)** — widget API
- **[Queues](docs/reference/queues.md)** — BullMQ integration

## License

[MIT](LICENSE)
