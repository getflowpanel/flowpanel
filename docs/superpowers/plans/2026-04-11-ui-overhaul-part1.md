# UI Overhaul — Part 1: Architecture + shadcn + Visual System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor FlowPanelUI from 700-line monolith to self-contained components with tRPC hooks, migrate styling to Tailwind v4 + shadcn, implement visual system.

**Architecture:** FlowPanelUI becomes a ~50 LOC orchestrator. Each view component (MetricsStrip, StageCards, etc.) fetches its own data via tRPC hooks. SSE events invalidate React Query cache instead of manual reducer. Tailwind v4 with `fp:` prefix and `layer(flowpanel)` for style isolation.

**Tech Stack:** Tailwind CSS v4, shadcn/ui, Radix UI, TanStack Table, cmdk, @trpc/react-query, @tanstack/react-query

**Spec:** `docs/superpowers/specs/2026-04-11-shadcn-migration-design.md`

**Branch:** `feat/beta-features` (all commits here)

**Commit budget:** 4 commits in Part 1, 4 commits in Part 2

---

## Commit 1: Architecture Refactor

Decompose FlowPanelUI monolith. Wire tRPC hooks. SSE → cache invalidation.

### Task 1.1: Export FlowPanelRouter type from core

**Files:**
- Modify: `packages/core/src/trpc/index.ts`

- [ ] **Step 1: Add router type export**

```ts
// packages/core/src/trpc/index.ts — add at the end
export type { FlowPanelContext } from "./context.js";
export { createFlowPanelRouter } from "./router.js";

// Add this line:
export type FlowPanelRouter = ReturnType<typeof createFlowPanelRouter>;
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter @flowpanel/core build
```

Expected: builds without errors, `FlowPanelRouter` type is in dist.

---

### Task 1.2: Create tRPC client hook

**Files:**
- Create: `packages/react/src/hooks/trpc.ts`

- [ ] **Step 1: Create internal tRPC client**

```ts
// packages/react/src/hooks/trpc.ts
import { createTRPCReact } from "@trpc/react-query";
import type { FlowPanelRouter } from "@flowpanel/core/trpc";

export const trpc = createTRPCReact<FlowPanelRouter>();
```

This file is internal — not exported from the package.

---

### Task 1.3: Update FlowPanelContext

**Files:**
- Modify: `packages/react/src/context.ts`

- [ ] **Step 1: Expand context to include config and container ref**

```ts
// packages/react/src/context.ts
import type { FlowPanelConfig } from "@flowpanel/core";
import { createContext, useContext } from "react";

export interface FlowPanelContextValue {
  config: FlowPanelConfig;
  timezone: string;
  container: HTMLDivElement | null;
}

export const FlowPanelContext = createContext<FlowPanelContextValue>({
  config: {} as FlowPanelConfig,
  timezone: "UTC",
  container: null,
});

export function useFlowPanelConfig() {
  return useContext(FlowPanelContext).config;
}

export function useFlowPanelContainer() {
  return useContext(FlowPanelContext).container;
}
```

---

### Task 1.4: Create FlowPanelProvider

**Files:**
- Create: `packages/react/src/FlowPanelProvider.tsx`

- [ ] **Step 1: Create provider with tRPC client + QueryClient**

```tsx
// packages/react/src/FlowPanelProvider.tsx
import type { FlowPanelConfig } from "@flowpanel/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import React, { useRef, useState } from "react";
import { FlowPanelContext } from "./context.js";
import { trpc } from "./hooks/trpc.js";
import { resolveTheme, themeToStyle } from "./theme/index.js";

interface FlowPanelProviderProps {
  config: FlowPanelConfig;
  trpcBaseUrl: string;
  children: React.ReactNode;
}

export function FlowPanelProvider({ config, trpcBaseUrl, children }: FlowPanelProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: false } },
      }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: trpcBaseUrl })],
    }),
  );

  const theme = resolveTheme(config);
  const themeStyle = themeToStyle(theme);
  const colorScheme = config.theme?.colorScheme ?? "auto";
  const rootClassName = [
    "fp-root",
    "flowpanel",
    colorScheme === "dark" ? "fp-dark" : "",
    colorScheme === "light" ? "fp-light" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <FlowPanelContext.Provider
          value={{
            config,
            timezone: config.timezone ?? "UTC",
            container: containerRef.current,
          }}
        >
          <div className={rootClassName} style={{ ...themeStyle, minHeight: "100vh" }} ref={containerRef} data-testid="fp-root">
            {children}
          </div>
        </FlowPanelContext.Provider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

---

### Task 1.5: Create useFlowPanelSSE — SSE to cache invalidation

**Files:**
- Create: `packages/react/src/hooks/useFlowPanelSSE.ts`

- [ ] **Step 1: Create SSE hook that invalidates React Query cache**

```ts
// packages/react/src/hooks/useFlowPanelSSE.ts
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { LiveStatus } from "./useFlowPanelStream.js";
import { useFlowPanelStream } from "./useFlowPanelStream.js";

