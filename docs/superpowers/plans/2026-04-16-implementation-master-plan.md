# FlowPanel — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform FlowPanel from a pipeline-only dashboard into a full config-driven admin for Next.js SaaS — with CRUD resources, queues, dashboards, and beautiful shadcn-based UI. Two phases: Phase 1 = shippable beta, Phase 2 = v1.0.

**Spec:** [`docs/superpowers/specs/2026-04-16-flowpanel-resources-queues-design.md`](../specs/2026-04-16-flowpanel-resources-queues-design.md)

---

## Architecture

### Principles

1. **`core` is pure TypeScript.** No React, no CSS, no DOM. Testable with `vitest` alone.
2. **Adapters are isolated.** Each ORM adapter is a separate package. Adding a new ORM = new package, zero changes to core.
3. **UI uses shadcn/ui.** Vendor shadcn primitives into `react/ui/`. Resource components compose them. Zero custom design system — shadcn IS the design system.
4. **One adapter interface for both ORMs.** `ResourceAdapter` abstracts Prisma and Drizzle. Core never imports Prisma or Drizzle directly.
5. **Normalized filter IR.** Filters are `{ field, op, value }` internally. Each adapter translates to its native where-clause.

### File structure (target state)

```
packages/
├── core/src/
│   ├── index.ts                         ← Public exports
│   ├── defineFlowPanel.ts               ← defineFlowPanel() entry point
│   │
│   ├── resource/                        ← Resource system (NEW)
│   │   ├── types.ts                     ← ResourceAdapter, ModelMetadata, ResolvedResource, etc.
│   │   ├── path.ts                      ← Path Proxy: (p) => p.user.email
│   │   ├── builders.ts                  ← column/filter/action builders (all in one — they're small)
│   │   ├── resolver.ts                  ← Descriptor → ResolvedResource (merge defaults, infer include)
│   │   ├── filters.ts                   ← Normalized filter IR: { field, op, value } → adapter where
│   │   ├── serializer.ts               ← ResolvedResource → SerializedResource (client-safe)
│   │   └── __tests__/
│   │
│   ├── trpc/
│   │   ├── router.ts                    ← MODIFY: mount resource + queue procedures
│   │   ├── context.ts                   ← MODIFY: add resources to context
│   │   └── procedures/
│   │       ├── resources.ts             ← NEW: CRUD via ResourceAdapter
│   │       ├── queues.ts                ← NEW (Phase 2): queue inspection
│   │       ├── runs.ts                  ← existing
│   │       ├── metrics.ts               ← existing
│   │       ├── drawers.ts              ← existing
│   │       ├── stages.ts               ← existing
│   │       ├── users.ts                ← existing (deprecated in favor of resources)
│   │       └── stream.ts               ← existing
│   │
│   ├── pipeline/                        ← MOVE existing pipeline code here
│   │   ├── withRun.ts
│   │   ├── queryBuilder.ts
│   │   ├── reaper.ts
│   │   ├── schemaGenerator.ts
│   │   └── migrationRunner.ts
│   │
│   ├── config/
│   │   ├── schema.ts                    ← MODIFY: add resource/queue config to Zod schema
│   │   ├── validate.ts
│   │   └── accessors.ts
│   │
│   ├── sse/
│   │   └── broker.ts                    ← existing
│   │
│   └── types/
│       ├── db.ts                        ← existing SqlExecutor (for pipeline)
│       └── config.ts                    ← existing
│
├── adapter-prisma/src/
│   ├── index.ts                         ← prismaAdapter() — auto-detects PrismaClient
│   ├── resource.ts                      ← NEW: ResourceAdapter via prisma[model].findMany()
│   ├── metadata.ts                      ← NEW: Prisma.dmmf → ModelMetadata
│   ├── filters.ts                       ← NEW: filter IR → Prisma where
│   ├── sql.ts                           ← existing SqlExecutor (for pipeline)
│   └── __tests__/
│
├── adapter-drizzle/src/
│   ├── index.ts                         ← drizzleAdapter() — auto-detects Drizzle db
│   ├── resource.ts                      ← NEW: ResourceAdapter via db.query[model].findMany()
│   ├── metadata.ts                      ← NEW: getTableColumns() → ModelMetadata
│   ├── filters.ts                       ← NEW: filter IR → Drizzle where
│   ├── sql.ts                           ← existing SqlExecutor (for pipeline)
│   └── __tests__/
│
├── react/src/
│   ├── index.ts                         ← Public exports
│   │
│   ├── ui/                              ← Vendored shadcn primitives (INTERNAL, not exported)
│   │   ├── button.tsx
│   │   ├── badge.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── skeleton.tsx
│   │   ├── toast.tsx (sonner)
│   │   ├── command.tsx (cmdk)
│   │   ├── popover.tsx
│   │   ├── calendar.tsx
│   │   ├── switch.tsx
│   │   ├── textarea.tsx
│   │   ├── separator.tsx
│   │   ├── scroll-area.tsx
│   │   ├── sheet.tsx                    ← drawer/sidebar
│   │   ├── tabs.tsx
│   │   └── tooltip.tsx
│   │
│   ├── resource/                        ← Resource UI (NEW)
│   │   ├── ResourcePage.tsx             ← Full page: toolbar + table + pagination
│   │   ├── ResourceTable.tsx            ← shadcn Table + sort + row click
│   │   ├── ResourceDrawer.tsx           ← Sheet with detail/form/actions
│   │   ├── ResourceForm.tsx             ← Auto-generated form from ModelMetadata
│   │   ├── ResourceToolbar.tsx          ← Search + filters + create button
│   │   ├── ResourcePagination.tsx       ← Page N of M
│   │   ├── ResourceEmptyState.tsx       ← "No X yet" with CTA
│   │   ├── cells/                       ← Cell renderers (one per format)
│   │   │   ├── index.ts                 ← CellRenderer dispatcher
│   │   │   ├── TextCell.tsx
│   │   │   ├── BadgeCell.tsx            ← enum values
│   │   │   ├── MoneyCell.tsx
│   │   │   ├── DateCell.tsx
│   │   │   ├── BooleanCell.tsx
│   │   │   ├── ImageCell.tsx
│   │   │   └── JsonCell.tsx
│   │   ├── filters/                     ← Filter widgets (one per type)
│   │   │   ├── index.ts                 ← FilterWidget dispatcher
│   │   │   ├── EnumFilter.tsx           ← shadcn Select multi
│   │   │   ├── DateRangeFilter.tsx      ← shadcn Calendar + Popover
│   │   │   ├── TextFilter.tsx           ← shadcn Input
│   │   │   ├── BooleanFilter.tsx        ← shadcn Select (yes/no/any)
│   │   │   └── NumberFilter.tsx         ← shadcn Input range
│   │   └── fields/                      ← Form field widgets (one per type)
│   │       ├── index.ts                 ← FieldWidget dispatcher
│   │       ├── TextField.tsx
│   │       ├── TextareaField.tsx
│   │       ├── SelectField.tsx          ← enum + relation
│   │       ├── DateField.tsx
│   │       ├── SwitchField.tsx
│   │       ├── NumberField.tsx
│   │       └── JsonField.tsx
│   │
│   ├── layout/                          ← Shared layout (REFACTOR from existing)
│   │   ├── FlowPanelUI.tsx              ← Main shell: sidebar + header + content
│   │   ├── Sidebar.tsx                  ← Nav with groups + icons
│   │   ├── Header.tsx                   ← App name + time range + live status
│   │   └── CommandPalette.tsx           ← ⌘K (existing, extended)
│   │
│   ├── pipeline/                        ← MOVE existing pipeline components here
│   │   ├── PipelinePage.tsx             ← Current pipeline view (metrics + stages + runs)
│   │   ├── MetricCard.tsx
│   │   ├── StageCard.tsx
│   │   ├── RunTable.tsx
│   │   ├── RunChart.tsx
│   │   ├── Drawer.tsx
│   │   └── ...
│   │
│   ├── dashboard/                       ← Dashboard (Phase 2)
│   │   ├── DashboardPage.tsx
│   │   └── widgets/
│   │       ├── MetricWidget.tsx
│   │       ├── ChartWidget.tsx
│   │       ├── ListWidget.tsx
│   │       ├── QueueWidget.tsx
│   │       ├── PipelineRunsWidget.tsx
│   │       ├── AiCostWidget.tsx
│   │       └── CustomWidget.tsx
│   │
│   ├── queue/                           ← Queue UI (Phase 2)
│   │   ├── QueuePage.tsx
│   │   ├── QueueTable.tsx
│   │   ├── JobDetail.tsx
│   │   └── QueueMetrics.tsx
│   │
│   ├── hooks/
│   │   ├── useResourceData.ts           ← NEW
│   │   ├── useFlowPanelData.ts          ← existing
│   │   ├── useFlowPanelLive.ts          ← existing
│   │   ├── useKeyboard.ts              ← existing
│   │   └── useUrlState.ts              ← NEW: filters/sort ↔ URL
│   │
│   └── lib/
│       ├── cn.ts                        ← tailwind-merge + clsx
│       ├── format.ts                    ← formatDate, formatMoney, formatDuration
│       └── utils.ts
│
├── cli/src/
│   ├── index.ts
│   └── commands/
│       ├── init.ts                      ← MODIFY: detect models, generate new config format
│       ├── scaffold.ts                  ← NEW (Phase 2)
│       └── ...existing
│
└── e2e/                                 ← Playwright tests
```

