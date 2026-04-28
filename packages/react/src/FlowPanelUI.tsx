import type { FlowPanelConfig, FlowPanelPage } from "@flowpanel/core";
import type React from "react";
import { useCallback, useState } from "react";
import type { Command } from "./components/CommandPalette";
import { CommandPalette } from "./components/CommandPalette";
import { DemoBanner } from "./components/DemoBanner";
import { Drawer } from "./components/Drawer";
import { KeyboardHelp } from "./components/KeyboardHelp";
import type { RunLogColumn } from "./components/RunTable";
import { FlowPanelContext } from "./context";
import { useDrawerState } from "./hooks/useDrawerState";
import { useFlowPanelData } from "./hooks/useFlowPanelData";
import { useFlowPanelLive } from "./hooks/useFlowPanelLive";
import { useKeyboard } from "./hooks/useKeyboard";
import { FlowPanelErrorBoundary } from "./layout/ErrorBoundary";
import { FlowPanelShell } from "./layout/FlowPanelShell";
import { HeaderControls } from "./layout/HeaderControls";
import { useLocale } from "./locale/LocaleContext";
import { TabRouter } from "./routing/TabRouter";
import { useSidebarNav } from "./routing/useSidebarNav";
import { useAdminSchema } from "./state/useAdminSchema";
import { resolveTheme, themeToClassName, themeToStyle } from "./theme/index";

export interface FlowPanelUIProps {
  config: FlowPanelConfig;
  /**
   * Custom pages shown in the sidebar alongside resources and queues.
   * Each page renders its React component inside the admin shell when active.
   * Pages are declared in `defineFlowPanel({ pages: [...] })` and passed here
   * for client rendering (components can't cross the tRPC wire).
   */
  pages?: readonly FlowPanelPage[];
  /**
   * Per-column cell render overrides, keyed as `"<resource>.<columnId>"`.
   * Takes precedence over the default format-based dispatcher — escape hatch
   * for custom UI without creating a custom column.
   *
   * @example
   *   columnRenderers={{
   *     "user.status": (value, row) => <StatusPill value={value} urgent={row.critical} />
   *   }}
   */
  columnRenderers?: Record<
    string,
    (value: unknown, row: Record<string, unknown>) => React.ReactNode
  >;
  /**
   * Per-field form render overrides, keyed as `"<resource>.<fieldName>"`.
   * Takes precedence over the default type-based dispatcher.
   */
  fieldRenderers?: Record<
    string,
    (props: {
      name: string;
      value: unknown;
      onChange: (next: unknown) => void;
      error?: string;
    }) => React.ReactNode
  >;
  trpcBaseUrl?: string;
  showDemoBanner?: boolean;
  onError?: (error: Error, info: React.ErrorInfo) => void;
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
  pages,
  columnRenderers,
  fieldRenderers,
  trpcBaseUrl = "/api/trpc",
  showDemoBanner = false,
  onError,
}: FlowPanelUIProps) {
  const theme = resolveTheme(config);
  const themeStyle = themeToStyle(theme);
  const locale = useLocale();

  const firstTabId = config.tabs?.[0]?.id ?? "pipeline";
  const [activeTab, setActiveTab] = useState(firstTabId);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [timeRange, setTimeRange] = useState(config.timeRange?.default ?? "24h");

  const data = useFlowPanelData({
    config,
    baseUrl: trpcBaseUrl,
    timeRange,
    selectedStage,
  });
  const { refresh, dispatchRuns, resetDemo, runsState, error, loading } = data;

  const setMetricsDirect = useCallback(
    (_data: Record<string, unknown>) => {
      void refresh();
    },
    [refresh],
  );

  const { status: liveStatus, liveAnnouncement } = useFlowPanelLive({
    // SSE runs via its own route (not tRPC) — see createFlowPanelStreamHandler.
    streamUrl: "/api/flowpanel/stream",
    dispatchRuns,
    onMetricsUpdate: setMetricsDirect,
  });

  const schema = useAdminSchema(trpcBaseUrl);
  const drawer = useDrawerState({ config, baseUrl: trpcBaseUrl, allRuns: runsState.runs });
  const nav = useSidebarNav({ config, schema, pages });

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

  const runLogColumns: RunLogColumn[] = (config.runLog?.columns as RunLogColumn[] | undefined) ?? [
    { field: "id", label: "Run ID", width: 90, mono: true },
    { field: "stage", label: "Stage", width: 72, render: "stagePill" },
    { field: "partition_key", label: "Target", flex: 1 },
    { field: "duration_ms", label: "Duration", width: 80, format: "duration" },
    { field: "status", label: "Status", width: 110, render: "statusTag" },
  ];

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
    ...Object.entries(schema.resourceMap).map(([key, res]) => ({
      id: `go-resource-${key}`,
      label: `Go to ${res.labelPlural}`,
      category: "Resources",
      action: () => setActiveTab(`resource:${key}`),
    })),
  ];

  return (
    <FlowPanelContext.Provider value={{ timezone: config.timezone ?? "UTC" }}>
      <div
        className={`fp-root ${themeToClassName(config.theme?.colorScheme)}`.trim()}
        style={themeStyle}
        data-testid="fp-root"
      >
        <FlowPanelErrorBoundary onError={onError}>
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

            <TabRouter
              activeTab={activeTab}
              firstTabId={firstTabId}
              config={config}
              schema={schema}
              pages={pages}
              baseUrl={trpcBaseUrl}
              theme={theme}
              timeRange={timeRange}
              data={data}
              runLogColumns={runLogColumns}
              selectedStage={selectedStage}
              setSelectedStage={setSelectedStage}
              openRunDetail={(id) => drawer.openDrawer("runDetail", String(id))}
              openMetricDrawer={(name) => drawer.openDrawer(name)}
              selectedRunId={drawer.selectedRunId}
              columnRenderers={columnRenderers}
              fieldRenderers={fieldRenderers}
            />
          </FlowPanelShell>

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

          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            commands={builtinCommands}
          />

          <KeyboardHelp open={keyboardHelpOpen} onClose={() => setKeyboardHelpOpen(false)} />

          <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
            {liveAnnouncement}
          </div>

          {liveStatus === "reconnecting" && (
            <div
              role="status"
              aria-live="polite"
              className="fixed inset-x-0 top-14 z-30 bg-yellow-500 py-2 text-center text-xs font-medium text-black"
            >
              {locale.reconnecting}
            </div>
          )}
        </FlowPanelErrorBoundary>
      </div>
    </FlowPanelContext.Provider>
  );
}
