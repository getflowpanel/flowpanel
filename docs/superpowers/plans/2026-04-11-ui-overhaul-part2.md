# UI Overhaul — Part 2: Drawer + Demo + CLI + Tests

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the UI overhaul: working drawer system with URL sync, standalone demo experience, simplified CLI (4 commands), targeted tests.

**Architecture:** Drawer reads `?run=` from URL and renders sections from config, each section fetches its own data via `trpc.flowpanel.drawers.render`. Demo uses built-in `node:http` server with mock tRPC router. CLI consolidated from 12 commands to 4.

**Tech Stack:** Same as Part 1. Demo server: `node:http`. CLI: `commander`.

**Spec:** `docs/superpowers/specs/2026-04-11-shadcn-migration-design.md`

**Branch:** `feat/beta-features`

**Prerequisite:** Part 1 commits 1-4 completed.

---

## Commit 5: Drawer System

URL sync, keyboard navigation, sections connected to data.

### Task 5.1: Create useDrawerURL hook

**Files:**
- Create: `packages/react/src/hooks/useDrawerURL.ts`

- [ ] **Step 1: URL sync hook**

```ts
// packages/react/src/hooks/useDrawerURL.ts
import { useCallback, useEffect, useState } from "react";

interface DrawerURLState {
  runId: string | null;
  open: (runId: string) => void;
  close: () => void;
}

export function useDrawerURL(): DrawerURLState {
  const [runId, setRunId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("run");
  });

  // Sync from URL on popstate (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setRunId(params.get("run"));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const open = useCallback((id: string) => {
    setRunId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("run", id);
    // pushState on first open so Back closes drawer
    window.history.pushState({}, "", url.toString());
  }, []);

  const close = useCallback(() => {
    setRunId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("run");
    window.history.replaceState({}, "", url.toString());
  }, []);

  return { runId, open, close };
}
```

---

### Task 5.2: Create DrawerSection resolver

**Files:**
- Create: `packages/react/src/drawer/DrawerSection.tsx`

- [ ] **Step 1: Section resolver using tRPC drawers.render**

```tsx
// packages/react/src/drawer/DrawerSection.tsx
import React from "react";
import { trpc } from "../hooks/trpc.js";
import { Skeleton } from "../components/ui/skeleton.js";
import {
  StatGridSection,
  KvGridSection,
  TimelineSection,
  TrendChartSection,
  BreakdownSection,
  ErrorListSection,
  ErrorBlockSection,
} from "../components/drawer-sections/index.js";

interface DrawerSectionProps {
  type: string;
  runId: string;
  drawerType: string;
  fields?: string[];
  showIf?: string;
}

const SECTION_MAP: Record<string, React.ComponentType<{ data: unknown }>> = {
  "stat-grid": StatGridSection as React.ComponentType<{ data: unknown }>,
  "kv-grid": KvGridSection as React.ComponentType<{ data: unknown }>,
  timeline: TimelineSection as React.ComponentType<{ data: unknown }>,
  "trend-chart": TrendChartSection as React.ComponentType<{ data: unknown }>,
  breakdown: BreakdownSection as React.ComponentType<{ data: unknown }>,
  "error-list": ErrorListSection as React.ComponentType<{ data: unknown }>,
  "error-block": ErrorBlockSection as React.ComponentType<{ data: unknown }>,
};

export function DrawerSection({ type, runId, drawerType, showIf }: DrawerSectionProps) {
  const { data, isLoading } = trpc.flowpanel.drawers.render.useQuery({
    drawerId: drawerType,
    runId,
  });

  if (isLoading) {
    return (
      <div className="fp:p-4 fp:space-y-2">
        <Skeleton className="fp:h-4 fp:w-1/3" />
        <Skeleton className="fp:h-20 fp:w-full" />
      </div>
    );
  }

  if (!data) return null;

  // Conditional rendering via showIf predicates
  if (showIf) {
    const run = data as Record<string, unknown>;
    if (showIf === "hasError" && run.status !== "err") return null;
    if (showIf === "hasMeta" && (!run.meta || Object.keys(run.meta as object).length === 0))
      return null;
    if (showIf === "isRunning" && run.status !== "running") return null;
  }

  const SectionComponent = SECTION_MAP[type];
  if (!SectionComponent) return null;

  return <SectionComponent data={data} />;
}
```