### Key patterns

**Resource components compose shadcn — never reinvent:**

```tsx
// ResourceTable.tsx — example of how thin our components are
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/table";
import { Skeleton } from "@/ui/skeleton";
import { CellRenderer } from "./cells";

export function ResourceTable({ columns, data, loading, onRowClick, sort, onSort }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.id} onClick={() => onSort?.(col)} className="cursor-pointer">
              {col.label} {sort?.field === col.id && (sort.dir === "asc" ? "↑" : "↓")}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((col) => <TableCell key={col.id}><Skeleton className="h-4 w-24" /></TableCell>)}
              </TableRow>
            ))
          : data.map((row) => (
              <TableRow key={row.id} onClick={() => onRowClick?.(row)} className="cursor-pointer">
                {columns.map((col) => (
                  <TableCell key={col.id}>
                    <CellRenderer column={col} value={getNestedValue(row, col.path)} row={row} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
```

**CellRenderer is a dispatcher, not a God component:**

```tsx
// cells/index.ts
export function CellRenderer({ column, value, row }) {
  switch (column.format) {
    case "enum":    return <BadgeCell value={value} />;
    case "money":   return <MoneyCell value={value} />;
    case "relative": return <DateCell value={value} format="relative" />;
    case "boolean": return <BooleanCell value={value} />;
    case "image":   return <ImageCell value={value} />;
    case "json":    return <JsonCell value={value} />;
    default:        return <TextCell value={value} mono={column.opts.mono} />;
  }
}
```

