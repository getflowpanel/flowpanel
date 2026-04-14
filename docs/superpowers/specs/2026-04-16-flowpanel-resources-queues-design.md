# FlowPanel — Resources & Queues Design

**Status:** v5 · 2026-04-16
**Scope:** Add generic CRUD Resources, Queue Inspector, per-record dashboards, multi-adapter data, and native pipeline⇄resource linking — as first-class citizens alongside the existing pipeline model.

---

## At a glance — the DX spectrum

One file. One function. Typed paths. Progressive disclosure.

```ts
// flowpanel.ts — auto-detect adapter, object or builder resources
import { defineFlowPanel, resource } from "@flowpanel/core";
import { prisma } from "@/db";

export const flowpanel = defineFlowPanel({
  adapter: prisma,                                     // auto-detects PrismaClient
  context: async () => ({ session: await auth.getSession() }),
  appName: "Freelance Radar",

  // Object form — simplest (no presets):
  resources: {
    // L0 — one line, full CRUD
    post: resource(prisma.post),

    // L1 — pick fields (shorthand arrays)
    invoice: resource(prisma.invoice, {
      columns: [(p) => p.number, (p) => p.amount, (p) => p.paidAt],
      filters: [(p) => p.status, (p) => p.createdAt],
    }),

    // L2 — customize (builder functions)
    subscription: resource(prisma.subscription, {
      columns: (c) => [
        c.field((p) => p.user.email),
        c.field((p) => p.price, { format: "money" }),
        c.computed("mrr", { compute: (r) => r.price / 12, format: "money" }),
      ],
      actions: (a) => ({ cancel: a.mutation({ handler: cancelSub }) }),
    }),

    // L3 — per-record dashboard
    exchange: resource(prisma.exchange, {
      detail: {
        tabs: [
          { id: "overview", label: "Overview",
            sections: (s) => [s.fields([(p) => p.name, (p) => p.url])] },
          { id: "analytics", label: "Analytics",
            widgets: (w, row) => [
              w.aiCost({ partitionKey: row.id, period: "24h" }),
              w.pipelineRuns({ partitionKey: row.id, limit: 20 }),
            ] },
        ],
      },
    }),
  },

  // Builder form — when presets needed:
  // resources: (fp) => ({
  //   ...betterAuthPreset()(fp),
  //   user: fp.resource(prisma.user),
  // }),
});
```

Every feature is reached by adding one field. Nothing requires rewriting existing config.

---

## Design principles

1. **One function, one file, server-only.** `defineFlowPanel({...})` is the entire API surface. `adapter: prisma` auto-detects the ORM. `resources: {}` for simple cases, `(fp) => {}` when presets needed. RSC keeps server imports out of the client bundle.
2. **Progressive disclosure.** `fp.resource(prisma.post)` works. Each customization = one more field. Shorthand arrays for the common case; builder functions when you need control.
3. **100% inference, zero codegen.** Types flow from Prisma delegates / Drizzle tables through every handler, column, filter, section. Renaming a model = compile-time error.
4. **One idiom per concept.** Paths = functions. Models = references. "Deny access" = `false`. No second syntax for the same thing.
5. **Auto-infer what the code already said.** Using `(p) => p.user.email` in columns → FlowPanel adds `include: { user: true }`. Manual `include` only overrides.
6. **Escape hatches at every layer.** Cell / section / view / query / form / page — each has `custom` that takes a React component directly (not a string ID).
7. **Symmetric Prisma / Drizzle.** Same config shape, same handler code. Only the adapter import changes.
8. **Real-time opt-in.** SSE is wired once; `realtime: true` per resource/queue/widget.
9. **Composable by preset.** `...stripePreset()(fp)` — drop-in modules that add resources, widgets, and actions.

---

## 1. Motivation

FlowPanel v0.1 covers pipeline observability (stages, runs, AI cost) but not the 60–70% of Next.js SaaS admin needs: list/edit users, manage subscriptions, inspect background jobs, run ops actions. Without these, users install FlowPanel *alongside* Retool — defeating the value proposition.

### Positioning

> "The admin panel for modern Next.js SaaS. Generic CRUD, pipelines, AI cost, and queues — defined in one config, rendered zero-UI."

### Success criteria

- A developer with a Prisma schema can expose a working admin for a model in **one line**: `fp.resource(prisma.post)`.
- Every escape hatch is **one additional field** away, not a rewrite.
- Type inference is **100%** for columns, filters, handlers, and computed fields — with no codegen step.
- Config file is **server-only** by construction; Prisma/Stripe/Telegram cannot leak into the client bundle.
- Symmetric DX for Prisma and Drizzle.

### Non-goals (v1)

- Visual (drag-and-drop) admin builder
- Non-BullMQ queues first-class (designed extensibly; Inngest/trigger.dev in v2)
- Full CMS features (rich-text block editor, file management, image transformation)
- i18n of admin UI beyond what exists

