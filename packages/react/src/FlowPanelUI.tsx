import type {
  FlowPanelConfig,
  SerializedQueue,
  SerializedResource,
  SerializedWidget,
} from "@flowpanel/core";
import { Activity, LayoutDashboard, ListOrdered, Table as TableIcon } from "lucide-react";
import { DashboardPage } from "./dashboard/DashboardPage";
import { QueuePage } from "./queue/QueuePage";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Command } from "./components/CommandPalette";
import { CommandPalette } from "./components/CommandPalette";
import { DemoBanner } from "./components/DemoBanner";
import { Drawer } from "./components/Drawer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ErrorPanel } from "./components/ErrorPanel";
import { KeyboardHelp } from "./components/KeyboardHelp";
import { MetricCard } from "./components/MetricCard";
import { RunChart } from "./components/RunChart";
import type { RunLogColumn } from "./components/RunTable";
import { RunTable } from "./components/RunTable";
import { SectionHeader } from "./components/SectionHeader";
import { StageCard } from "./components/StageCard";
import { FlowPanelContext } from "./context";
import { useDrawerState } from "./hooks/useDrawerState";
import type { MetricResult } from "./hooks/useFlowPanelData";
import { useFlowPanelData } from "./hooks/useFlowPanelData";
import { useFlowPanelLive } from "./hooks/useFlowPanelLive";
import { useKeyboard } from "./hooks/useKeyboard";
import { FlowPanelShell } from "./layout/FlowPanelShell";
import { HeaderControls } from "./layout/HeaderControls";
import type { SidebarNavGroup } from "./layout/Sidebar";
import { useLocale } from "./locale/LocaleContext";
import { ResourcePage } from "./resource/ResourcePage";
import { resolveTheme, themeToClassName, themeToStyle } from "./theme/index";

// ─── Main Component ───────────────────────────────────────────────────────────

export interface FlowPanelUIProps {
  config: FlowPanelConfig;
  trpcBaseUrl?: string;
  showDemoBanner?: boolean;
}

/**
 * Main dashboard component. Renders the full FlowPanel admin UI with
 * shadcn-based sidebar layout, dark/light/system theme, and resource tabs.
 *
 * @example
 * ```tsx
 * <FlowPanelUI config={config} trpcBaseUrl="/api/trpc" />
 * ```
 */