**ResourceAdapter — the contract between core and adapters:**

```ts
// core/resource/types.ts
interface ResourceAdapter {
  findMany(model: string, args: FindManyArgs): Promise<{ data: Row[]; total: number }>;
  findUnique(model: string, args: { where: Record<string, unknown> }): Promise<Row | null>;
  create(model: string, args: { data: Record<string, unknown> }): Promise<Row>;
  update(model: string, args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<Row>;
  delete(model: string, args: { where: Record<string, unknown> }): Promise<Row>;
  getModelMetadata(model: string): ModelMetadata;
  getEnumValues(enumName: string): string[];
  getModelNames(): string[];
}

interface FindManyArgs {
  where?: NormalizedFilter[];
  orderBy?: { field: string; dir: "asc" | "desc" };
  skip?: number;
  take?: number;
  include?: Record<string, unknown>;
}

interface NormalizedFilter {
  field: string;
  op: "eq" | "neq" | "contains" | "in" | "gte" | "lte" | "gt" | "lt";
  value: unknown;
}

interface ModelMetadata {
  name: string;
  fields: FieldMetadata[];
  primaryKey: string;
}

interface FieldMetadata {
  name: string;
  type: "string" | "int" | "float" | "boolean" | "datetime" | "json" | "enum" | "relation";
  kind: "scalar" | "relation" | "enum";
  isRequired: boolean;
  isList: boolean;
  isId: boolean;
  isAutoGenerated: boolean;    // id, createdAt, updatedAt
  enumValues?: string[];       // for enums
  relationModel?: string;      // for relations — target model name
  default?: unknown;
}
```

