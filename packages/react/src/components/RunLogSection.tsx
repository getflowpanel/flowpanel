import { useInfiniteQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useState } from "react";
import { useFlowPanelConfig } from "../context.js";
import { useTRPCClient } from "../hooks/trpc.js";
import { resolveTheme } from "../theme/index.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import type { RunLogColumn } from "./RunTable.js";
import { RunTable } from "./RunTable.js";
import { SectionHeader } from "./SectionHeader.js";

interface RunLogSectionProps {
  timeRange: string;
  selectedStage: string | null;
  statusFilter: string | null;
  searchQuery: string;
  onOpenDrawer: (type: string, runId?: string) => void;
  onSearch: (query: string) => void;
  onStatusFilter: (status: string | null) => void;
  onRunIdsChange?: (ids: string[]) => void;
}

export function RunLogSection({
  timeRange,
  selectedStage,
  statusFilter,
  searchQuery,
  onOpenDrawer,
  onSearch,
  onStatusFilter,
  onRunIdsChange,
}: RunLogSectionProps) {
  const config = useFlowPanelConfig();
  const client = useTRPCClient();
  const theme = resolveTheme(config);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();

  const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: [
      ["flowpanel", "runs", "list"],
      { timeRange, stage: selectedStage, status: statusFilter, search: searchQuery },
    ],
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      (client as any).flowpanel.runs.list.query({
        timeRange,
        stage: selectedStage ?? undefined,
        status: statusFilter ?? undefined,
        search: searchQuery || undefined,
        limit: 50,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: any) => lastPage.nextCursor ?? undefined,
  });

  const runs = data?.pages.flatMap((page: any) => page.data) ?? [];

  useEffect(() => {
    onRunIdsChange?.(runs.map((r: any) => String(r.id)));
  }, [runs, onRunIdsChange]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage) void fetchNextPage();
  }, [hasNextPage, fetchNextPage]);

  const runLogColumns: RunLogColumn[] = (config.runLog?.columns as RunLogColumn[] | undefined) ?? [
    { field: "id", label: "Run ID", width: 90, mono: true },
    { field: "stage", label: "Stage", width: 72, render: "stagePill" },
    { field: "partition_key", label: "Target", flex: 1 },
    { field: "duration_ms", label: "Duration", width: 80, format: "duration" },
    { field: "status", label: "Status", width: 110, render: "statusTag" },
  ];

  const showOnboarding =
    !isLoading && runs.length === 0 && !selectedStage && !statusFilter && !searchQuery;

  if (showOnboarding) {
    return (
      <ErrorBoundary>
        <section aria-label="Getting started">
          <div className="fp-card" style={{ padding: "32px 24px", textAlign: "center" }}>
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
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <section aria-label="Run log">
        <SectionHeader
          label="Run Log"
          meta={runs.length > 0 && !isLoading ? `${runs.length.toLocaleString()} total` : undefined}
        />
        <div className="fp-card" style={{ overflow: "hidden" }}>
          <RunTable
            runs={runs}
            columns={runLogColumns}
            stageColors={theme.stageColors}
            loading={isLoading}
            hasNextPage={!!hasNextPage}
            onLoadMore={handleLoadMore}
            onRowClick={(run) => {
              setSelectedRunId(String(run.id));
              onOpenDrawer("runDetail", String(run.id));
            }}
            selectedRunId={selectedRunId}
            onSearch={onSearch}
            onStatusFilter={onStatusFilter}
            activeStatusFilter={statusFilter}
          />
        </div>
      </section>
    </ErrorBoundary>
  );
}
