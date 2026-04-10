import React from "react";

interface StatGridSectionProps {
	data: Record<string, unknown>;
	columns?: number;
}

function formatLabel(key: string): string {
	return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(ms: unknown): string {
	const n = Number(ms);
	if (isNaN(n)) return String(ms);
	if (n < 1000) return `${Math.round(n)}ms`;
	return `${(n / 1000).toFixed(1)}s`;
}

const DURATION_KEYS = new Set([
	"duration",
	"duration_ms",
	"avg_duration",
	"p95_duration",
	"p50_duration",
	"avg_duration_ms",
	"p95_duration_ms",
]);

const STATUS_COLORS: Record<string, string> = {
	succeeded: "var(--fp-ok)",
	failed: "var(--fp-err)",
	running: "var(--fp-warn)",
};

function formatValue(key: string, value: unknown): { text: string; color?: string } {
	if (DURATION_KEYS.has(key) && value != null) {
		return { text: formatDuration(value) };
	}
	const str = String(value ?? "—");
	const color = STATUS_COLORS[str.toLowerCase()];
	return { text: str, color };
}

export function StatGridSection({ data, columns = 3 }: StatGridSectionProps) {
	const entries = Object.entries(data ?? {});

	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: `repeat(${columns}, 1fr)`,
				gap: 8,
			}}
		>
			{entries.map(([key, value]) => {
				const { text, color } = formatValue(key, value);
				return (
					<div
						key={key}
						style={{
							background: "var(--fp-surface-2)",
							border: "1px solid var(--fp-border-1)",
							borderRadius: 8,
							padding: "10px 12px",
							display: "flex",
							flexDirection: "column",
							gap: 4,
						}}
					>
						<span
							style={{
								fontSize: 11,
								color: "var(--fp-text-4)",
								textTransform: "capitalize",
								letterSpacing: "0.02em",
							}}
						>
							{formatLabel(key)}
						</span>
						<span
							style={{
								fontSize: 15,
								fontWeight: 600,
								color: color ?? "var(--fp-text-1)",
								lineHeight: 1.2,
							}}
						>
							{text}
						</span>
					</div>
				);
			})}
		</div>
	);
}
