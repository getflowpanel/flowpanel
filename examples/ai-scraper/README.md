# ai-scraper — FlowPanel showcase

Ops admin for **ScrapeAI**, a fictional **price & product intelligence** SaaS:
customers upload their catalog, the platform crawls marketplaces (Amazon,
Walmart, eBay, Jumia, MercadoLibre, Flipkart…) on a schedule, and an AI
pipeline matches every competitor **listing** to a customer **SKU** — each with
a confidence score — so prices and stock can be tracked. High-confidence matches
auto-confirm; low-confidence ones land in a human **review queue**. Billed by
subscription and metered AI usage. Built on **Drizzle + PostgreSQL**.

This is the canonical reference for wiring FlowPanel into a Next.js 15 App
Router app. It exercises a broad slice of the framework: a **realtime
price-change feed** (an in-memory ticker → SSE payload → custom client widgets,
zero DB writes), a customer **catalog**, competitor **listings**, an AI
**review queue** with confirm/reject row actions, **detail drawers on every
resource** (with related-resource tabs across multi-level FK chains), BullMQ
queue dashboards, soft-delete, row / bulk / drawer actions, inline-edit cells,
declarative **cell formatters**, `FieldDef`-driven forms with a searchable
**relation picker**, **CSV / JSON import + export**, type-safe cross-resource
references, saved **views**, area / bar / pie charts, audit logging, rate
limiting, and a `theme.components` override.

## Run the demo locally (60 seconds)

**Prereq:** Docker Desktop running (`docker info` should succeed).

```bash
pnpm docker:up         # Postgres 16 (port 54329)
pnpm db:push           # apply Drizzle schema
pnpm db:seed           # 90 customers, 37 scrapers, ~120 runs, 45 catalog SKUs, ~135 listings + AI matches, invoices, AI usage
pnpm dev               # Next.js on :3000
```

Open <http://localhost:3000> → click **"Open admin"**.

Optional (for queue UIs):

```bash
docker run -d -p 6379:6379 redis:7-alpine
export REDIS_URL=redis://localhost:6379
export BOARD_TOKEN=$(openssl rand -hex 16)   # the board can retry/remove/drain jobs
pnpm flowpanel:board                          # bull-board on :3001
pnpm dev                                      # admin sees the queues
```

`BOARD_TOKEN` is required: the board server is a separate process on its own
port, so FlowPanel's `requireRole` cannot protect it — the token is what does.
Both commands read the same variable, which is how the admin's iframe gets in.

## What's wired