### Adapter auto-detection

```ts
// defineFlowPanel.ts
function detectAdapter(input: unknown): { sql: SqlExecutor; resource: ResourceAdapter } {
  // Prisma: has $queryRawUnsafe + $extends + Prisma.dmmf
  if (isPrismaClient(input)) {
    const { sqlExecutor, resourceAdapter } = createPrismaAdapters(input);
    return { sql: sqlExecutor, resource: resourceAdapter };
  }
  // Drizzle: has select + insert + $inferSelect on tables
  if (isDrizzleDb(input)) {
    const { sqlExecutor, resourceAdapter } = createDrizzleAdapters(input);
    return { sql: sqlExecutor, resource: resourceAdapter };
  }
  // Explicit adapter object
  if (isAdapterObject(input)) return input;
  throw new Error("Unrecognized adapter. Pass a PrismaClient, Drizzle db, or explicit adapter.");
}
```

---

## Phase 1: Shippable Beta

**Milestone:** developer installs FlowPanel, runs `flowpanel init`, opens `/admin` — sees beautiful shadcn-based admin with their Prisma/Drizzle models. CRUD works. Filters work. Forms auto-generate. Actions fire.

### Phase 1 tasks

#### 1.1 Scaffold: shadcn primitives + Tailwind config

Vendor shadcn/ui components into `packages/react/src/ui/`. These are internal building blocks — not exported to consumers.

**Files to vendor (from shadcn/ui, MIT license):**
button, badge, input, select, table, dialog, dropdown-menu, skeleton, popover, calendar, switch, textarea, separator, scroll-area, sheet, tabs, tooltip, command (cmdk), toast (sonner)

**Add dependencies to `packages/react/package.json`:**
- `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-popover`, etc.
- `tailwind-merge`, `clsx`, `class-variance-authority`
- `cmdk`, `sonner`, `lucide-react`, `date-fns`

**Create `packages/react/tailwind.config.ts`** — internal config for building the package.

**Create `@flowpanel/tailwind`** preset (or inline into docs) — consumer adds to their Tailwind config:
```ts
// consumer's tailwind.config.ts
import flowpanelPreset from "@flowpanel/react/tailwind";
export default { presets: [flowpanelPreset], content: [..., "./node_modules/@flowpanel/react/**/*.{js,ts,jsx,tsx}"] };
```

#### 1.2 Core: Path Proxy

`packages/core/src/resource/path.ts` — Proxy-based path builder. ~40 lines. Full test suite.

#### 1.3 Core: Resource types

`packages/core/src/resource/types.ts` — ResourceAdapter, ModelMetadata, FieldMetadata, NormalizedFilter, ResolvedResource, SerializedResource, all builder types.

#### 1.4 Core: Builders

`packages/core/src/resource/builders.ts` — column (field/computed/custom), filter (filter/custom), action (mutation) builders + shorthand resolvers. One file — they share types and are each ~30 lines.

#### 1.5 Core: Filter IR

