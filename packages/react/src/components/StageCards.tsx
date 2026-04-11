import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useFlowPanelConfig } from "../context.js";
import { useTRPCClient } from "../hooks/trpc.js";
import { resolveTheme } from "../theme/index.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { SectionHeader } from "./SectionHeader.js";
import { StageCard } from "./StageCard.js";

interface StageCardsProps {
  timeRange: string;
  selectedStage: string | null;
  onStageSelect: (stage: string | null) => void;
}

export function StageCards({ timeRange, selectedStage, onStageSelect }: StageCardsProps) {
  const config = useFlowPanelConfig();
  const client = useTRPCClient();
  const theme = resolveTheme(config);

  const { data: stageData, isLoading } = useQuery({
    queryKey: [["flowpanel", "stages", "summary"], { timeRange }],
    queryFn: () => (client as any).flowpanel.stages.summary.query({ timeRange }),
  });

  if (!stageData || (stageData as any[]).length === 0) return null;

  return (
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
          {(stageData as any[]).map((s: any) => (
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
    </ErrorBoundary>
  );
}
