# Getting started

FlowPanel is the admin panel for modern Next.js SaaS. One config file, zero custom UI code — you get CRUD resources, dashboards, queues, and pipeline observability with a polished shadcn-based interface that looks great in 2026.

## Requirements

- Next.js 14+ with the App Router
- **Prisma 5+** or **Drizzle 0.30+** (pick one)
- tRPC v11 with React Query
- Tailwind CSS 3.4+ (FlowPanel ships a preset)
- PostgreSQL

## Install

```bash
pnpm add @flowpanel/core @flowpanel/react
# Choose one:
pnpm add @flowpanel/adapter-prisma       # Prisma
pnpm add @flowpanel/adapter-drizzle      # Drizzle
# Optional — for queue inspection:
pnpm add @flowpanel/queue-bullmq
```

## Scaffold

The CLI detects your ORM, models, and existing tRPC setup. In your project root:

```bash
pnpm flowpanel init
```

It will:

1. Detect Prisma or Drizzle and list your models.
2. Ask which models to include in the admin.
3. Create `flowpanel.config.ts` with `resource()` calls for those models.
4. Create `app/admin/page.tsx` mounting `<FlowPanelUI />`.
5. Add the FlowPanel Tailwind preset to your config.
6. Wire up the `/api/trpc` route handler.
7. Wire up the `/api/flowpanel/stream` route handler for realtime (SSE runs on a dedicated route — tRPC's JSON transport can't carry `text/event-stream`).

### Run the audit-log migration

FlowPanel ships one tiny migration — the `flowpanel_audit_log` table that every mutation writes to (required even if you don't use realtime). Pick one:

```ts
// scripts/flowpanel-migrate.ts
import { applyMigrations } from "@flowpanel/core";
import { flowpanel } from "@/flowpanel.config";

await applyMigrations(flowpanel);
```

```bash
pnpm tsx scripts/flowpanel-migrate.ts
```

Or let the CLI do it:

```bash
pnpm flowpanel migrate
```

You only run this once per environment (and again whenever FlowPanel ships a new migration — you'll see it in the changelog). The runner is idempotent: re-running it is a no-op.

### Start dev

```bash
pnpm dev
```

Navigate to `/admin`. That's it — your data is now CRUD-editable with filters, sorts, search, and live updates.

## Anatomy of a config

```ts
// flowpanel.config.ts
import { defineFlowPanel, resource } from "@flowpanel/core";
import { prisma } from "./lib/prisma";

export const flowpanel = defineFlowPanel({
  appName: "My SaaS",
  adapter: prisma,                // auto-detects Prisma client
  pipeline: { stages: [] },       // keep even if empty

  resources: {
    user: resource(prisma.user, {
      columns: [(p) => p.email, (p) => p.role, (p) => p.createdAt],
      filters: [(p) => p.role],
      searchFields: ["email", "name"],
      actions: (a) => ({
        archive: a.mutation({
          label: "Archive",
          confirm: "Archive this user?",
          handler: async (row, ctx) => {
            await ctx.db.user.update({
              where: { id: row.id },
              data: { archivedAt: new Date() },
            });
          },
        }),
      }),
    }),
  },

  dashboard: (w) => [
    w.metric({
      label: "Total users",
      value: async (ctx) => ctx.db.user.count(),
    }),
    w.list({
      label: "Recent signups",
      rows: async (ctx) =>
        ctx.db.user.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
      render: (u) => ({ primary: u.email, secondary: u.name }),
    }),
  ],

  security: {
    auth: {
      getSession: async (req) => {
        // your auth session lookup
        return { userId: "…", role: "admin" };
      },
    },
  },
});
```

## What you get for free

- **Sidebar navigation** with groups (Monitoring, Data, Queues)
- **Dark / light / system theme toggle** in the header
- **Command palette** (⌘K) for navigation and actions
- **Row CRUD** with auto-generated forms inferred from your schema
- **Filters** with typed widgets (enum, date range, text, boolean, number)
- **Column sort** and URL-synced state — shareable links to filtered views
- **Bulk selection** appears automatically when any `a.bulk` action is defined
- **Confirm dialogs** with optional type-to-confirm for destructive actions
- **Toast notifications** (sonner) on every mutation
- **Responsive layout** — sidebar collapses on mobile, drawer goes full-screen
- **Keyboard shortcuts** — `⌘K` palette, `/` focus search, `?` shortcut help

## Next steps

- [Resources](../reference/resources.md) — columns, filters, forms, access
- [Actions](../reference/actions.md) — `a.mutation`, `a.bulk`, `a.collection`, `a.link`, `a.dialog`
- [Dashboard](../reference/dashboard.md) — widgets (`metric`, `list`, `chart`, `custom`)
- [Queues](../reference/queues.md) — BullMQ integration and queue inspection
