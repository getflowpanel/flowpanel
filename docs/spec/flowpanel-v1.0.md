# FlowPanel v1.0 — Technical Specification

> **Status:** Frozen source of truth for 1.0.
> **Revision:** 3 (2026-04-21) — added architecture overview, full real-world config example, CLI-UX description, repo structure & OSS hygiene, concrete customization examples. All decisions from revisions 1–2 retained (see §33 FAQ).

---

# Part I — The product

## 1. Vision

FlowPanel is the fastest way to build a beautiful, production-grade admin panel for a Next.js 15 SaaS.

**One typed config → full admin.** Dashboards, CRUD lists + drawers + detail pages, BullMQ queue UIs, realtime updates, command palette, auth, audit. When props aren't enough, slot in a custom widget. When a widget isn't enough, eject the source.

**Pitch:** *"Your SaaS admin in ~300 lines of typed config — and every line of code is yours the moment you need it."*

FlowPanel is built to be **loved** by developers:

- **Simple** — one config file, four CLI commands, predictable file layout.
- **Beautiful** — shadcn + Tailwind + design tokens; light/dark; motion; WCAG 2.2 AA.
- **Customizable** — three clean levels: props → overrides → eject. No trapdoors.
- **Complete** — Drizzle *and* Prisma, realtime, BullMQ, drawers, ⌘K out of the box.

---

## 2. Scope of 1.0

### 2.1 In

| Category | Feature |
|---|---|
| ORMs | **Drizzle** (primary), **Prisma** (runtime DMMF — zero setup) |
| Databases | Postgres 14+, MySQL 8+, SQLite; MongoDB via Prisma |
| CRUD | list, detail, create, update, delete, bulk-delete, soft-delete, optimistic mutations |
| Drawers | row preview / metric breakdown / action form; URL-synced, focus-trapped, keyboard-accessible |
| Dashboards | sections, global date range, per-widget Suspense + ErrorBoundary |
| Widgets | `metric`, `areaChart`, `barChart`, `lineChart`, `pieChart`, `table`, `statGroup`, `custom` |
| Tables | server-side pagination / sort / filter / search · column visibility / resize / density / pin · keyboard nav · CSV export |
| Filters | text, select, multiselect, daterange, numeric-range, boolean, tag |
| Forms | `@conform-to/react` + Zod · auto-derived from Drizzle columns or Prisma DMMF · field overrides · conditional · async validation |
| Queues | BullMQ via `bull-board` (re-themed) · retry/pause/resume/clear/drain · payload viewer · flow graphs |
| Realtime | SSE (memory + Redis) · public `publish()` API · `<LiveIndicator>` · `<DataTable realtime>` · optimistic mutations |
| ⌘K palette | Linear/Raycast-style · resources, items, actions, navigation |
| Auth | pluggable session + role · 401/403 redirects |
| Scope | row-level multi-tenant · strict by default (no silent leaks) |
| Audit | default DB sink · custom sink · diff · retention |
| Rate limit | per-user / per-IP · memory + Redis drivers |
| Customization | L1 props · L2 custom widgets + `theme.components` overrides · L3 eject |
| Eject | `resource`, `dashboard`, `layout` · AST-edits `flowpanel.config.ts` |
| Theming | 30 design tokens + motion tokens · light/dark/auto · brand, nav, user menu |
| Label overrides | flat key → string map (replaces built-in strings) |
| A11y | WCAG 2.2 AA · axe-core CI · keyboard-only smoke · focus-trap · reduced-motion |
| Types | `keyof InferSelect<T>` (Drizzle) · `resource<User>("user", …)` (Prisma) · module augmentation, no codegen file |
| Docs | fumadocs site · quickstart · 10+ recipes · API reference · migration guides |

### 2.2 Deferred to 1.1

CSV **import** · full i18n (plurals / locale / RTL) · visual config GUI · saved filter views beyond URL · SSO/SAML turnkey · workflow builder · mobile-first redesign · Postgres LISTEN/NOTIFY realtime · non-Next.js standalone runtime · Pages Router · mixed adapters.

### 2.3 Anti-goals (CI-enforced)

- Zero `TODO`/`FIXME` in `packages/*/src`.
- Zero `@ts-ignore` in `packages/*/src`; `@ts-expect-error` allowed only with adjacent justification.
- Zero `any` in public exports.
- No `"unstable"`/`"experimental"` exports from 1.0.

---

## 3. Architecture overview

### 3.1 Runtime dataflow

```
┌────────────────────────────────────────────────────────────────────────┐
│  flowpanel.config.ts      (single source of truth, typed)              │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  defineAdmin({                                                    │  │
│  │    adapter, auth, theme, resources, dashboards, queues,           │  │
│  │    realtime, audit, rateLimit, commandPalette, hooks              │  │
│  │  })                                                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────┬────────────────────────────────────────────────────┘
                    │ imported by:
      ┌─────────────┼──────────────┬──────────────┐
      ▼             ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌───────────┐  ┌─────────────┐
│ Page RSC │  │ Route    │  │ SSE       │  │ Server code │
│ catch-all│  │ handlers │  │ stream    │  │ (publish)   │
└────┬─────┘  └────┬─────┘  └────┬──────┘  └──────┬──────┘
     │             │             │                 │
     ▼             ▼             ▼                 ▼
┌──────────────────────────────────────────────────────────┐
│  FlowPanel runtime                                        │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ Auth → Scope → Adapter → Audit → Publish            │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────┬───────────────────────────────────────────────┘
           │ via Adapter contract
           ▼
  ┌────────────────────────────────┐
  │ DrizzleAdapter  or  PrismaAdapter │
  └────────────────────────────────┘
           │
           ▼
     Postgres / MySQL / SQLite / MongoDB
```

### 3.2 Package topology

Internal monorepo (`packages/*`), one public npm artifact (`flowpanel`). Subpaths re-export workspaces.

