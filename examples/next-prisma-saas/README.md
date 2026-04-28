# next-prisma-saas

Canonical FlowPanel example — Next.js 15 App Router + Prisma + Postgres.

## Getting started

    pnpm install                  # runs `prisma generate` via postinstall
    cp .env.example .env          # set DATABASE_URL
    pnpm db:push                  # apply Prisma schema to the database
    pnpm db:seed                  # seed sample data
    pnpm dev

Open http://localhost:3000/admin.

## Stack

- Next.js 15 (App Router)
- Prisma 5 + PostgreSQL
- tRPC 11
- FlowPanel
