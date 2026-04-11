# FlowPanel UI: Architecture Refactor + shadcn Migration

## Problem

Custom UI components in `@flowpanel/react` (26 components, ~3000 LOC) are a maintenance
burden. FlowPanelUI.tsx is a 700-line monolith with inline styles, manual fetch() calls,
unused tRPC deps (+8kB dead code), and disconnected drawer sections. Low test coverage,
no animations, no loading choreography, static feel.

## Goal

Transform `@flowpanel/react` into a top-tier admin panel that developers love.
Five pillars:

1. **Clean architecture** — self-contained components, each fetches its own data
2. **Top UX/UI** — shadcn design language, polished animations, real-time feel
3. **Minimal bugs** — targeted tests that catch real breakage
4. **Easy customization** — config → CSS variables → slots (3 levels)
5. **Great DX** — zero-config defaults, interactive demo, 4-command CLI

## Constraints

- Bundle limit: **35kB** gzipped (current: ~30kB with dead tRPC deps)
- Embeddable widget — must not conflict with host app styles
- No chart library — keep custom SVG for RunChart and sparklines
- Target: React 18+
- Brand colors: cyan `#38BDF8` accent, navy `#0F172A` dark background

---

## 1. Architecture Refactor

### Problem

`FlowPanelUI.tsx` is a 700-line monolith:
- 5 useState, 1 useReducer, 3 useCallback, 2 useEffect
- Manual `fetchJson()` calls to tRPC endpoints via URL concatenation
- `@trpc/react-query` and `@tanstack/react-query` in deps but unused (+8kB)
- All data fetching, SSE handling, keyboard shortcuts in one component
- Drawer sections exist as components but aren't connected to data

### Solution: self-contained components

Each component fetches its own data via tRPC hooks. No god-hooks, no prop drilling.

#### tRPC client setup

```tsx
// hooks/trpc.ts — internal tRPC client, not exposed to consumers
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@flowpanel/core/trpc";

export const trpc = createTRPCReact<AppRouter>();
```

#### FlowPanelProvider

```tsx
// FlowPanelProvider.tsx — creates tRPC client + QueryClient + context
function FlowPanelProvider({ config, trpcBaseUrl, children }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: trpcBaseUrl })],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <FlowPanelContext.Provider value={{ config, container: containerRef.current }}>
          <div className={cn("flowpanel", config.theme?.colorScheme === "dark" && "fp-dark")} ref={containerRef}>
            {children}
          </div>
        </FlowPanelContext.Provider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

#### Self-contained components

```tsx
// Each component fetches its own data
function MetricsStrip({ timeRange }) {
  const { data, isLoading } = trpc.flowpanel.metrics.current.useQuery({ timeRange });
  if (isLoading) return <MetricsStripSkeleton />;
  return /* render metrics */;
}

function StageCards({ timeRange, selectedStage, onStageSelect }) {
  const { data, isLoading } = trpc.flowpanel.stages.breakdown.useQuery({ timeRange });
  if (isLoading) return <StageCardsSkeleton />;
  return /* render stages */;
}