---

## 2. Architecture

### File layout

```
<project>/
├── flowpanel.ts               ← defineFlowPanel({ ... })
├── app/
│   └── admin/
│       └── page.tsx           ← <FlowPanelUI schema={flowpanel.schema} />
│   └── api/
│       └── trpc/[trpc]/route.ts  ← mounts flowpanel.router
```

**One file.** Infrastructure (`adapter`, `context`, `roles`) and config (`appName`, `resources`) live together in a single `defineFlowPanel({...})` call. Builder functions (`resources: (fp) => ...`) receive a typed `fp` helper — this is how TypeScript infers model types without a chain or codegen step.

`flowpanel.ts` starts with `import "server-only"`. It can freely import Prisma, Stripe, React components — the RSC boundary ensures none cross into the client bundle.

### Data flow

```
┌──────────────────┐       serialize        ┌─────────────────┐
│  flowpanel       │  ───────────────────▶  │  schema (JSON)  │
│  (server object) │                        └────────┬────────┘
│                  │                                 │ via <FlowPanelUI schema>
│  handlers,       │                                 ▼
│  compute,        │                        ┌─────────────────┐
│  context,        │       tRPC calls       │  FlowPanelUI    │
│  adapter         │  ◀──────────────────── │  (client)       │
└──────────────────┘                        └─────────────────┘
```

`flowpanel.schema` strips all functions, replacing them with stable keys. Custom React components (imported with `"use client"`) become client-reference descriptors that RSC serializes natively. No registry map.

### Auto-generated tRPC router

```ts
appRouter.flowpanel = createFlowPanelRouter({ t, config: flowpanel });
// → flowpanel.resource.subscription.list / .get / .create / .update / .delete
// → flowpanel.resource.subscription.action.cancel
// → flowpanel.queue.notifications.list / .retry / .remove
// → flowpanel.stream.connect (SSE)
```

The user never writes tRPC procedures for CRUD.

---

## 3. `defineFlowPanel` — single entry point

```ts
import "server-only";
import { defineFlowPanel } from "@flowpanel/core";
import { prismaAdapter } from "@flowpanel/adapter-prisma";
import { prisma } from "@/db";

export const flowpanel = defineFlowPanel({
  // ── Infrastructure ──
  adapter: prismaAdapter({ prisma }),         // single adapter (shorthand)
  context: async () => ({
    session: await auth.getSession(),
    stripe: new Stripe(process.env.STRIPE_KEY!),
  }),
  roles: ["admin", "support", "billing-ops"] as const,
  rowLevel: ({ session }) =>
    session.role === "admin" ? {} : { orgId: session.orgId },
  audit: { enabled: true, retentionDays: 90 },

  // ── Admin ──
  appName: "Freelance Radar",
  basePath: "/admin",
  timezone: "UTC",

  resources: (fp) => ({ /* ... */ }),
  queues:    (fp) => ({ /* ... */ }),
  pipeline:  { /* existing */ },
  dashboard: { widgets: (w) => [/* ... */] },
  nav:       [/* ... */],
  security:  { /* ... */ },
  theme:     { /* ... */ },
});
```

### 3.1 `adapter` vs `adapters`

**Single adapter** (90% of projects):
```ts
adapter: prismaAdapter({ prisma })
```

**Multiple adapters** (when needed):
```ts
adapters: {
  primary:   prismaAdapter({ prisma }),
  analytics: clickhouseAdapter({ clickhouse }),
}
```

`adapter: x` is sugar for `adapters: { primary: x }`. The two forms are mutually exclusive.

Each adapter declares its **capabilities** (`read`, `write`, `migrations`, `transactions`, `realtime`). ClickHouse → `write: false`. Attempting CRUD on a read-only adapter fails at runtime with a clear error.

### 3.2 `context` and `ctx`

`context` returns per-request data (session, external clients). Everything returned becomes part of `ctx` in every handler:

```ts
ctx = {
  session,            // from context()
  stripe,             // from context()
  db,                 // shortcut → primary adapter's client (prisma / drizzle db)
  adapters: {         // all adapters, typed
    primary: { client: prisma },
    analytics: { client: clickhouse },
  },
  toast,              // FlowPanel-provided: ctx.toast.success("Done")
  sse,                // FlowPanel-provided: ctx.sse.invalidate("subscription")
}
```

`ctx.db` is the shortcut everyone uses. `ctx.adapters.analytics.client` for secondary adapters.

### 3.3 Type signature