export function useFlowPanelSSE(trpcBaseUrl: string): { status: LiveStatus } {
  const queryClient = useQueryClient();

  const { status } = useFlowPanelStream({
    url: `${trpcBaseUrl}/flowpanel.stream.connect`,
    onEvent: useCallback(
      (event) => {
        if (
          event.event === "run.created" ||
          event.event === "run.finished" ||
          event.event === "run.failed"
        ) {
          void queryClient.invalidateQueries({ queryKey: [["flowpanel", "runs"]] });
          void queryClient.invalidateQueries({ queryKey: [["flowpanel", "stages"]] });
        }
        if (event.event === "metrics.updated") {
          void queryClient.invalidateQueries({ queryKey: [["flowpanel", "metrics"]] });
        }
      },
      [queryClient],
    ),
  });

  return { status };
}
```

Note: tRPC React Query uses nested array keys like `[["flowpanel", "runs"]]`. The exact key shape depends on tRPC v11 internals — verify by checking `queryClient.getQueryCache().getAll()` in browser devtools during development.

---

### Task 1.6: Extract self-contained view components

**Files:**
- Create: `packages/react/src/components/MetricsStrip.tsx`
- Create: `packages/react/src/components/StageCards.tsx`
- Create: `packages/react/src/components/ActivitySection.tsx`
- Create: `packages/react/src/components/RunLogSection.tsx`
- Create: `packages/react/src/components/PipelineView.tsx`
- Create: `packages/react/src/components/StatusOverlays.tsx`

- [ ] **Step 1: Create MetricsStrip**

```tsx
// packages/react/src/components/MetricsStrip.tsx
import React from "react";
import { useFlowPanelConfig } from "../context.js";
import { trpc } from "../hooks/trpc.js";
import { MetricCard } from "./MetricCard.js";

interface MetricsStripProps {
  timeRange: string;
  onDrawerOpen: (type: string) => void;
}