```
packages/
├─ core/        # defineAdmin, builders, types, runtime
├─ react/       # UI primitives (shadcn-based, 50+ components)
├─ drizzle/     # drizzleAdapter
├─ prisma/      # prismaAdapter (runtime DMMF)
├─ next/        # Flowpanel(), handlers(), stream()
├─ bullmq/      # bullmqAdapter + bull-board integration
├─ client/      # useAdminMutation, useLiveChannel, useAdminDrawer, useAdminCommand
├─ cli/         # init, eject, migrate, doctor
└─ flowpanel/   # the published package — re-exports via subpaths
```

### 3.3 Rendering model

- **Server Components by default.** Pages, dashboards, detail, lists, forms — all RSC.
- **Client components only where interactivity demands:** DataTable controls, FilterBar, Drawer, forms (conform), Toasts, CommandPalette, `<LiveIndicator>`.
- **Per-widget Suspense + ErrorBoundary.** A slow or broken widget doesn't block its siblings; the user sees skeletons and retry buttons per card.
- **Server Actions** for every mutation. No REST layer, no tRPC-style bespoke procedures — React 19 natively.

### 3.4 Customization model

```
L1  Config props                      covers ~90%
    columns, filters, render, schema, fields
     │
     │  not enough? drop a custom widget or override a primitive
     ▼
L2  Custom widgets + theme.components covers ~8%
    custom(MyPipelineFlow, query)
    theme: { components: { MetricCard: MyMetricCard } }
     │
     │  still not enough? take ownership of a whole piece
     ▼
L3  Eject                             covers ~2%
    flowpanel eject resource users
    flowpanel eject dashboard /monitoring
    flowpanel eject layout
```

No fourth trapdoor. No hidden runtime behaviors. What you configure is what renders.

---

## 4. A full example: freelance-radar admin

This is a realistic 300-line config for a SaaS admin with 12 tables, 3 dashboards, 3 BullMQ queues, realtime updates, drawers, and a ⌘K palette. It's what a developer sees in their IDE after `flowpanel init` + filling in resources.