function RunLogSection({ timeRange, selectedStage }) {
  const { data, fetchNextPage, hasNextPage, isLoading } =
    trpc.flowpanel.runs.list.useInfiniteQuery(
      { timeRange, stage: selectedStage, limit: 50 },
      { getNextPageParam: (last) => last.nextCursor }
    );
  return /* RunTable with infinite scroll */;
}
```

React Query deduplicates requests if two components query the same data.

#### SSE → React Query cache invalidation

```tsx
// hooks/useFlowPanelSSE.ts
function useFlowPanelSSE(trpcBaseUrl: string) {
  const queryClient = useQueryClient();

  useFlowPanelStream({
    url: `${trpcBaseUrl}/flowpanel.stream.connect`,
    onEvent: (event) => {
      if (event.event === "run.created" || event.event === "run.finished" || event.event === "run.failed") {
        queryClient.invalidateQueries({ queryKey: ["flowpanel", "runs"] });
        queryClient.invalidateQueries({ queryKey: ["flowpanel", "stages"] });
      }
      if (event.event === "metrics.updated") {
        queryClient.invalidateQueries({ queryKey: ["flowpanel", "metrics"] });
      }
    },
  });
}
```

No more `runsReducer`. No more `bufferedNewRuns`. SSE events invalidate cache,
React Query refetches. Components re-render with fresh data automatically.

#### Resulting FlowPanelUI (~50 LOC)

```tsx
function FlowPanelUI({ config, trpcBaseUrl, showDemoBanner }: FlowPanelUIProps) {
  return (
    <FlowPanelProvider config={config} trpcBaseUrl={trpcBaseUrl}>
      <Header />
      {showDemoBanner && <DemoBanner />}
      <Tabs />
      <main>
        <PipelineView />
      </main>
      <DrawerFromURL />
      <CommandPalette />
      <StatusOverlays />
    </FlowPanelProvider>
  );
}
```

Orchestrator only. No state management, no data fetching.

#### Component tree

```
FlowPanelUI (~50 LOC, orchestrator)
├── FlowPanelProvider — tRPC client + QueryClient + portal ref + config
├── Header — app name, time range, live indicator
├── Tabs
└── PipelineView
    ├── MetricsStrip — fetches metrics
    ├── StageCards — fetches stages
    ├── ActivitySection — fetches chart + topErrors
    └── RunLogSection — fetches runs (infinite query)

DrawerFromURL — reads ?run= from URL, renders drawer
├── DrawerHeader
└── DrawerBody — sections from config, each fetches own data

CommandPalette — commands from config + builtins
StatusOverlays — reconnecting banner, ARIA live region
```

---

## 2. Style Isolation

### Tailwind prefix

All Tailwind classes inside FlowPanel use `fp:` prefix:

```tsx
// standard shadcn
<button className="bg-primary text-primary-foreground">

// FlowPanel
<button className="fp:bg-primary fp:text-primary-foreground">
```

### Scoped CSS variables

shadcn color tokens scoped under `.flowpanel` container, not `:root`:

```css
.flowpanel {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 199 89% 48%;           /* brand cyan #38BDF8 */
  --primary-foreground: 210 40% 8%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --border: 240 5.9% 90%;
  --radius: 0.5rem;
  /* ...full shadcn token set */
}