export function MetricsStrip({ timeRange, onDrawerOpen }: MetricsStripProps) {
  const config = useFlowPanelConfig();
  const { data: metrics, isLoading } = trpc.flowpanel.metrics.getAll.useQuery({ timeRange });

  return (
    <section
      aria-label="Metrics"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 12,
        marginBottom: 24,
      }}
    >
      {Object.entries(config.metrics ?? {}).map(([name, mc]) => (
        <MetricCard
          key={name}
          label={mc.label}
          value={
            ((metrics?.[name] as { value?: unknown } | undefined)?.value ?? null) as
              | string
              | number
              | null
          }
          loading={isLoading}
          hasDrawer={!!mc.drawer}
          onClick={mc.drawer ? () => onDrawerOpen(mc.drawer!) : undefined}
        />
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Create StageCards**

```tsx
// packages/react/src/components/StageCards.tsx
import React from "react";
import { resolveTheme } from "../theme/index.js";
import { useFlowPanelConfig } from "../context.js";
import { trpc } from "../hooks/trpc.js";
import { SectionHeader } from "./SectionHeader.js";
import { StageCard } from "./StageCard.js";

interface StageCardsProps {
  timeRange: string;
  selectedStage: string | null;
  onStageSelect: (stage: string | null) => void;
}

export function StageCards({ timeRange, selectedStage, onStageSelect }: StageCardsProps) {
  const config = useFlowPanelConfig();
  const { data: stageData, isLoading } = trpc.flowpanel.stages.summary.useQuery({ timeRange });
  const theme = resolveTheme(config);

  if (isLoading || !stageData || stageData.length === 0) return null;

  return (
    <section aria-label="Pipeline stages" style={{ marginBottom: 24 }}>
      <SectionHeader label="Pipeline Stages" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {stageData.map((s) => (
          <StageCard
            key={s.stage}
            stage={s.stage}
            color={theme.stageColors[s.stage] ?? "#818cf8"}
            total={s.total}
            succeeded={s.succeeded}
            failed={s.failed}
            running={s.running}
            avgDurationMs={s.avgDurationMs}
            selected={selectedStage === s.stage}
            loading={isLoading}
            onClick={() => onStageSelect(selectedStage === s.stage ? null : s.stage)}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create ActivitySection**

```tsx
// packages/react/src/components/ActivitySection.tsx
import React from "react";
import { trpc } from "../hooks/trpc.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { RunChart } from "./RunChart.js";
import { SectionHeader } from "./SectionHeader.js";

interface ActivitySectionProps {
  timeRange: string;
}

export function ActivitySection({ timeRange }: ActivitySectionProps) {
  const { data: chartData, isLoading: chartLoading } = trpc.flowpanel.runs.chart.useQuery({
    timeRange,
  });
  const { data: topErrors } = trpc.flowpanel.runs.topErrors.useQuery({
    timeRange,
    limit: 5,
  });

  return (
    <>
      <ErrorBoundary>
        <section aria-label="Run activity" style={{ marginBottom: 24 }}>
          <SectionHeader label="Activity" />
          <RunChart
            buckets={chartData?.buckets ?? []}
            peakBucket={chartData?.peakBucket}
            loading={chartLoading}
          />
        </section>
      </ErrorBoundary>

      {topErrors && topErrors.length > 0 && (
        <ErrorBoundary>
          <section aria-label="Top errors" style={{ marginBottom: 24 }}>
            <SectionHeader label="Top Errors" />
            <div className="fp-card" style={{ padding: 16 }}>
              {topErrors.map((e) => (
                <div
                  key={e.errorClass}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--fp-border-1)",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "#ef4444", fontFamily: "var(--fp-font-mono)" }}>
                    {e.errorClass}
                  </span>
                  <span
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      color: "#ef4444",
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {e.count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </ErrorBoundary>
      )}
    </>
  );
}
```

- [ ] **Step 4: Create RunLogSection**

```tsx
// packages/react/src/components/RunLogSection.tsx
import React, { useCallback, useState } from "react";
import type { RunLogColumn } from "./RunTable.js";
import { useFlowPanelConfig } from "../context.js";
import { trpc } from "../hooks/trpc.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { RunTable } from "./RunTable.js";
import { SectionHeader } from "./SectionHeader.js";

interface RunLogSectionProps {
  timeRange: string;
  selectedStage: string | null;
  onRunSelect: (runId: string) => void;
  selectedRunId?: string;
}

export function RunLogSection({
  timeRange,
  selectedStage,
  onRunSelect,
  selectedRunId,
}: RunLogSectionProps) {
  const config = useFlowPanelConfig();
  const { data, isLoading, fetchNextPage, hasNextPage } =
    trpc.flowpanel.runs.list.useInfiniteQuery(
      { timeRange, stage: selectedStage, limit: 50 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    );

  const runs = data?.pages.flatMap((p) => p.runs) ?? [];
  const theme = resolveTheme(config);

  const runLogColumns: RunLogColumn[] =
    (config.runLog?.columns as RunLogColumn[] | undefined) ?? [
      { field: "id", label: "Run ID", width: 90, mono: true },
      { field: "stage", label: "Stage", width: 72, render: "stagePill" },
      { field: "partition_key", label: "Target", flex: 1 },
      { field: "duration_ms", label: "Duration", width: 80, format: "duration" },
      { field: "status", label: "Status", width: 110, render: "statusTag" },
    ];

  // Onboarding state
  if (!isLoading && runs.length === 0) {
    return (
      <section aria-label="Getting started">
        <div className="fp-card" style={{ padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fp-text-1)", marginBottom: 8 }}>
            Get started with FlowPanel
          </div>
          <div style={{ fontSize: 13, color: "var(--fp-text-3)", marginBottom: 16 }}>
            Add withRun() to start tracking runs
          </div>
          <pre
            style={{
              display: "inline-block",
              textAlign: "left",
              padding: "16px 20px",
              background: "var(--fp-surface-1)",
              border: "1px solid var(--fp-border-1)",
              borderRadius: 8,
              fontFamily: "var(--fp-font-mono)",
              fontSize: 12,
              color: "var(--fp-text-2)",
              lineHeight: 1.6,
              overflow: "auto",
              maxWidth: "100%",
            }}
          >{`import { withRun } from "@flowpanel/core";

await withRun({ stage: "parse", partitionKey: "doc-1" }, async (run) => {
  // your pipeline logic
  run.setMeta({ tokens: 420 });
});`}</pre>
        </div>
      </section>
    );
  }

  return (
    <ErrorBoundary>
      <section aria-label="Run log">
        <SectionHeader
          label="Run Log"
          meta={runs.length > 0 && !isLoading ? `${runs.length.toLocaleString()} total` : undefined}
        />
        <div className="fp-card" style={{ overflow: "hidden" }}>
          <RunTable
            runs={runs}
            columns={runLogColumns}
            stageColors={theme.stageColors}
            loading={isLoading}
            hasNextPage={!!hasNextPage}
            onLoadMore={() => void fetchNextPage()}
            onRowClick={(run) => onRunSelect(String(run.id))}
            selectedRunId={selectedRunId}
          />
        </div>
      </section>
    </ErrorBoundary>
  );
}
```

Note: `resolveTheme` import is missing — add `import { resolveTheme } from "../theme/index.js";` at top.

- [ ] **Step 5: Create PipelineView**

```tsx
// packages/react/src/components/PipelineView.tsx
import React, { useState } from "react";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { MetricsStrip } from "./MetricsStrip.js";
import { StageCards } from "./StageCards.js";
import { ActivitySection } from "./ActivitySection.js";
import { RunLogSection } from "./RunLogSection.js";

interface PipelineViewProps {
  timeRange: string;
  onDrawerOpen: (type: string, runId?: string) => void;
  selectedRunId?: string;
}

export function PipelineView({ timeRange, onDrawerOpen, selectedRunId }: PipelineViewProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  return (
    <div id="fp-tabpanel-pipeline" role="tabpanel" aria-labelledby="fp-tab-pipeline">
      <ErrorBoundary>
        <MetricsStrip timeRange={timeRange} onDrawerOpen={onDrawerOpen} />
      </ErrorBoundary>

      <ErrorBoundary>
        <StageCards
          timeRange={timeRange}
          selectedStage={selectedStage}
          onStageSelect={setSelectedStage}
        />
      </ErrorBoundary>

      <ErrorBoundary>
        <ActivitySection timeRange={timeRange} />
      </ErrorBoundary>

      <RunLogSection
        timeRange={timeRange}
        selectedStage={selectedStage}
        onRunSelect={(runId) => onDrawerOpen("runDetail", runId)}
        selectedRunId={selectedRunId}
      />
    </div>
  );
}
```

- [ ] **Step 6: Create StatusOverlays**

```tsx
// packages/react/src/components/StatusOverlays.tsx
import React from "react";
import type { LiveStatus } from "../hooks/useFlowPanelStream.js";

interface StatusOverlaysProps {
  liveStatus: LiveStatus;
}

export function StatusOverlays({ liveStatus }: StatusOverlaysProps) {
  return (
    <>
      {/* ARIA live region for screen readers */}
      <div
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}
      />

      {/* SSE reconnect banner */}
      {liveStatus === "reconnecting" && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 52,
            left: 0,
            right: 0,
            zIndex: 20,
            background: "var(--fp-warn)",
            color: "#000",
            padding: "8px 24px",
            textAlign: "center",
            fontSize: 13,
          }}
        >
          Live updates paused — reconnecting...
        </div>
      )}
    </>
  );
}
```

---

### Task 1.7: Rewrite FlowPanelUI as orchestrator

**Files:**
- Modify: `packages/react/src/FlowPanelUI.tsx`

- [ ] **Step 1: Replace 700-line monolith with ~80 LOC orchestrator**

```tsx
// packages/react/src/FlowPanelUI.tsx
import type { FlowPanelConfig } from "@flowpanel/core";
import React, { useState } from "react";
import type { Command } from "./components/CommandPalette.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { DemoBanner } from "./components/DemoBanner.js";
import { Drawer } from "./components/Drawer.js";
import { Header } from "./components/Header.js";
import { KeyboardHelp } from "./components/KeyboardHelp.js";
import { PipelineView } from "./components/PipelineView.js";
import { StatusOverlays } from "./components/StatusOverlays.js";
import type { TabConfig } from "./components/Tabs.js";
import { Tabs } from "./components/Tabs.js";
import { ToastProvider } from "./components/Toast.js";
import { FlowPanelProvider } from "./FlowPanelProvider.js";
import { useFlowPanelSSE } from "./hooks/useFlowPanelSSE.js";
import { useKeyboard } from "./hooks/useKeyboard.js";

export interface FlowPanelUIProps {
  config: FlowPanelConfig;
  trpcBaseUrl?: string;
  showDemoBanner?: boolean;
}

function FlowPanelInner({ config, trpcBaseUrl = "/api/trpc", showDemoBanner = false }: FlowPanelUIProps) {
  const firstTabId = config.tabs?.[0]?.id ?? "pipeline";
  const [activeTab, setActiveTab] = useState(firstTabId);
  const [timeRange, setTimeRange] = useState(config.timeRange?.default ?? "24h");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [drawerState, setDrawerState] = useState<{ open: boolean; type: string; runId?: string }>({
    open: false,
    type: "",
  });

  const { status: liveStatus } = useFlowPanelSSE(trpcBaseUrl);

  const tabs: TabConfig[] =
    config.tabs?.map((t) => ({ id: t.id, label: t.label, icon: t.icon })) ?? [
      { id: "pipeline", label: "Pipeline" },
    ];

  const timePresets = config.timeRange?.presets ?? ["1h", "6h", "24h", "7d", "30d"];

  useKeyboard([
    { key: "k", meta: true, handler: () => setPaletteOpen(true), description: "Open command palette" },
    { key: "1", handler: () => setActiveTab(tabs[0]?.id ?? "pipeline") },
    { key: "2", handler: () => { if (tabs[1]) setActiveTab(tabs[1].id); } },
    { key: "3", handler: () => { if (tabs[2]) setActiveTab(tabs[2].id); } },
    { key: "?", shift: true, handler: () => setKeyboardHelpOpen(true), description: "Show keyboard shortcuts" },
    {
      key: "Escape",
      handler: () => {
        if (keyboardHelpOpen) setKeyboardHelpOpen(false);
        else if (drawerState.open) setDrawerState({ open: false, type: "" });
        else if (paletteOpen) setPaletteOpen(false);
      },
    },
  ]);

  const commands: Command[] = [
    { id: "refresh", label: "Refresh data", action: () => {}, category: "Data", shortcut: "⌘R" },
    ...timePresets.map((preset) => ({
      id: `time-${preset}`,
      label: `Set time range: ${preset}`,
      action: () => setTimeRange(preset),
      category: "Time Range",
    })),
  ];

  const handleDrawerOpen = (type: string, runId?: string) => {
    setDrawerState({ open: true, type, runId });
  };

  const drawerTitle =
    drawerState.type === "runDetail"
      ? `Run ${drawerState.runId ?? ""}`
      : drawerState.type || "Details";

  return (
    <>
      <a href="#fp-main" style={{ position: "absolute", left: -9999, top: 0, zIndex: 100 }}>
        Skip to main content
      </a>

      <Header
        appName={config.appName}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        timeRangePresets={timePresets}
        liveStatus={liveStatus}
        onCommandPaletteOpen={() => setPaletteOpen(true)}
      />

      {showDemoBanner && <DemoBanner runCount={0} realRunCount={0} onClear={() => {}} />}

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <main id="fp-main" style={{ padding: "24px" }}>
        {activeTab === "pipeline" && (
          <PipelineView
            timeRange={timeRange}
            onDrawerOpen={handleDrawerOpen}
            selectedRunId={drawerState.runId}
          />
        )}
      </main>

      <Drawer
        open={drawerState.open}
        onClose={() => setDrawerState({ open: false, type: "" })}
        title={drawerTitle}
      />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <KeyboardHelp open={keyboardHelpOpen} onClose={() => setKeyboardHelpOpen(false)} />
      <StatusOverlays liveStatus={liveStatus} />
    </>
  );
}

export function FlowPanelUI(props: FlowPanelUIProps) {
  return (
    <FlowPanelProvider config={props.config} trpcBaseUrl={props.trpcBaseUrl ?? "/api/trpc"}>
      <ToastProvider>
        <FlowPanelInner {...props} />
      </ToastProvider>
    </FlowPanelProvider>
  );
}
```

---

### Task 1.8: Update exports and verify

**Files:**
- Modify: `packages/react/src/index.ts`

- [ ] **Step 1: Add new exports, keep existing ones**

Add to `packages/react/src/index.ts`:

```ts
export { FlowPanelProvider } from "./FlowPanelProvider.js";
export { PipelineView } from "./components/PipelineView.js";
export { MetricsStrip } from "./components/MetricsStrip.js";
export { StageCards } from "./components/StageCards.js";
export { ActivitySection } from "./components/ActivitySection.js";
export { RunLogSection } from "./components/RunLogSection.js";
export { StatusOverlays } from "./components/StatusOverlays.js";
export { useFlowPanelConfig, useFlowPanelContainer } from "./context.js";
```

- [ ] **Step 2: Build and test**

```bash
pnpm build && pnpm test:unit
```

Fix any type errors or test failures. Existing tests should still pass since the public API (`FlowPanelUI` props) hasn't changed.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(react): architecture refactor — self-contained components with tRPC hooks"
```

---

## Commit 2: Tailwind v4 + shadcn Primitives

Add Tailwind v4 infrastructure and migrate low-risk components to shadcn.

### Task 2.1: Install dependencies

**Files:**
- Modify: `packages/react/package.json`

- [ ] **Step 1: Add Tailwind v4 + shadcn deps**

```bash
cd packages/react
pnpm add -D tailwindcss @tailwindcss/cli
pnpm add clsx tailwind-merge tailwindcss-animate class-variance-authority
pnpm add @radix-ui/react-tooltip lucide-react
```

---

### Task 2.2: Create Tailwind v4 CSS entry

**Files:**
- Create: `packages/react/src/styles/index.css`
- Create: `packages/react/src/styles/animations.css`

- [ ] **Step 1: Create main CSS file with Tailwind v4 config**

```css
/* packages/react/src/styles/index.css */
@import "tailwindcss" prefix(fp) layer(flowpanel);
@import "tailwindcss-animate" layer(flowpanel);
@import "./animations.css" layer(flowpanel);

@layer flowpanel {
  @theme {
    --color-background: hsl(var(--background));
    --color-foreground: hsl(var(--foreground));
    --color-primary: hsl(var(--primary));
    --color-primary-foreground: hsl(var(--primary-foreground));
    --color-card: hsl(var(--card));
    --color-card-foreground: hsl(var(--card-foreground));
    --color-muted: hsl(var(--muted));
    --color-muted-foreground: hsl(var(--muted-foreground));
    --color-border: hsl(var(--border));
    --color-destructive: hsl(var(--destructive));
    --color-destructive-foreground: hsl(var(--destructive-foreground));
    --color-accent: hsl(var(--accent));
    --color-accent-foreground: hsl(var(--accent-foreground));
    --color-status-ok: hsl(var(--status-ok));
    --color-status-err: hsl(var(--status-err));
    --color-status-warn: hsl(var(--status-warn));
    --color-status-running: hsl(var(--status-running));
    --radius-lg: var(--radius);
    --radius-md: calc(var(--radius) - 2px);
    --radius-sm: calc(var(--radius) - 4px);
  }
}

/* Scoped design tokens */
.flowpanel {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 199 89% 48%;
  --primary-foreground: 210 40% 8%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --border: 240 5.9% 90%;
  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 98%;
  --radius: 0.5rem;

  /* Status tokens */
  --status-ok: 142 71% 45%;
  --status-err: 0 84% 60%;
  --status-warn: 38 92% 50%;
  --status-running: 199 89% 48%;
  --status-pending: 240 5% 65%;

  /* Motion */
  --duration-instant: 80ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;

  /* Typography */
  font-feature-settings: "tnum";
}

.flowpanel.fp-dark {
  --background: 217 33% 6%;
  --foreground: 0 0% 98%;
  --primary: 199 89% 48%;
  --primary-foreground: 210 40% 8%;
  --card: 217 33% 10%;
  --card-foreground: 0 0% 98%;
  --muted: 217 33% 15%;
  --muted-foreground: 215 20% 55%;
  --border: 217 33% 17%;
  --accent: 217 33% 15%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62% 30%;
  --destructive-foreground: 0 0% 98%;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .flowpanel,
  .flowpanel * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Create animations file**

```css
/* packages/react/src/styles/animations.css */
@keyframes fp-skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes fp-live-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

@keyframes fp-slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes fp-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fp-scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
```

---

### Task 2.3: Create cn() utility

**Files:**
- Create: `packages/react/src/utils/cn.ts`

- [ ] **Step 1: Standard shadcn cn() utility**

```ts
// packages/react/src/utils/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

### Task 2.4: Create shadcn primitives

**Files:**
- Create: `packages/react/src/components/ui/skeleton.tsx`
- Create: `packages/react/src/components/ui/badge.tsx`
- Create: `packages/react/src/components/ui/card.tsx`
- Create: `packages/react/src/components/ui/button.tsx`
- Create: `packages/react/src/components/ui/tooltip.tsx`

- [ ] **Step 1: Skeleton**

```tsx
// packages/react/src/components/ui/skeleton.tsx
import React from "react";
import { cn } from "../../utils/cn.js";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("fp:animate-pulse fp:rounded-md fp:bg-muted", className)}
      {...props}
    />
  );
}
```

- [ ] **Step 2: Badge**

```tsx
// packages/react/src/components/ui/badge.tsx
import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/cn.js";

const badgeVariants = cva(
  "fp:inline-flex fp:items-center fp:rounded-full fp:px-2.5 fp:py-0.5 fp:text-xs fp:font-semibold fp:transition-colors",
  {
    variants: {
      variant: {
        default: "fp:bg-primary fp:text-primary-foreground",
        ok: "fp:bg-status-ok/10 fp:text-status-ok",
        err: "fp:bg-status-err/10 fp:text-status-err",
        warn: "fp:bg-status-warn/10 fp:text-status-warn",
        running: "fp:bg-status-running/10 fp:text-status-running",
        muted: "fp:bg-muted fp:text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

- [ ] **Step 3: Card**

```tsx
// packages/react/src/components/ui/card.tsx
import React from "react";
import { cn } from "../../utils/cn.js";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "fp:rounded-lg fp:border fp:border-border fp:bg-card fp:text-card-foreground fp:shadow-sm fp:transition-shadow fp:duration-[var(--duration-fast)]",
        "hover:fp:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("fp:flex fp:flex-col fp:space-y-1.5 fp:p-4", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("fp:p-4 fp:pt-0", className)} {...props} />;
}
```

- [ ] **Step 4: Button**

```tsx
// packages/react/src/components/ui/button.tsx
import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/cn.js";

const buttonVariants = cva(
  "fp:inline-flex fp:items-center fp:justify-center fp:whitespace-nowrap fp:rounded-md fp:text-sm fp:font-medium fp:ring-offset-background fp:transition-colors focus-visible:fp:outline-none focus-visible:fp:ring-2 focus-visible:fp:ring-primary focus-visible:fp:ring-offset-2 disabled:fp:pointer-events-none disabled:fp:opacity-50",
  {
    variants: {
      variant: {
        default: "fp:bg-primary fp:text-primary-foreground hover:fp:bg-primary/90",
        destructive: "fp:bg-destructive fp:text-destructive-foreground hover:fp:bg-destructive/90",
        outline: "fp:border fp:border-border fp:bg-background hover:fp:bg-accent hover:fp:text-accent-foreground",
        ghost: "hover:fp:bg-accent hover:fp:text-accent-foreground",
      },
      size: {
        default: "fp:h-9 fp:px-4 fp:py-2",
        sm: "fp:h-8 fp:rounded-md fp:px-3 fp:text-xs",
        icon: "fp:h-9 fp:w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
```

- [ ] **Step 5: Tooltip**

```tsx
// packages/react/src/components/ui/tooltip.tsx
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import React from "react";
import { cn } from "../../utils/cn.js";
import { useFlowPanelContainer } from "../../context.js";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>) {
  const container = useFlowPanelContainer();
  return (
    <TooltipPrimitive.Portal container={container}>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "fp:z-50 fp:overflow-hidden fp:rounded-md fp:border fp:border-border fp:bg-card fp:px-3 fp:py-1.5 fp:text-sm fp:text-card-foreground fp:shadow-md fp:animate-in fp:fade-in-0 fp:zoom-in-95",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
```

---

### Task 2.5: Update build config

**Files:**
- Modify: `packages/react/tsup.config.ts`
- Modify: `packages/react/package.json`

- [ ] **Step 1: Update tsup to build CSS with Tailwind v4**

```ts
// packages/react/tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  external: ["react", "react-dom"],
  onSuccess: async () => {
    const { execSync } = await import("node:child_process");
    execSync("npx @tailwindcss/cli -i src/styles/index.css -o dist/styles.css --minify", {
      stdio: "inherit",
    });
  },
});
```

- [ ] **Step 2: Update package.json exports**

In `packages/react/package.json`, change:

```json
"./theme.css": "./dist/theme/variables.css"
```

to:

```json
"./styles.css": "./dist/styles.css"
```

Also update `sideEffects`:

```json
"sideEffects": ["./dist/styles.css"]
```

And update `size-limit` to 35kB:

```json
"size-limit": [{ "path": "dist/index.js", "limit": "35 kB" }]
```

- [ ] **Step 3: Build and verify**

```bash
pnpm --filter @flowpanel/react build
```

Verify `dist/styles.css` exists and contains Tailwind utilities with `fp:` prefix.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(react): tailwind v4 infrastructure + shadcn primitives"
```

---

## Commit 3: Composite shadcn Components

Replace Tabs, Drawer (→ Sheet), CommandPalette (→ Command), RunTable (→ TanStack Table).

### Task 3.1: Install composite deps

- [ ] **Step 1: Add Radix + TanStack + cmdk**

```bash
cd packages/react
pnpm add @radix-ui/react-dialog @radix-ui/react-tabs cmdk @tanstack/react-table
```

---

### Task 3.2: Create shadcn Tabs

**Files:**
- Create: `packages/react/src/components/ui/tabs.tsx`

- [ ] **Step 1: shadcn Tabs with Radix**

```tsx
// packages/react/src/components/ui/tabs.tsx
import * as TabsPrimitive from "@radix-ui/react-tabs";
import React from "react";
import { cn } from "../../utils/cn.js";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "fp:inline-flex fp:h-10 fp:items-center fp:gap-1 fp:border-b fp:border-border fp:px-6",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "fp:inline-flex fp:items-center fp:justify-center fp:whitespace-nowrap fp:px-3 fp:py-1.5 fp:text-sm fp:font-medium fp:text-muted-foreground fp:transition-all",
        "hover:fp:text-foreground",
        "data-[state=active]:fp:text-foreground data-[state=active]:fp:border-b-2 data-[state=active]:fp:border-primary",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = TabsPrimitive.Content;
```

---

### Task 3.3: Create shadcn Sheet

**Files:**
- Create: `packages/react/src/components/ui/sheet.tsx`

- [ ] **Step 1: Sheet (replaces Drawer)**

```tsx
// packages/react/src/components/ui/sheet.tsx
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import React from "react";
import { cn } from "../../utils/cn.js";
import { useFlowPanelContainer } from "../../context.js";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  const container = useFlowPanelContainer();
  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Overlay className="fp:fixed fp:inset-0 fp:z-50 fp:bg-black/50 data-[state=open]:fp:animate-in data-[state=open]:fp:fade-in-0 data-[state=closed]:fp:animate-out data-[state=closed]:fp:fade-out-0" />
      <DialogPrimitive.Content
        className={cn(
          "fp:fixed fp:inset-y-0 fp:right-0 fp:z-50 fp:w-[420px] fp:max-w-full fp:bg-background fp:border-l fp:border-border fp:shadow-lg fp:overflow-y-auto",
          "data-[state=open]:fp:animate-in data-[state=open]:fp:slide-in-from-right",
          "data-[state=closed]:fp:animate-out data-[state=closed]:fp:slide-out-to-right",
          "fp:duration-[var(--duration-slow)]",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="fp:absolute fp:right-4 fp:top-4 fp:rounded-sm fp:opacity-70 hover:fp:opacity-100 fp:transition-opacity">
          <X className="fp:h-4 fp:w-4" />
          <span className="fp:sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("fp:flex fp:flex-col fp:space-y-2 fp:p-6 fp:pb-0", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("fp:text-lg fp:font-semibold fp:text-foreground", className)} {...props} />;
}
```

---

### Task 3.4: Create shadcn Command

**Files:**
- Create: `packages/react/src/components/ui/command.tsx`

- [ ] **Step 1: Command (replaces CommandPalette internals)**

```tsx
// packages/react/src/components/ui/command.tsx
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import React from "react";
import { cn } from "../../utils/cn.js";

export function Command({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      className={cn("fp:flex fp:h-full fp:w-full fp:flex-col fp:overflow-hidden fp:rounded-md fp:bg-card fp:text-card-foreground", className)}
      {...props}
    />
  );
}

export function CommandInput({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>) {
  return (
    <div className="fp:flex fp:items-center fp:border-b fp:border-border fp:px-3">
      <Search className="fp:mr-2 fp:h-4 fp:w-4 fp:shrink-0 fp:opacity-50" />
      <CommandPrimitive.Input
        className={cn(
          "fp:flex fp:h-11 fp:w-full fp:rounded-md fp:bg-transparent fp:py-3 fp:text-sm fp:outline-none fp:placeholder:text-muted-foreground disabled:fp:cursor-not-allowed disabled:fp:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export const CommandList = CommandPrimitive.List;
export const CommandEmpty = CommandPrimitive.Empty;

export function CommandGroup({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn("fp:overflow-hidden fp:p-1 fp:text-foreground [&_[cmdk-group-heading]]:fp:px-2 [&_[cmdk-group-heading]]:fp:py-1.5 [&_[cmdk-group-heading]]:fp:text-xs [&_[cmdk-group-heading]]:fp:font-medium [&_[cmdk-group-heading]]:fp:text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CommandItem({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "fp:relative fp:flex fp:cursor-default fp:select-none fp:items-center fp:rounded-sm fp:px-2 fp:py-1.5 fp:text-sm fp:outline-none",
        "data-[selected=true]:fp:bg-accent data-[selected=true]:fp:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}
```

---

### Task 3.5: Create shadcn Table

**Files:**
- Create: `packages/react/src/components/ui/table.tsx`

- [ ] **Step 1: shadcn Table markup components**

```tsx
// packages/react/src/components/ui/table.tsx
import React from "react";
import { cn } from "../../utils/cn.js";

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="fp:relative fp:w-full fp:overflow-auto">
      <table className={cn("fp:w-full fp:caption-bottom fp:text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:fp:border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:fp:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "fp:border-b fp:border-border fp:transition-colors fp:duration-[var(--duration-instant)]",
        "hover:fp:bg-muted/50",
        "data-[state=selected]:fp:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "fp:h-10 fp:px-3 fp:text-left fp:align-middle fp:font-medium fp:text-muted-foreground [&:has([role=checkbox])]:fp:pr-0",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("fp:px-3 fp:py-2 fp:align-middle [&:has([role=checkbox])]:fp:pr-0", className)}
      {...props}
    />
  );
}
```

---

### Task 3.6: Build, test, commit

- [ ] **Step 1: Verify build**

```bash
pnpm build && pnpm test:unit
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(react): shadcn composite components — Tabs, Sheet, Command, Table"
```

---

## Commit 4: Visual System + Migrate Existing Components

Apply shadcn primitives to existing components. Remove inline styles. Wire up visual system.

### Task 4.1: Migrate StatusTag → Badge

**Files:**
- Modify: `packages/react/src/components/StatusTag.tsx`

- [ ] **Step 1: Replace StatusTag internals with Badge**

```tsx
// packages/react/src/components/StatusTag.tsx
import React from "react";
import { Badge, type BadgeProps } from "./ui/badge.js";

export type Status = "ok" | "err" | "warn" | "running" | "pending" | "timeout" | "cancelled";

const statusVariantMap: Record<Status, BadgeProps["variant"]> = {
  ok: "ok",
  err: "err",
  warn: "warn",
  running: "running",
  pending: "muted",
  timeout: "err",
  cancelled: "muted",
};

const statusLabelMap: Record<Status, string> = {
  ok: "OK",
  err: "Error",
  warn: "Warning",
  running: "Running",
  pending: "Pending",
  timeout: "Timeout",
  cancelled: "Cancelled",
};

interface StatusTagProps {
  status: Status;
}

export function StatusTag({ status }: StatusTagProps) {
  return (
    <Badge variant={statusVariantMap[status] ?? "muted"}>
      {statusLabelMap[status] ?? status}
    </Badge>
  );
}
```

---

### Task 4.2: Migrate MetricCard to use Card + transitions

**Files:**
- Modify: `packages/react/src/components/MetricCard.tsx`

- [ ] **Step 1: Replace inline styles with Tailwind + Card**

Replace the MetricCard component internals to use `fp:` prefixed Tailwind classes and the Card component from `./ui/card.js`. Keep the same props interface. Use `fp:transition-transform fp:duration-[var(--duration-fast)] hover:fp:-translate-y-px hover:fp:shadow-md` for hover effect. Use `Skeleton` from `./ui/skeleton.js` for loading state instead of custom skeleton CSS.

---

### Task 4.3: Migrate remaining inline styles

Components to update (replace `style={{}}` with `fp:` Tailwind classes):
- `SectionHeader.tsx` — simple, just typography classes
- `Header.tsx` — layout + flex classes
- `DemoBanner.tsx` — alert-style classes
- `StagePill.tsx` — badge-like classes

For each component, preserve the exact same visual appearance. Replace `style={{ fontSize: 13, color: "var(--fp-text-3)" }}` with `className="fp:text-[13px] fp:text-muted-foreground"`.

Keep `RunChart.tsx` with inline styles — custom SVG needs precise positioning.

---

### Task 4.4: Build, test, commit

- [ ] **Step 1: Build and run tests**

```bash
pnpm build && pnpm test:unit
```

- [ ] **Step 2: Run E2E to verify visual rendering**

```bash
pnpm test:e2e
```

Fix any test selectors that broke due to class changes.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(react): visual system + migrate components to shadcn primitives"
```

---

This completes Part 1 (Commits 1-4). Part 2 covers: Drawer system, Demo experience, CLI simplification, Tests.
