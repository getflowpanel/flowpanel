import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useTRPCClient } from "../hooks/trpc.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { RunChart } from "./RunChart.js";
import { SectionHeader } from "./SectionHeader.js";

interface ActivitySectionProps {
  timeRange: string;
}

export function ActivitySection({ timeRange }: ActivitySectionProps) {
  const client = useTRPCClient();

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: [["flowpanel", "runs", "chart"], { timeRange }],
    queryFn: () => (client as any).flowpanel.runs.chart.query({ timeRange }),
  });

  const { data: topErrors } = useQuery({
    queryKey: [["flowpanel", "runs", "topErrors"], { timeRange }],
    queryFn: () => (client as any).flowpanel.runs.topErrors.query({ timeRange }),
  });

  return (
    <>
      <ErrorBoundary>
        <section aria-label="Run activity" style={{ marginBottom: 24 }}>
          <SectionHeader label="Activity" />
          <RunChart
            buckets={(chartData as any)?.buckets ?? []}
            peakBucket={(chartData as any)?.peakBucket}
            loading={chartLoading}
          />
        </section>
      </ErrorBoundary>

      {topErrors && (topErrors as any[]).length > 0 && (
        <ErrorBoundary>
          <section aria-label="Top errors" style={{ marginBottom: 24 }}>
            <SectionHeader label="Top Errors" />
            <div className="fp-card" style={{ padding: 16 }}>
              {(topErrors as any[]).map((e: any) => (
                <div
                  key={e.errorClass}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--fp-border-1)",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "#ef4444", fontFamily: "var(--fp-font-mono)" }}>
                    {e.errorClass}
                  </span>
                  <span
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      color: "#ef4444",
                      padding: "2px 8px",
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {e.count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </ErrorBoundary>
      )}
    </>
  );
}
