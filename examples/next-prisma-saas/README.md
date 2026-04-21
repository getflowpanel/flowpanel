# next-prisma-saas

Canonical FlowPanel example — Next.js 15 App Router + Prisma + Postgres.

## Getting started

    pnpm install
    cp .env.example .env          # set DATABASE_URL
    pnpm db:push
    pnpm db:seed
    pnpm dev

Open http://localhost:3000/admin.

## Stack

- Next.js 15 (App Router)
- Prisma 5 + PostgreSQL
- tRPC 11
- FlowPanel
