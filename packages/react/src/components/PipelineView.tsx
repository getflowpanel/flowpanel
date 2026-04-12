import React from "react";
import type { ViewState } from "../hooks/useViewState.js";
import { ActivitySection } from "./ActivitySection.js";
import { MetricsStrip } from "./MetricsStrip.js";
import { RunLogSection } from "./RunLogSection.js";
import { StageCards } from "./StageCards.js";

interface PipelineViewProps {
  timeRange: string;
  viewState: ViewState;
  onOpenDrawer: (type: string, runId?: string) => void;
  onStageSelect: (stage: string | null) => void;
  onStatusFilter: (status: string | null) => void;
  onSearch: (query: string) => void;
  onRunIdsChange?: (ids: string[]) => void;
}

export function PipelineView({
  timeRange,
  viewState,
  onOpenDrawer,
  onStageSelect,
  onStatusFilter,
  onSearch,
  onRunIdsChange,
}: PipelineViewProps) {
  return (
    <div id="fp-tabpanel-pipeline" role="tabpanel" aria-labelledby="fp-tab-pipeline">
      <MetricsStrip timeRange={timeRange} onOpenDrawer={onOpenDrawer} />
      <StageCards
        timeRange={timeRange}
        selectedStage={viewState.stage}
        onStageSelect={onStageSelect}
      />
      <ActivitySection timeRange={timeRange} />
      <RunLogSection
        timeRange={timeRange}
        selectedStage={viewState.stage}
        statusFilter={viewState.status}
        searchQuery={viewState.search}
        onOpenDrawer={onOpenDrawer}
        onSearch={onSearch}
        onStatusFilter={onStatusFilter}
        onRunIdsChange={onRunIdsChange}
      />
    </div>
  );
}