---

### Task 5.3: Create DrawerFromURL

**Files:**
- Create: `packages/react/src/drawer/DrawerFromURL.tsx`

- [ ] **Step 1: Drawer that reads URL and renders sections**

```tsx
// packages/react/src/drawer/DrawerFromURL.tsx
import React, { useEffect } from "react";
import { useFlowPanelConfig } from "../context.js";
import { useDrawerURL } from "../hooks/useDrawerURL.js";
import { useKeyboard } from "../hooks/useKeyboard.js";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet.js";
import { ErrorBoundary } from "../components/ErrorBoundary.js";
import { DrawerSection } from "./DrawerSection.js";

const DEFAULT_SECTIONS = [
  { type: "stat-grid", fields: ["status", "stage", "duration_ms", "created_at"] },
  { type: "timeline" },
  { type: "kv-grid", fields: ["meta"], showIf: "hasMeta" as const },
  { type: "error-block", showIf: "hasError" as const },
];

export function DrawerFromURL() {
  const { runId, close } = useDrawerURL();
  const config = useFlowPanelConfig();

  const sections =
    (config.drawers?.runDetail as { sections?: typeof DEFAULT_SECTIONS } | undefined)?.sections ??
    DEFAULT_SECTIONS;

  // Keyboard: Escape closes drawer
  useKeyboard(
    runId
      ? [{ key: "Escape", handler: close }]
      : [],
  );

  if (!runId) return null;

  return (
    <Sheet open onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Run {runId}</SheetTitle>
        </SheetHeader>
        <div className="fp:p-6 fp:space-y-6">
          {sections.map((section, i) => (
            <ErrorBoundary key={`${section.type}-${i}`}>
              <DrawerSection
                type={section.type}
                runId={runId}
                drawerType="runDetail"
                showIf={section.showIf}
              />
            </ErrorBoundary>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

---

### Task 5.4: Create drawer directory index

**Files:**
- Create: `packages/react/src/drawer/index.ts`

- [ ] **Step 1: Export drawer components**

```ts
// packages/react/src/drawer/index.ts
export { DrawerFromURL } from "./DrawerFromURL.js";
export { DrawerSection } from "./DrawerSection.js";
```

---

### Task 5.5: Wire DrawerFromURL into FlowPanelUI

**Files:**
- Modify: `packages/react/src/FlowPanelUI.tsx`

- [ ] **Step 1: Replace old Drawer with DrawerFromURL**

In `FlowPanelUI.tsx`, replace:
```tsx
import { Drawer } from "./components/Drawer.js";
```
with:
```tsx
import { DrawerFromURL } from "./drawer/index.js";
```

Replace the `<Drawer>` JSX with `<DrawerFromURL />` (no props needed — reads from URL).

Update `PipelineView`'s `onDrawerOpen` to use `useDrawerURL().open` instead of local state:

```tsx
// In FlowPanelInner, replace drawerState with:
const { runId: drawerRunId, open: openDrawer, close: closeDrawer } = useDrawerURL();
```

Remove the `drawerState` useState and related code. The drawer is now URL-driven.

- [ ] **Step 2: Update exports**

In `packages/react/src/index.ts`, add:

```ts
export { DrawerFromURL, DrawerSection } from "./drawer/index.js";
export { useDrawerURL } from "./hooks/useDrawerURL.js";
```

- [ ] **Step 3: Build, test, commit**

```bash
pnpm build && pnpm test:unit
git add -A && git commit -m "feat(react): drawer system with URL sync and section data fetching"
```

---

## Commit 6: Demo Experience

Standalone demo server with mock data, SSE simulation, theme playground.

### Task 6.1: Create mock tRPC router

**Files:**
- Create: `packages/cli/src/demo/mock-data.ts`
- Create: `packages/cli/src/demo/mock-router.ts`

- [ ] **Step 1: Create realistic mock data generator**

```ts
// packages/cli/src/demo/mock-data.ts
const STAGES = ["ingest", "transform", "embed", "index"];
const ERROR_MESSAGES = [
  "TimeoutError: embedding API exceeded 30s",
  "ValidationError: document too large (15.2MB > 10MB limit)",
  "ConnectionError: upstream service unavailable",
  "RateLimitError: OpenAI quota exceeded",
];