```ts
// flowpanel.config.ts
import { defineAdmin, resource, dashboard, queue, metric, areaChart, barChart, table, custom, statGroup } from "flowpanel";
import { drizzleAdapter } from "flowpanel/drizzle";
import { bullmqAdapter } from "flowpanel/bullmq";
import { db } from "@/server/lib/db";
import * as schema from "@/server/lib/db/schema";
import { getSession } from "@/server/lib/auth";
import { scraperQueue, matcherQueue, notifierQueue } from "@/server/queues";
import { PipelineFlow } from "@/components/admin/PipelineFlow";
import { PlatformStatus } from "@/components/admin/PlatformStatus";
import { eq, gte, sql } from "drizzle-orm";

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),

  auth: {
    session: getSession,
    role: (s) => s?.user?.role ?? "guest",
    requireRole: "admin",
  },

  theme: {
    brand: { name: "FreelanceRadar", logo: "/logo.svg" },
    accent: "hsl(268 80% 58%)",
    mode: "auto",
    nav: {
      groups: [
        { label: "Overview",    items: ["/", "/monitoring"] },
        { label: "People",      items: ["users", "freelancerProfile"] },
        { label: "Marketplace", items: ["jobs", "categories", "response"] },
        { label: "Billing",     items: ["subscription", "payments", "aiCosts"] },
        { label: "Operations",  items: ["/queues/scraper", "/queues/matcher", "/queues/notifier"] },
      ],
    },
  },

  // ─── Dashboards ────────────────────────────────────────────────────────
  dashboards: [
    dashboard({
      path: "/",
      label: "Overview",
      dateRange: { preset: "last7d" },
      sections: [
        {
          label: "Today",
          columns: 4,
          widgets: [
            metric("Signups", async ({ db, dateRange }) =>
              db.select({ c: sql`count(*)` }).from(schema.users).where(gte(schema.users.createdAt, dateRange.from)).then(r => r[0]!.c),
              { format: "number", drilldown: "/users?range=today" }
            ),
            metric("Active jobs",  async ({ db }) => db.select({ c: sql`count(*)` }).from(schema.jobs).where(eq(schema.jobs.status, "active")).then(r => r[0]!.c)),
            metric("Revenue",      async ({ db, dateRange }) => 0, { format: "currency", delta: async () => ({ value: 0.12, vs: "last week" }) }),
            metric("AI spend",     async ({ db, dateRange }) => 0, { format: "currency", tone: "warning" }),
          ],
        },
        {
          label: "Traffic",
          columns: 2,
          widgets: [
            areaChart("Signups",  async ({ db, dateRange }) => [], { x: "day", y: "count", smooth: true }),
            barChart ("Revenue",  async ({ db, dateRange }) => [], { x: "day", y: ["pro", "team"], stacked: true }),
          ],
        },
        {
          label: "Recent users",
          widgets: [ table({ resource: "users", limit: 10, rowClick: "drawer" }) ],
        },
      ],
    }),

    dashboard({
      path: "/monitoring",
      label: "Monitoring",
      icon: "activity",
      realtime: ["scraperRuns", "matcherRuns"],
      sections: [
        {
          label: "Pipeline",
          widgets: [ custom(PipelineFlow, async ({ db }) => ({ stages: await pipelineStages(db) }), { span: 12 }) ],
        },
        {
          label: "Platforms",
          columns: 4,
          widgets: [
            custom(PlatformStatus, async ({ db }) => ({ platform: "kwork", …await platformStatus(db, "kwork") })),
            custom(PlatformStatus, async ({ db }) => ({ platform: "fl", …await platformStatus(db, "fl") })),
            custom(PlatformStatus, async ({ db }) => ({ platform: "upwork", …await platformStatus(db, "upwork") })),
            custom(PlatformStatus, async ({ db }) => ({ platform: "freelance", …await platformStatus(db, "freelance") })),
          ],
        },
        {
          label: "Last runs",
          widgets: [
            table({
              query: async ({ db }) => db.select().from(schema.scraperRuns).orderBy(sql`started_at desc`).limit(50),
              columns: ["startedAt", "platform", "status", "durationMs", "jobsScraped"],
              realtime: "scraperRuns",
              rowClick: "drawer",
            }),
          ],
        },
      ],
    }),
  ],

  // ─── Resources ──────────────────────────────────────────────────────────
  resources: [
    resource(schema.users, {
      label: "Users",
      icon: "users",
      columns: ["email", "name", "subscriptionPlan", "role", "createdAt"],
      search: ["email", "name"],
      filters: ["role", "subscriptionPlan"],
      defaultSort: { field: "createdAt", dir: "desc" },
      rowClick: "drawer",

      drawer: {
        width: "lg",
        header: (u) => `${u.name ?? u.email}`,
        tabs: [
          { key: "profile",  label: "Profile",  fields: "*" },
          { key: "subs",     label: "Subscriptions", resource: "subscription", filter: (u) => ({ userId: u.id }) },
          { key: "payments", label: "Payments",      resource: "payments",     filter: (u) => ({ userId: u.id }) },
          {
            key: "activity", label: "Activity",
            widgets: [
              statGroup({ stats: [
                { label: "Responses", value: async ({ db }, u) => db.$count(schema.response, eq(schema.response.userId, u.id)) },
                { label: "Last login", value: async (_, u) => u.lastLoginAt ?? "—" },
              ]}),
            ],
          },
        ],
        actions: [
          { key: "resend-welcome", label: "Resend welcome email",
            form: [{ name: "template", type: "select", options: ["welcome", "recovery"] }],
            run: async (u, { template }) => { await sendEmail(u.email, template); return { ok: true, message: "Email queued" }; } },
          { key: "ban", label: "Ban user", variant: "destructive", confirm: "This will block access.",
            run: async (u) => { await db.update(schema.users).set({ banned: true }).where(eq(schema.users.id, u.id)); return { ok: true, refresh: true }; } },
        ],
      },

      bulkActions: [
        { key: "export", label: "Export CSV", run: async (ids) => ({ ok: true, download: { filename: "users.csv", data: await exportUsers(ids), mime: "text/csv" } }) },
      ],

      scope: (s, q) => q.where(eq(schema.users.companyId, s.companyId)),
    }),

    resource(schema.jobs, {
      label: "Jobs",
      icon: "briefcase",
      columns: [
        "title",
        { field: "platform", render: (j) => <Badge>{j.platform}</Badge> },
        "status",
        { field: "budget", render: (j) => formatMoney(j.budget, j.currency) },
        "createdAt",
      ],
      search: ["title", "description"],
      filters: ["platform", "status", "categoryId"],
      rowClick: "drawer",
      drawer: { fields: "*", width: "xl" },
    }),

    resource(schema.categories, {
      label: "Categories",
      columns: ["name", "slug", "isActive"],
      search: ["name"],
      update: { fields: [{ name: "isActive", type: "switch" }] },
    }),

    resource(schema.subscription,       { label: "Subscriptions", columns: ["userId", "plan", "status", "renewsAt"], filters: ["status", "plan"] }),
    resource(schema.payments,           { label: "Payments",      columns: ["userId", "amount", "currency", "status", "createdAt"], filters: ["status"] }),
    resource(schema.aiCosts,            { label: "AI costs",      columns: ["userId", "model", "inputTokens", "outputTokens", "costUsd", "at"] }),
    resource(schema.response,           { label: "Responses",     columns: ["userId", "jobId", "status", "createdAt"], filters: ["status"] }),
    resource(schema.freelancerProfile,  { label: "Freelancers",   columns: ["userId", "rating", "hourlyRate", "isVerified"], filters: ["isVerified"] }),
    resource(schema.sourceCategoryMapping, { label: "Source mappings", hidden: false, columns: ["source", "sourceCategory", "targetCategoryId"] }),
  ],

  // ─── Queues (BullMQ via bull-board) ─────────────────────────────────────
  queues: [
    queue(scraperQueue,  { label: "Scraper",  icon: "rss" }),
    queue(matcherQueue,  { label: "Matcher",  icon: "combine" }),
    queue(notifierQueue, { label: "Notifier", icon: "bell" }),
  ],

  // ─── Realtime ───────────────────────────────────────────────────────────
  realtime: {
    driver: process.env.REDIS_URL ? "redis" : "memory",
  },

  // ─── Audit ──────────────────────────────────────────────────────────────
  audit: { enabled: true, retention: "90d" },

  // ─── ⌘K palette ─────────────────────────────────────────────────────────
  commandPalette: {
    groups: [
      { label: "Actions", items: [
        { label: "Trigger scraper run", icon: "play",
          action: { type: "run", fn: () => scraperQueue.add("manual", {}) } },
      ]},
    ],
  },

  // ─── Observability ──────────────────────────────────────────────────────
  hooks: {
    onError: async (err, ctx) => { logger.error({ err, path: ctx.req.url }); },
  },
});
```

**That's ~220 lines of config for a 12-table admin with realtime, queues, dashboards, drawers, custom widgets, and ⌘K.** The reader can skim it and know exactly what the admin does.

The two custom components (`PipelineFlow`, `PlatformStatus`) are the L2 escape hatch. Everything else is L1.

---

# Part II — Developer experience

## 5. CLI — four commands

`pnpm dlx flowpanel <cmd>` or local `pnpm flowpanel <cmd>`.

### 5.1 Visual UX

Every command uses `@clack/prompts` for consistent prompts + `picocolors` for color. No spinners inside other spinners; no ASCII art; no ads.

