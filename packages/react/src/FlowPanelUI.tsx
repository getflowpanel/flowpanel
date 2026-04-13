import type { FlowPanelConfig } from "@flowpanel/core";
import type React from "react";
import { useCallback, useState } from "react";
import type { Command } from "./components/CommandPalette";
import { CommandPalette } from "./components/CommandPalette";
import { DemoBanner } from "./components/DemoBanner";
import { Drawer } from "./components/Drawer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ErrorPanel } from "./components/ErrorPanel";
import { Header } from "./components/Header";
import { KeyboardHelp } from "./components/KeyboardHelp";
import { MetricCard } from "./components/MetricCard";
import { RunChart } from "./components/RunChart";
import type { RunLogColumn } from "./components/RunTable";
import { RunTable } from "./components/RunTable";
import { SectionHeader } from "./components/SectionHeader";
import { StageCard } from "./components/StageCard";
import type { TabConfig } from "./components/Tabs";
import { Tabs } from "./components/Tabs";
import { ToastProvider } from "./components/Toast";
import { FlowPanelContext } from "./context";
import { useDrawerState } from "./hooks/useDrawerState";
import type { MetricResult } from "./hooks/useFlowPanelData";
import { useFlowPanelData } from "./hooks/useFlowPanelData";
import { useFlowPanelLive } from "./hooks/useFlowPanelLive";
import { useKeyboard } from "./hooks/useKeyboard";
import { useLocale } from "./locale/LocaleContext";
import { resolveTheme, themeToStyle } from "./theme/index";

// ─── Main Component ───────────────────────────────────────────────────────────

export interface FlowPanelUIProps {
  config: FlowPanelConfig;
  trpcBaseUrl?: string;
  showDemoBanner?: boolean;
}