export function generateDemoRuns(count: number) {
  const now = Date.now();
  const runs: Array<Record<string, unknown>> = [];

  for (let i = 0; i < count; i++) {
    const age = Math.random() * 24 * 60 * 60 * 1000; // last 24h
    const createdAt = new Date(now - age);
    const stage = STAGES[Math.floor(Math.random() * STAGES.length)]!;
    const isError = Math.random() < 0.12; // 12% error rate
    const isRunning = !isError && Math.random() < 0.03;
    const durationMs = isRunning ? null : Math.floor(200 + Math.random() * 5000);

    // Incident burst at ~14:30
    const hour = createdAt.getHours();
    const isIncident = hour === 14 && createdAt.getMinutes() >= 25 && createdAt.getMinutes() <= 45;

    runs.push({
      id: String(1000 + i),
      stage,
      partition_key: `doc-${Math.floor(Math.random() * 10000)}`,
      status: isRunning ? "running" : isError || isIncident ? "err" : "ok",
      duration_ms: durationMs,
      created_at: createdAt.toISOString(),
      error_class: isError || isIncident
        ? ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)]
        : null,
      meta: { tokens: Math.floor(Math.random() * 3000), model: "gpt-4o" },
    });
  }

  return runs.sort((a, b) =>
    new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
  );
}

export function generateDemoMetrics() {
  return {
    throughput: { value: Math.floor(800 + Math.random() * 200) },
    errorRate: { value: Number((Math.random() * 5).toFixed(1)) },
    avgLatency: { value: Math.floor(400 + Math.random() * 300) },
    activeRuns: { value: Math.floor(Math.random() * 5) },
  };
}

export function generateDemoStages() {
  return STAGES.map((stage) => ({
    stage,
    total: Math.floor(100 + Math.random() * 200),
    succeeded: Math.floor(80 + Math.random() * 150),
    failed: Math.floor(5 + Math.random() * 20),
    running: Math.floor(Math.random() * 3),
    avgDurationMs: Math.floor(500 + Math.random() * 2000),
  }));
}

export const DEMO_CONFIG = {
  appName: "Acme AI Pipeline",
  timezone: "UTC",
  basePath: "/admin",
  pipeline: {
    stages: STAGES,
    stageColors: {
      ingest: "#38BDF8",
      transform: "#818cf8",
      embed: "#6ee7b7",
      index: "#fb923c",
    },
  },
  metrics: {
    throughput: { label: "Throughput", format: "number" as const },
    errorRate: { label: "Error Rate", format: "percent" as const },
    avgLatency: { label: "Avg Latency", format: "duration" as const },
    activeRuns: { label: "Active Runs", format: "number" as const },
  },
  theme: { colorScheme: "dark" as const },
};
```

- [ ] **Step 2: Create mock HTTP handler**

```ts
// packages/cli/src/demo/mock-router.ts
import { generateDemoRuns, generateDemoMetrics, generateDemoStages } from "./mock-data.js";

let runs = generateDemoRuns(500);

