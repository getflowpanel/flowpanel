import type { FlowPanelConfig } from "@flowpanel/core";
import type React from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ErrorPanel } from "../components/ErrorPanel";
import { MetricCard } from "../components/MetricCard";
import { RunChart } from "../components/RunChart";
import type { RunLogColumn } from "../components/RunTable";
import { RunTable } from "../components/RunTable";
import { SectionHeader } from "../components/SectionHeader";
import { StageCard } from "../components/StageCard";
import type { MetricResult, useFlowPanelData } from "../hooks/useFlowPanelData";
import type { resolveTheme } from "../theme/index";

export interface PipelineSectionProps {
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

export function PipelineSection({
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