.flowpanel.fp-dark {
  --background: 217 33% 6%;          /* brand navy #0F172A */
  --foreground: 0 0% 98%;
  --primary: 199 89% 48%;
  --card: 217 33% 10%;
  --card-foreground: 0 0% 98%;
  --muted: 217 33% 15%;
  --muted-foreground: 215 20% 55%;
  --border: 217 33% 17%;
  /* ...dark overrides */
}
```

Host app's CSS variables on `:root` are not affected.

### Tailwind config

```js
// packages/react/tailwind.config.js
module.exports = {
  prefix: "fp:",
  content: ["./src/**/*.tsx"],
  corePlugins: { preflight: false }, // no CSS reset — don't break host
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        // ...standard shadcn color mapping
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### Radix portal containment

Radix Dialog, Tooltip, Sheet render portals to `document.body` by default —
outside `.flowpanel`, so CSS variables don't reach them. Fix: bind all portals
to the `.flowpanel` container via `FlowPanelContext`:

```tsx
const { container } = useFlowPanelContext();

<Sheet portal={{ container }}>
<Tooltip portal={{ container }}>
<Dialog portal={{ container }}>
```

---

## 3. Customization (3 levels)

### Level 1: Config (zero CSS)

```ts
defineFlowPanel({
  theme: {
    accent: "#6366f1",
    radius: "8px",
    colorScheme: "dark",
    colors: {
      background: "240 10% 3.9%",
      primary: "220 90% 56%",
      card: "240 10% 5.9%",
    },
  },
})
```

`resolveTheme()` converts config values to CSS variables. Injected via a
`<style>` tag with low specificity (`.flowpanel` selector) so user CSS can
override without `!important`.

### Level 2: CSS variables (any project)

```css
.flowpanel {
  --primary: 220 90% 56%;
  --radius: 0.25rem;
}
.flowpanel.fp-dark {
  --background: 220 20% 6%;
}
```

Works with Tailwind, plain CSS, Sass — just CSS variables.

### Level 3: Slots (component replacement)

```ts
defineFlowPanel({
  slots: {
    MetricCard: MyCustomMetricCard,
    StageCard: MyCustomStageCard,
    RunRow: MyCustomRunRow,
    DrawerHeader: MyCustomDrawerHeader,
    DrawerSection: MyCustomDrawerSection,
    Header: MyCustomHeader,
    FilterBar: MyCustomFilterBar,
    TableEmptyState: MyCustomEmptyState,
  },
})
```

Each slot component receives typed props:

```ts
import type { MetricCardProps, RunRowProps } from "@flowpanel/react";
```

Internal resolution:

```tsx
const MetricCard = slots?.MetricCard ?? DefaultMetricCard;
return (
  <SlotErrorBoundary fallback={<DefaultMetricCard {...props} />}>
    <MetricCard {...props} />
  </SlotErrorBoundary>
);
```

Broken slots show fallback instead of crashing the panel.

### Cascade priority

```
shadcn defaults → defineFlowPanel config → user CSS overrides
```

Config generates a `<style>` tag (not inline styles) so user CSS can override.

---

## 4. Visual System & Motion

### Color palette (monitoring-first)

```css
.flowpanel {
  /* Status — first-class tokens */
  --status-ok: 142 71% 45%;
  --status-err: 0 84% 60%;
  --status-warn: 38 92% 50%;
  --status-running: 199 89% 48%;   /* brand cyan */
  --status-pending: 240 5% 65%;

  /* Surfaces — subtle depth without heavy shadows */
  --surface-raised: 0 0% 100%;     /* cards */
  --surface-overlay: 0 0% 100%;    /* sheet, dialog */
  --surface-sunken: 240 5% 96%;    /* table rows, code blocks */

  /* Data viz */
  --chart-positive: var(--status-ok);
  --chart-negative: var(--status-err);
  --chart-neutral: 240 5% 65%;
}

.flowpanel.fp-dark {
  /* Dark ≠ invert. Different contrasts, glow instead of shadow */
  --surface-raised: 217 33% 10%;
  --surface-overlay: 217 33% 12%;
  --surface-sunken: 217 33% 7%;
}
```

### Typography (data-optimized)

```css
.flowpanel {
  /* Tabular nums for metrics — digits don't jump on update */
  --font-feature-tabular: "tnum";

  /* Scale: compact for admin density */
  --text-xs: 11px;    /* table cells, secondary info */
  --text-sm: 13px;    /* body, labels */
  --text-base: 14px;  /* primary content */
  --text-lg: 16px;    /* section headers */
  --text-xl: 24px;    /* metric values */
}
```

### Motion system

```css
.flowpanel {
  --duration-instant: 80ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);    /* decelerate — open */
  --ease-in: cubic-bezier(0.55, 0, 1, 0.45);     /* accelerate — close */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

@media (prefers-reduced-motion: reduce) {
  .flowpanel,
  .flowpanel * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Component animations

| Element | Animation |
|---|---|
| Card hover | `translateY(-1px)` + shadow lift, `--duration-fast` |
| Skeleton → content | Fade crossfade, `--duration-normal` |
| Sheet open/close | Slide from right + backdrop fade, `--duration-slow` |
| Tab switch | Content fade, `--duration-fast` |
| Command palette | Scale from 0.95 + fade, `--duration-normal` |
| Toast | Slide up + fade in/out |
| New runs banner | Slide down, `--duration-normal` |
| Metric value change | Crossfade (old → new) + subtle scale pulse 1.02x |
| Stage card filter | Border color transition, `--duration-fast` |
| Row hover | Background tint, `--duration-instant` |
| SSE reconnecting banner | Slide down from top |

### Loading choreography

No global `loading` state. Each component fetches its own data via tRPC hooks,
shows its own skeleton, and reveals content when ready. Components naturally
appear staggered because queries have different response times:

```
MetricsStrip    — appears first  (~50ms, lightweight query)
StageCards      — appears second (~80ms)
ActivitySection — appears third  (~120ms)
RunLogSection   — appears last   (~200ms, heaviest query)
```

This is free from the architecture in Section 1 — no orchestration needed.

### Real-time micro-interactions

| SSE Event | Visual |
|---|---|
| New run | Row slides in from top with subtle highlight, fade out after 2s |
| Metric updated | Value crossfade (old → new), subtle scale pulse 1.02x |
| Run failed | Row flash red background → fade to normal |
| Live indicator | Breathing pulse animation (opacity 0.4 → 1.0, 2s cycle) |
| Filter applied | Table content crossfade, count badge updates |

### Empty states

| Section | Empty state |
|---|---|
| MetricsStrip | Cards with `—` values and muted label |
| StageCards | Not rendered |
| RunTable | Onboarding card with `withRun()` example |
| RunChart | Empty chart with dashed baseline and "No activity yet" |
| Top Errors | Not rendered |

---

## 5. Drawer System

### Architecture

Drawer is a Sheet + layout. Each section fetches its own data.

```tsx
function RunDetailDrawer({ runId, onClose }) {
  return (
    <Sheet open onClose={onClose}>
      <DrawerHeader runId={runId} />
      <DrawerBody runId={runId} />
    </Sheet>
  );
}

function DrawerBody({ runId }) {
  const config = useFlowPanelConfig();
  const sections = config.drawers?.runDetail?.sections ?? defaultSections;

  return sections.map((section) => (
    <ErrorBoundary key={section.type} fallback={<SectionError />}>
      <DrawerSection section={section} runId={runId} />
    </ErrorBoundary>
  ));
}
```

Each section is self-contained:

```tsx
function TimelineSection({ runId }) {
  const { data, isLoading } = trpc.flowpanel.runs.timeline.useQuery({ runId });
  if (isLoading) return <TimelineSkeleton />;
  return <Timeline events={data.events} />;
}
```

### Default drawer layout (zero-config)

```ts
const defaultRunDetailSections = [
  { type: "stat-grid", fields: ["status", "stage", "duration_ms", "created_at"] },
  { type: "timeline" },
  { type: "kv-grid", fields: "meta", showIf: "hasMeta" },
  { type: "error-block", showIf: "hasError" },
];
```

`showIf` — built-in predicates: `hasMeta`, `hasError`, `isRunning`, `hasCustomFields`.
Section doesn't render if predicate is false. No empty sections.

### URL sync

```
/admin?run=abc123              → drawer open for run abc123
/admin?run=abc123&tab=pipeline → specific tab + drawer
```

Implementation via `URLSearchParams` — no router dependencies:

```tsx
function useDrawerURL() {
  // Reads ?run= from URL on mount
  // pushState on first open (so Back closes drawer)
  // replaceState on subsequent navigation within drawer
}
```

### Keyboard navigation in drawer

When drawer is open:
- `j` / `↓` — next run (drawer updates, doesn't close/reopen)
- `k` / `↑` — previous run
- `Escape` — close drawer
- Table scrolls to active run

Drawer transition between runs: crossfade content, not slide close → slide open.

### Live updates in open drawer

SSE events for current run → React Query cache invalidates → drawer sections
re-render automatically (free from Section 1 architecture).

For running runs:
- Duration counter ticks every second (local interval)
- Timeline section shows "In progress..." with breathing animation
- Status badge pulses

### Drawer actions

```ts
defineFlowPanel({
  drawers: {
    runDetail: {
      sections: [...],
      actions: [
        { label: "Retry", icon: "refresh", action: "retry", confirm: true },
        { label: "Cancel", icon: "x", action: "cancel", destructive: true, confirm: true },
      ],
    },
  },
})
```

Actions render in drawer header. `confirm: true` shows confirmation dialog.
`destructive: true` — red button.

---

## 6. Filters & Table

### Configurable filters

```ts
defineFlowPanel({
  pipeline: {
    filters: [
      { key: "status", type: "select", options: ["ok", "err", "running"] },
      { key: "createdAt", type: "date-range" },
      { key: "userId", type: "search", placeholder: "User ID..." },
    ],
  },
})
```

### FilterBar slot

For full control:

```tsx
defineFlowPanel({
  slots: {
    FilterBar: ({ filters, onFilterChange }) => <MyFilters ... />,
  },
})
```

### Table (TanStack Table + shadcn Table)

- shadcn `Table` for styled markup (thead/tbody/tr/td)
- **TanStack Table** for logic — sorting, filtering, pagination, virtualization
- Column sort via header click
- Configured filters rendered above table
- Row virtualization (preserved from current implementation)
- Keyboard navigation: j/k, Enter (preserved)
- Column resize

---

## 7. shadcn Components

### What we take

| shadcn component | Replaces | Radix primitive |
|---|---|---|
| Button | inline `<button>` styles | — |
| Badge | custom `StatusTag` | — |
| Card | `.fp-card` class | — |
| Skeleton | `.fp-skeleton` class | — |
| Table | custom RunTable markup | — |
| Tabs | custom `Tabs` | `@radix-ui/react-tabs` |
| Tooltip | custom `Tooltip` | `@radix-ui/react-tooltip` |
| Sheet | custom `Drawer` | `@radix-ui/react-dialog` |
| Dialog | CommandPalette overlay | `@radix-ui/react-dialog` |
| Command | CommandPalette logic | `cmdk` |

### What we DON'T take

- Form, Input, Select, Checkbox — no user forms in FlowPanel
- Toast — current custom Toast is simple enough, no need for sonner
- Chart — keep custom SVG (RunChart + sparklines)

### New dependencies

| Package | gzipped | Purpose |
|---|---|---|
| `@radix-ui/react-dialog` | ~2kB | Sheet, Dialog |
| `@radix-ui/react-tooltip` | ~1.5kB | Tooltip |
| `@radix-ui/react-tabs` | ~1.5kB | Tabs |
| `cmdk` | ~3kB | Command palette |
| `@tanstack/react-table` | ~4kB | Table logic |
| `tailwindcss-animate` | ~0.5kB | Radix animations |
| `lucide-react` (10-15 icons) | ~1.5kB | Icons |
| `tailwindcss` + `postcss` | dev only | Build |

---

## 8. Bundle Budget

| Part | gzipped |
|---|---|
| Radix (Dialog, Tooltip, Tabs) | ~5kB |
| TanStack Table | ~4kB |
| cmdk | ~3kB |
| Tailwind CSS (purged, ~10 components) | ~4-5kB |
| tailwindcss-animate | ~0.5kB |
| lucide-react (10-15 icons) | ~1.5kB |
| tRPC client + React Query (already in deps) | 0kB delta |
| FlowPanel components | ~8-10kB |
| **Total** | **~27-31kB** |

**Limit: 35kB.** Buffer of ~4-8kB for growth.

What's removed from current bundle:
- Dead `@trpc/react-query` import (now actually used — no wasted bytes)
- Inline style objects on every component (replaced by Tailwind classes)
- Custom Tooltip implementation
- Custom focus trap (Radix handles it)
- Custom keyboard nav in CommandPalette (cmdk handles it)
- `.fp-card`, `.fp-skeleton`, `.fp-mono` utility classes
- `runsReducer` + buffered runs logic (replaced by React Query cache)

---

## 9. Build Pipeline

Single build step via tsup + postcss:

```ts
// packages/react/tsup.config.ts
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  external: ["react", "react-dom"],
  onSuccess: "postcss src/styles/index.css -o dist/styles.css",
});
```

CSS exported as `@flowpanel/react/styles.css`:

```json
{
  ".": { "import": "./dist/index.js", "require": "./dist/index.cjs" },
  "./styles.css": "./dist/styles.css"
}
```

Developer usage:

```ts
import { FlowPanelUI } from "@flowpanel/react";
import "@flowpanel/react/styles.css";
```

`sideEffects: ["*.css"]` — JS is fully tree-shakeable.

---

## 10. Demo Experience

### Problem

To see FlowPanel today, developer needs PostgreSQL running, DATABASE_URL configured,
migrations applied, framework dev server running. Developer must see the panel
**before** all of this.

### `flowpanel demo`

One command, no dependencies:

```bash
$ flowpanel demo

  ◆ FlowPanel v0.1.0

  ✓ FlowPanel demo running at http://localhost:4400

  Live events:
  12:03:41  run.created   #1042  ingest     doc-7821
  12:03:43  run.finished  #1042  ingest     420ms ✓
  12:03:44  run.created   #1043  transform  doc-7821
  12:03:46  run.failed    #1043  transform  2.1s ✗ TimeoutError
