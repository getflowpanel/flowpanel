import type { FlowPanelConfig } from "@flowpanel/core";
import { useCallback, useEffect, useReducer, useState } from "react";
import type { Command } from "./components/CommandPalette.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { DemoBanner } from "./components/DemoBanner.js";
import { Drawer } from "./components/Drawer.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { Header } from "./components/Header.js";
import { KeyboardHelp } from "./components/KeyboardHelp.js";
import { MetricCard } from "./components/MetricCard.js";
import type { RunLogColumn } from "./components/RunTable.js";
import { RunTable } from "./components/RunTable.js";
import { SectionHeader } from "./components/SectionHeader.js";
import { StageCard } from "./components/StageCard.js";
import type { TabConfig } from "./components/Tabs.js";
import { Tabs } from "./components/Tabs.js";
import { ToastProvider } from "./components/Toast.js";
import { useFlowPanelStream } from "./hooks/useFlowPanelStream.js";
import { useKeyboard } from "./hooks/useKeyboard.js";
import { resolveTheme, themeToStyle } from "./theme/index.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunsState {
  runs: Record<string, unknown>[];
  nextCursor: string | null;
  bufferedNewRuns: Record<string, unknown>[];
}

type RunsAction =
  | { type: "SET_RUNS"; runs: Record<string, unknown>[]; nextCursor: string | null }
  | { type: "BUFFER_RUN"; run: Record<string, unknown> }
  | { type: "UPDATE_RUN"; runId: string; update: Partial<Record<string, unknown>> }
  | { type: "LOAD_MORE"; runs: Record<string, unknown>[]; nextCursor: string | null }
  | { type: "FLUSH_BUFFERED" };