```ts
function defineFlowPanel<
  TAdapter extends Adapter | Record<string, Adapter>,
  TCtx extends object,
  TRoles extends readonly string[],
>(config: {
  adapter?: TAdapter;
  adapters?: TAdapter;
  context: () => Promise<TCtx> | TCtx;
  roles?: TRoles;
  rowLevel?: (ctx: BaseCtx<TCtx>) => WhereClause;
  audit?: { enabled: boolean; retentionDays?: number };
  appName: string;
  resources?: (fp: FP<TAdapter, TCtx, TRoles>) => Record<string, Resource>;
  queues?: (fp: FP<TAdapter, TCtx, TRoles>) => Record<string, Queue>;
  // ... rest
}): FlowPanel;
```

`fp` carries four generics: **adapter(s), context, roles, config-so-far**. Full inference downstream.

### 3.4 `fp.*` inside builder functions

```ts
fp.resource(model)              // minimal — one arg
fp.resource(model, opts)        // with config — two args
fp.queue(client)                // minimal
fp.queue(client, opts)          // with config
```

Builders for columns/filters/actions/sections/widgets come as function parameters:
- `columns: (c) => [c.field(...)]`
- `filters: (f) => [f.filter(...)]`
- `actions: (a) => ({ x: a.mutation(...) })`
- `sections: (s) => [s.fields(...)]`
- `widgets: (w) => [w.metric(...)]` or `(w, row) => [...]` for per-record

Each builder shows only methods relevant to that context — autocomplete stays focused.

### 3.5 Presets

Presets are direct imports, not attached to `fp`:

```ts
import { csvExport, softDelete } from "@flowpanel/core/presets";
import { betterAuthPreset } from "@flowpanel/preset-better-auth";

resources: (fp) => ({
  ...betterAuthPreset()(fp),
  subscription: fp.resource(prisma.subscription, {
    actions: (a) => ({
      ...csvExport(),
      ...softDelete({ field: "deletedAt" }),
      cancel: a.mutation({ ... }),
    }),
  }),
})
```

---

## 4. `flowpanel` — the output

`defineFlowPanel` returns an object with three surfaces:

- `flowpanel.schema` — serializable config for client (functions → keys, React components → client-references)
- `flowpanel.router` — tRPC router (mount into appRouter)
- `flowpanel.handlers` — `(resourceId, actionId) → fn` map for Server Actions / tests

Type helper: `type SubscriptionRow = InferRow<typeof flowpanel, "subscription">`

---

## 5. Resources

### 5.1 `fp.resource` — positional model

```ts
fp.resource(model)                // L0: full CRUD, auto everything
fp.resource(model, options)       // L1+: customized
```

First argument = Prisma delegate (`prisma.user`) or Drizzle table (`schema.users`). Always a reference, never a string. Rename in schema = TS error.

L0 renders: list (all scalar columns, offset pagination, ILIKE search over strings), create/edit forms (all writable scalars), detail drawer, delete-with-confirm.

### 5.2 Options shape

```ts
interface ResourceOptions<Row, Ctx, Roles> {
  // Identity
  adapter?: keyof TAdapters;                      // default: "primary"
  label?: string | { singular: string; plural: string };
  icon?: LucideIcon;
  description?: string;

  // Data
  include?: PrismaInclude;                        // override auto-inferred include
  defaultSort?: { field: (p) => Path; dir: "asc" | "desc" };
  readOnly?: boolean;

  // UI — shorthand or builder
  columns?: PathFn[] | ((c: C) => Column[]);
  filters?: PathFn[] | ((f: F) => Filter[]);
  search?:  PathFn[] | { fields: PathFn[]; minLength?: number; debounceMs?: number };
  pagination?: { mode: "offset" | "cursor"; pageSize?: number };   // default offset
  emptyState?: string | React.FC;              // custom empty state (default: "No {label} yet")

  // Behavior
  actions?: (a: A) => Record<string, Action>;
  detail?:  PathFn[] | ((s: S) => Section[]) | { tabs: Tab[] };
  form?:    { create?: FormConfig | false; edit?: FormConfig | "auto" | false };
  access?:  AccessConfig;
  realtime?: boolean | { on: ("insert" | "update" | "delete")[] };

  // Metrics (dashboard widgets)
  metrics?: Record<string, MetricConfig>;
}
```

**Action ID validation:** action names declared in `actions: (a) => ({...})` must not collide with CRUD operation names (`list`, `read`, `create`, `update`, `delete`). FlowPanel validates at init and TS catches via `Exclude<ActionKeys, CrudOps>`.
```

### 5.3 Auto-inferred `include` / `with`

FlowPanel walks columns, filters, search, detail, form at build time and generates `include` (Prisma) or `with` (Drizzle) from path usage:

```ts
fp.resource(prisma.subscription, {
  columns: [(p) => p.user.email, (p) => p.plan.name],
  // → auto include: { user: true, plan: true }
})
```

Manual `include` merges on top (overrides).

### 5.4 Paths — always function form

```ts
(p) => p.email                                    // shallow
(p) => p.user.email                               // relation
(p) => p.user.subscription.plan.features          // depth 4+
(p) => p._count.posts                             // Prisma aggregates
```

Typed Proxy records the path, returns `Path<Row, LeafType>`. No recursion limits, no string autocomplete hacks.

Strings appear only in URL state (`?status=active`) and `filterPresets` keys — runtime-parsed, unavoidable.

### 5.5 Drizzle symmetry

```ts
// Prisma
adapter: prismaAdapter({ prisma }),
resources: (fp) => ({ user: fp.resource(prisma.user) })

