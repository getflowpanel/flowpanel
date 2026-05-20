# freelance-radar — FlowPanel showcase

End-to-end demo of a realistic admin panel on **Drizzle + PostgreSQL**.
This example is the canonical reference for how to wire FlowPanel into a
Next.js 15 App Router app. It exercises every M3/M4 feature: realtime,
queues, soft-delete, drawer actions, `theme.components` overrides, and
Russian `labels`.

## Run in 60 seconds

**Prereq:** Docker Desktop running (`docker info` should succeed).

```bash
pnpm docker:up         # Postgres 16 (port 54329)
pnpm db:push           # apply Drizzle schema
pnpm db:seed           # 4 users, 3 jobs, payments
pnpm dev               # Next.js on :3000
```

Open <http://localhost:3000> → click **"Open admin"**.

Optional (for queue UIs):

```bash
docker run -d -p 6379:6379 redis:7-alpine
REDIS_URL=redis://localhost:6379 pnpm flowpanel:board   # bull-board on :3001
REDIS_URL=redis://localhost:6379 pnpm dev               # admin sees the queues
```

## What's wired

| File                                                       | Role                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `flowpanel.config.ts`                                      | The config — resources, dashboards, queues, theme override, labels  |
| `app/admin/[[...slug]]/page.tsx`                           | Admin entry — `Flowpanel(config)`                                   |
| `app/api/flowpanel/[...route]/route.ts`                    | All admin API routes via `handlers(config)` (drawer GET + actions)  |
| `app/api/flowpanel/stream/route.ts`                        | SSE realtime channel                                                |
| `src/admin/PriorityMetricCard.tsx`                         | `theme.components.MetricCard` override (rings the default body)     |
| `src/db/schema.ts`                                         | Drizzle schema — enums, FKs, soft-delete column                     |
| `src/lib/queues.ts`                                        | 3 BullMQ queues, gated on `REDIS_URL`                               |
| `scripts/seed.ts`                                          | 4 users, 3 jobs, payments                                           |
| `scripts/board-server.ts`                                  | bull-board Express server (run via `pnpm flowpanel:board`)          |

## What you can click through

1. `/admin` — Overview dashboard. Metrics + signups area chart + recent users table (live via SSE).
2. `/admin/users` — DataTable with filter bar (Plan, Status, Joined daterange), search, sort, column resize, column pin, bulk select, soft-delete.
3. Click any user row → drawer opens via `GET /api/flowpanel/drawer/users/<id>`. Click **"Disable user"** → confirm dialog → `POST /api/flowpanel/drawer/users/<id>/actions/disable` → soft-deletes in DB and publishes `resource.users` over SSE → tab B's list refreshes within ~200ms.
4. `/admin/monitoring` — Queue health metrics (zero when no Redis) + live jobs table.
5. ⌘K palette — "Open Overview".

## Stop everything

```bash
pnpm docker:down
```

## Stack

- **Next.js 15** App Router
- **Drizzle ORM** (node-postgres)
- **PostgreSQL 16** via Docker
- Optional: **Redis 7** for realtime + queues
- `flowpanel`, `@flowpanel/adapter-drizzle`, `@flowpanel/adapter-bullmq`
