# flowpanel

Config-first admin panel framework for Next.js 15.

One typed config file produces a full admin: dashboards, CRUD lists + drawers + detail pages, realtime, auth, audit. When config isn't enough, drop in a custom widget. When that isn't enough, eject the source.

```bash
pnpm add flowpanel drizzle-orm
pnpm dlx flowpanel init
```

## Subpath exports

| Subpath | Contents |
|---|---|
| `flowpanel` | `defineAdmin`, `resource`, types, error classes, runtime helpers |
| `flowpanel/next` | `Flowpanel(config)`, `handlers(config)`, `stream(config)` |
| `flowpanel/drizzle` | `drizzleAdapter({ db, schema })` |
| `flowpanel/react` | UI primitives, shell, DataTable, forms |
| `flowpanel/client` | `useAdminMutation` and other client hooks |
| `flowpanel/server` | `publish()`, `requireRole()`, audit emitter |
| `flowpanel/bullmq` | BullMQ adapter (ships in `0.3.0-alpha`) |
| `flowpanel/charts` | 4 chart builders (lazy, Recharts) |

## Status

`0.2.0-alpha.0` — M2 Dashboards + Drawers + Widgets + ⌘K. M1 Core Runtime continues to ship.

See [`docs/spec/flowpanel-v1.0.md`](https://github.com/Ch4m4/flowpanel/blob/main/docs/spec/flowpanel-v1.0.md) for the frozen 1.0 specification.

## License

MIT
