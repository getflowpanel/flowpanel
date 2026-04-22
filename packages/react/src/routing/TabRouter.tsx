import type { FlowPanelConfig, FlowPanelPage } from "@flowpanel/core";
import type React from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import type { RunLogColumn } from "../components/RunTable";
import { DashboardPage } from "../dashboard/DashboardPage";
import type { useFlowPanelData } from "../hooks/useFlowPanelData";
import { QueuePage } from "../queue/QueuePage";
import { ResourcePage } from "../resource/ResourcePage";
import { PipelineSection } from "../sections/PipelineSection";
import type { AdminSchema } from "../state/useAdminSchema";
import type { resolveTheme } from "../theme/index";
import { scopeRenderers } from "../utils/scopeRenderers";

export interface TabRouterProps {
  activeTab: string;
  firstTabId: string;
  config: FlowPanelConfig;
  schema: AdminSchema;
  pages?: readonly FlowPanelPage[];
  baseUrl: string;
  theme: ReturnType<typeof resolveTheme>;
  timeRange: string;
  data: ReturnType<typeof useFlowPanelData>;
  runLogColumns: RunLogColumn[];
  selectedStage: string | null;
  setSelectedStage: React.Dispatch<React.SetStateAction<string | null>>;
  openRunDetail: (id: string | number) => void;
  openMetricDrawer: (name: string) => void;
  selectedRunId?: string | null | undefined;
  columnRenderers?: Record<
    string,
    (value: unknown, row: Record<string, unknown>) => React.ReactNode
  >;
  fieldRenderers?: Record<
    string,
    (props: {
      name: string;
      value: unknown;
      onChange: (next: unknown) => void;
      error?: string;
    }) => React.ReactNode
  >;
}

/**
 * Dispatch the visible content based on `activeTab`. Encapsulates the
 * routing matrix so `FlowPanelUI` stays focused on orchestration.
 */
export function TabRouter({
  activeTab,
  firstTabId,
  config,
  schema,
  pages,
  baseUrl,
  theme,
  timeRange,
  data,
  runLogColumns,
  selectedStage,
  setSelectedStage,
  openRunDetail,
  openMetricDrawer,
  selectedRunId,
  columnRenderers,
  fieldRenderers,
}: TabRouterProps) {
  if (activeTab === "dashboard" && schema.dashboardWidgets.length > 0) {
    return (
      <ErrorBoundary>
        <DashboardPage widgets={schema.dashboardWidgets} baseUrl={baseUrl} />
      </ErrorBoundary>
    );
  }

  if (activeTab === firstTabId && activeTab !== "dashboard") {
    return (
      <PipelineSection
        config={config}
        theme={theme}
        metrics={data.metrics}
        stageData={data.stageData}
        runs={data.runsState}
        dispatchRuns={data.dispatchRuns}
        loading={data.loading}
        chartData={data.chartData}
        topErrors={data.topErrors}
        loadMore={data.loadMore}
        selectedStage={selectedStage}
        setSelectedStage={setSelectedStage}
        runLogColumns={runLogColumns}
        openRunDetail={openRunDetail}
        selectedRunId={selectedRunId}
        openMetricDrawer={openMetricDrawer}
      />
    );
  }

  if (activeTab.startsWith("resource:")) {
    const resourceKey = activeTab.slice("resource:".length);
    const resource = schema.resourceMap[resourceKey];
    if (!resource) return null;
    const scopedColumnRenderers = scopeRenderers(columnRenderers, resourceKey);
    const scopedFieldRenderers = scopeRenderers(fieldRenderers, resourceKey);
    return (
      <ErrorBoundary>
        <ResourcePage
          resource={resource}
          baseUrl={baseUrl}
          columnRenderers={scopedColumnRenderers}
          fieldRenderers={scopedFieldRenderers}
        />
      </ErrorBoundary>
    );
  }

  if (activeTab.startsWith("queue:")) {
    const queueKey = activeTab.slice("queue:".length);
    const queue = schema.queueMap[queueKey];
    if (!queue) return null;
    return (
      <ErrorBoundary>
        <QueuePage queue={queue} baseUrl={baseUrl} />
      </ErrorBoundary>
    );
  }

  if (activeTab.startsWith("page:")) {
    const pageId = activeTab.slice("page:".length);
    const page = pages?.find((p) => p.path === pageId);
    if (!page || !page.component) {
      return (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <div className="mb-2">Page &ldquo;{pageId}&rdquo; not found.</div>
          <div className="text-xs">
            Make sure the page is declared in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">
              defineFlowPanel({"{ pages: [...] }"})
            </code>{" "}
            and passed to{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">
              &lt;FlowPanelUI pages={"{pages}"} /&gt;
            </code>
            .
          </div>
        </div>
      );
    }
    const PageComponent = page.component as React.ComponentType<{
      config: FlowPanelConfig;
    }>;
    return (
      <ErrorBoundary>
        <PageComponent config={config} />
      </ErrorBoundary>
    );
  }

  // User-defined custom tab (beyond the first)
  const tabEntry = config.tabs?.find((t) => t.id === activeTab);
  if (tabEntry?.component) {
    const TabComponent = tabEntry.component as React.ComponentType<{
      config: FlowPanelConfig;
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
        Add a <code className="rounded bg-muted px-1 py-0.5 text-foreground">component</code> to
        this tab in your flowpanel.config.ts
      </div>
    </div>
  );
}