function runsReducer(state: RunsState, action: RunsAction): RunsState {
  switch (action.type) {
    case "SET_RUNS":
      return { runs: action.runs, nextCursor: action.nextCursor, bufferedNewRuns: [] };
    case "BUFFER_RUN":
      return { ...state, bufferedNewRuns: [action.run, ...state.bufferedNewRuns] };
    case "UPDATE_RUN":
      return {
        ...state,
        runs: state.runs.map((r) =>
          String(r.id) === action.runId ? { ...r, ...action.update } : r,
        ),
        bufferedNewRuns: state.bufferedNewRuns.map((r) =>
          String(r.id) === action.runId ? { ...r, ...action.update } : r,
        ),
      };
    case "LOAD_MORE":
      return { ...state, runs: [...state.runs, ...action.runs], nextCursor: action.nextCursor };
    case "FLUSH_BUFFERED":
      return {
        runs: [...state.bufferedNewRuns, ...state.runs],
        nextCursor: state.nextCursor,
        bufferedNewRuns: [],
      };
    default:
      return state;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface FlowPanelUIProps {
  config: FlowPanelConfig;
  trpcBaseUrl?: string;
  showDemoBanner?: boolean;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = (await res.json()) as { result: { data: T } };
  return json.result.data;
}

export function FlowPanelUI({
  config,
  trpcBaseUrl = "/api/trpc",
  showDemoBanner = false,
}: FlowPanelUIProps) {
  const theme = resolveTheme(config);
  const themeStyle = themeToStyle(theme);

  // ── UI state ──────────────────────────────────────────────────────────────
  const firstTabId = config.tabs?.[0]?.id ?? "pipeline";
  const [activeTab, setActiveTab] = useState(firstTabId);
  const [timeRange, setTimeRange] = useState(config.timeRange?.default ?? "24h");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [drawerState, setDrawerState] = useState<{
    open: boolean;
    type: string;
    runId?: string;
  }>({ open: false, type: "" });
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();

  // ── Server state ──────────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<Record<string, unknown>>({});
  const [stageData, setStageData] = useState<
    Array<{
      stage: string;
      total: number;
      succeeded: number;
      failed: number;
      running: number;
      avgDurationMs: number | null;
    }>
  >([]);
  const [runsState, dispatchRuns] = useReducer(runsReducer, {
    runs: [],
    nextCursor: null,
    bufferedNewRuns: [],
  });
  const [loading, setLoading] = useState(true);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsData, stagesData, runsData] = await Promise.all([
        fetchJson<Record<string, unknown>>(
          `${trpcBaseUrl}/flowpanel.metrics.current?input=${encodeURIComponent(
            JSON.stringify({ timeRange }),
          )}`,
        ),
        fetchJson<
          Array<{
            stage: string;
            total: number;
            succeeded: number;
            failed: number;
            running: number;
            avgDurationMs: number | null;
          }>
        >(
          `${trpcBaseUrl}/flowpanel.stages.breakdown?input=${encodeURIComponent(
            JSON.stringify({ timeRange }),
          )}`,
        ),
        fetchJson<{
          runs: Record<string, unknown>[];
          nextCursor: string | null;
        }>(
          `${trpcBaseUrl}/flowpanel.runs.list?input=${encodeURIComponent(
            JSON.stringify({ timeRange, stage: selectedStage, limit: 50 }),
          )}`,
        ),
      ]);
      setMetrics(metricsData);
      setStageData(stagesData);
      dispatchRuns({
        type: "SET_RUNS",
        runs: runsData.runs,
        nextCursor: runsData.nextCursor,
      });
    } catch (err) {
      console.error("[FlowPanel] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [trpcBaseUrl, timeRange, selectedStage]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── SSE stream ────────────────────────────────────────────────────────────
  const { status: liveStatus } = useFlowPanelStream({
    url: `${trpcBaseUrl}/flowpanel.stream.connect`,
    onEvent: useCallback((event) => {
      if (event.event === "run.created") {
        dispatchRuns({ type: "BUFFER_RUN", run: event.data as Record<string, unknown> });
        setLiveAnnouncement("New run started");
      } else if (event.event === "run.finished" || event.event === "run.failed") {
        const data = event.data as Record<string, unknown>;
        dispatchRuns({
          type: "UPDATE_RUN",
          runId: String(data.id),
          update: { status: data.status, duration_ms: data.durationMs },
        });
        if (event.event === "run.failed") setLiveAnnouncement("Run failed");
      } else if (event.event === "metrics.updated") {
        setMetrics(event.data as Record<string, unknown>);
      }
    }, []),
  });

  // ── Load more ─────────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(async () => {
    if (!runsState.nextCursor) return;
    try {
      const data = await fetchJson<{
        runs: Record<string, unknown>[];
        nextCursor: string | null;
      }>(
        `${trpcBaseUrl}/flowpanel.runs.list?input=${encodeURIComponent(
          JSON.stringify({
            timeRange,
            stage: selectedStage,
            limit: 50,
            cursor: runsState.nextCursor,
          }),
        )}`,
      );
      dispatchRuns({ type: "LOAD_MORE", runs: data.runs, nextCursor: data.nextCursor });
    } catch (err) {
      console.error("[FlowPanel] load more error:", err);
    }
  }, [trpcBaseUrl, timeRange, selectedStage, runsState.nextCursor]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const tabs: TabConfig[] = config.tabs?.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
  })) ?? [{ id: "pipeline", label: "Pipeline" }];

  useKeyboard([
    {
      key: "k",
      meta: true,
      handler: () => setPaletteOpen(true),
      description: "Open command palette",
    },
    { key: "1", handler: () => setActiveTab(tabs[0]?.id ?? "pipeline") },
    {
      key: "2",
      handler: () => {
        if (tabs[1]) setActiveTab(tabs[1].id);
      },
    },
    {
      key: "3",
      handler: () => {
        if (tabs[2]) setActiveTab(tabs[2].id);
      },
    },
    {
      key: "?",
      shift: true,
      handler: () => setKeyboardHelpOpen(true),
      description: "Show keyboard shortcuts",
    },
    {
      key: "Escape",
      handler: () => {
        if (keyboardHelpOpen) setKeyboardHelpOpen(false);
        else if (drawerState.open) setDrawerState({ open: false, type: "" });
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
      label: "Clear filters",
      action: () => setSelectedStage(null),
      category: "Filters",
    },
    {
      id: "refresh",
      label: "Refresh data",
      action: () => void fetchData(),
      category: "Data",
      shortcut: "⌘R",
    },
    ...timePresets.map((preset) => ({
      id: `time-${preset}`,
      label: `Set time range: ${preset}`,
      action: () => setTimeRange(preset),
      category: "Time Range",
    })),
  ];

  // ── Drawer title ──────────────────────────────────────────────────────────
  const drawerConfigEntry = config.drawers?.[drawerState.type] as
    | { title?: string | ((...args: unknown[]) => string) }
    | undefined;
  const drawerTitle =
    drawerState.type === "runDetail"
      ? `Run ${drawerState.runId ?? ""}`
      : typeof drawerConfigEntry?.title === "string"
        ? drawerConfigEntry.title
        : drawerState.type || "Details";

  // ── Onboarding: show when no runs and not loading ─────────────────────────
  const showOnboarding = !loading && runsState.runs.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  const colorScheme = config.theme?.colorScheme ?? "auto";
  const rootClassName = [
    "fp-root",
    colorScheme === "dark" ? "fp-dark" : "",
    colorScheme === "light" ? "fp-light" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ToastProvider>
      <div
        className={rootClassName}
        style={{ ...themeStyle, minHeight: "100vh" }}
        data-testid="fp-root"
      >
        {/* Skip link for accessibility */}
        <a
          href="#fp-main"
          style={{ position: "absolute", left: -9999, top: 0, zIndex: 100 }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.left = "0";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.left = "-9999px";
          }}
        >
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

        {showDemoBanner && (
          <DemoBanner
            runCount={runsState.runs.length}
            realRunCount={0}
            onClear={() => {
              void fetchData();
            }}
          />
        )}

        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        <main id="fp-main" style={{ padding: "24px" }}>
          {activeTab === "pipeline" && (
            <>
              {/* Metrics strip */}
              <ErrorBoundary>
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
                        ((metrics[name] as { value?: unknown } | undefined)?.value ?? null) as
                          | string
                          | number
                          | null
                      }
                      loading={loading}
                      hasDrawer={!!mc.drawer}
                      onClick={
                        mc.drawer
                          ? () => setDrawerState({ open: true, type: mc.drawer! })
                          : undefined
                      }
                    />
                  ))}
                </section>
              </ErrorBoundary>

              {/* Stage cards */}
              {stageData.length > 0 && (
                <ErrorBoundary>
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
                          loading={loading}
                          onClick={() =>
                            setSelectedStage((prev) => (prev === s.stage ? null : s.stage))
                          }
                        />
                      ))}
                    </div>
                  </section>
                </ErrorBoundary>
              )}

              {/* Onboarding or Run log */}
              <ErrorBoundary>
                {showOnboarding && stageData.length === 0 ? (
                  <section aria-label="Getting started">
                    <div
                      className="fp-card"
                      style={{
                        padding: "32px 24px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "var(--fp-text-1)",
                          marginBottom: 8,
                        }}
                      >
                        Get started with FlowPanel
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--fp-text-3)",
                          marginBottom: 16,
                        }}
                      >
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
                      >
                        {`import { withRun } from "@flowpanel/core";

await withRun({ stage: "parse", partitionKey: "doc-1" }, async (run) => {
  // your pipeline logic
  run.setMeta({ tokens: 420 });
});`}
                      </pre>
                    </div>
                  </section>
                ) : (
                  <section aria-label="Run log">
                    <SectionHeader
                      label="Run Log"
                      meta={
                        runsState.runs.length > 0 && !loading
                          ? `${runsState.runs.length.toLocaleString()} total`
                          : undefined
                      }
                    />
                    <div className="fp-card" style={{ overflow: "hidden" }}>
                      <RunTable
                        runs={runsState.runs}
                        columns={runLogColumns}
                        stageColors={theme.stageColors}
                        loading={loading}
                        hasNextPage={!!runsState.nextCursor}
                        onLoadMore={handleLoadMore}
                        newRunsBanner={
                          runsState.bufferedNewRuns.length > 0
                            ? runsState.bufferedNewRuns.length
                            : undefined
                        }
                        onScrollToTop={() => dispatchRuns({ type: "FLUSH_BUFFERED" })}
                        onRowClick={(run) => {
                          setSelectedRunId(String(run.id));
                          setDrawerState({
                            open: true,
                            type: "runDetail",
                            runId: String(run.id),
                          });
                        }}
                        selectedRunId={selectedRunId}
                      />
                    </div>
                  </section>
                )}
              </ErrorBoundary>
            </>
          )}

          {/* Non-pipeline tabs */}
          {activeTab !== "pipeline" &&
            (() => {
              const tabConfig = tabs.find((t) => t.id === activeTab);
              return (
                <div
                  id={`fp-tabpanel-${activeTab}`}
                  role="tabpanel"
                  aria-labelledby={`fp-tab-${activeTab}`}
                  style={{
                    color: "var(--fp-text-3)",
                    padding: 40,
                    textAlign: "center",
                  }}
                >
                  {tabConfig?.label ?? activeTab} view — coming soon
                </div>
              );
            })()}
        </main>

        {/* Drawers */}
        <Drawer
          open={drawerState.open}
          onClose={() => setDrawerState({ open: false, type: "" })}
          title={drawerTitle}
        >
          <div style={{ color: "var(--fp-text-3)", fontSize: 13 }}>
            {drawerState.type === "runDetail"
              ? `Run details for ${drawerState.runId}`
              : "Loading drawer content..."}
          </div>
        </Drawer>

        {/* Command palette */}
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          commands={builtinCommands}
        />

        {/* Keyboard help */}
        <KeyboardHelp open={keyboardHelpOpen} onClose={() => setKeyboardHelpOpen(false)} />

        {/* ARIA live region */}
        <div
          role="status"
          aria-live="assertive"
          aria-atomic="true"
          style={{
            position: "absolute",
            left: -9999,
            width: 1,
            height: 1,
            overflow: "hidden",
          }}
        >
          {liveAnnouncement}
        </div>

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
      </div>
    </ToastProvider>
  );
}