`packages/core/src/resource/filters.ts` — NormalizedFilter type + utilities to merge/validate filters.

#### 1.6 Core: Resolver

`packages/core/src/resource/resolver.ts` — Takes resource descriptor + ModelMetadata → produces ResolvedResource. Handles: auto-include from paths, auto-columns from metadata (when user provides none), auto-search (string fields), defaults, validation (reserved action IDs).

#### 1.7 Core: Serializer

`packages/core/src/resource/serializer.ts` — ResolvedResource → SerializedResource. Strips functions, evaluates access rules against session roles.

#### 1.8 Prisma adapter v2

Extend `packages/adapter-prisma/src/`:
- `resource.ts` — ResourceAdapter via `prisma[model].findMany/create/update/delete`
- `metadata.ts` — `Prisma.dmmf.datamodel.models` → ModelMetadata
- `filters.ts` — NormalizedFilter → Prisma where clause

Existing `SqlExecutor` (for pipeline) stays unchanged.

Auto-detection: `prismaAdapter({ prisma })` returns `{ sql: SqlExecutor, resource: ResourceAdapter }`. Shorthand: passing `prisma` directly to `adapter:` auto-wraps.

#### 1.9 Drizzle adapter v2

Same structure in `packages/adapter-drizzle/src/`:
- `resource.ts` — ResourceAdapter via `db.query[model].findMany()`
- `metadata.ts` — `getTableColumns()` + relations → ModelMetadata
- `filters.ts` — NormalizedFilter → Drizzle where conditions

#### 1.10 Core: defineFlowPanel v2

Refactor `packages/core/src/defineFlowPanel.ts`:
- Accept `adapter: prisma` (auto-detect) or `adapter: prismaAdapter({ prisma })`
- Accept `resources: { user: resource(prisma.user) }` (object form)
- Accept `resources: (fp) => ({ user: fp.resource(prisma.user) })` (builder form)
- Process resources through resolver using adapter's ModelMetadata
- Expose `flowpanel.schema`, `flowpanel.router`, `flowpanel.resources`
- Inject `ctx.db` shortcut into handler context
- Backward compatible: existing pipeline config still works

#### 1.11 Core: Resource tRPC procedures

`packages/core/src/trpc/procedures/resources.ts`:
- `list` — via ResourceAdapter.findMany + filter translation + sort + offset pagination
- `get` — via ResourceAdapter.findUnique
- `create` — via ResourceAdapter.create
- `update` — via ResourceAdapter.update
- `delete` — via ResourceAdapter.delete
- `action` — fetch row → check `when` → execute handler
- All respect `access` rules

Mount in router alongside existing procedures.

#### 1.12 React: Cell renderers

`packages/react/src/resource/cells/` — one component per format:
- TextCell (default), BadgeCell (enum), MoneyCell, DateCell (relative/absolute), BooleanCell (icon), ImageCell (avatar), JsonCell (collapsible)
- CellRenderer dispatcher: auto-detect from SerializedResource column format

All compose shadcn primitives (Badge, Tooltip, etc.).

#### 1.13 React: Filter widgets

`packages/react/src/resource/filters/` — one component per type:
- EnumFilter (shadcn Select multi), DateRangeFilter (Calendar + Popover), TextFilter (Input), BooleanFilter (Select yes/no/any), NumberFilter (Input)
- FilterWidget dispatcher: auto-detect from SerializedResource filter mode

#### 1.14 React: Form field widgets

`packages/react/src/resource/fields/` — one component per type:
- TextField (Input), TextareaField, SelectField (for enums + relations), DateField (Calendar), SwitchField (Switch), NumberField, JsonField (Textarea + JSON validation)
- FieldWidget dispatcher: auto-detect from ModelMetadata field type

#### 1.15 React: ResourcePage + sub-components

