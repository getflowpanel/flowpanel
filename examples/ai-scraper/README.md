# ScrapeAI — the canonical Flowpanel demo

ScrapeAI is a fictional **Competitive price intelligence** SaaS. Customers connect product
catalogs and marketplace monitors; ScrapeAI discovers competing offers, matches them to catalog
products, and sends uncertain results to a human Review workflow.

This example is the reference for building a production-shaped admin with Flowpanel, Next.js,
Drizzle, and PostgreSQL. The main journey uses five screens and the public Flowpanel DSL directly:
no generated page tree, config meta-framework, runtime crawler, or external AI call.

![ScrapeAI operations overview showing monitor health, marketplace offers, AI match quality, and recent crawl runs](./public/scrapeai-overview-dark.png)

## Run locally

Prerequisites: Node.js 22+, pnpm, and Docker.

```bash
pnpm install
pnpm --filter "./packages/**" build
pnpm --filter ai-scraper docker:up
pnpm --filter ai-scraper db:push
pnpm --filter ai-scraper db:seed
pnpm --filter ai-scraper dev
```

Open [http://localhost:3000](http://localhost:3000), then choose **Open admin**. The default local
mode is interactive. Use the Admin / Support switch to see server-enforced role differences.

## Five-screen tour

**Overview** turns operational data into a concise status page: active monitors, offers found,
crawl success, the Review backlog, marketplace activity, match quality, and recent runs. The date
range changes time-based metrics and charts; each summary links to its underlying resource.

**Customers** manages the SaaS accounts that own catalogs and monitors. Search and filter the
table, edit Company inline, import or export data, open related Monitors, Products, and Invoices in
the drawer, and compare the Admin-only disable action with the Support persona.

**Monitors** shows where and how ScrapeAI crawls marketplaces for each customer. Typed forms
validate target URLs, filters expose schedule and status, bulk actions pause or resume work, and the
drawer connects a monitor to its recent Runs and discovered Offers.

**Products** is each customer's own catalog. It demonstrates explicit grouped forms, searchable
customer references, category filters, money formatting, field-level RBAC, export, and related AI
matches without exposing raw foreign-key IDs to operators.

**Review** is the human-in-the-loop core. Ambiguous product/offer matches appear lowest-confidence
first with saved views and Confirm / Reject actions; the drawer keeps the decision, marketplace
offer, and catalog product together. Runs, Offers, Invoices, and AI usage remain available through
drawers, deep links, and the command palette without crowding primary navigation.

## Feature-to-code map

| Capability | Canonical source |
| --- | --- |
| Complete admin composition, auth, security, theme | `src/admin/config/index.ts` |
| Customers, Monitors, Products, Review resources | `src/admin/config/resources/` |
| Operational dashboard composition | `src/admin/config/overview.ts` |
| Named, testable dashboard queries | `src/admin/config/overview-queries.ts` |
| One accessible custom realtime widget | `src/admin/MarketActivity.tsx` |
| Bounded synthetic SSE feed | `src/demo/realtime/feed.ts` |
| Six coherent customer/product stories | `src/demo/data/scenarios.ts` |
| Deterministic relational data generator | `src/demo/data/generate.ts` |
| Disposable demo personas | `src/demo/auth/` |
| Drizzle tables and relations | `src/db/schema.ts` |
| Thin transactional database writer | `scripts/seed-data.ts` |
| Next.js admin page and API handlers | `app/admin/` and `app/api/flowpanel/` |

The `src/admin` directory is deliberately copyable application code. Synthetic identities, data,
and realtime simulation live under `src/demo`, making the boundary between Flowpanel usage and
showcase infrastructure explicit.

## Data model and reset

The seed creates 48 customers, 36 monitors, 60 catalog products, 252 crawl runs, and 240 offers
with matching decisions. Six named customer stories provide recognizable products and believable
ambiguous variants; background rows add enough volume for pagination, filters, charts, and saved
views. Ownership and timestamps are generated as one causal graph, and exactly 26 matches begin in
`needs_review`.

`pnpm --filter ai-scraper db:seed` truncates and recreates that deterministic state. For a hosted
sandbox, schedule `pnpm --filter ai-scraper demo:reset` hourly.

## Public demo safety

Set `DEMO_MODE=true` for a public deployment. Flowpanel then removes mutation affordances and
rejects create, update, delete, inline-edit, row-action, drawer-action, and bulk-action requests on
the server; hiding buttons is not the security boundary. The persona cookie is an unsigned,
allow-listed demo mechanism only—replace all of `src/demo/auth` with trusted application auth.

The example also enables role checks, audit events, and in-memory IP rate limiting. The realtime
feed never writes to PostgreSQL and never calls marketplaces or an LLM. Set `DEMO_LIVE=off` on
serverless hosts where a persistent two-second ticker is inappropriate.

Never deploy the sample `.env` values as secrets. Configure `DATABASE_URL` and your real auth,
audit sink, shared rate-limit store, and network policy for production.

## Optional queues

With no `REDIS_URL`, the demo starts cleanly and queue screens are absent. To exercise BullMQ:

```bash
docker run -d -p 6379:6379 redis:7-alpine
export REDIS_URL=redis://localhost:6379
export BOARD_TOKEN=$(openssl rand -hex 16)
pnpm --filter ai-scraper flowpanel:board
pnpm --filter ai-scraper dev
```

Queue routes stay out of primary navigation and are available from operational links. `BOARD_TOKEN`
is mandatory because the separate board origin exposes destructive job controls. Set `BOARD_URL`
to a browser-reachable HTTPS origin when deployed.

## Deploy

Build from the repository root with the included Dockerfile, attach PostgreSQL, and set at least
`DATABASE_URL` and `DEMO_MODE=true`. Run `db:push` and `db:seed` once, then schedule `demo:reset`.
A persistent Node host supports Market activity; on Vercel or another sleeping serverless runtime,
set `DEMO_LIVE=off`.

```bash
docker build -f examples/ai-scraper/Dockerfile .
docker compose -f examples/ai-scraper/docker-compose.demo.yml up --build
```

The result is a standard Next.js application. Railway, Fly.io, Coolify, and comparable Node hosts
work with any PostgreSQL-compatible managed database.