/**
 * Main dashboard component. Renders the full FlowPanel admin UI.
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
      // Metrics are updated via the data hook's internal state — trigger a refresh
      void refresh();
    },
    [refresh],
  );

  const { status: liveStatus, liveAnnouncement } = useFlowPanelLive({
    streamUrl: `${trpcBaseUrl}/flowpanel.stream.connect`,
    dispatchRuns,
    onMetricsUpdate: setMetricsDirect,
  });

  // ── Drawer state ──────────────────────────────────────────────────────────
  const drawer = useDrawerState({ config, baseUrl: trpcBaseUrl, allRuns: runsState.runs });

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
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ToastProvider>
      <FlowPanelContext.Provider value={{ timezone: config.timezone ?? "UTC" }}>
        <div
          className="fp-root"
          style={{ ...themeStyle, minHeight: "100vh" }}
          data-testid="fp-root"
        >
          <ErrorBoundary>
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
              {locale.skipToMain}
            </a>

            <Header
              appName={config.appName}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              timeRangePresets={timePresets}
              liveStatus={liveStatus}
              onOpenPalette={() => setPaletteOpen(true)}
            />

            {showDemoBanner && (
              <DemoBanner runCount={runsState.runs.length} realRunCount={0} onClear={resetDemo} />
            )}

            <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

            <main id="fp-main" style={{ padding: "24px" }}>
              {/* Error state */}
              {error && !loading && (
                <div
                  role="alert"
                  style={{
                    padding: "16px 20px",
                    marginBottom: 24,
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 8,
                    color: "var(--fp-err, #ef4444)",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>
                    {locale.serverError}: {error}
                  </span>
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    style={{
                      padding: "6px 14px",
                      background: "rgba(239,68,68,0.15)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      borderRadius: 6,
                      color: "inherit",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {locale.retry}
                  </button>
                </div>
              )}

              {/* Hidden placeholder panels for inactive tabs (required for aria-controls validity) */}
              {tabs
                .filter((t) => t.id !== activeTab && t.id !== firstTabId)
                .map((t) => (
                  <div
                    key={t.id}
                    id={`fp-tabpanel-${t.id}`}
                    role="tabpanel"
                    aria-labelledby={`fp-tab-${t.id}`}
                    hidden
                  />
                ))}
              {activeTab !== firstTabId && (
                <div
                  id={`fp-tabpanel-${firstTabId}`}
                  role="tabpanel"
                  aria-labelledby={`fp-tab-${firstTabId}`}
                  hidden
                />
              )}

              {activeTab === firstTabId && (
                <div
                  id={`fp-tabpanel-${firstTabId}`}
                  role="tabpanel"
                  aria-labelledby={`fp-tab-${firstTabId}`}
                >
                  <>
                    {/* Metrics strip */}
                    <ErrorBoundary>
                      <section aria-label="Metrics" style={{ marginBottom: 24 }}>
                        <SectionHeader
                          label="Overview"
                          meta={loading ? undefined : "Last updated just now"}
                        />
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: 10,
                          }}
                        >
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
                                onClick={
                                  mc.drawer ? () => drawer.openDrawer(mc.drawer ?? "") : undefined
                                }
                              />
                            );
                          })}
                        </div>
                      </section>
                    </ErrorBoundary>

                    {/* Stage cards */}
                    {stageData.length > 0 &&
                      (() => {
                        const totalAllStages = stageData.reduce((s, d) => s + d.total, 0);
                        return (
                          <ErrorBoundary>
                            <section aria-label="Pipeline stages" style={{ marginBottom: 24 }}>
                              <SectionHeader
                                label="Pipeline Stages"
                                meta="Click to filter runs below"
                              />
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                  gap: 10,
                                }}
                              >
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
                                      setSelectedStage((prev) =>
                                        prev === s.stage ? null : s.stage,
                                      )
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
                        <section aria-label="Errors" style={{ marginBottom: 24 }}>
                          <SectionHeader label="Errors" meta={`${topErrors.totalFailed} failed`} />
                          <ErrorPanel
                            errors={topErrors.errors}
                            totalFailed={topErrors.totalFailed}
                            loading={loading}
                            onRetryAll={() => {}}
                            onErrorClick={(_errorClass) => {
                              setSelectedStage(null);
                            }}
                          />
                        </section>
                      </ErrorBoundary>
                    )}

                    {/* Run volume chart */}
                    {chartData && chartData.buckets.length > 0 && (
                      <ErrorBoundary>
                        <section aria-label="Run volume" style={{ marginBottom: 24 }}>
                          <SectionHeader label="Run Volume" />
                          <div className="fp-card" style={{ padding: 16 }}>
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
                            !loading && runsState.runs.length > 0
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
                            onLoadMore={loadMore}
                            newRunsBanner={
                              runsState.bufferedNewRuns.length > 0
                                ? runsState.bufferedNewRuns.length
                                : undefined
                            }
                            onScrollToTop={() => dispatchRuns({ type: "FLUSH_BUFFERED" })}
                            onRowClick={(run) => {
                              drawer.openDrawer("runDetail", String(run.id));
                            }}
                            selectedRunId={drawer.selectedRunId}
                          />
                        </div>
                      </section>
                    </ErrorBoundary>
                  </>
                </div>
              )}

              {/* Non-pipeline tabs */}
              {activeTab !== firstTabId &&
                (() => {
                  const tabEntry = config.tabs?.find((t) => t.id === activeTab);

                  if (tabEntry?.component) {
                    const TabComponent = tabEntry.component as React.ComponentType<{
                      config: typeof config;
                      timeRange: string;
                    }>;
                    return (
                      <ErrorBoundary>
                        <div
                          id={`fp-tabpanel-${activeTab}`}
                          role="tabpanel"
                          aria-labelledby={`fp-tab-${activeTab}`}
                        >
                          <TabComponent config={config} timeRange={timeRange} />
                        </div>
                      </ErrorBoundary>
                    );
                  }

                  return (
                    <div
                      id={`fp-tabpanel-${activeTab}`}
                      role="tabpanel"
                      aria-labelledby={`fp-tab-${activeTab}`}
                      style={{ color: "var(--fp-text-3)", padding: 40, textAlign: "center" }}
                    >
                      <div style={{ fontSize: 14, marginBottom: 8 }}>
                        No component configured for &ldquo;{tabEntry?.label ?? activeTab}&rdquo;
                      </div>
                      <div style={{ fontSize: 12 }}>
                        Add a <code style={{ color: "var(--fp-accent-text)" }}>component</code> to
                        this tab in your flowpanel.config.ts
                      </div>
                    </div>
                  );
                })()}
            </main>

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
              <div style={{ color: "var(--fp-text-3)", fontSize: 13 }}>
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
                {locale.reconnecting}
              </div>
            )}
          </ErrorBoundary>
        </div>
      </FlowPanelContext.Provider>
    </ToastProvider>
  );
}