// Drizzle
adapter: drizzleAdapter({ db, schema }),
resources: (fp) => ({ user: fp.resource(schema.users, { with: { posts: true } }) })
```

Same downstream API — `columns`, `filters`, `actions`, `detail`, `form`, `access` — identical.

---

## 6. Columns — 3 methods

### 6.1 `c.field` — auto-detect by type

```ts
c.field(path)                              // auto-render by leaf type
c.field(path, opts)                        // with overrides
```

Auto-detection:
- `String` → text
- `Enum` → colored badge
- `DateTime` → relative date
- `Boolean` → checkbox icon
- `Int` / `Float` / `Decimal` → number
- `Json` → collapsible JSON
- Array → chips

Override with `format`:

```ts
c.field((p) => p.price, { format: "money" })
c.field((p) => p.avatar, { format: "image", width: 40 })
c.field((p) => p.createdAt, { format: "relative" })        // or "absolute" / "calendar"
c.field((p) => p.tags, { format: "tags" })
c.field((p) => p.stripeId, { format: "link", href: (row) => `https://dashboard.stripe.com/...` })
```

### 6.2 `c.computed` — virtual column

```ts
c.computed("mrr", {
  label: "MRR",
  compute: (row: Row) => number,              // synchronous, server-side
  format: "money",
  sortExpr?: (db) => Sql,                     // opt-in server-side sort
})
```

Name joins `ColumnKey` union — referenceable in `defaultSort`, `detail`, etc.

### 6.3 `c.custom` — escape hatch

```ts
import { ChurnBadge } from "@/components/admin/ChurnBadge";   // "use client"
c.custom({ id: "risk", render: ChurnBadge, width: 80 })
```

Direct import. RSC serializes the client-reference.

### 6.4 Common options (all column methods)

```ts
interface FieldOpts {
  label?: string;            // default: Title Case of path tail
  width?: number;
  flex?: number;
  format?: "money" | "image" | "relative" | "absolute" | "tags" | "link" | "json" | ...;
  pin?: "left" | "right";
  visible?: "list" | "detail" | "always";     // default "always"
  sortable?: boolean;
  searchable?: boolean;
  mono?: boolean;
  align?: "left" | "center" | "right";
  href?: (row: Row) => string;                // for "link" format
}
```

---

## 7. Filters — 2 methods

### 7.1 `f.filter` — auto-detect by type

```ts
f.filter(path)                             // auto by leaf type
f.filter(path, opts)                       // with overrides
```

Auto-detection:
- `Enum` → multi-select (values from Prisma/Drizzle schema)
- `DateTime` → date range picker with presets
- `String` → text input (debounced)
- `Boolean` → yes / no / any toggle
- `Int` / `Float` → number input (or `{ mode: "range" }` for min/max)
- Relation → relation picker

Override with `mode`:

```ts
f.filter((p) => p.price, { mode: "range" })                   // min/max
f.filter((p) => p.user.email, { mode: "text", debounceMs: 300 })
```

### 7.2 `f.custom` — escape hatch

```ts
f.custom({
  id: "churnRisk",
  label: "Churn risk",
  render: ChurnRiskFilter,
  toWhere: (value) => ({ churnScore: { gte: value } }),
})
```

### 7.3 URL persistence

Filters, sort, and pagination cursor serialize to URL query params. Deep-linkable. Selected row in drawer stays local (not in URL).

### 7.4 Filter presets

```ts
filterPresets: [
  { id: "active", label: "Active", filters: { status: "active" } },
  { id: "expiring", label: "Expiring <7d", filters: { "currentPeriodEnd.lte": "+7d" } },
]
```

Presets render as pills. Users can also save ad-hoc presets to localStorage.

---

## 8. Actions — 5 kinds

```ts
a.mutation({     // per-row
  label, icon?, variant?: "default" | "danger",
  confirm?: string | ConfirmConfig,
  when?: (row) => boolean,
  handler: (row, ctx) => Promise<void | Partial<Row>>,
  onSuccess?: { toast?: string; invalidate?: string[] },
})

a.bulk({         // on selected rows
  label, handler: (rows, ctx) => Promise<void | { download?: { filename, content } }>,
})

a.collection({   // toolbar, no row context
  label, handler: (_, ctx) => Promise<void>,
})

a.link({         // navigate
  label, href: (row) => string, external?: boolean,
})

