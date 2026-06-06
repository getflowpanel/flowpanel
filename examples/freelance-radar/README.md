# freelance-radar — FlowPanel showcase

End-to-end demo of a realistic admin panel on **Drizzle + PostgreSQL**.
This example is the canonical reference for how to wire FlowPanel into a
Next.js 15 App Router app. It exercises every M3/M4 feature: realtime,
queues, soft-delete, drawer actions, `theme.components` overrides, and
Russian `labels`.

A public read-only instance lives at <https://demo.flowpanel.tech>.

## Run the demo locally (60 seconds)

**Prereq:** Docker Desktop running (`docker info` should succeed).

```bash
pnpm docker:up         # Postgres 16 (port 54329)
pnpm db:push           # apply Drizzle schema
pnpm db:seed           # 6 users, 3 categories, 3 jobs, 4 payments, 5 AI-cost rows
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
| `scripts/seed-data.ts`                                     | Shared seed rows — imported by both `seed.ts` and `reset-demo.ts`   |
| `scripts/seed.ts`                                          | Local-dev entry: connects + calls `seedDatabase`                    |
| `scripts/board-server.ts`                                  | bull-board Express server (run via `pnpm flowpanel:board`)          |

## What you can click through

1. `/admin` — Overview dashboard. Metrics + signups area chart + recent users table (live via SSE).
2. `/admin/users` — DataTable with filter bar (Plan, Status, Joined daterange), search, sort, column resize, column pin, bulk select, soft-delete.
3. Click any user row → drawer opens via `GET /api/flowpanel/drawer/users/<id>`. Click **"Disable user"** → confirm dialog → `POST /api/flowpanel/drawer/users/<id>/actions/disable` → soft-deletes in DB and publishes `resource.users` over SSE → tab B's list refreshes within ~200ms.
4. `/admin/payments` — money formatted as ₽ (stored in kopecks) and the `userId` FK rendered as the user's email (via `reference`).
5. `/admin/ai_costs` — AI usage by provider; cost formatted as $ (stored in cents).
6. `/admin/monitoring` — Queue health metrics (zero when no Redis) + AI-cost-by-provider bar chart + live jobs table.
7. ⌘K palette — "Open Overview".

## Stop everything

```bash
pnpm docker:down
```

## Host this as a public demo

The example is **destructive** by default — "Disable user" mutates rows
and bulk delete removes them. Flip `DEMO_MODE=true` to neutralize every
write path:

- Row actions render a "Read-only — public demo" tooltip and short-circuit
  to `{ ok: false, error: "Demo mode — actions are disabled" }`.
- `create` / `update` / `delete` are flagged `disabled: true` on every
  resource (incl. the `softDelete` write path on `users`).
- `app/layout.tsx` renders a banner above the host header.

### Files

| File                                 | Role                                                        |
| ------------------------------------ | ----------------------------------------------------------- |
| `Dockerfile`                         | Multi-stage production build straight from workspace source — no npm publish required. Build from the **repo root**: `docker build -f examples/freelance-radar/Dockerfile .` (it `COPY . .` then `pnpm --filter "freelance-radar..." build`). |
| `.env.example`                       | Placeholders only — never commit real `.env`.               |
| `docker-compose.demo.yml`            | Full dress rehearsal: app + Postgres in one network.        |
| `scripts/reset-demo.ts`              | Idempotent TRUNCATE + reseed. Run from cron.                |

### Dress rehearsal

```bash
docker compose -f docker-compose.demo.yml up --build
# → http://localhost:3000/admin (banner visible, actions greyed out)
```

### Deploying

The build outputs a standard Next.js production server. Any host that
can run a Node app + Postgres works.

#### Vercel

| Setting           | Value                                                    |
| ----------------- | -------------------------------------------------------- |
| Root directory    | `examples/freelance-radar`                               |
| Build command     | `pnpm build`                                             |
| Database          | Vercel Postgres / Neon / Supabase (any managed Postgres) |
| Env vars          | `DATABASE_URL`, `DEMO_MODE=true`                         |
| Reset cron        | Vercel Cron Job hitting an API route that runs the reset, or an external scheduler invoking `pnpm exec tsx scripts/reset-demo.ts` |

#### Railway

| Setting           | Value                                                            |
| ----------------- | ---------------------------------------------------------------- |
| Service           | Deploy from this directory via the Dockerfile.                   |
| Database          | Railway Postgres plugin — Railway injects `DATABASE_URL`.        |
| Env vars          | `DEMO_MODE=true`                                                 |
| Reset cron        | Railway Scheduled Command: `pnpm exec tsx scripts/reset-demo.ts` |

#### Coolify

| Setting           | Value                                                            |
| ----------------- | ---------------------------------------------------------------- |
| Application type  | Dockerfile (point at `examples/freelance-radar/Dockerfile`).     |
| Database          | Coolify-managed Postgres service in the same project.            |
| Env vars          | `DATABASE_URL`, `DEMO_MODE=true`                                 |
| Reset cron        | Coolify Scheduled Task running `pnpm exec tsx scripts/reset-demo.ts` |

### After deploy

1. Run schema once: `pnpm db:push` against the production `DATABASE_URL`.
2. Seed: `pnpm db:seed` (one-off).
3. Wire the cron: hourly `pnpm exec tsx scripts/reset-demo.ts`.
4. Point `demo.flowpanel.tech` DNS at the deployment.

## Stack

- **Next.js 15** App Router
- **Drizzle ORM** (node-postgres)
- **PostgreSQL 16** via Docker
- Optional: **Redis 7** for realtime + queues
- `@flowpanel/kit` (umbrella) via `@flowpanel/kit`, `/drizzle`, `/charts`