```

### How it works

1. **Standalone server** — built-in `node:http` server, no Express/Hono
2. **In-memory data** — mock tRPC router with realistic data, no PostgreSQL
3. **Pre-bundled UI** — `@flowpanel/react` bundled into CLI as static asset
4. **Auto-open browser** — `open` / `xdg-open`
5. **SSE simulation** — new run every 2-5 seconds, metrics update, some runs fail
6. **Terminal live feed** — colored event stream in terminal, synced with browser

### Startup < 2s

- UI pre-bundled in CLI as single HTML + JS
- Server: `node:http`, zero external deps
- No compilation step
- Benchmark in CI: `time flowpanel demo --smoke` < 2s

### Realistic data generation

Not random — a story:

```ts
function generateDemoTimeline() {
  // Last 24 hours with realistic patterns:
  // - Morning ramp-up (8:00-10:00): throughput grows
  // - Daytime peak (10:00-17:00): stable load
  // - Incident at 14:30: burst of 15 failed runs (TimeoutError)
  // - Recovery at 14:45: errors stop
  // - Evening decline (17:00-22:00)
  // - Night baseline (22:00-8:00): rare runs
  //
  // Error messages are realistic:
  // - "TimeoutError: embedding API exceeded 30s"
  // - "ValidationError: document too large (15.2MB > 10MB limit)"
  // - "ConnectionError: upstream service unavailable"
  //
  // Meta fields are meaningful:
  // - { tokens: 1420, model: "gpt-4o", chunks: 12 }
  // - { rows: 50000, source: "postgres", table: "events" }
}
```

### Demo mode UI

- **Banner**: "Demo Mode — explore FlowPanel with sample data" + "Get Started →" link
- **Live data**: SSE simulation creates runs, some fail, metrics change
- **All features work**: drawer with real sections, filters, command palette, keyboard
- **Config preview**: "View Config" button shows the config powering the demo

### Theme playground

Floating `Customize` button in demo mode → slide-out panel:

- Color scheme toggle (dark/light)
- Accent color picker
- Border radius presets (0, 4, 8, 12, 16)
- **Copy config** button at bottom — generates ready-to-paste `theme: { ... }` snippet
- Changes apply instantly via CSS variables

### `flowpanel demo --config`

Preview your own config with mock data:

```bash
$ flowpanel demo --config ./flowpanel.config.ts

  ◆ FlowPanel v0.1.0

  ✓ Loaded config: My Pipeline (4 stages, 3 metrics)
  ✓ Watching config for changes...
  ✓ FlowPanel demo running at http://localhost:4400