```
$ pnpm dlx flowpanel init

┌  FlowPanel — admin panels the fast way
│
◇  Detected stack
│  Next.js 15.2 · TypeScript · Drizzle · tRPC
│
◇  ORM
│  ● Drizzle
│
◇  Paths
│  db client  ~/server/lib/db
│  schema     ~/server/lib/db/schema
│  auth       ~/server/lib/auth
│  admin      app/admin
│
◇  Starter resources
│  ◼ users  ◼ jobs  ◼ categories  ◻ payments  ◻ subscription  …
│
◆  Writing files
│  ✓ flowpanel.config.ts
│  ✓ app/admin/[[...slug]]/page.tsx
│  ✓ app/api/flowpanel/[...route]/route.ts
│  ✓ app/api/flowpanel/stream/route.ts
│  ✓ flowpanel/migrations/0001_init.sql
│  ✓ styles/admin.css
│
└  Next:  pnpm flowpanel migrate  ·  pnpm dev  ·  open /admin
```

### 5.2 Commands

| Command | Purpose |
|---|---|
| `flowpanel init` | Scaffold 6 files into an existing Next.js project. Interactive; `--yes` for CI. |
| `flowpanel eject <resource\|dashboard\|layout> [name]` | Move a piece into the user's repo as ownable source; AST-edit the config to remove it. |
| `flowpanel migrate` | Apply SQL from `flowpanel/migrations/`. Idempotent. Tracked in `_flowpanel_migrations`. |
| `flowpanel doctor` | Health check: stack versions, config type-check, routes wired, migrations applied, axe-core smoke, `size-limit` budgets, peer deps. Exit 0 healthy. |

**No `add`, `generate`, or `update`.** Adding a resource is editing one file.

---

## 6. Files installed (exactly six)

```
flowpanel.config.ts
app/admin/[[...slug]]/page.tsx
app/api/flowpanel/[...route]/route.ts
app/api/flowpanel/stream/route.ts
flowpanel/migrations/0001_init.sql
styles/admin.css
```

Sources shown in full in §7 of revision 2 (unchanged). The starter `flowpanel.config.ts` seeded from user-selected tables — not an empty stub.

---

## 7. Config API

### 7.1 `defineAdmin`

```ts
function defineAdmin(config: AdminConfig): ResolvedAdminConfig;

interface AdminConfig {
  adapter: Adapter;

  auth:     AuthConfig;
  scope?:   (ctx: ScopeContext) => Promise<Scope> | Scope;
  theme?:   ThemeConfig;

  resources?:  ResourceConfig[];
  dashboards?: DashboardConfig[];
  pages?:      PageConfig[];         // user-owned routes registered in nav
  queues?:     QueueConfig[];

  realtime?:       RealtimeConfig;
  audit?:          AuditConfig;
  rateLimit?:      RateLimitConfig;
  commandPalette?: CommandPaletteConfig;
  labels?:         Record<string, string>;
  observability?:  ObservabilityConfig;

  hooks?: {
    onAction?: (event: ActionLifecycleEvent) => void | Promise<void>;
    onError?:  (error: Error, ctx: RequestContext) => void | Promise<void>;
  };
}
```

### 7.2 `resource(ref, options)`

Single signature, two adapter shapes:

```ts
// Drizzle — table passed directly; Row inferred
resource(schema.users, {
  columns: ["email", "role"],          // keyof InferSelect<typeof schema.users>
})

// Prisma — model name as string + explicit type parameter
resource<User>("user", {
  columns: ["email", "role"],          // keyof User
})
```

Full `ResourceOptions<Row>` shape identical to revision 2 §9.1 (retained unchanged). Key fields: `columns`, `search`, `filters`, `defaultSort`, `density`, `rowClick`, `drawer`, `detail`, `schema`, `create`/`update`/`delete`, `actions`, `bulkActions`, `scope`, `listQuery`, `itemQuery`, `export`, `realtime`.

### 7.3 `dashboard(options)` — FlowPanel-rendered

Renders widgets in sections. Separate from `page()`.

### 7.4 `page(options)` — user-owned route in nav

Registers `app/admin/<path>/page.tsx` in navigation. FlowPanel does not render it; the user does. Two functions, two clear roles.

### 7.5 Widget builders

Four chart builders (`areaChart`, `barChart`, `lineChart`, `pieChart`) each with typed options for their chart kind. Plus `metric`, `table`, `custom`, `statGroup`. Full signatures in §18 below and revision 2 §10.

### 7.6 `queue(bullmq, options)`

Wraps `bull-board` under FlowPanel's theme. User gets retry / pause / resume / clear / drain / payload / flow graphs without FlowPanel rebuilding them.

---

## 8. Customization ladder — with concrete examples

### L1 — Config props (≈ 90% of needs)

**Scenario:** render the `plan` column as a colored badge, hide `password` from create form.

```ts
resource(schema.users, {
  columns: [
    "email",
    { field: "plan", render: (u) => <Badge tone={u.plan === "pro" ? "accent" : "muted"}>{u.plan}</Badge> },
  ],
  create: {
    fields: [
      { name: "email" },
      { name: "name" },
      { name: "plan", type: "select", options: ["free", "pro", "team"] },
    ],
  },
})
```

### L2a — Custom widgets (non-CRUD visualization)

**Scenario:** pipeline flow chart — not a table, not a metric.

```ts
import { PipelineFlow } from "@/components/admin/PipelineFlow";

dashboard({
  path: "/monitoring",
  sections: [
    {
      label: "Pipeline",
      widgets: [
        custom(PipelineFlow, async ({ db }) => ({
          stages: await pipelineCounts(db),
        }), { span: 12 }),
      ],
    },
  ],
})
```

`PipelineFlow.tsx` is the user's React component. Imports atoms from `flowpanel/react` (Card, StatusDot, Mono) to stay visually consistent.

### L2b — Component overrides (primitive swap)

**Scenario:** company design system has its own Card look.

