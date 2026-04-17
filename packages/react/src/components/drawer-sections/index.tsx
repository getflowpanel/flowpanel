import type React from "react";
import { BreakdownSection } from "./BreakdownSection";
import { ErrorBlockSection } from "./ErrorBlockSection";
import { ErrorListSection } from "./ErrorListSection";
import { KvGridSection } from "./KvGridSection";
import { StatGridSection } from "./StatGridSection";
import { TimelineSection } from "./TimelineSection";
import { TrendChartSection } from "./TrendChartSection";

const SECTION_RENDERERS: Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: section data is dynamically typed
  React.ComponentType<{ data: any; run?: Record<string, unknown> }>
> = {
  "stat-grid": StatGridSection,
  "kv-grid": KvGridSection,
  "trend-chart": TrendChartSection,
  breakdown: BreakdownSection,
  "error-list": ErrorListSection,
  "error-block": ErrorBlockSection,
  timeline: TimelineSection,
};

function ErrorFallback({ error }: { error: string }) {
  return (
    <div
      style={{
        padding: 12,
        fontSize: 12,
        color: "var(--fp-text-3)",
        background: "rgba(239,68,68,0.05)",
        borderRadius: 6,
        borderLeft: "2px solid var(--fp-err)",
        marginBottom: 12,
      }}
    >
      Failed to load section: {error}
    </div>
  );
}

export function renderDrawerSections(
  sections: Array<{ type: string; data: unknown; error?: string }>,
  run?: Record<string, unknown>,
) {
  return sections.map((section) => {
    if (section.error) return <ErrorFallback key={`err-${section.type}`} error={section.error} />;
    const Renderer = SECTION_RENDERERS[section.type];
    if (!Renderer) return null;
    return (
      <div key={section.type} style={{ marginBottom: 16 }}>
        <Renderer data={section.data} run={run} />
      </div>
    );
  });
}