```

Mock layer replaces:
- `adapter` → in-memory store
- `security.auth.getSession` → mock session `{ userId: "demo", role: "admin" }`
- Custom `metrics[].query` → realistic random values
- `pipeline.onRetry` → no-op

What's used from config as-is:
- `appName`, `pipeline.stages`, `pipeline.stageColors`
- `metrics[].label`, `metrics[].format`, `metrics[].trend`
- `runLog.columns`, `tabs`, `drawers`, `theme`

Config HMR: edit config file → demo hot-reloads → CSS variables update via SSE.
Warnings for unmockable features, not crashes:

```
  ⚠ Skipped custom metric query "revenue" — using mock value in demo
```

### Smart `npx flowpanel`

No project detected → guided entry:

```
$ npx flowpanel

  ◆ FlowPanel v0.1.0

  Get started:  flowpanel demo

  Commands:
    demo       Try FlowPanel with sample data
    init       Add FlowPanel to your project
    migrate    Sync database with config
    doctor     Check setup and troubleshoot

  flowpanel.tech
```

---

## 11. CLI

### 4 commands

```
flowpanel demo       Try FlowPanel with sample data
flowpanel init       Add FlowPanel to your project
flowpanel migrate    Sync database with config
flowpanel doctor     Check setup and troubleshoot
```

### What was removed/consolidated

| Was | Became |
|---|---|
| `migrate:gen` | `flowpanel migrate` (detects drift, generates, asks to apply) |
| `migrate:status` | `flowpanel migrate --status` |
| `diff` | Part of `migrate --status` |
| `demo:clear` | `flowpanel demo --clear` |
| `status` | `flowpanel doctor` (first lines show status) |
| `dev` | Removed (framework's own dev server handles this) |
| `worker:scan` | Part of `doctor` output |
| `audit:export` | Deferred to v2 |

### `migrate` — one command

```bash
flowpanel migrate              # Detect drift → show SQL → confirm → apply
flowpanel migrate --dry-run    # Show SQL without applying
flowpanel migrate --status     # Show pending migrations
```

Default flow is safe: always shows SQL, always asks confirmation.

### Contextual root help

In a project with FlowPanel config:

```
  ◆ FlowPanel v0.1.0 · Acme AI Pipeline

  3 stages · 4 metrics · 2 pending migrations

  Commands:
    migrate    Sync database with config
    doctor     Check setup and troubleshoot
    demo       Try FlowPanel with sample data

  Run flowpanel migrate to apply pending changes