```ts
import { MyMetricCard } from "@/components/admin/MyMetricCard";

theme: {
  components: {
    MetricCard: MyMetricCard,  // applied everywhere MetricCard renders
  },
}
```

`MetricCardProps` type is exported from `flowpanel/react` — user's component is type-checked against runtime expectations.

### L3 — Eject (ownable source)

**Scenario:** the `users` resource grew to have custom multi-step create wizards, GDPR exports, and side-by-side diff view. Config can't express it cleanly.

```bash
flowpanel eject resource users
```

Result:
```
app/admin/users/
├── page.tsx           # list — was runtime, now yours
├── new/page.tsx       # create
├── [id]/page.tsx      # detail
├── [id]/edit/page.tsx # edit
└── actions.ts         # server actions

flowpanel.config.ts    # resource(schema.users, ...) is commented out,
                       # replaced with // ejected: app/admin/users
```

Files stamped `// flowpanel: ejected @ 1.0.0 — this file is yours`. Runtime defers. `doctor` verifies the marker + absence of the config entry.

Three eject targets total: `resource`, `dashboard`, `layout`. No fourth.

---

# Part III — Subsystems

## 9. Adapters

### 9.1 Drizzle

```ts
import { drizzleAdapter } from "flowpanel/drizzle";

adapter: drizzleAdapter({
  db,                 // Drizzle db instance
  schema,             // import * as schema
  dialect?: "pg" | "mysql" | "sqlite",  // inferred
})
```

Type inference via `InferSelect<typeof schema.users>`. Auto Zod schemas via `drizzle-zod`.

### 9.2 Prisma

```ts
import { prismaAdapter } from "flowpanel/prisma";

adapter: prismaAdapter({ prisma })

resources: [
  resource<User>("user", { columns: ["email", "role"] }),
],
```

Runtime DMMF introspection via `Prisma.dmmf.datamodel.models` — zero setup, no generator.

### 9.3 Pick one

Mixing Drizzle + Prisma in one config is out of 1.0 scope. One project, one ORM.

---

## 10. Forms — `@conform-to/react`

React 19 Server Actions + Zod, progressive-enhanced.

```tsx
<Form action={admin.users.update} schema={usersUpdateSchema} defaultValues={user}>
  <Field name="email" />
  <Field name="name" />
  <Field name="role" type="select" options={[…]} />
  <FormError />
  <FormSubmit>Save</FormSubmit>
</Form>
```

Schemas auto-derived (drizzle-zod or Prisma DMMF) or overridden via `schema: customZod`. Field inference by column type (text → input, boolean → switch, enum → select, FK → reference picker, etc.). Async validation, conditional fields (`hidden: (v) => v.plan !== "pro"`), optimistic submits.

Full `FieldDef` shape retained from revision 2 §11.5.

---

## 11. Actions & optimistic mutations

`RowAction<Row>`, `BulkAction<Row>` with `confirm`, `form`, `hidden`, `disabled`, `requireRole`, typed `run`.

```ts
const update = useAdminMutation(admin.users.update, {
  optimistic: (prev, input) => ({ ...prev, ...input }),
  rollbackOn: "error",
  onSuccess: (r) => toast(r.message ?? "Saved"),
});
```

Result shape includes `refresh: string[]` (SSE channels to publish), `redirect`, and `download: { filename, data, mime }` for CSV/JSON exports.

---

## 12. Drawers

URL-synced (`?drawer=users:abc123`), focus-trapped, `Esc`-closable, `prefers-reduced-motion`-aware.

```ts
drawer: {
  width: "lg",
  header: (u) => u.name,
  tabs: [
    { key: "profile",  label: "Profile",  fields: "*" },
    { key: "subs",     label: "Subscriptions", resource: "subscription", filter: (u) => ({ userId: u.id }) },
    { key: "activity", label: "Activity", widgets: [statGroup({ … })] },
  ],
  actions: [/* RowAction[] with form, confirm, variant */],
  viewDetailsLink: true,  // "Open full page →" in footer
}
```

Programmatic:
```ts
const drawer = useAdminDrawer();
drawer.open({ resource: "users", id });
```

---

## 13. Realtime

```ts
// In config
realtime: { driver: "redis" }

// In any server code
import { publish } from "flowpanel/server";
await publish("scraperRuns");

// In any widget / custom component
realtime: "scraperRuns"   // declarative
// or
useLiveChannel("scraperRuns", () => router.refresh());
```

- SSE endpoint: `/api/flowpanel/stream?channel=<name>`.
- Auto-publish on resource mutations → channel `resource.<name>`.
- Manual publish for non-FlowPanel writes (BullMQ workers, crons, webhooks).
- Reconnect with exponential backoff; `router.refresh()` on reconnect to resync.

---

## 14. Command palette (⌘K)

Baseline 1.0 feature. Open with `⌘K` / `Ctrl+K`.

Groups (built-in + user-extendable):
- **Navigation** — resources, dashboards, pages.
- **Items** — fuzzy search across resources (adapter implements `searchItems`).
- **Actions** — custom commands + actions marked `palette: true`.
- **Theme** — light / dark toggle.

Programmatic:
```ts
const cmd = useAdminCommand();
cmd.open({ query: "user:" });
```

Keyboard-only fully supported (↑↓ / Enter / Esc / `/`). Screen reader live regions.

---

## 15. Queues — BullMQ via `bull-board`

```ts
queue(scraperQueue, { label: "Scraper" })
```

Route `/admin/queues/scraper` renders `bull-board`'s React UI re-themed with FlowPanel tokens. User gets:
- per-state tabs (waiting, active, completed, failed, delayed)
- retry / pause / resume / clear / drain
- payload inspection + replay
- flow chain visualizer
- realtime job counts via BullMQ events

FlowPanel wraps, auth-gates, and themes. We don't reinvent the UI.

---

## 16. Auth & scope

