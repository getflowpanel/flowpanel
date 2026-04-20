# FlowPanel Documentation

FlowPanel is the admin panel for modern Next.js SaaS. One config, zero UI code.

## Start here

- **[Getting started](./guides/getting-started.md)** — install, scaffold, run your first admin
- **[Resources](./reference/resources.md)** — CRUD entities with filters, sort, search
- **[Actions](./reference/actions.md)** — five action kinds: mutation, bulk, collection, link, dialog
- **[Dashboard](./reference/dashboard.md)** — widget-based dashboards (metric / list / chart / custom)
- **[Queues](./reference/queues.md)** — BullMQ inspection and control

## Concepts at a glance

```ts
defineFlowPanel({
  appName: "My SaaS",
  adapter: prisma,                    // or drizzle
  pipeline: { stages: [...] },

  resources: {                        // table UIs with CRUD
    user: resource(prisma.user, {...}),
  },

  dashboard: (w) => [                 // live overview cards
    w.metric(...),
    w.chart(...),
  ],

  queues: {                           // BullMQ inspection
    email: bullmqAdapter(emailQueue),
  },
});
```

That's the whole surface. Every feature is composable — define only what you need.

## Design principles

1. **shadcn + Tailwind inside, polished 2026 defaults outside.** Dark mode, responsive, keyboard-navigable.
2. **Type-safe API.** Path proxies like `(p) => p.user.email` infer from your Prisma / Drizzle schema.
3. **Progressive disclosure.** Shorthand covers 80%; the full builder API is there when you need it.
4. **Server is the source of truth.** Widget/action handlers run on the server; only data reaches the client.
5. **ORM-agnostic core.** Prisma and Drizzle both work through the same `ResourceAdapter` interface.

## CLI

```bash
flowpanel init              # scaffold config, page, tRPC router, tailwind preset
flowpanel scaffold <Model>  # generate a resource stub for one model
flowpanel dev               # watch config and validate on change
flowpanel migrate           # apply pipeline schema migrations
flowpanel doctor            # health check (auth, schema, indexes, TS types)
flowpanel status            # quick overview
```

Run `flowpanel <cmd> --help` for command options.