```

- `init` hidden (already initialized)
- `migrate` first (actionable — pending migrations detected)
- Last line: contextual hint based on current state

Hints adapt:
- Pending migrations → "Run `flowpanel migrate`"
- All in sync → "Panel URL: http://localhost:3000/admin"
- No runs → "Run `flowpanel demo` to seed sample data"

### CLI visual identity

Brand mark `◆` in cyan (`#38BDF8`). Consistent color system:

| Element | Color |
|---|---|
| Brand mark `◆` + "FlowPanel" | Cyan bold |
| Command names | Cyan |
| Section headers | White bold |
| Descriptions | Dim gray |
| URLs | Dim underline |
| Flags | Cyan |
| Success `✓` | Green |
| Warning `⚠` | Yellow |
| Error `✗` | Red |
| Suggestions `→` | Dim |
| Values (counts, names) | White |

### Every error → action

```bash
  ✗ Connection failed: ECONNREFUSED localhost:5432
    → Is PostgreSQL running? Check DATABASE_URL in .env

  ✗ 2 pending migrations
    → Run: flowpanel migrate

  ✓ Schema in sync
  ✓ Auth configured (Better Auth)
  ✓ 3 stages, 4 metrics
```

Never a dead end. Always a next step.

### Per-command help

Same visual style. First line — what it does in plain language.
Minimal flags. Examples where non-obvious.