```ts
auth: {
  session: getSession,
  role: (s) => s?.user?.role ?? "guest",
  requireRole: "admin",
}

scope: async ({ session }) => ({ companyId: session?.user?.companyId ?? null }),
resource(schema.users, {
  scope: (s, q) => q.where(eq(schema.users.companyId, s.companyId)),
})
```

**Strict scope by default:** if `scope` is defined globally but a resource omits its `scope: …`, runtime throws in dev and returns 403 in prod. No silent data leaks. Opt-out per resource: `scope: "bypass"` + explicit role check.

---

## 17. Audit, rate limit, observability

```ts
audit: {
  enabled: true,
  sink: async (event) => { /* optional custom — default writes to DB */ },
  retention: "90d",
}

rateLimit: { per: "user", limit: 100, window: "1m", driver: "redis" }

observability: { metrics: true, otel: true }
hooks: {
  onAction: ({ action, status, durationMs }) => metrics.timing("admin.action", durationMs, { action }),
  onError:  (err, ctx) => sentry.captureException(err, { user: ctx.session }),
}
```

Built-in audit dashboard at `/admin/_audit` (ejectable). Prometheus endpoint at `/api/flowpanel/metrics` when `metrics: true`.

---

## 18. Widgets — complete reference

### `metric`
```ts
metric(label, query, { icon, format, sublabel, delta, sparkline, tone, drilldown, drawer, span, realtime })
```

### `areaChart` / `barChart` / `lineChart` / `pieChart` — separate for DX
```ts
areaChart(label, query, { x, y, stacked?, smooth?, height?, format?, tooltip?, drilldown? })
barChart (label, query, { x, y, stacked?, horizontal?, … })
lineChart(label, query, { x, y, smooth?, markers?, … })
pieChart (label, query, { category, value, donut?, showLegend?, … })
```

### `table`
```ts
table({ label?, resource?, query?, columns?, limit?, rowClick?, emptyState?, realtime? })
```

### `custom` & `statGroup`
```ts
custom(Component, props | (ctx) => Promise<props>, { span?, realtime? })
statGroup({ label?, stats: [{label, value, format?, tone?}] })
```

---

# Part IV — Engineering

## 19. UI primitives (~50 components)

```
_shell/     AdminShell · AdminNav · PageHeader · DetailShell · Breadcrumbs
            Drawer · DrawerHeader · DrawerContent · DrawerFooter
            Tabs (URL-synced) · CommandPalette
_layout/    Section · SectionLabel · MetricGrid · Card · CardHeader · CardContent · Divider
_data/      DataTable · FilterBar · DateRangePicker · Pagination · KV · Field
            EmptyState · ReferencePicker · JsonEditor · TagInput
            ColumnVisibilityMenu · DensityToggle
_atoms/     Badge · StatusDot · StatusBadge · TimeAgo · Mono · Sparkline
            LiveIndicator · CopyButton · Avatar · Kbd
_charts/    AreaChart · BarChart · LineChart · PieChart   (Recharts, lazy)
_forms/     Form · Field · FormSubmit · FormError · FormSection · AsyncSelect
_feedback/  SkeletonCard · SkeletonTable · HealthBanner · ConfirmDialog · ErrorState · Toast · ToastProvider
_queue/     QueueDashboard (bull-board re-themed) · JobRow · JobPayloadDialog
ui/         shadcn primitives — button · input · select · dialog · popover · tabs
            dropdown-menu · skeleton · switch · checkbox · radio · toggle · tooltip · sheet · command
```

**DataTable** baseline: server-side everything, column visibility + resize + density + pin, keyboard nav (`j/k/Enter/Space/Esc/ /`), row selection, bulk bar, CSV export, skeleton + empty states.

All component props are public API. Semver-major to change.

---

## 20. Theming & design tokens

30 color/radius/spacing + motion tokens. Light + dark. Tailwind v4 `@theme` mapping.

```css
:root {
  --fp-bg-1: 0 0% 100%;
  --fp-text-1: 220 10% 15%;
  --fp-accent: 268 80% 58%;
  --fp-radius: 0.5rem;
  --fp-space-unit: 4px;

  --fp-duration: 180ms;
  --fp-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --fp-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  /* … */
}
.dark { /* overrides */ }
@media (prefers-reduced-motion: reduce) {
  :root { --fp-duration: 0ms; }
}
```

Customize: edit `styles/admin.css` (tokens), or `theme.accent` / `theme.cssVars` in config.

---

## 21. TypeScript & DX

**No codegen files.** The typed `admin` client is derived by TypeScript module augmentation from `defineAdmin`'s return type:

```ts
// user's flowpanel.config.ts
export default defineAdmin({ resources: [resource(schema.users, { … }), …] } as const);

// flowpanel/client internally
declare module "flowpanel/client" {
  const admin: ResolveAdmin<typeof import("@/flowpanel.config").default>;
}
```

`admin.users.list`, `admin.users.update`, etc. are typed from the config shape. No stale generated files. Config change → types update on next TS pass.

