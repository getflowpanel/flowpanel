import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useFlowPanelConfig } from "../context.js";
import { useTRPCClient } from "../hooks/trpc.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { MetricCard } from "./MetricCard.js";

interface MetricsStripProps {
  timeRange: string;
  onOpenDrawer: (type: string) => void;
}

export function MetricsStrip({ timeRange, onOpenDrawer }: MetricsStripProps) {
  const config = useFlowPanelConfig();
  const client = useTRPCClient();

  const { data: metrics, isLoading } = useQuery({
    queryKey: [["flowpanel", "metrics", "getAll"], { timeRange }],
    queryFn: () => (client as any).flowpanel.metrics.getAll.query({ timeRange }),
  });

  const metricsConfig = config.metrics ?? {};

  return (
    <ErrorBoundary>
      <section
        aria-label="Metrics"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {Object.entries(metricsConfig).map(([name, mc]) => (
          <MetricCard
            key={name}
            label={mc.label}
            value={
              (((metrics as any)?.[name] as { value?: unknown } | undefined)?.value as
                | string
                | number
                | null) ?? null
            }
            loading={isLoading}
            hasDrawer={!!mc.drawer}
            onClick={mc.drawer ? () => onOpenDrawer(mc.drawer!) : undefined}
          />
        ))}
      </section>
    </ErrorBoundary>
  );
}
