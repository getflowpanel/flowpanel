import type React from "react";
import { StatGridSection } from "./StatGridSection.js";
import { KvGridSection } from "./KvGridSection.js";
import { TrendChartSection } from "./TrendChartSection.js";
import { BreakdownSection } from "./BreakdownSection.js";
import { ErrorListSection } from "./ErrorListSection.js";
import { ErrorBlockSection } from "./ErrorBlockSection.js";
import { TimelineSection } from "./TimelineSection.js";

const SECTION_RENDERERS: Record<string, React.ComponentType<{ data: any }>> = {
  "stat-grid": StatGridSection as React.ComponentType<{ data: any }>,
  "kv-grid": KvGridSection as React.ComponentType<{ data: any }>,
  "trend-chart": TrendChartSection as React.ComponentType<{ data: any }>,
  breakdown: BreakdownSection as React.ComponentType<{ data: any }>,
  "error-list": ErrorListSection as React.ComponentType<{ data: any }>,
  "error-block": ErrorBlockSection as React.ComponentType<{ data: any }>,
  timeline: TimelineSection as React.ComponentType<{ data: any }>,
};

function ErrorFallback({ error }: { error: string }) {
  return (
    <div
      style={{
        padding: 12,
        fontSize: 12,
        color: "#ef4444",
        background: "rgba(239,68,68,0.08)",
        borderRadius: 6,
        marginBottom: 12,
      }}
    >
      Section error: {error}
    </div>
  );
}

export function renderDrawerSections(
  sections: Array<{ type: string; data: unknown; error?: string }>,
) {
  return sections.map((section, i) => {
    if (section.error) return <ErrorFallback key={i} error={section.error} />;
    const Renderer = SECTION_RENDERERS[section.type];
    if (!Renderer) return null;
    return <Renderer key={i} data={section.data} />;
  });
}

export {
  StatGridSection,
  KvGridSection,
  TrendChartSection,
  BreakdownSection,
  ErrorListSection,
  ErrorBlockSection,
  TimelineSection,
};