a.dialog({       // form → handler
  label, schema: StandardSchemaV1,
  handler: (values, row | null, ctx) => Promise<void>,
})
```

### 8.1 Confirm config

```ts
interface ConfirmConfig {
  title?: string;
  description?: string | ((row) => string);
  intent?: "default" | "destructive";
  stepUp?: boolean;              // require fresh auth
  typeToConfirm?: string;       // user types "DELETE" to enable
}
```

### 8.2 Success / error

- `handler` return merges into row (optimistic UI).
- Throws → toast with sanitized error.
- Every action auto-appends to audit log.

### 8.3 Presets — direct imports

```ts
import { csvExport, softDelete, duplicate, impersonate } from "@flowpanel/core/presets";

actions: (a) => ({
  ...csvExport(),
  ...softDelete({ field: "deletedAt" }),
  cancel: a.mutation({ ... }),
})
```

---

## 9. Detail — progressive disclosure

### 9.1 Three levels

```ts
// L1: pick fields — array of paths
detail: [(p) => p.email, (p) => p.name, (p) => p.createdAt]

// L2: custom sections — builder function
detail: (s) => [
  s.fields([(p) => p.email, (p) => p.name]),
  s.relation((p) => p.subscription),
  s.pipelineRuns({ partitionKey: (row) => row.id, limit: 20 }),
]

