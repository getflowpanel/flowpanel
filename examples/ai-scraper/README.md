# ScrapeAI

The FlowPanel demo: an admin for a fictional price-intelligence SaaS whose customers set up marketplace monitors, whose runs find competing offers, and whose uncertain matches go to human review. Next.js, Drizzle and PostgreSQL.

![ScrapeAI overview in FlowPanel: monitor, offer, crawl and review figures, a live throughput chart, market activity and recent runs](./public/scrapeai-overview-dark.png)

## Run locally

Node.js 22+, pnpm and Docker. From the repository root:

```bash
pnpm install
pnpm --filter "./packages/**" build
pnpm --filter ai-scraper docker:up
pnpm --filter ai-scraper db:push
pnpm --filter ai-scraper db:seed
pnpm --filter ai-scraper dev
```

Open [http://localhost:3000](http://localhost:3000) and choose **Open admin**. The Admin / Support switch shows server-enforced role differences: Support loses the pricing field and the disable action.

## Screens

- **Overview**: monitors, offers, crawl success, review backlog, live throughput and recent runs, each linking to its rows.
- **Customers**: search, filters, inline edit, import and export, related monitors, products and invoices.
- **Monitors**: typed forms, schedule and status filters, bulk pause and resume.
- **Runs**: crawl history with throughput, duration, retries and AI usage.
- **Offers**: full-text search, numeric filters, export, and each offer's AI match.
- **Products**: grouped forms, customer references, field-level roles.
- **Review**: ambiguous matches, lowest confidence first, with Confirm and Reject.

## Where the code is

| What | File |
| --- | --- |
| Admin config, auth, security, theme | `src/admin/config/index.ts` |
| Resources | `src/admin/config/resources/` |
| Overview dashboard | `src/admin/config/dashboards/overview.ts` |
| Dashboard queries | `src/admin/overview-queries.ts` |
| Live operations widget | `src/admin/LiveOperations.tsx` |
| Widget and header tests | `src/admin/__tests__/`, `src/admin/config/resources/__tests__/` |
| Drizzle schema | `src/db/schema.ts` |
| Demo data, personas, realtime feed and sandboxes | `src/demo/` |

`src/admin` is ordinary application code; `src/demo` is demo-only.

## Seed and reset

`db:seed` creates the `local` sandbox: 48 customers, 36 monitors, 60 products, 252 runs and 240 offers, 26 of them awaiting review. Reset it with `pnpm --filter ai-scraper demo:reset -- --sandbox local`; remove expired browser sandboxes with `pnpm --filter ai-scraper demo:cleanup -- --force`.

## Public demo

Set `DEMO_MODE=true` and a random `DEMO_SANDBOX_SECRET` of 32+ characters. Each browser then gets its own pre-filled PostgreSQL sandbox that expires after 60 minutes idle or 24 hours. At most 200 sandboxes are active, created at most 10 per hour per IP hash. Set `DEMO_TRUST_PROXY=true` only behind a proxy that rewrites forwarding headers. `DEMO_READ_ONLY=true` blocks writes, and `DEMO_LIVE=off` turns off the realtime ticker on serverless hosts.

The persona cookie is a demo mechanism; a real app uses real auth. Do not deploy the sample `.env` values.

## Queues

Without `REDIS_URL` the queue screens are absent. To try them:

```bash
docker run -d -p 6379:6379 redis:7-alpine
export REDIS_URL=redis://localhost:6379
export BOARD_TOKEN=$(openssl rand -hex 16)
pnpm --filter ai-scraper flowpanel:board
pnpm --filter ai-scraper dev
```

Set `BOARD_URL` to a browser-reachable HTTPS origin when deployed.

## Deploy

```bash
docker build -f examples/ai-scraper/Dockerfile .
DEMO_SANDBOX_SECRET="$(openssl rand -hex 32)" \
  docker compose -f examples/ai-scraper/docker-compose.demo.yml up --build
```

Attach PostgreSQL and set `DATABASE_URL`, `DEMO_MODE=true` and `DEMO_SANDBOX_SECRET`. The container applies the schema on start; sandboxes fill on first visit.
