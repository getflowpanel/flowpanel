# freelance-radar — FlowPanel demo

End-to-end demo of a realistic admin panel on **Drizzle + PostgreSQL**.
Covers enums, self-referential FKs, one-to-many relations, JSON columns,
computeBatch (N+1 avoidance), row actions with confirm + stepUp, and the
B2 metric helpers.

## Run in 60 seconds

```bash
# 1. boot Postgres
pnpm docker:up

# 2. apply schema
pnpm db:push

# 3. seed sample data
pnpm db:seed

# 4. start Next.js
pnpm dev
```

Open **http://localhost:3000** → click "Open admin".

## What's inside

| File | Role |
| ---- | ---- |
| `src/flowpanel.ts` | The config — typed resources, actions, B2 metrics. |
| `src/flowpanel-types.d.ts` | Module augmentation: `ctx.db` is typed as `typeof db` everywhere without casts. |
| `src/db/schema.ts` | Drizzle schema with enums, relations, JSON columns. |
| `app/api/trpc/[trpc]/route.ts` | **6 lines** — `createFlowPanelHandler(flowpanel)`. |
| `app/admin/page.tsx` | Admin entry — lists resource keys. Full UI lands in B8. |
| `scripts/seed.ts` | Realistic seed data (4 users, 3 jobs, payments, AI cost rows). |

## Stack

- **Next.js 15** App Router
- **Drizzle ORM** (postgres-js or node-postgres)
- **PostgreSQL 16** via Docker
- **@flowpanel/core** + **@flowpanel/adapter-drizzle** + **@flowpanel/react**

## Stop the database

```bash
pnpm docker:down
```