// L3: tabs — object with tabs array
detail: {
  layout?: "drawer" | "page",          // default "drawer"
  width?: "sm" | "md" | "lg" | "xl",
  tabs: [
    { id: "overview", label: "Overview",
      sections: (s) => [s.fields([(p) => p.plan, (p) => p.status])] },
    { id: "analytics", label: "Analytics",
      widgets: (w, row) => [w.aiCost({ partitionKey: row.id })] },
  ],
}
```

Default (omitted): all scalar fields in a 2-column grid, relation cards, audit timeline if enabled.

### 9.2 Section builder `s.*`

| Method | Purpose |
|---|---|
| `s.fields(paths[], opts?)` | Key-value grid |
| `s.relation(path, { as?: "card" \| "inline" })` | Single related record |
| `s.related(path, { columns?, limit? })` | Table of many-side relation |
| `s.pipelineRuns({ partitionKey, stage?, limit?, realtime? })` | Native pipeline runs for this record |
| `s.aiCost({ partitionKey, period })` | AI cost breakdown for this record |
| `s.queueJobs({ queue, filter })` | Jobs from a queue filtered for this record |
| `s.timeline({ source, filter })` | Audit/activity timeline |
| `s.trendChart({ query, format })` | Chart from aggregate |
| `s.json(path)` | Collapsible JSON |
| `s.custom({ component, when? })` | React component escape hatch |

All sections support: `when: (row) => boolean`, `title?: string`, `collapsed?: boolean`.

### 9.3 Tabs — sections or widgets

Each tab declares its content inline — no ID indirection:

```ts
tabs: [
  { id: "overview", label: "Overview",
    sections: (s) => [s.fields([...]), s.relation("user")] },
  { id: "analytics", label: "Analytics",
    widgets: (w, row) => [
      w.aiCost({ partitionKey: row.id, period: "24h" }),
      w.pipelineRuns({ partitionKey: row.id, limit: 20 }),
    ] },
]
```

Per-record widgets use the same `w.*` builder as the global dashboard (§13).

---

## 10. Forms

### 10.1 Config

```ts
form: {
  create?: FormConfig | false;
  edit?:   FormConfig | "auto" | false;
}
```

Both default to `"auto"`. `false` disables. No `disable` field — `false` is the only way to disable.

### 10.2 `"auto"` fields

Generates one field per writable scalar: `String` → text, `@db.Text` → textarea, `Boolean` → switch, `Enum` → select, `DateTime` → date picker, `Number` → number input, `Json` → JSON editor.

Skips `id`, `createdAt`, `updatedAt`, fields with `access.fields[].write: false`.

### 10.3 Explicit fields

```ts
form: {
  create: {
    schema: createUserSchema,               // Standard Schema (Zod/Valibot/ArkType)
    fields: (f) => [
      f.field((p) => p.email),
      f.field((p) => p.name),
      f.relation((p) => p.orgId, { resource: "org" }),
      f.custom((p) => p.avatar, { component: AvatarUploader }),
    ],
    defaults: { role: "user" },
    layout: "2col",
  },
  edit: "auto",
}
```

All form fields support: `label`, `description`, `placeholder`, `readOnly`, `defaultValue`, `when: (values) => boolean`.

### 10.4 Validation

If `schema` provided → it validates. If not → FlowPanel builds one from model metadata. Server always re-validates.

---

## 11. Access Control

### 11.1 Layers (applied in order)

1. **Panel-level** — `security.auth.getSession` + `requireRole`
2. **Resource-level** — `access.list | read | create | update | delete | [actionId]`
3. **Row-level** — global `rowLevel` merged with per-resource `access.rowLevel`
4. **Field-level** — `access.fields[].read | write`

### 11.2 Config

Three forms for any rule: `false` (deny all), `RolesArray` (allow listed), `(ctx, row?) => boolean` (predicate).

```ts
access: {
  list:   ["admin", "support"],
  delete: false,
  cancel: ["admin", "billing-ops"],
  update: (ctx, row) => row.ownerId === ctx.session.userId,

  rowLevel: (ctx) => ({ orgId: ctx.session.orgId }),

  fields: [
    { path: (p) => p.stripeSecret, read: ["admin"], write: false },
  ],
}
```

`RolesArray` = `TRoles[number][]`. Misspelled role → TS error. `access.fields` is an **array** (not object) so paths use function form.

### 11.3 Behavior

Unauthorized actions → hidden (not disabled). Unauthorized fields → not rendered. Zero-access resource → hidden from nav. All enforced server-side.

---

## 12. Realtime

```ts
realtime: boolean | { on: ("insert" | "update" | "delete")[] }
```

Default `false`. `true` = all three events.

**Prisma:** Client Extensions (Prisma 6+) emit events post-mutation.
**Drizzle:** Adapter wrapper emits events.
Both write to the SSE broker via `pg_notify`.

Client receives events through `/flowpanel.stream.connect`, buffers updates, shows "New: 3" banner. Back-pressure: 50 events/sec per resource, 200ms client debounce.

---

## 13. Queues — `fp.queue`

### 13.1 Positional client

```ts
fp.queue(client)                              // minimal
fp.queue(client, options)                     // with config
```

```ts
fp.queue(notificationQueue, {
  label: "Telegram",
  icon: "send",
  actions: ["retry", "remove", "drain", "pause", "resume"],
  jobDetail: (s) => [
    s.fields((d) => [d.chatId, d.message]),       // d typed from Queue<DataType>
    s.json("data"),
    s.errors("failedReason"),
  ],
  metrics: ["waiting", "active", "completed", "failed"],
  realtime: true,
  access: { view: ["admin", "support"], act: ["admin"] },
})
```

### 13.2 Adapter abstraction

Internal `QueueAdapter<D, R>` interface with `list`, `get`, `retry`, `remove`, `promote`, `pause`, `resume`, `drain`, `stream`, `counts`. `bullmqAdapter` is v1. Inngest/trigger.dev in v2.

---

## 14. Navigation

```ts
nav: [
  { group: "Operations", items: ["pipeline", "queues.notifications"] },
  { group: "Billing",    items: ["subscription", "invoice"] },
  { group: "Users",      items: ["user", "org"], collapsed: true },
]
```

If `nav` omitted: flat list in declaration order. Sidebar collapsible, state persisted per-user.

---

## 15. Dashboard + widget builder

The `w.*` builder is shared across three locations (same API everywhere):

1. Global `dashboard.widgets: (w) => [...]`
2. Per-record tabs `widgets: (w, row) => [...]`
3. Resource/queue overview widgets

### 15.1 Widget types

| Method | Purpose |
|---|---|
| `w.metric({ from \| compute \| adapter+query, format, size? })` | Number/trend card (`from` typed as `` `${ResourceKey}.metrics.${MetricKey}` ``) |
| `w.chart({ adapter+query \| compute, type, groupBy? })` | Area/bar/line/pie |
| `w.list({ resource, filter?, columns?, limit? })` | Mini-table |
| `w.queue({ from })` | Queue state summary |
| `w.pipelineRuns({ stage?, partitionKey?, limit? })` | Native pipeline runs |
| `w.aiCost({ period, groupBy?, partitionKey? })` | Native AI cost |
| `w.custom({ component, props? })` | React component |

### 15.2 Data sources

1. `from: "resource.metrics.*"` — reference a declared metric
2. `adapter: "name", query: (client) => ...` — typed query against named adapter
3. `compute: async (ctx) => ...` — escape hatch with full `ctx`

### 15.3 Per-record widgets

```ts
widgets: (w, row) => [
  w.aiCost({ partitionKey: row.id, period: "24h" }),
  w.pipelineRuns({ partitionKey: row.id, limit: 20 }),
]
```

`row` is fully typed. This is the primitive that makes per-parser dashboards trivial.

---

## 16. Type Inference

```
defineFlowPanel({ adapter: prismaAdapter({ prisma }), context, roles })
│
├─▶ TAdapter    = PrismaAdapter<typeof prisma>
├─▶ TCtx        = Awaited<ReturnType<typeof context>>
└─▶ TRoles      = typeof roles[number]

