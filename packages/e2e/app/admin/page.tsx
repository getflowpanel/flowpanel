"use client";

import { FlowPanelUI } from "@flowpanel/react";

// Minimal mock config that works without a real DB
const mockConfig = {
  appName: "FlowPanel E2E",
  pipeline: {
    stages: ["parse", "score", "draft", "notify"],
  },
  metrics: {
    totalRuns: { label: "Total runs", drawer: "overview" },
    successRate: { label: "Success rate" },
  },
  drawers: {
    overview: {
      title: "Pipeline Overview",
      sections: [
        { type: "stat-grid" as const },
        { type: "trend-chart" as const },
        { type: "breakdown" as const, groupBy: "stage" as const },
      ],
    },
  },
  timeRange: {
    default: "24h",
    presets: ["1h", "6h", "24h", "7d"],
  },
  tabs: [
    { id: "pipeline", label: "Pipeline", view: "pipeline" as const },
    { id: "users", label: "Users", view: "userList" as const },
  ],
  // biome-ignore lint/suspicious/noExplicitAny: e2e mock config cast
} as any;

export default function AdminPage() {
  return <FlowPanelUI config={mockConfig} trpcBaseUrl="/api/mock" showDemoBanner />;
}
