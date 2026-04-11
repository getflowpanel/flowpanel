import React, { useState } from "react";
import { ActivitySection } from "./ActivitySection.js";
import { MetricsStrip } from "./MetricsStrip.js";
import { RunLogSection } from "./RunLogSection.js";
import { StageCards } from "./StageCards.js";

interface PipelineViewProps {
  timeRange: string;
  onOpenDrawer: (type: string, runId?: string) => void;
}

export function PipelineView({ timeRange, onOpenDrawer }: PipelineViewProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  return (
    <div id="fp-tabpanel-pipeline" role="tabpanel" aria-labelledby="fp-tab-pipeline">
      <MetricsStrip timeRange={timeRange} onOpenDrawer={onOpenDrawer} />
      <StageCards
        timeRange={timeRange}
        selectedStage={selectedStage}
        onStageSelect={setSelectedStage}
      />
      <ActivitySection timeRange={timeRange} />
      <RunLogSection
        timeRange={timeRange}
        selectedStage={selectedStage}
        onOpenDrawer={onOpenDrawer}
      />
    </div>
  );
}