fp.resource(prisma.subscription, { columns, actions, ... })
│
├─▶ Delegate   = typeof prisma.subscription
├─▶ Include    = auto-inferred from path usage in columns/filters/detail
├─▶ Row        = Prisma.SubscriptionGetPayload<{ include: Include }>
├─▶ columns: (c) => [c.field((p) => p.user.email)]
│                              ^^^^^ p: PathProxy<Row>, full autocomplete
├─▶ actions: (a) => ({ handler: (row: Row, ctx: Ctx) => ... })
│                                     ^^^ fully typed including relations
└─▶ access: AccessRule<Ctx> — false | TRoles[] | predicate
```

Per-surface guarantees:

| Surface | Type source |
|---|---|
| `fp.resource(prisma.x)` | Delegate reference → compile-time binding |
| `fp.resource(schema.x)` | Drizzle table object |
| `include` / `with` | Auto-inferred from path usage; manual overrides |
| `c.field((p) => p.x)` | `Path<Row, Leaf>` via Proxy |
| `c.computed("name")` | Name → `ColumnKey` union |
| `a.mutation({ handler })` | `(row: Row, ctx: Ctx) => ...` |
| `access: { cancel: [...] }` | `TRoles[number][]` |
| `form.schema` | `StandardSchemaV1` |
| `ctx.db` | Primary adapter client type |
| `ctx.adapters.*.client` | Per-adapter client type |

No `any`. No codegen.

---

## 17. Client / Server Boundary

### Problem

`flowpanel.ts` imports Prisma, Stripe, Telegram, and `"use client"` React components. Nothing must leak to the client bundle.

### Solution — RSC + `flowpanel.schema`

```tsx
// app/admin/page.tsx
import { flowpanel } from "@/flowpanel";
export default function AdminPage() {
  return <FlowPanelUI schema={flowpanel.schema} />;
}
```

`flowpanel.schema` getter replaces:
- Every function → stable `(resourceId, actionId)` key
- Every React component → Next.js client-reference (serializable natively)

Result: pure JSON + client-refs. Handlers invoked via tRPC. Components resolved by React runtime.

### Enforcement

- `import "server-only"` at top of `flowpanel.ts`
- `defineFlowPanel` throws if called in browser
- `flowpanel doctor` verifies all of the above

---

## 18. Files / Uploads / Rich Text (v2)

Deferred. Escape via `f.custom` with user-provided component + their upload pipeline.

---

## 19. Audit Log

Enabled by default. Table `flowpanel_audit`. Auto-writes on every mutation. Schema: `{ id, at, actor_id, actor_email, action, resource_id, record_id, diff_before, diff_after, ip, user_agent }`. Viewable as built-in read-only resource. Retention sweeper.

---

## 20. CLI

```
flowpanel init              Scaffold config, page, mount tRPC
flowpanel scaffold <model>  Emit fp.resource stub for a Prisma model
flowpanel migrate           Apply migrations
flowpanel migrate:status    Show status
flowpanel doctor            Health check: server-only, adapters, roles, audit
flowpanel diff              Config ↔ DB drift
flowpanel resources:list    Show registered resources
flowpanel queues:list       Show registered queues
flowpanel demo              Seed demo data
flowpanel dev               Watch config, live validation
```

---

## 21. Presets

A preset is a factory `(opts) => (fp) => ResourceMap`:

```ts
// @flowpanel/preset-stripe
export const stripePreset = (opts: { stripe: Stripe }) =>
  (fp: FlowPanelHelper) => ({
    "stripe-customer":     fp.resource(/* ... */),
    "stripe-subscription": fp.resource(/* ... */),
    "stripe-invoice":      fp.resource(/* ... */),
  });

// Consumer
resources: (fp) => ({
  ...stripePreset({ stripe })(fp),
  user: fp.resource(prisma.user),
})
```

Built-in presets:
- `@flowpanel/preset-better-auth` (v0.5) — Users, Sessions
- `@flowpanel/preset-feature-flags` (v0.5) — Kill switches
- `@flowpanel/preset-stripe` (v1.0) — Customers, Subscriptions, Invoices, MRR widgets

---

## 22. Multi-adapter data

### Adapter interface

```ts
interface Adapter<TClient> {
  client: TClient;
  capabilities: { read: true; write: boolean; migrations: boolean; transactions: boolean; realtime: boolean };
  execute<T>(sql: string, params: unknown[]): Promise<T[]>;
  health?(): Promise<"ok" | "degraded" | "down">;
}
```

### Built-in adapters

| Package | Capabilities | v |
|---|---|---|
| `@flowpanel/adapter-prisma` | all | v0.2 |
| `@flowpanel/adapter-drizzle` | all | v0.2 |
| `@flowpanel/adapter-clickhouse` | read | v0.5 |
| `@flowpanel/adapter-stripe` | read | v0.5 |
| `@flowpanel/adapter-pg` | read + write | v0.5 |

### Usage

| Location | Syntax |
|---|---|
| Resource CRUD | `fp.resource(prisma.user)` — uses primary adapter |
| Resource on specific adapter | `fp.resource(prisma.user, { adapter: "archive" })` |
| Widget | `w.metric({ adapter: "analytics", query: (ch) => ... })` |
| Handler | `ctx.adapters.analytics.client.query(...)` |

`flowpanel doctor` pings `health()` on all adapters. Unhealthy → grayed-out widgets with error state.

---

## 23. Recipes

```ts
// Add a resource
post: fp.resource(prisma.post)