const handlers: Record<string, (input: Record<string, unknown>) => unknown> = {
  "flowpanel.metrics.getAll": () => generateDemoMetrics(),
  "flowpanel.stages.summary": () => generateDemoStages(),
  "flowpanel.runs.list": (input) => {
    const limit = (input.limit as number) ?? 50;
    const cursor = input.cursor as string | undefined;
    const startIdx = cursor ? runs.findIndex((r) => r.id === cursor) + 1 : 0;
    const slice = runs.slice(startIdx, startIdx + limit);
    return {
      runs: slice,
      nextCursor: slice.length === limit ? slice[slice.length - 1]!.id : null,
    };
  },
  "flowpanel.runs.get": (input) => runs.find((r) => r.id === input.runId) ?? null,
  "flowpanel.runs.chart": () => ({
    buckets: Array.from({ length: 24 }, (_, i) => ({
      label: `${i}:00`,
      total: Math.floor(20 + Math.random() * 40),
      succeeded: Math.floor(15 + Math.random() * 35),
      failed: i === 14 ? Math.floor(10 + Math.random() * 5) : Math.floor(Math.random() * 5),
    })),
    peakBucket: 14,
  }),
  "flowpanel.runs.topErrors": () => [
    { errorClass: "TimeoutError", count: 23 },
    { errorClass: "ValidationError", count: 12 },
    { errorClass: "ConnectionError", count: 8 },
  ],
  "flowpanel.drawers.render": (input) => runs.find((r) => r.id === input.runId) ?? null,
};

export function handleTrpcRequest(path: string, input: Record<string, unknown>): unknown {
  const procedure = path.replace("/api/trpc/", "");
  const handler = handlers[procedure];
  if (!handler) return { error: `Unknown procedure: ${procedure}` };
  return { result: { data: handler(input) } };
}

// SSE simulation: create new runs periodically
export function createSSESimulation() {
  let nextId = 2000;
  return {
    generateEvent() {
      const isFinish = Math.random() > 0.5;
      if (isFinish) {
        const run = runs[Math.floor(Math.random() * 10)]!;
        return { event: "run.finished", data: { id: run.id, status: "ok", durationMs: 1200 } };
      }
      nextId++;
      const newRun = {
        id: String(nextId),
        stage: ["ingest", "transform", "embed", "index"][Math.floor(Math.random() * 4)],
        partition_key: `doc-${Math.floor(Math.random() * 10000)}`,
        status: "running",
        duration_ms: null,
        created_at: new Date().toISOString(),
        meta: { tokens: Math.floor(Math.random() * 3000), model: "gpt-4o" },
      };
      runs.unshift(newRun);
      return { event: "run.created", data: newRun };
    },
  };
}
```

---

### Task 6.2: Create demo server

**Files:**
- Create: `packages/cli/src/demo/server.ts`

- [ ] **Step 1: Standalone HTTP server**

```ts
// packages/cli/src/demo/server.ts
import { createServer } from "node:http";
import { handleTrpcRequest, createSSESimulation } from "./mock-router.js";

export function startDemoServer(port: number): Promise<{ close: () => void }> {
  const sse = createSSESimulation();

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

    // SSE stream
    if (url.pathname.includes("stream.connect")) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const interval = setInterval(() => {
        const event = sse.generateEvent();
        res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
      }, 3000);

      req.on("close", () => clearInterval(interval));
      return;
    }

    // tRPC-like handler
    if (url.pathname.startsWith("/api/trpc/")) {
      const inputRaw = url.searchParams.get("input");
      const input = inputRaw ? JSON.parse(decodeURIComponent(inputRaw)) : {};
      const result = handleTrpcRequest(url.pathname, input);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    }

    // Serve pre-bundled UI HTML (placeholder — will embed actual UI in build step)
    if (url.pathname === "/" || url.pathname === "/admin") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(getDemoHTML(port));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({ close: () => server.close() });
    });
  });
}