```
$ flowpanel migrate --help

  ◆ flowpanel migrate

  Sync database schema with your FlowPanel config.
  Detects changes, generates SQL, applies with confirmation.

  Options
    --dry-run    Show generated SQL without applying
    --status     Show pending migrations

  Examples
    $ flowpanel migrate              Detect and apply changes
    $ flowpanel migrate --dry-run    Preview SQL first
```

---

## 12. Testing Strategy

Tests target real breakage points, not coverage metrics.

### Style isolation tests (integration)

```ts
it("fp: prefixed styles don't leak to host elements");
it("host Tailwind classes don't affect FlowPanel components");
it("Radix portals render inside .flowpanel container");
```

### Focus management tests

```ts
it("Sheet traps focus and restores on close");
it("Command palette returns focus after Escape");
it("Tab key cycles within Sheet, not outside");
```

### Data layer tests

```ts
it("SSE run.created invalidates runs query cache");
it("SSE metrics.updated invalidates metrics query cache");
it("infinite scroll loads next page and appends");
it("stale-while-revalidate shows previous data during refetch");
```

### Drawer tests

```ts
it("URL ?run=123 opens drawer on mount");
it("j/k navigates between runs without closing drawer");
it("drawer sections load independently with own skeletons");
it("conditional section with showIf='hasError' hidden when no error");
it("Back button closes drawer and restores URL");
```