// Pick columns (shorthand)
columns: [(p) => p.email, (p) => p.name, (p) => p.createdAt]

// Computed column
c.computed("mrr", { compute: (r) => r.price / 12, format: "money" })

// Row action
cancel: a.mutation({
  confirm: "Cancel?",
  handler: async (row, ctx) => {
    await ctx.stripe.subscriptions.cancel(row.stripeId);
    await ctx.db.subscription.update({ where: { id: row.id }, data: { status: "canceled" } });
  },
})

// Per-record dashboard tab
{ id: "analytics", label: "Analytics",
  widgets: (w, row) => [w.aiCost({ partitionKey: row.id, period: "24h" })] }

// Pipeline runs on user detail
detail: (s) => [s.pipelineRuns({ partitionKey: (row) => row.id, limit: 50 })]

// BullMQ queue
notifications: fp.queue(notificationQueue, { realtime: true })

// Custom cell
c.custom({ id: "status", render: StatusChip })

// ClickHouse widget
w.chart({ adapter: "analytics", query: (ch) => ch.query(`SELECT ...`), type: "area" })

// RBAC
access: { read: ["admin", "support"], delete: false, cancel: ["admin", "billing-ops"] }

// Multi-tenant
rowLevel: ({ session }) => ({ orgId: session.orgId })

// Form with Zod schema
form: { create: { schema: createUserSchema }, edit: "auto" }

// Deep path (depth 4)
c.field((p) => p.user.subscription.plan.name, { label: "Plan" })

// Stripe preset
resources: (fp) => ({ ...stripePreset({ stripe })(fp), user: fp.resource(prisma.user) })
```

---

## 24. What FlowPanel generates (you don't write)

- All tRPC procedures: `list`, `get`, `create`, `update`, `delete`, `action.*` per resource
- All queue procedures: `list`, `get`, `retry`, `remove`, `pause`, `resume`, `drain`
- Serializable schema with client-references (no functions cross the boundary)
- SSE broker wiring for realtime
- Audit log writes on every mutation
- Access enforcement at router level
- Default list/detail/form UI with loading/error/empty states
- URL state: filters + sort + cursor (round-trippable)
- Keyboard shortcuts: ⌘K palette, tab nav, Esc close
- Dark/light theme, accent color, custom CSS
- `server-only` enforcement via CLI

---

## 25. Migration from current `users` section

**Old:**
```ts
users: { source: "User", primaryKey: "id", columns: [{ field: "email" }] }
```

**New:**
```ts
resources: (fp) => ({
  user: fp.resource(prisma.user, {
    columns: [(p) => p.email],
  }),
})
```

v1 keeps old `users` working (deprecation warning). Automated via `flowpanel migrate:users-to-resource`.

---

## 26. Open risks

1. **Path Proxy runtime cost** — evaluates once at config-build time, <1ms for 50 resources.
2. **Prisma `GetPayload` naming** — `Prisma.${Capitalize<M>}GetPayload` stable since v3; vendor type-tests.
3. **Realtime via Prisma Client Extensions** — Prisma 6+ required. Prisma 5 fallback via `$use`.
4. **Drizzle return-type extraction** — `Awaited<ReturnType<typeof db.query.x.findFirst>>`. Vendor type-test.
5. **Auto-include inference** — can't analyze handler function bodies. Handlers needing extra relations use manual `include` override or `ctx.db` directly.

---

## 27. Rollout

1. **v0.2** — Resources MVP: list/CRUD, columns (shorthand + builder), filters, search, pagination, mutation actions, detail drawer, auto form.
2. **v0.3** — Resources polish: computed columns, function-form paths, all action types, filter presets, URL state, realtime, access control.
3. **v0.4** — Queues: BullMQ adapter, `fp.queue`, `s.queueJobs`, queue metrics.
4. **v0.5** — Dashboard widgets, per-record dashboards (tabs + widgets), native `s.pipelineRuns` / `w.aiCost`, multi-adapter (`adapters`), nav groups, presets (better-auth, feature-flags), `scaffold` CLI.
5. **v1.0** — Stability, docs site, migration from `users` section, `@flowpanel/preset-stripe`.

---

## 28. Out of scope (v1)

- Visual builder
- File upload widget (escape: `f.custom`)
- Rich-text editor widget (escape: `f.custom`)
- Inline table editing
- Saved views (persisted column order/visibility)
- Admin user management UI
- i18n beyond existing locale
- Mobile admin app
- Inngest / trigger.dev queue adapters (interface designed)
- BullMQ repeat/cron job editing (view-only in v1)
