import type React from "react";
import { BreakdownSection } from "./BreakdownSection.js";
import { ErrorBlockSection } from "./ErrorBlockSection.js";
import { ErrorListSection } from "./ErrorListSection.js";
import { KvGridSection } from "./KvGridSection.js";
import { StatGridSection } from "./StatGridSection.js";
import { TimelineSection } from "./TimelineSection.js";
import { TrendChartSection } from "./TrendChartSection.js";

const SECTION_RENDERERS: Record<
	string,
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
	return sections.map((section, i) => {
		if (section.error) return <ErrorFallback key={i} error={section.error} />;
		const Renderer = SECTION_RENDERERS[section.type];
		if (!Renderer) return null;
		return (
			<div key={i} style={{ marginBottom: 16 }}>
				<Renderer data={section.data} run={run} />
			</div>
		);
	});
}