| File                                                       | Role                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/admin/config/`                                        | The config — `index.ts` assembles `resources/*` + `dashboards/*` + shared `format.tsx` (cell formatters) |
| `app/admin/[[...slug]]/page.tsx`                           | Admin entry — `Flowpanel(config)`                                   |
| `app/api/flowpanel/[...route]/route.ts`                    | All admin API routes via `handlers(config)` (drawer GET + actions)  |
| `app/api/flowpanel/stream/route.ts`                        | SSE realtime channel                                                |
| `src/admin/PriorityMetricCard.tsx`                         | `theme.components.MetricCard` override (rings the default body)     |
| `src/admin/LiveStats.tsx` / `LiveFeed.tsx` / `LiveDot.tsx` | `custom()` client widgets — read the `live` SSE payload over a dedicated EventSource (`useLiveChannel`) and render throughput + a price-change feed |
| `src/lib/live-feed.ts`                                      | In-memory ticker → `publish("live", …)` every ~2s (price-change events). No DB writes |
| `src/lib/live-types.ts`                                     | Client-safe shared types/channel for the live feed (no server imports) |
| `instrumentation.ts`                                        | Next startup hook — starts the ticker once per server boot         |
| `src/lib/catalog.ts`                                        | Canonical product sample (+ marketplaces / sellers), shared by the seed and the live feed |
| `src/db/schema.ts`                                          | Drizzle schema — enums, FK chains (`scrapers → runs → listings`, `matches → listings`/`products`), soft-delete column |
| `src/lib/billing.ts`                                       | Stripe refund stub (wired into the invoice **Refund** action)      |
| `src/lib/runner.ts`                                        | Scrape re-enqueue stub (wired into the run **Retry** action)       |
| `src/lib/queues.ts`                                        | 3 BullMQ queues (scrape / extract / billing), gated on `REDIS_URL` |
| `scripts/seed-data.ts`                                     | Shared seed rows — imported by both `seed.ts` and `reset-demo.ts`   |
| `scripts/board-server.ts`                                  | bull-board Express server (run via `pnpm flowpanel:board`)          |

## What you can click through

1. `/admin` — Overview dashboard. Right under the date picker, an **Activity**
   row of four range-aware metrics (New customers / Listings tracked / AI
   matches / Runs) — changing the top-right range immediately, visibly changes
   the numbers. Below it a **Live** section — a `Throughput` card (listings/min,
   price changes today, concurrent crawls, match latency + sparkline) and a
   `Live activity` **price-change feed** (`amazon · −12% · Sony WH-1000XM5 · $372
   → $328`), both updating every ~2s over SSE with **zero DB writes**. Then an
   **AI quality** section (a "Match status" donut + a "Confidence by model" bar
   chart) and a customer-growth area chart.
2. `/admin/users` (**Customers**) — DataTable with filter bar (Plan, Status, Joined daterange), search, sort, column resize, column pin, bulk select, soft-delete. The toolbar's **Import** (CSV / JSON) and **Export** buttons bulk-load and download customers.
3. Click any customer row → tabbed drawer: **Profile** (account fields) + **Scrapers** + **Invoices** (both pulled live from their resources, filtered to that user). Click **"Disable user"** → confirm dialog → soft-deletes in DB and publishes `resource.users` over SSE → other tabs refresh within ~200ms.
4. `/admin/scrapers` — **double-click a Name** to inline-edit it; select rows to **Pause / Resume** in bulk; filter by Status / Schedule; `userId` FK rendered as the customer's email. Click a row → drawer (**Detail** + **Recent runs** + **Listings** tabs).
5. `/admin/runs` — multiselect Status filter + Started daterange; duration formatted (`1.4 s`); the **Retry** row action appears only on failed runs (re-enqueues via the stub, resets the run to queued). Click a row → drawer (**Detail** + **Listings** + **AI usage** tabs — the scraper → run → listing FK chain).
6. `/admin/products` (**Catalog**) — the customer's own SKUs: SKU, our price, owning customer FK. Click **New** (or a row's edit) for a `FieldDef`-driven form: a `select` Category, a searchable **Customer reference picker** resolved live from the users table, and an **admin-only `Our price` field** (`requireRole: "admin"`) — field-level RBAC enforced server-side, so `support` staff never see or can write it. Filter by Category; search by SKU / title / brand. Click a row → drawer (**Detail** + **Matches** — the competitor listings matched to this SKU).
7. `/admin/listings` — competitor offers across marketplaces, rendered with declarative `format` cells: site badge, `$` price, In/Low/Out-of-stock badges, ★ rating, formatted review counts. The high-volume table uses `density: "compact"` for tighter rows. Filter by Site / Stock / Price; `create` disabled (machine-generated). Click a row → drawer (**Detail** + **Match**).
8. `/admin/matches` (**Review queue**) — the AI human-in-the-loop core: every match shows a toned **confidence %**, model badge, and status. **Confirm / Reject** row actions appear only on `needs_review` rows (write the decision + reviewer). Saved **views** (Needs review / Auto-confirmed / Rejected) one-click the backlog; default sort is lowest-confidence first. Click a row → drawer (**Detail** + **Listing** + **Catalog SKU**).
9. `/admin/invoices` — amount formatted as `$` (stored in integer cents), status badges, `userId` FK. The **Refund** row action appears only on paid invoices (calls the Stripe stub, then flips status). Click a row → drawer (**Detail** + **Customer**).
10. `/admin/ai_usage` — LLM spend by provider / model / **task** (match vs extract); cost formatted as `$`; filter by Provider / Task / Date; `create` disabled (machine-generated).
11. `/admin/monitoring` — **Crawl health** metrics (Runs / Failed runs / Listings found — DB-derived and range-aware, so they read true even without Redis) + an **AI cost by task** bar chart + a live runs table.
12. Every successful mutation is forwarded to the `audit` sink (see your dev console); each IP is capped at 240 req/min by `rateLimit`.
13. ⌘K palette — "Open Overview".

## Realtime architecture (how the live feed works without touching the DB)

The principle: **realtime is a stream layered on top of durable data, not rows
in a table.** The database holds the snapshot (customers, the catalog,
listings, AI matches, run history). "Liveness" is a separate, in-memory layer:

1. `instrumentation.ts` starts a single ticker on server boot
   (`src/lib/live-feed.ts`).
2. Every ~2s the ticker advances an imaginary crawler fleet, emits a
   price-change event, and calls
   `publish("live", { kind: "live", event, recent, stats })` — exported from
   `@flowpanel/kit/next`. **Nothing is written to Postgres.** State is a bounded
   in-memory ring buffer, so it never grows unbounded.
3. The SSE stream (`app/api/flowpanel/stream`) forwards that payload to the
   browser.
4. The `LiveStats` / `LiveFeed` client widgets read it over a **dedicated
   EventSource** (`src/admin/useLiveChannel.ts`) — **no refetch, no DB
   round-trip.** Initial values are server-rendered (from the same in-memory
   state) so the panel is never empty on first paint.

Two implementation notes worth copying:

- The widgets use a dedicated EventSource rather than the shared realtime bus on
  purpose: the bus calls `router.refresh()` on every message (to revalidate RSC
  data), which would re-render the whole dashboard ~every 2s. The price feed only
  needs to update its own widgets, so it bypasses the bus. Payloads still carry a
  `kind` tag so a subscriber ignores anything that isn't theirs. See
  `src/lib/live-types.ts`.
- The ticker lives in one long-running process. A public live demo therefore
  needs a **persistent Node host** (Railway / Coolify / Fly via the Dockerfile),
  **not** serverless functions — those sleep between requests and freeze the
  feed. Set `DEMO_LIVE=off` to disable the ticker entirely.

## Stop everything

```bash
pnpm docker:down
```

## Host this as a public demo

The example is **destructive** by default — "Disable user" soft-deletes,
"Refund" mutates an invoice, "Retry run" re-enqueues, inline-edit and the
bulk pause/resume actions write rows. Set `DEMO_MODE=true` to put the whole
admin in read-only mode with a single flag:

```ts
// src/admin/config/index.ts
defineAdmin({
  readOnly: process.env.DEMO_MODE === "true",
  // …
});
```

FlowPanel then disables every create / update / delete form, drops all row /
bulk / drawer actions, and turns off inline-edit — and blocks every write
**server-side**, so a hand-crafted POST can't bypass the hidden UI.
`app/layout.tsx` renders a banner above the host header.

### Files

| File                                 | Role                                                        |
| ------------------------------------ | ----------------------------------------------------------- |
| `Dockerfile`                         | Multi-stage production build straight from workspace source — no npm publish required. Build from the **repo root**: `docker build -f examples/ai-scraper/Dockerfile .` (it `COPY . .` then `pnpm --filter "ai-scraper..." build`). |
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
| Root directory    | `examples/ai-scraper`                                    |
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
| Application type  | Dockerfile (point at `examples/ai-scraper/Dockerfile`).         |
| Database          | Coolify-managed Postgres service in the same project.            |
| Env vars          | `DATABASE_URL`, `DEMO_MODE=true`                                 |
| Reset cron        | Coolify Scheduled Task running `pnpm exec tsx scripts/reset-demo.ts` |

### After deploy

1. Run schema once: `pnpm db:push` against the production `DATABASE_URL`.
2. Seed: `pnpm db:seed` (one-off).
3. Wire the cron: hourly `pnpm exec tsx scripts/reset-demo.ts`.
4. Point the demo hostname's DNS at the deployment, then link it from
   `apps/site` and `docs/introduction/getting-started.mdx`.

## Stack

- **Next.js 15** App Router
- **Drizzle ORM** (node-postgres) — money stored as integer USD cents
- **PostgreSQL 16** via Docker
- Optional: **Redis 7** for realtime + queues
- **`@flowpanel/kit`** — the umbrella package; the demo imports the DSL from `@flowpanel/kit` and pulls adapters/runtime from its `/next`, `/react`, `/drizzle`, and `/charts` entry points