### Data race tests

```ts
it("filter change during SSE update shows consistent data");
it("stale SSE data doesn't overwrite newer filter results");
```

### Slot tests

```ts
it("custom slot receives correctly typed props");
it("broken slot renders fallback, doesn't crash panel");
it("slot override renders user component instead of default");
```

### Theme tests

```ts
it("config colors propagate to nested components");
it("dark/light switch applies to all surfaces");
it("user CSS overrides config values");
it("brand cyan is default primary color");
```

### Accessibility tests (axe)

```ts
const INTERACTIVE = [RunTable, CommandPalette, Sheet, Tabs, FilterBar];
for (const Component of INTERACTIVE) {
  it(`${Component.name} passes axe audit`);
}
```

### What we DON'T test

- "Renders without crashing" — TypeScript catches this
- Snapshot tests — break on any refactor, don't catch bugs
- Inline style values — brittle, not reflective of real issues
- Text label content — not a bug if text changes

---

## 13. Migration Strategy

Component-by-component. Each step produces a working panel.

### Phase 0: Architecture Refactor

1. Create `FlowPanelProvider` — tRPC client + QueryClient + context
2. Create `useFlowPanelSSE` — SSE → React Query cache invalidation
3. Extract `MetricsStrip` — self-contained with own tRPC query
4. Extract `StageCards` — self-contained with own tRPC query
5. Extract `ActivitySection` (RunChart + TopErrors) — own queries
6. Extract `RunLogSection` — infinite query replaces useReducer
7. Extract `DrawerFromURL` — URL sync + keyboard nav
8. Connect drawer sections to tRPC queries
9. Slim `FlowPanelUI` to ~50 LOC orchestrator
10. Remove `runsReducer`, manual `fetchJson()`, dead code

After Phase 0: same visual appearance, better behavior (caching, staggered loading,
working drawer, URL sync). `pnpm build && pnpm test:unit && pnpm test:e2e`.

### Phase 1: Infrastructure (shadcn)

11. Add Tailwind + PostCSS to `packages/react`
12. Configure `fp:` prefix, `preflight: false`
13. Scoped shadcn CSS variables under `.flowpanel` with brand colors
14. `cn()` utility (clsx + tailwind-merge)
15. `tailwindcss-animate` for Radix animations
16. Visual System tokens (status colors, typography, motion)

### Phase 2: Primitives (low risk)

17. Skeleton — replaces `.fp-skeleton`
18. Badge — replaces `StatusTag`
19. Card — replaces `.fp-card`
20. Button — replaces inline `<button>` styles
21. Tooltip — replaces custom Tooltip (Radix)

### Phase 3: Composite components (medium risk)

22. Tabs — replaces custom Tabs (Radix)
23. Sheet — replaces custom Drawer (Radix)
24. Command (cmdk) — replaces custom CommandPalette
25. Table + TanStack Table — replaces RunTable

### Phase 4: System improvements

26. Slot system in defineFlowPanel
27. Configurable filters + FilterBar slot
28. Error boundaries around slots and drawer sections
29. RunChart + sparklines restyle with Tailwind
30. Animation system (hover states, transitions, micro-interactions)

### Phase 5: Demo & CLI

31. Standalone demo server in CLI
32. Mock tRPC router with realistic data
33. SSE simulation + terminal live feed
34. Theme playground component
35. Config HMR in demo mode
36. CLI consolidation to 4 commands
37. Contextual help + branded output

### Phase 6: Tests

38. Style isolation tests
39. Focus management tests
40. Data layer tests (SSE + cache invalidation)
41. Drawer tests (URL sync, keyboard nav, conditional sections)
42. Data race tests (SSE + filters)
43. Slot tests (props, broken slot fallback)
44. Theme tests (cascade, dark/light, brand colors)
45. Accessibility tests (axe on interactive components)

### Migration rule

After each step: `pnpm build && pnpm test:unit && pnpm test:e2e`.
Fix breakage before moving to next step.