`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enforced in FlowPanel source. `doctor` warns if user's tsconfig is looser.

---

## 22. Next.js integration

- App Router only, Next ≥ 15, React ≥ 19.
- Catch-all `app/admin/[[...slug]]/page.tsx`; specific routes win.
- API: `app/api/flowpanel/[...route]/route.ts` + `app/api/flowpanel/stream/route.ts`.
- Server Actions for mutations.
- RSC streaming per dashboard section.
- No middleware required — auth runs in RSC and actions.

---

## 23. Accessibility — WCAG 2.2 AA

**Enforced in CI:**
- `axe-core` on every admin route — 0 violations.
- Playwright keyboard-only smoke: navigate list → drawer → edit → save → close.
- Contrast ratios ≥ 4.5:1 on default theme.

**Guaranteed:** focus-trap in drawers / dialogs / palette; `aria-labelledby` on all overlays; `aria-live="polite"` (toasts), `assertive` (errors); `aria-sort` on tables; `aria-invalid` + `aria-describedby` on form fields; skip-to-content as first Tab target; all animations respect `prefers-reduced-motion`.

**Responsive:** desktop-first (1024 px+), fluent to tablet (768 px). Phone renders a clear message — "Admin is desktop-optimized; mobile support lands in 1.1."

---

## 24. Performance & bundle

| Target | Budget (gzip) |
|---|---|
| `flowpanel` | < 30 KB |
| `flowpanel/react` | < 55 KB |
| `flowpanel/charts` | < 60 KB · **lazy** |
| `flowpanel/client` | < 25 KB |
| `@bull-board/react` | < 45 KB · **lazy** |
| **First Load JS (initial admin route)** | **< 170 KB** |

Enforced via `size-limit` in CI. Charts and bull-board are lazy — they don't count.

**Perf targets:**
- List TTI (10k rows, 4G, p95): < 800 ms.
- Mutation → list refresh p95 (same tab, optimistic): < 300 ms.
- Mutation → list refresh p95 (cross-tab, Redis SSE): < 500 ms.

---

## 25. Repo structure & OSS hygiene (2026 practices)

### 25.1 Monorepo

```
flowpanel/
├─ .changeset/               # Changesets for releases
├─ .github/
│  ├─ workflows/ci.yml       # lint, typecheck, unit, integration, e2e, a11y, size-limit
│  ├─ workflows/release.yml  # Changesets → npm publish + GitHub release
│  ├─ CODEOWNERS
│  ├─ ISSUE_TEMPLATE/
│  └─ PULL_REQUEST_TEMPLATE.md
├─ apps/
│  └─ docs/                  # fumadocs site
├─ examples/
│  └─ freelance-radar/       # living E2E fixture (real SaaS clone)
├─ packages/
│  ├─ core/
│  ├─ react/
│  ├─ drizzle/
│  ├─ prisma/
│  ├─ next/
│  ├─ bullmq/
│  ├─ client/
│  ├─ cli/
│  └─ flowpanel/             # the published package (subpath re-exports)
├─ docs/
│  ├─ adr/                   # architecture decision records
│  ├─ invariants.md          # public-API contracts
│  └─ spec/flowpanel-v1.0.md
├─ biome.json                # single linter+formatter (replaces eslint+prettier in 2026 setup)
├─ tsconfig.base.json        # project references
├─ pnpm-workspace.yaml
└─ package.json
```

### 25.2 Tooling

| Concern | Tool |
|---|---|
| Package manager | `pnpm` (workspaces) |
| Build | `tsup` (libraries), `next build` (docs + example) |
| Lint + format | `biome` (one config) |
| Unit | `vitest` |
| Integration | `testcontainers` (real Postgres/MySQL/SQLite/Redis) |
| E2E + a11y | `playwright` + `@axe-core/playwright` |
| Screenshot regression | `playwright` `toHaveScreenshot` with pixelmatch |
| Type tests | `tsd` |
| Bundle | `size-limit` |
| Releases | `@changesets/cli` — one changeset per user-visible change, required by PR template |
| Deps | `renovate` (automated) |
| Docs | `fumadocs` |

### 25.3 Public contracts

`docs/invariants.md` catalogs every invariant of the public API (naming, signatures, lifecycle). Any PR that touches `packages/*/src/index.ts` must cite a matching invariant or introduce an ADR in `docs/adr/`.

### 25.4 Coding patterns (enforced via Biome + reviews)

- **One file, one responsibility.** Files > 300 LOC require a split justification in PR.
- **No side-effects on import.** All initialization behind `defineAdmin(config)`.
- **No globals beyond the request-scoped AsyncLocalStorage for scope.**
- **Errors are typed.** Throw `FlowpanelError` subclasses, not raw strings.
- **Public APIs are documented with JSDoc** (`@example` on builders, visible in IDE hovers).
- **Server-only code in `"use server"` modules;** client-only in `"use client"`. Isomorphic utilities are rare and reviewed.

### 25.5 Contribution flow

- `good-first-issue` and `help-wanted` curated monthly.
- PR template forces: description, changeset, test evidence, docs update (if user-visible).
- All commits signed (DCO — Developer Certificate of Origin).
- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1).
- `SECURITY.md` with disclosure channel.

---

## 26. Testing

Five layers (§26 retained from revision 2):
1. Unit (vitest) — public functions.
2. Integration (testcontainers) — each adapter against each dialect.
3. E2E (Playwright) — `examples/freelance-radar` full flows on both adapters.
4. Screenshot regression (Playwright + pixelmatch) — light + dark + both adapters.
5. Type tests (tsd) — public API shapes.

Plus a11y (axe-playwright) — 0 violations gate.

CI fails on any of: test failure · size-limit exceeded · tsd failure · `TODO|FIXME|@ts-ignore` grep · lint/typecheck · missing changeset.

---

# Part V — Delivery

## 27. Success metrics for 1.0

Ship as `1.0.0-beta.N` until **every** metric green; then `1.0.0`.

| # | Criterion | Verified by |
|---|---|---|
| 1  | `flowpanel init` < 20 s on a 10-table project | automated e2e |
| 2  | freelance-radar admin (Monitoring + Users + Jobs + Categories + Queues) reproduces from config — Drizzle + Prisma | screenshot regression ≤ 2 % |
| 3  | freelance-radar config ≤ 350 LOC | CI line counter |
| 4  | 0 TS errors in user repo after `init` | `tsc --noEmit` in e2e |
| 5  | `eject resource <name>` produces tsc-passing, visually-identical code | integration test |
| 6  | Cross-tab mutation refresh p95 < 500 ms (Redis) | timing test |
| 7  | First Load JS < 170 KB gzip | size-limit CI |
| 8  | Docs site live — quickstart · 10 recipes · API reference · both adapters · eject · realtime · BullMQ · theming · migrations | vercel check |
| 9  | Spec author migrates freelance-radar production end-to-end, uses admin daily ≥ 2 weeks | manual sign-off |
| 10 | 0 TODO/FIXME in `packages/*/src` | grep CI |
| 11 | Prisma adapter passes same integration suite as Drizzle | CI matrix |
| 12 | Playwright smoke < 5 min on both adapters | CI timing |
| 13 | 0 axe-core violations on all admin routes | a11y CI |
| 14 | Keyboard-only smoke (list → drawer → edit → save → close) passes | Playwright |

**If any metric fails → not 1.0.**

---

## 28. Milestones — 150 h across 4 releases

Each release is an installable npm artifact that works end-to-end for its scope.

| M | Hours | Release | Scope (concrete deliverables) |
|---|---|---|---|
| **M1 Core Runtime (Drizzle)** | 35 h | `0.1.0-alpha.0` | `defineAdmin` · `drizzleAdapter` · `resource` CRUD · conform-based forms · catch-all routing · audit · strict scope · `init` · `migrate` · `doctor` · optimistic mutations · DataTable baseline (visibility / resize / density / pin / keyboard) |
| **M2 Dashboards + Drawers + Widgets + ⌘K** | 30 h | `0.2.0-alpha.0` | `dashboard()` + `page()` · 4 chart builders · `metric` / `table` / `custom` / `statGroup` · Drawer subsystem (URL-sync, focus trap) · date range control · drilldown · `CommandPalette` |
| **M3 Queues + Realtime** | 30 h | `0.3.0-alpha.0` | `queue()` via `bull-board` wrap · SSE broker (memory + Redis) · `publish()` public API · `<LiveIndicator>` · `<DataTable realtime>` · auto-publish on mutations · Redis rate-limit |
| **M4 Prisma + Eject + Polish + Docs** | 55 h | `1.0.0-beta.0` → `1.0.0` | `prismaAdapter` (runtime DMMF) · `eject resource` / `eject dashboard` / `eject layout` · `theme.components` overrides · motion tokens · a11y audit (axe + keyboard) · label overrides · tRPC bridge hook · fumadocs site · size-limit CI · screenshot regression CI · 2-week production validation |

**Total: 150 h solo.** Realistic calendar: ~10 weeks full-time, or ~5 months at ~30 h/week part-time.

---

## 29. Public types reference

All types from revision 2 §29 retained:

`RequestContext` · `QueryContext` · `ListQueryContext<Row>` · `ItemQueryContext<Row>` · `MutationContext<Row>` · `ActionContext`
`ListResult<Row>` · `ActionResult`
`ColumnDef<Row>` · `FilterDef<Row>` · `FieldDef<Row>` · `DetailTab<Row>` · `DateRangeControl`
`RowAction<Row>` · `BulkAction<Row>`
`FlowpanelError` · `FlowpanelValidationError` · `FlowpanelAccessError` · `FlowpanelAuthError` · `FlowpanelNotFoundError` · `FlowpanelConflictError` · `FlowpanelRateLimitError`

Every public type is semver-major after 1.0. Additive fields allowed; breaking changes trigger a major.

---

## 30. Out of scope (1.1+)

CSV import · full i18n · visual GUI editor · saved views beyond URL · SSO/SAML turnkey · workflow builder · heatmap/sankey/radar charts · mobile-first redesign · Postgres LISTEN/NOTIFY · non-Next.js standalone · Pages Router · mixed adapters.

---

## 31. Decisions log (FAQ)

**Why four chart builders instead of `chart({type})`?** IDE autocomplete per chart kind. `pieChart(` offers `{category, value, donut}`; `areaChart(` offers `{x, y, stacked, smooth}`. Union-type props are hostile to discovery.

**Why Prisma via runtime DMMF, not `zod-prisma-types`?** Zero setup. No extra generator. `Prisma.dmmf` is stable since Prisma 5.

**Why `conform` for forms?** React 19 native, progressive-enhanced, field arrays + async validation solved. We don't reinvent.

**Why bundle `bull-board` instead of writing a queue UI?** Mature (9 k⭐), feature-complete, proven. Rebuilding costs 20 h and ships worse UX.

**Why separate `dashboard()` and `page()`?** Different semantics: `dashboard()` renders widgets, `page()` registers a user-owned route. Merging them creates a leaky union.

**Why no `eject component`?** `theme.components.<Name>` already covers component swap. Two paths for one concern = confusion. Dropped.

**Why TS module augmentation, not a codegen file?** Codegen goes stale. Augmentation stays fresh.

**Why 170 KB First Load JS, not 120 KB?** Honest measurement. shadcn + DataTable + FilterBar + Forms + CommandPalette ≈ 140 KB. 170 KB leaves real margin.

**Why 150 h, not 95 h?** 95 h omitted docs, a11y audit, screenshot baselines, Prisma parity, 2-week production validation. 150 h is what actually ships.

**Why no CSV import in 1.0?** Deserves its own subsystem (mapping, validation, error rows, dry-run). Shoehorning it in is half-baked. Export ships; import → 1.1.

**Why "label overrides" and not "i18n"?** Real i18n needs plurals, locale, RTL. We only substitute strings by key. Calling it i18n would mislead. Docs point to `next-intl` + eject for full i18n.

**Why strict scope by default?** Silent data leaks are catastrophic. Opt-out must be explicit and loud.

**Can I run on Vercel?** Yes, with Redis (SSE needs Redis pub/sub for multi-invocation fan-out). `doctor` warns.

**What's stable?** Every export from `flowpanel` and subpaths, every public type in §29. Semver-major gated. Internal `@flowpanel/*` workspaces are not installable.

---

*Spec v1.0 revision 3. 2026-04-21. Source-of-truth for the 1.0 implementation plan. Any change requires an explicit revision note appended here.*