export function FlowPanelUI({
  config,
  trpcBaseUrl = "/api/trpc",
  showDemoBanner = false,
}: FlowPanelUIProps) {
  const theme = resolveTheme(config);
  const themeStyle = themeToStyle(theme);
  const locale = useLocale();

  // ── UI state ──────────────────────────────────────────────────────────────
  const firstTabId = config.tabs?.[0]?.id ?? "pipeline";
  const [activeTab, setActiveTab] = useState(firstTabId);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [timeRange, setTimeRange] = useState(config.timeRange?.default ?? "24h");

  // ── Data fetching ─────────────────────────────────────────────────────────
  const {
    metrics,
    stageData,
    runsState,
    dispatchRuns,
    loading,
    error,
    chartData,
    topErrors,
    refresh,
    loadMore,
    resetDemo,
  } = useFlowPanelData({ config, baseUrl: trpcBaseUrl, timeRange, selectedStage });

  // ── SSE live updates ──────────────────────────────────────────────────────
  const setMetricsDirect = useCallback(
    (_data: Record<string, unknown>) => {
      void refresh();
    },
    [refresh],
  );

  const { status: liveStatus, liveAnnouncement } = useFlowPanelLive({
    streamUrl: `${trpcBaseUrl}/flowpanel.stream.connect`,
    dispatchRuns,
    onMetricsUpdate: setMetricsDirect,
  });

  // ── Resource schema ────────────────────────────────────────────────────────
  const [resourceMap, setResourceMap] = useState<Record<string, SerializedResource>>({});
  const [dashboardWidgets, setDashboardWidgets] = useState<SerializedWidget[]>([]);
  const [queueMap, setQueueMap] = useState<Record<string, SerializedQueue>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${trpcBaseUrl}/flowpanel.resource.schema`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as
          | { result?: { data?: { resources: Record<string, SerializedResource> } } }
          | { resources: Record<string, SerializedResource> };
        if (cancelled) return;
        const payload =
          "result" in json && json.result?.data
            ? json.result.data
            : (json as { resources: Record<string, SerializedResource> });
        setResourceMap(payload.resources ?? {});
      } catch {
        // Resource schema not available — no resource tabs shown
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trpcBaseUrl]);

  // Load queue schema
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${trpcBaseUrl}/flowpanel.queue.schema`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as
          | { result?: { data?: { queues: Record<string, SerializedQueue> } } }
          | { queues: Record<string, SerializedQueue> };
        if (cancelled) return;
        const payload =
          "result" in json && json.result?.data
            ? json.result.data
            : (json as { queues: Record<string, SerializedQueue> });
        setQueueMap(payload.queues ?? {});
      } catch {
        // Queue schema not available — no queue tabs shown
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trpcBaseUrl]);

  // Load dashboard layout (widget definitions only — data fetched by DashboardPage)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${trpcBaseUrl}/flowpanel.dashboard.schema`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as
          | { result?: { data?: { widgets: SerializedWidget[] } } }
          | { widgets: SerializedWidget[] };
        if (cancelled) return;
        const payload =
          "result" in json && json.result?.data
            ? json.result.data
            : (json as { widgets: SerializedWidget[] });
        setDashboardWidgets(payload.widgets ?? []);
      } catch {
        // Dashboard not configured — "Dashboard" nav entry hidden
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trpcBaseUrl]);

  // ── Drawer state ──────────────────────────────────────────────────────────
  const drawer = useDrawerState({ config, baseUrl: trpcBaseUrl, allRuns: runsState.runs });

  // ── Sidebar navigation groups ──────────────────────────────────────────────
  const configTabs = config.tabs ?? [{ id: "pipeline", label: "Pipeline" }];

  const nav = useMemo<SidebarNavGroup[]>(() => {
    const groups: SidebarNavGroup[] = [];

    // Core section (dashboard + pipeline + user-defined tabs)
    const coreItems: SidebarNavGroup["items"] = [];
    if (dashboardWidgets.length > 0) {
      coreItems.push({ id: "dashboard", label: "Dashboard", icon: LayoutDashboard });
    }
    for (const t of configTabs) {
      coreItems.push({ id: t.id, label: t.label, icon: Activity });
    }
    if (coreItems.length > 0) {
      groups.push({ id: "core", label: "Monitoring", items: coreItems });
    }

    // Resources section
    const resourceEntries = Object.entries(resourceMap);
    if (resourceEntries.length > 0) {
      groups.push({
        id: "resources",
        label: "Data",
        items: resourceEntries.map(([key, res]) => ({
          id: `resource:${key}`,
          label: res.labelPlural,
          icon: TableIcon,
        })),
      });
    }

    // Queues section
    const queueEntries = Object.entries(queueMap);
    if (queueEntries.length > 0) {
      groups.push({
        id: "queues",
        label: "Queues",
        items: queueEntries.map(([key, q]) => ({
          id: `queue:${key}`,
          label: q.label,
          icon: ListOrdered,
        })),
      });
    }

    return groups;
  }, [configTabs, resourceMap, dashboardWidgets, queueMap]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const flatNavIds = nav.flatMap((g) => g.items.map((i) => i.id));

  useKeyboard([
    {
      key: "k",
      meta: true,
      handler: () => setPaletteOpen(true),
      description: "Open command palette",
    },
    { key: "?", handler: () => setKeyboardHelpOpen(true) },
    {
      key: "/",
      handler: () => {
        const el = document.querySelector<HTMLInputElement>("[data-fp-run-search]");
        if (el) {
          el.focus();
          return true;
        }
        return false;
      },
      description: "Focus search",
    },
    { key: "1", handler: () => flatNavIds[0] && setActiveTab(flatNavIds[0]) },
    { key: "2", handler: () => flatNavIds[1] && setActiveTab(flatNavIds[1]) },
    { key: "3", handler: () => flatNavIds[2] && setActiveTab(flatNavIds[2]) },
    {
      key: "Escape",
      handler: () => {
        if (keyboardHelpOpen) setKeyboardHelpOpen(false);
        else if (drawer.isOpen) drawer.closeDrawer();
        else if (paletteOpen) setPaletteOpen(false);
      },
    },
  ]);

  // ── Run log columns ───────────────────────────────────────────────────────
  const runLogColumns: RunLogColumn[] = (config.runLog?.columns as RunLogColumn[] | undefined) ?? [
    { field: "id", label: "Run ID", width: 90, mono: true },
    { field: "stage", label: "Stage", width: 72, render: "stagePill" },
    { field: "partition_key", label: "Target", flex: 1 },
    { field: "duration_ms", label: "Duration", width: 80, format: "duration" },
    { field: "status", label: "Status", width: 110, render: "statusTag" },
  ];

  // ── Commands ──────────────────────────────────────────────────────────────
  const timePresets = config.timeRange?.presets ?? ["1h", "6h", "24h", "7d", "30d"];
  const builtinCommands: Command[] = [
    {
      id: "clear-filters",
      label: locale.clearFilters,
      category: "Actions",
      action: () => setSelectedStage(null),
    },
    {
      id: "refresh",
      label: locale.refreshData,
      category: "Actions",
      action: () => void refresh(),
    },
    {
      id: "keyboard-help",
      label: "Keyboard shortcuts",
      category: "Help",
      shortcut: "?",
      action: () => setKeyboardHelpOpen(true),
    },
    ...timePresets.map((preset) => ({
      id: `time-${preset}`,
      label: `Set time range: ${preset}`,
      category: "Time Range",
      action: () => setTimeRange(preset),
    })),
    ...Object.entries(resourceMap).map(([key, res]) => ({
      id: `go-resource-${key}`,
      label: `Go to ${res.labelPlural}`,
      category: "Resources",
      action: () => setActiveTab(`resource:${key}`),
    })),
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <FlowPanelContext.Provider value={{ timezone: config.timezone ?? "UTC" }}>
      <div
        className={`fp-root ${themeToClassName(config.theme?.colorScheme)}`.trim()}
        style={themeStyle}
        data-testid="fp-root"
      >
        <ErrorBoundary>
          <FlowPanelShell
            appName={config.appName}
            nav={nav}
            activeKey={activeTab}
            onNavigate={setActiveTab}
            headerRight={
              <HeaderControls
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
                timeRangePresets={timePresets}
                liveStatus={liveStatus}
                onOpenPalette={() => setPaletteOpen(true)}
              />
            }
          >
            {showDemoBanner && (
              <DemoBanner runCount={runsState.runs.length} realRunCount={0} onClear={resetDemo} />
            )}

            {/* Error banner */}
            {error && !loading && (
              <div
                role="alert"
                className="mb-6 flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <span>
                  {locale.serverError}: {error}
                </span>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="rounded-md border border-destructive/30 bg-destructive/15 px-3 py-1 text-xs font-semibold transition-colors hover:bg-destructive/25"
                >
                  {locale.retry}
                </button>
              </div>
            )}

            {/* Dashboard tab */}
            {activeTab === "dashboard" && dashboardWidgets.length > 0 && (
              <ErrorBoundary>
                <DashboardPage widgets={dashboardWidgets} baseUrl={trpcBaseUrl} />
              </ErrorBoundary>
            )}

            {/* Pipeline tab (or first configured tab) */}
            {activeTab === firstTabId && activeTab !== "dashboard" && (
              <PipelineSection
                config={config}
                theme={theme}
                metrics={metrics}
                stageData={stageData}
                runs={runsState}
                dispatchRuns={dispatchRuns}
                loading={loading}
                chartData={chartData}
                topErrors={topErrors}
                loadMore={loadMore}
                selectedStage={selectedStage}
                setSelectedStage={setSelectedStage}
                runLogColumns={runLogColumns}
                openRunDetail={(id) => drawer.openDrawer("runDetail", String(id))}
                selectedRunId={drawer.selectedRunId}
                openMetricDrawer={(name) => drawer.openDrawer(name)}
              />
            )}

            {/* Resource tab */}
            {activeTab.startsWith("resource:") &&
              (() => {
                const resourceKey = activeTab.slice("resource:".length);
                const resource = resourceMap[resourceKey];
                if (!resource) return null;
                return (
                  <ErrorBoundary>
                    <ResourcePage resource={resource} baseUrl={trpcBaseUrl} />
                  </ErrorBoundary>
                );
              })()}

            {/* Queue tab */}
            {activeTab.startsWith("queue:") &&
              (() => {
                const queueKey = activeTab.slice("queue:".length);
                const queue = queueMap[queueKey];
                if (!queue) return null;
                return (
                  <ErrorBoundary>
                    <QueuePage queue={queue} baseUrl={trpcBaseUrl} />
                  </ErrorBoundary>
                );
              })()}

            {/* User-defined custom tab (beyond first) */}
            {activeTab !== firstTabId &&
              activeTab !== "dashboard" &&
              !activeTab.startsWith("resource:") &&
              !activeTab.startsWith("queue:") &&
              (() => {
                const tabEntry = config.tabs?.find((t) => t.id === activeTab);
                if (tabEntry?.component) {
                  const TabComponent = tabEntry.component as React.ComponentType<{
                    config: typeof config;
                    timeRange: string;
                  }>;
                  return (
                    <ErrorBoundary>
                      <TabComponent config={config} timeRange={timeRange} />
                    </ErrorBoundary>
                  );
                }
                return (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    <div className="mb-2">
                      No component configured for &ldquo;{tabEntry?.label ?? activeTab}&rdquo;
                    </div>
                    <div className="text-xs">
                      Add a{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                        component
                      </code>{" "}
                      to this tab in your flowpanel.config.ts
                    </div>
                  </div>
                );
              })()}
          </FlowPanelShell>

          {/* Drawers */}
          <Drawer
            open={drawer.isOpen}
            onClose={drawer.closeDrawer}
            title={drawer.drawerTitle}
            sections={drawer.drawerData?.sections}
            run={drawer.drawerData?.run}
            actions={drawer.drawerData?.actions?.map((a) => ({
              ...a,
              onClick: () => {},
            }))}
            loading={drawer.drawerLoading}
          >
            <div className="text-sm text-muted-foreground">
              {drawer.type === "runDetail"
                ? `Run details for ${drawer.runId}`
                : "Loading drawer content..."}
            </div>
          </Drawer>

          {/* Command palette */}
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            commands={builtinCommands}
          />

          {/* Keyboard shortcuts help */}
          <KeyboardHelp open={keyboardHelpOpen} onClose={() => setKeyboardHelpOpen(false)} />

          {/* ARIA live region */}
          <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
            {liveAnnouncement}
          </div>

          {/* SSE reconnect banner */}
          {liveStatus === "reconnecting" && (
            <div
              role="status"
              aria-live="polite"
              className="fixed inset-x-0 top-14 z-30 bg-yellow-500 py-2 text-center text-xs font-medium text-black"
            >
              {locale.reconnecting}
            </div>
          )}
        </ErrorBoundary>
      </div>
    </FlowPanelContext.Provider>
  );
}

// ─── Pipeline section (extracted for readability) ─────────────────────────────

interface PipelineSectionProps {
  config: FlowPanelConfig;
  theme: ReturnType<typeof resolveTheme>;
  metrics: Record<string, unknown>;
  stageData: ReturnType<typeof useFlowPanelData>["stageData"];
  runs: ReturnType<typeof useFlowPanelData>["runsState"];
  dispatchRuns: ReturnType<typeof useFlowPanelData>["dispatchRuns"];
  loading: boolean;
  chartData: ReturnType<typeof useFlowPanelData>["chartData"];
  topErrors: ReturnType<typeof useFlowPanelData>["topErrors"];
  loadMore: () => void;
  selectedStage: string | null;
  setSelectedStage: React.Dispatch<React.SetStateAction<string | null>>;
  runLogColumns: RunLogColumn[];
  openRunDetail: (id: string | number) => void;
  selectedRunId?: string | null | undefined;
  openMetricDrawer: (name: string) => void;
}

function PipelineSection({
  config,
  theme,
  metrics,
  stageData,
  runs,
  dispatchRuns,
  loading,
  chartData,
  topErrors,
  loadMore,
  selectedStage,
  setSelectedStage,
  runLogColumns,
  openRunDetail,
  selectedRunId,
  openMetricDrawer,
}: PipelineSectionProps) {
  return (
    <div className="space-y-6">
      {/* Metrics strip */}
      {Object.keys(config.metrics ?? {}).length > 0 && (
        <ErrorBoundary>
          <section aria-label="Metrics">
            <SectionHeader label="Overview" meta={loading ? undefined : "Last updated just now"} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(config.metrics ?? {}).map(([name, mc]) => {
                const result = metrics[name] as MetricResult | undefined;
                return (
                  <MetricCard
                    key={name}
                    label={mc.label}
                    value={result?.value ?? null}
                    trend={result?.trend}
                    sublabel={result?.sublabel}
                    sparkline={result?.sparkline}
                    loading={loading}
                    hasDrawer={!!mc.drawer}
                    onClick={mc.drawer ? () => openMetricDrawer(mc.drawer ?? "") : undefined}
                  />
                );
              })}
            </div>
          </section>
        </ErrorBoundary>
      )}

      {/* Stage cards */}
      {stageData.length > 0 &&
        (() => {
          const totalAllStages = stageData.reduce((s, d) => s + d.total, 0);
          return (
            <ErrorBoundary>
              <section aria-label="Pipeline stages">
                <SectionHeader label="Pipeline Stages" meta="Click to filter runs below" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {stageData.map((s) => (
                    <StageCard
                      key={s.stage}
                      stage={s.stage}
                      color={theme.stageColors[s.stage] ?? "#818cf8"}
                      total={s.total}
                      totalAllStages={totalAllStages}
                      succeeded={s.succeeded}
                      failed={s.failed}
                      running={s.running}
                      avgDurationMs={s.avgDurationMs}
                      selected={selectedStage === s.stage}
                      loading={loading}
                      onClick={() =>
                        setSelectedStage((prev) => (prev === s.stage ? null : s.stage))
                      }
                    />
                  ))}
                </div>
              </section>
            </ErrorBoundary>
          );
        })()}

      {/* Error summary */}
      {topErrors && topErrors.totalFailed > 0 && (
        <ErrorBoundary>
          <section aria-label="Errors">
            <SectionHeader label="Errors" meta={`${topErrors.totalFailed} failed`} />
            <ErrorPanel
              errors={topErrors.errors}
              totalFailed={topErrors.totalFailed}
              loading={loading}
              onRetryAll={() => {}}
              onErrorClick={() => setSelectedStage(null)}
            />
          </section>
        </ErrorBoundary>
      )}

      {/* Run volume chart */}
      {chartData && chartData.buckets.length > 0 && (
        <ErrorBoundary>
          <section aria-label="Run volume">
            <SectionHeader label="Run Volume" />
            <div className="rounded-lg border border-border bg-card p-4">
              <RunChart
                buckets={chartData.buckets}
                peakBucket={chartData.peakBucket}
                loading={loading}
              />
            </div>
          </section>
        </ErrorBoundary>
      )}

      {/* Run log */}
      <ErrorBoundary>
        <section aria-label="Run log">
          <SectionHeader
            label="Run Log"
            meta={
              !loading && runs.runs.length > 0
                ? `${runs.runs.length.toLocaleString()} total`
                : undefined
            }
          />
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <RunTable
              runs={runs.runs}
              columns={runLogColumns}
              stageColors={theme.stageColors}
              loading={loading}
              hasNextPage={!!runs.nextCursor}
              onLoadMore={loadMore}
              newRunsBanner={
                runs.bufferedNewRuns.length > 0 ? runs.bufferedNewRuns.length : undefined
              }
              onScrollToTop={() => dispatchRuns({ type: "FLUSH_BUFFERED" })}
              onRowClick={(run) => openRunDetail(String(run.id))}
              selectedRunId={selectedRunId ?? undefined}
            />
          </div>
        </section>
      </ErrorBoundary>
    </div>
  );
}