function getDemoHTML(port: number): string {
  // Minimal HTML that loads FlowPanel UI from CDN or embedded bundle
  // For now, inline a simple HTML that shows the panel config
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FlowPanel Demo</title>
  <style>
    body { font-family: system-ui; background: #0F172A; color: #e2e8f0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 32px; border-radius: 12px; text-align: center; max-width: 480px; }
    h1 { color: #38BDF8; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
    code { background: #0f172a; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    a { color: #38BDF8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>◆ FlowPanel Demo</h1>
    <p>Demo server running on port ${port}.</p>
    <p>API endpoints available at <code>/api/trpc/*</code></p>
    <p>SSE stream at <code>/api/trpc/flowpanel.stream.connect</code></p>
    <p style="margin-top: 16px; font-size: 12px; color: #64748b;">
      Full UI rendering requires the React package to be embedded.<br>
      This will be implemented in the build pipeline.
    </p>
  </div>
</body>
</html>`;
}
```

---

### Task 6.3: Rewrite demo command

**Files:**
- Modify: `packages/cli/src/commands/demo.ts`

- [ ] **Step 1: Rewrite demo command with standalone server + terminal feed**

```ts
// packages/cli/src/commands/demo.ts
import kleur from "kleur";
import { startDemoServer } from "../demo/server.js";
import { DEMO_CONFIG } from "../demo/mock-data.js";

interface DemoOptions {
  port?: string;
  config?: string;
  clear?: boolean;
  noOpen?: boolean;
}

export async function demo(options: DemoOptions) {
  const port = Number(options.port) || 4400;

  // Handle --clear (legacy behavior — clear seeded data from DB)
  if (options.clear) {
    console.log(kleur.yellow("  ⚠ --clear removes demo data from your database."));
    console.log(kleur.dim("    This requires DATABASE_URL to be set."));
    // Delegate to existing demo-clear logic
    const { demoClear } = await import("./demo-clear.js");
    return demoClear();
  }

  console.log();
  console.log(`  ${kleur.cyan("◆")} ${kleur.bold("FlowPanel")} ${kleur.dim("v0.1.0")}`);
  console.log();

  // Start server
  const server = await startDemoServer(port);
  console.log(kleur.green(`  ✓ FlowPanel demo running at http://localhost:${port}`));
  console.log();

  // Auto-open browser
  if (!options.noOpen) {
    try {
      const { exec } = await import("node:child_process");
      const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      exec(`${cmd} http://localhost:${port}`);
    } catch {
      // Silently skip if open fails
    }
  }

  // Terminal live feed
  console.log(kleur.dim("  Live events:"));
  const events = ["run.created", "run.finished", "run.failed"];
  const stages = DEMO_CONFIG.pipeline.stages;
  let eventId = 1000;

  const interval = setInterval(() => {
    const event = events[Math.floor(Math.random() * events.length)]!;
    const stage = stages[Math.floor(Math.random() * stages.length)]!;
    const time = new Date().toLocaleTimeString("en-US", { hour12: false });
    const id = `#${++eventId}`;
    const target = `doc-${Math.floor(Math.random() * 10000)}`;

    if (event === "run.created") {
      console.log(`  ${kleur.dim(time)}  ${kleur.cyan("run.created")}   ${kleur.dim(id)}  ${kleur.cyan(stage.padEnd(12))} ${target}`);
    } else if (event === "run.finished") {
      const ms = Math.floor(200 + Math.random() * 2000);
      console.log(`  ${kleur.dim(time)}  ${kleur.green("run.finished")}  ${kleur.dim(id)}  ${kleur.cyan(stage.padEnd(12))} ${ms}ms ${kleur.green("✓")}`);
    } else {
      const ms = Math.floor(1000 + Math.random() * 5000);
      console.log(`  ${kleur.dim(time)}  ${kleur.red("run.failed")}    ${kleur.dim(id)}  ${kleur.cyan(stage.padEnd(12))} ${ms}ms ${kleur.red("✗")} TimeoutError`);
    }
  }, 3000);

  // Graceful shutdown
  process.on("SIGINT", () => {
    clearInterval(interval);
    server.close();
    console.log();
    console.log(kleur.dim("  Demo stopped."));
    process.exit(0);
  });
}
```

---

### Task 6.4: Build and commit

- [ ] **Step 1: Build**

```bash
pnpm build
```

- [ ] **Step 2: Test demo manually**

```bash
node packages/cli/dist/index.mjs demo --no-open
```

Verify terminal shows colored live feed. Ctrl+C stops cleanly.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(cli): standalone demo server with mock data and SSE simulation"
```

---

## Commit 7: CLI Simplification

Consolidate from 12 commands to 4. Add contextual help and branded output.

### Task 7.1: Update CLI index

**Files:**
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Rewrite command registration — 4 commands**

Rewrite `packages/cli/src/index.ts` to register only 4 top-level commands:

```ts
// packages/cli/src/index.ts
import { Command } from "commander";
import kleur from "kleur";

const program = new Command();

program
  .name("flowpanel")
  .description(`${kleur.cyan("◆")} ${kleur.bold("FlowPanel")} — config-driven admin panels for Node.js`)
  .version("0.1.0")
  .action(async () => {
    // No args → contextual help
    const { showContextualHelp } = await import("./help.js");
    showContextualHelp();
  });

program
  .command("demo")
  .description("Try FlowPanel with sample data")
  .option("--config <path>", "Preview your own config with mock data")
  .option("--port <number>", "Server port", "4400")
  .option("--clear", "Remove seeded demo data from database")
  .option("--no-open", "Don't open browser automatically")
  .action(async (opts) => {
    const { demo } = await import("./commands/demo.js");
    await demo(opts);
  });

program
  .command("init")
  .description("Add FlowPanel to your project")
  .option("--adapter <name>", "Database adapter: drizzle, prisma")
  .option("--path <path>", "Base URL path", "/admin")
  .action(async (opts) => {
    const { init } = await import("./commands/init.js");
    await init(opts);
  });

program
  .command("migrate")
  .description("Sync database with config")
  .option("--dry-run", "Show generated SQL without applying")
  .option("--status", "Show pending migrations")
  .action(async (opts) => {
    const { migrate } = await import("./commands/migrate.js");
    await migrate(opts);
  });

program
  .command("doctor")
  .description("Check setup and troubleshoot")
  .option("--prod", "Pre-deploy checklist (stricter checks)")
  .option("--json", "Machine-readable output")
  .action(async (opts) => {
    const { doctor } = await import("./commands/doctor.js");
    await doctor(opts);
  });

program.parse();
```

---

### Task 7.2: Create contextual help

**Files:**
- Create: `packages/cli/src/help.ts`

- [ ] **Step 1: Smart help based on project context**

```ts
// packages/cli/src/help.ts
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import kleur from "kleur";

export function showContextualHelp() {
  const hasConfig = existsSync(resolve("flowpanel.config.ts")) ||
    existsSync(resolve("flowpanel.config.js"));

  console.log();
  console.log(`  ${kleur.cyan("◆")} ${kleur.bold("FlowPanel")} ${kleur.dim("v0.1.0")}`);

  if (hasConfig) {
    // In a project with config
    console.log();
    console.log(`  ${kleur.bold("Commands")}`);
    console.log(`    ${kleur.cyan("migrate")}    Sync database with config`);
    console.log(`    ${kleur.cyan("doctor")}     Check setup and troubleshoot`);
    console.log(`    ${kleur.cyan("demo")}       Try FlowPanel with sample data`);
    console.log();
    console.log(kleur.dim("  flowpanel <command> --help for details"));
  } else {
    // No project detected
    console.log();
    console.log(`  ${kleur.bold("Get started")}:  ${kleur.cyan("flowpanel demo")}`);
    console.log();
    console.log(`  ${kleur.bold("Commands")}`);
    console.log(`    ${kleur.cyan("demo")}       Try FlowPanel with sample data`);
    console.log(`    ${kleur.cyan("init")}       Add FlowPanel to your project`);
    console.log(`    ${kleur.cyan("migrate")}    Sync database with config`);
    console.log(`    ${kleur.cyan("doctor")}     Check setup and troubleshoot`);
    console.log();
    console.log(kleur.dim("  flowpanel.tech"));
  }

  console.log();
}
```

---

### Task 7.3: Update migrate to handle subcommands as flags

**Files:**
- Modify: `packages/cli/src/commands/migrate.ts`

- [ ] **Step 1: Add --status flag handling**

In `packages/cli/src/commands/migrate.ts`, add handling for `--status` option:

```ts
export async function migrate(opts: { dryRun?: boolean; status?: boolean }) {
  if (opts.status) {
    // Show migration status (previously migrate:status command)
    // Reuse existing logic from the old migrate:status implementation
    // ...
    return;
  }

  // Default: detect drift → generate SQL → confirm → apply
  // Combine logic from old migrate + migrate:gen
  // ...
}
```

The exact implementation reuses existing internal functions from the old `migrate.ts` file — the command registration changes, not the business logic.

---

### Task 7.4: Build, test, commit

- [ ] **Step 1: Build and test**

```bash
pnpm build
```

Test CLI:
```bash
node packages/cli/dist/index.mjs --help
node packages/cli/dist/index.mjs           # contextual help
node packages/cli/dist/index.mjs migrate --help
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(cli): simplify to 4 commands with contextual help and branded output"
```

---

## Commit 8: Tests + Final Polish

Targeted tests for new functionality. File structure cleanup.

### Task 8.1: Data layer tests

**Files:**
- Create: `packages/react/src/__tests__/useFlowPanelSSE.test.ts`

- [ ] **Step 1: Test SSE → cache invalidation**

```tsx
// packages/react/src/__tests__/useFlowPanelSSE.test.ts
import { describe, it, expect, vi } from "vitest";

describe("useFlowPanelSSE", () => {
  it("invalidates runs query on run.created event", async () => {
    // Mock QueryClient and verify invalidateQueries is called
    // with the correct query key when SSE event fires
    const invalidateQueries = vi.fn();
    // ... setup with QueryClientProvider + mock SSE
    // Fire event: { event: "run.created", data: { id: "123" } }
    // Assert: invalidateQueries called with { queryKey: [["flowpanel", "runs"]] }
  });

  it("invalidates metrics query on metrics.updated event", async () => {
    // Same pattern for metrics.updated → metrics query invalidation
  });
});
```

---

### Task 8.2: Drawer URL sync tests

**Files:**
- Create: `packages/react/src/__tests__/useDrawerURL.test.ts`

- [ ] **Step 1: Test URL sync**

```tsx
// packages/react/src/__tests__/useDrawerURL.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDrawerURL } from "../hooks/useDrawerURL.js";

describe("useDrawerURL", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/admin");
  });

  it("reads ?run= from URL on mount", () => {
    window.history.replaceState({}, "", "/admin?run=abc123");
    const { result } = renderHook(() => useDrawerURL());
    expect(result.current.runId).toBe("abc123");
  });

  it("open() sets URL param and pushState", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() => useDrawerURL());

    act(() => result.current.open("xyz789"));

    expect(result.current.runId).toBe("xyz789");
    expect(pushStateSpy).toHaveBeenCalled();
    expect(window.location.search).toContain("run=xyz789");
  });

  it("close() removes URL param", () => {
    window.history.replaceState({}, "", "/admin?run=abc123");
    const { result } = renderHook(() => useDrawerURL());

    act(() => result.current.close());

    expect(result.current.runId).toBeNull();
    expect(window.location.search).not.toContain("run");
  });
});
```

---

### Task 8.3: Style isolation test

**Files:**
- Create: `packages/react/src/__tests__/style-isolation.test.ts`

- [ ] **Step 1: Verify fp: prefix and scoped variables**

```tsx
// packages/react/src/__tests__/style-isolation.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Style isolation", () => {
  it("all Tailwind classes use fp: prefix", () => {
    const css = readFileSync(resolve(__dirname, "../../dist/styles.css"), "utf-8");

    // Find all class selectors — they should be fp: prefixed or .flowpanel scoped
    const classMatches = css.match(/\.[a-z][a-z0-9-]+/g) ?? [];
    const nonPrefixed = classMatches.filter(
      (cls) =>
        !cls.startsWith(".fp\\:") &&
        !cls.startsWith(".fp-") &&
        !cls.startsWith(".flowpanel") &&
        !cls.startsWith(".fp_") &&
        cls !== ".dark" // Tailwind built-in
    );

    // Some non-prefixed classes may exist from animations/base — but should be minimal
    expect(nonPrefixed.length).toBeLessThan(10);
  });

  it("CSS variables scoped under .flowpanel, not :root", () => {
    const css = readFileSync(resolve(__dirname, "../../dist/styles.css"), "utf-8");

    // --background, --primary etc. should be under .flowpanel
    expect(css).toContain(".flowpanel");
    expect(css).not.toMatch(/:root\s*\{[^}]*--background/);
  });
});
```

---

### Task 8.4: Component Badge test

**Files:**
- Create: `packages/react/src/__tests__/Badge.test.tsx`

- [ ] **Step 1: Test Badge variants**

```tsx
// packages/react/src/__tests__/Badge.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "../components/ui/badge.js";

describe("Badge", () => {
  it("renders with default variant", () => {
    const { getByText } = render(<Badge>Test</Badge>);
    expect(getByText("Test")).toBeDefined();
  });

  it("renders status variants", () => {
    const variants = ["ok", "err", "warn", "running", "muted"] as const;
    for (const variant of variants) {
      const { getByText } = render(<Badge variant={variant}>{variant}</Badge>);
      expect(getByText(variant)).toBeDefined();
    }
  });
});
```

---

### Task 8.5: Update E2E tests for new structure

**Files:**
- Modify: `e2e/tests/dashboard.test.ts`

- [ ] **Step 1: Verify E2E tests still pass**

The main risk: E2E tests use `data-testid="fp-root"` which is preserved.
Run and fix any broken selectors:

```bash
pnpm test:e2e
```

Common fixes needed:
- If tests check for specific CSS class names (`.fp-card`) → update to new shadcn classes
- If tests check for specific inline styles → update to Tailwind class assertions
- `data-testid` attributes should be preserved on all components

---

### Task 8.6: File structure cleanup

- [ ] **Step 1: Remove dead files**

Remove files replaced by shadcn:
- `packages/react/src/components/Tooltip.tsx` (replaced by `ui/tooltip.tsx`)
- `packages/react/src/theme/variables.css` (replaced by `styles/index.css`)

Do NOT remove:
- `packages/react/src/components/Drawer.tsx` — may still be used by slots system
- Old CLI command files — keep for reference in git history

- [ ] **Step 2: Final build + all tests**

```bash
pnpm build && pnpm test:unit && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test(react): targeted tests + file cleanup"
```

---

## Summary

| Commit | Scope | Description |
|---|---|---|
| 1 | react, core | Architecture refactor — self-contained components, tRPC hooks |
| 2 | react | Tailwind v4 infrastructure + shadcn primitives |
| 3 | react | Composite shadcn components — Tabs, Sheet, Command, Table |
| 4 | react | Visual system + migrate existing components |
| 5 | react | Drawer system — URL sync, sections, keyboard nav |
| 6 | cli | Standalone demo server with mock data and SSE |
| 7 | cli | CLI simplification — 4 commands, contextual help |
| 8 | react, e2e | Targeted tests + file cleanup |
