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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlowPanelUIProps {
  config: FlowPanelConfig;
  trpcBaseUrl?: string;
  showDemoBanner?: boolean;
}

// ─── Inner (rendered inside Provider) ─────────────────────────────────────────

function FlowPanelInner({ config, trpcBaseUrl, showDemoBanner = false }: FlowPanelUIProps) {
  const sseUrl = `${trpcBaseUrl}/flowpanel.stream.connect`;
  const { status: liveStatus } = useFlowPanelSSE(sseUrl);

  const firstTabId = config.tabs?.[0]?.id ?? "pipeline";
  const [activeTab, setActiveTab] = useState(firstTabId);
  const [timeRange, setTimeRange] = useState(config.timeRange?.default ?? "24h");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [drawerState, setDrawerState] = useState<{
    open: boolean;
    type: string;
    runId?: string;
  }>({ open: false, type: "" });

  const tabs: TabConfig[] = config.tabs?.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
  })) ?? [{ id: "pipeline", label: "Pipeline" }];

  const timePresets = config.timeRange?.presets ?? ["1h", "6h", "24h", "7d", "30d"];

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
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

  // ── Commands ────────────────────────────────────────────────────────────
  const builtinCommands: Command[] = [
    { id: "clear-filters", label: "Clear filters", action: () => {}, category: "Filters" },
    { id: "refresh", label: "Refresh data", action: () => {}, category: "Data", shortcut: "⌘R" },
    ...timePresets.map((preset) => ({
      id: `time-${preset}`,
      label: `Set time range: ${preset}`,
      action: () => setTimeRange(preset),
      category: "Time Range",
    })),
  ];

  // ── Drawer title ────────────────────────────────────────────────────────
  const drawerConfigEntry = config.drawers?.[drawerState.type] as
    | { title?: string | ((...args: unknown[]) => string) }
    | undefined;
  const drawerTitle =
    drawerState.type === "runDetail"
      ? `Run ${drawerState.runId ?? ""}`
      : typeof drawerConfigEntry?.title === "string"
        ? drawerConfigEntry.title
        : drawerState.type || "Details";

  const handleOpenDrawer = (type: string, runId?: string) => {
    setDrawerState({ open: true, type, runId });
  };

  return (
    <>
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

      {showDemoBanner && <DemoBanner runCount={0} realRunCount={0} onClear={() => {}} />}

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <main id="fp-main" style={{ padding: "24px" }}>
        {activeTab === "pipeline" && (
          <PipelineView timeRange={timeRange} onOpenDrawer={handleOpenDrawer} />
        )}

        {activeTab !== "pipeline" &&
          (() => {
            const tabEntry = config.tabs?.find((t) => t.id === activeTab);
            if (tabEntry && (tabEntry as any).component) {
              const TabComponent = (tabEntry as any).component as React.ComponentType<{
                config: typeof config;
                timeRange: string;
              }>;
              return (
                <div
                  id={`fp-tabpanel-${activeTab}`}
                  role="tabpanel"
                  aria-labelledby={`fp-tab-${activeTab}`}
                >
                  <TabComponent config={config} timeRange={timeRange} />
                </div>
              );
            }
            return (
              <div
                id={`fp-tabpanel-${activeTab}`}
                role="tabpanel"
                aria-labelledby={`fp-tab-${activeTab}`}
                style={{ color: "var(--fp-text-3)", padding: 40, textAlign: "center" }}
              >
                Configure <code>component</code> in tabs config to render this tab.
              </div>
            );
          })()}
      </main>

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

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={builtinCommands}
      />
      <KeyboardHelp open={keyboardHelpOpen} onClose={() => setKeyboardHelpOpen(false)} />
      <StatusOverlays liveStatus={liveStatus} />
    </>
  );
}

// ─── Outer (wraps in Provider) ────────────────────────────────────────────────

export function FlowPanelUI({
  config,
  trpcBaseUrl = "/api/trpc",
  showDemoBanner = false,
}: FlowPanelUIProps) {
  return (
    <ToastProvider>
      <FlowPanelProvider config={config} trpcBaseUrl={trpcBaseUrl}>
        <FlowPanelInner config={config} trpcBaseUrl={trpcBaseUrl} showDemoBanner={showDemoBanner} />
      </FlowPanelProvider>
    </ToastProvider>
  );
}