- `ResourcePage.tsx` — full page composition: toolbar + table + pagination + drawer
- `ResourceTable.tsx` — shadcn Table with sort + row click + loading skeletons
- `ResourceToolbar.tsx` — search input + filter bar + "New" button
- `ResourceDrawer.tsx` — shadcn Sheet with detail view or form
- `ResourceForm.tsx` — auto-generated from ModelMetadata + field widgets
- `ResourcePagination.tsx` — shadcn-style page controls
- `ResourceEmptyState.tsx` — icon + text + CTA button

#### 1.16 React: useResourceData + useUrlState hooks

- `useResourceData` — fetches list via tRPC, manages sort/search/filter/pagination state
- `useUrlState` — syncs filter/sort state to URL query params (shareable links)

#### 1.17 React: Layout refactor

Refactor `FlowPanelUI.tsx`:
- Extract Sidebar (nav items from resources + pipeline + queues)
- Resource tabs render ResourcePage
- Pipeline tab renders existing pipeline view (unchanged)
- Command palette extended with resource navigation

#### 1.18 CLI: flowpanel init v2

Update `packages/cli/src/commands/init.ts`:
- Detect Prisma models via `Prisma.dmmf` (or parse schema.prisma)
- Detect Drizzle schema files
- Prompt: "Which models to include in admin?" (checkboxes)
- Generate `flowpanel.ts` with `resource()` calls for selected models
- Generate `app/admin/page.tsx` with new FlowPanelUI
- Add Tailwind preset to consumer's config

#### 1.19 Tests + build

- Unit tests for all core modules (path, builders, resolver, serializer, filter IR)
- Unit tests for adapter metadata + filter translation (Prisma + Drizzle)
- Integration test: defineFlowPanel → resolve resources → serialize → verify
- Build all packages, typecheck
- Manual smoke test: create a test Next.js app, add FlowPanel, verify CRUD works

---

## Phase 2: v1.0

**Milestone:** full SaaS admin with queues, dashboard, per-record analytics, presets, docs.

### Phase 2 tasks

#### 2.1 Queue system

- Core: QueueAdapter interface + BullMQ implementation
- Core: `fp.queue(client)` descriptor + resolver
- Core: queue tRPC procedures (list, get, retry, remove, pause, resume, drain)
- React: QueuePage, QueueTable, JobDetail, QueueMetrics

#### 2.2 Widget system

- Core: widget builder (`w.*`): metric, chart, list, queue, pipelineRuns, aiCost, custom
- Core: widget resolver + serializer
- React: DashboardPage + widget components (MetricWidget, ChartWidget, ListWidget, etc.)

#### 2.3 Per-record dashboards

- Core: detail tabs with `widgets: (w, row) => [...]`
- React: render widgets inside resource detail drawer/page tabs

#### 2.4 Native sections

- `s.pipelineRuns`, `s.aiCost`, `s.queueJobs` — render inside resource detail
- Core: section resolver, React: section components

#### 2.5 Nav groups + sidebar polish

- Core: `nav` config with groups, icons, collapse
- React: Sidebar with collapsible groups

#### 2.6 Multi-adapter

- Core: `adapters: { primary, analytics }` map with capabilities
- Core: `adapter: "analytics"` on resources and widgets
- Adapter: `@flowpanel/adapter-clickhouse` (read-only)

#### 2.7 Realtime

- Core: Prisma Client Extension emits events on mutation
- Core: SSE broker broadcasts resource events
- React: useResourceLive hook — "New: 3" banner on tables

#### 2.8 All action types

- Core: `a.bulk`, `a.collection`, `a.link`, `a.dialog` builders
- React: bulk selection toolbar, dialog form, link navigation

#### 2.9 Access: field-level

- Core: `access.fields: [{ path, read, write }]`
- Core: server enforcement in tRPC procedures
- React: hide/show columns and form fields per session roles

#### 2.10 Presets

- `@flowpanel/preset-better-auth` — Users, Sessions resources
- `@flowpanel/preset-feature-flags` — FeatureFlag resource + toggle UI
- `@flowpanel/preset-stripe` — Customers, Subscriptions, Invoices, MRR widget

#### 2.11 CLI additions

- `flowpanel scaffold <model>` — generate resource config stub
- `flowpanel doctor` v2 — check adapters, resources, roles, audit
- `flowpanel resources:list`, `flowpanel queues:list`

#### 2.12 Migrate existing pipeline UI to shadcn

- Replace inline styles in MetricCard, StageCard, RunTable, Drawer, etc. with shadcn primitives
- Consistent look between pipeline and resource views

#### 2.13 Documentation

- Getting Started guide (install → init → first resource)
- API Reference (defineFlowPanel, resource, builders, adapters)
- Recipes (common patterns)
- Demo app (Next.js + Prisma + FlowPanel)

#### 2.14 Production polish

- Error boundaries on all resource/queue/dashboard views
- Confirm dialog with typeToConfirm for destructive actions
- Toast notifications (sonner) for all mutations
- Responsive: sidebar collapse, table scroll, drawer full-screen on mobile
- Keyboard shortcuts: ⌘K extended, Escape close, tab nav
- Loading: skeleton shimmer on all data-dependent views
- Empty states with icons + CTAs
- Dark mode: all components respect data-theme attribute

---

## Quality standards

### Code

- **TypeScript strict mode.** No `any` outside of tRPC casts (documented as `// biome-ignore`).
- **Biome** for linting and formatting (already configured).
- **No barrel files** except `index.ts` at package roots. Direct imports inside packages.
- **Small files.** One component per file. One concern per module. If a file > 200 lines, split.
- **Name things clearly.** `ResourceAdapter`, not `Adapter`. `NormalizedFilter`, not `Filter`. `ModelMetadata`, not `Meta`.

### Testing

- **Unit tests** for every core module (path, builders, resolver, serializer, filter IR, adapter metadata).
- **Integration tests** for tRPC procedures against a real database (existing docker-compose setup).
- **Type tests** — `.test-d.ts` files that verify TS inference works (autocomplete correctness).
- **E2E tests** (Playwright) for critical flows: list → detail → edit → save → verify.

### Git

- **Conventional commits:** `feat(core): add path proxy`, `fix(react): cell null handling`.
- **One feature per commit.** Buildable at every commit.
- **No generated files in git.** No `dist/`, no vendored `node_modules`.

### Dependencies

- **Minimize.** shadcn vendors Radix — we don't add alternative UI libraries.
- **Pin versions** in adapters (Prisma, Drizzle) — test against specific versions.
- **Peer dependencies** for React, tRPC — consumer brings their own.

---

## What consumers need

For FlowPanel beta (Phase 1) to work, consumer project must have:

1. **Next.js 14+** with App Router
2. **Prisma 5+** or **Drizzle 0.30+** (one of)
3. **tRPC v11** with React Query
4. **Tailwind CSS 3.4+** — and add FlowPanel preset to their config
5. **PostgreSQL** (SQLite support later)

`flowpanel init` checks all of these and guides the user if something is missing.

---

## Decision log

| Decision | Chosen | Why |
|---|---|---|
| CSS approach | shadcn/ui vendored + Tailwind | User preference + 2026 standard + minimal custom CSS |
| Adapter abstraction | ResourceAdapter interface from day 1 | Both ORMs work from Phase 1 without refactoring |
| Filter IR | Normalized `{ field, op, value }` | ORM-agnostic, testable, translator per adapter |
| `adapter: prisma` shorthand | Duck-type detection | Zero ceremony for 90% case |
| `resources: {}` object form | Supported alongside `(fp) => {}` | Simpler for non-preset cases |
| Phase split | 2 phases (beta + v1.0) | shadcn reduces UI work, 3 phases → 2 |
| Pipeline UI migration | Phase 2 | Don't block beta on migrating existing code |
| Drizzle | Phase 1 (adapter), full test in Phase 2 | Interface ready from start, Drizzle adapter is small |
