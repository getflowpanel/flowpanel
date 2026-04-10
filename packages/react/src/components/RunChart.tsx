import React from "react";

export interface RunChartBucket {
	label: string;
	total: number;
	succeeded: number;
	failed: number;
}

export interface RunChartProps {
	buckets: RunChartBucket[];
	peakBucket: { label: string; total: number } | null;
	loading?: boolean;
}

function areaPath(values: number[], maxVal: number, w: number, h: number): string {
	if (values.length === 0) return "";
	const step = w / Math.max(values.length - 1, 1);
	let d = `M 0 ${h}`;
	values.forEach((v, i) => {
		d += ` L ${i * step} ${h - (maxVal > 0 ? (v / maxVal) * h : 0)}`;
	});
	d += ` L ${w} ${h} Z`;
	return d;
}

function linePath(values: number[], maxVal: number, w: number, h: number): string {
	if (values.length === 0) return "";
	const step = w / Math.max(values.length - 1, 1);
	return values
		.map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (maxVal > 0 ? (v / maxVal) * h : 0)}`)
		.join(" ");
}

const SVG_W = 760;
const SVG_H = 80;

export function RunChart({ buckets, peakBucket, loading }: RunChartProps) {
	if (loading) {
		return (
			<div
				style={{
					height: 120,
					borderRadius: 6,
					background: "rgba(255,255,255,0.04)",
					animation: "fp-pulse 1.4s ease-in-out infinite",
				}}
				aria-label="Loading chart"
				aria-busy="true"
			/>
		);
	}

	const totals = buckets.map((b) => b.total);
	const succeeded = buckets.map((b) => b.succeeded);
	const maxVal = Math.max(...totals, 1);

	// Find peak bucket index
	let peakIndex = -1;
	if (peakBucket && buckets.length > 0) {
		peakIndex = buckets.findIndex((b) => b.label === peakBucket.label);
		if (peakIndex === -1) {
			// fallback: find by max total
			let maxT = -1;
			buckets.forEach((b, i) => {
				if (b.total > maxT) {
					maxT = b.total;
					peakIndex = i;
				}
			});
		}
	}

	const step = SVG_W / Math.max(buckets.length - 1, 1);
	const peakX = peakIndex >= 0 ? peakIndex * step : -1;
	const peakY =
		peakIndex >= 0 ? SVG_H - (maxVal > 0 ? (totals[peakIndex]! / maxVal) * SVG_H : 0) : 0;

	// X-axis labels: show every Nth label to avoid crowding
	const labelStep = buckets.length > 12 ? Math.ceil(buckets.length / 8) : 1;
	const visibleLabels = buckets
		.map((b, i) => ({ label: b.label, index: i }))
		.filter(({ index }) => index % labelStep === 0 || index === buckets.length - 1);

	return (
		<div>
			{/* Legend */}
			<div
				style={{
					display: "flex",
					gap: 16,
					marginBottom: 8,
					fontSize: 11,
					color: "var(--fp-text-2, #94a3b8)",
					userSelect: "none",
				}}
				aria-hidden="true"
			>
				<span style={{ display: "flex", alignItems: "center", gap: 5 }}>
					<span
						style={{
							width: 8,
							height: 8,
							borderRadius: "50%",
							background: "var(--fp-accent, #818cf8)",
							display: "inline-block",
						}}
					/>
					Runs
				</span>
				<span style={{ display: "flex", alignItems: "center", gap: 5 }}>
					<span
						style={{
							width: 8,
							height: 8,
							borderRadius: "50%",
							background: "var(--fp-ok, #34d399)",
							display: "inline-block",
						}}
					/>
					Succeeded
				</span>
				<span style={{ display: "flex", alignItems: "center", gap: 5 }}>
					<span
						style={{
							width: 8,
							height: 8,
							borderRadius: "50%",
							background: "var(--fp-err, #f87171)",
							display: "inline-block",
						}}
					/>
					Failed
				</span>
			</div>

			{/* SVG Chart */}
			<svg
				viewBox={`0 0 ${SVG_W} ${SVG_H}`}
				width="100%"
				height="80"
				preserveAspectRatio="none"
				aria-label="Run volume chart"
				role="img"
			>
				<defs>
					<linearGradient id="grad-total" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="var(--fp-accent, #818cf8)" stopOpacity="0.3" />
						<stop offset="100%" stopColor="var(--fp-accent, #818cf8)" stopOpacity="0" />
					</linearGradient>
					<linearGradient id="grad-succeeded" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="var(--fp-ok, #34d399)" stopOpacity="0.2" />
						<stop offset="100%" stopColor="var(--fp-ok, #34d399)" stopOpacity="0" />
					</linearGradient>
				</defs>

				{/* Grid lines */}
				<line x1="0" y1="27" x2={SVG_W} y2="27" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
				<line x1="0" y1="54" x2={SVG_W} y2="54" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

				{/* Area fills */}
				<path d={areaPath(totals, maxVal, SVG_W, SVG_H)} fill="url(#grad-total)" />
				<path d={areaPath(succeeded, maxVal, SVG_W, SVG_H)} fill="url(#grad-succeeded)" />

				{/* Stroke lines */}
				<path
					d={linePath(totals, maxVal, SVG_W, SVG_H)}
					fill="none"
					stroke="var(--fp-accent, #818cf8)"
					strokeWidth="1"
				/>
				<path
					d={linePath(succeeded, maxVal, SVG_W, SVG_H)}
					fill="none"
					stroke="var(--fp-ok, #34d399)"
					strokeWidth="1"
				/>

				{/* Peak marker */}
				{peakIndex >= 0 && peakX >= 0 && (
					<>
						<line
							x1={peakX}
							y1="0"
							x2={peakX}
							y2={SVG_H}
							stroke="var(--fp-accent, #818cf8)"
							strokeWidth="1"
							strokeDasharray="3 3"
							opacity="0.6"
						/>
						<text
							x={Math.min(peakX + 4, SVG_W - 40)}
							y="10"
							fill="var(--fp-accent, #818cf8)"
							fontSize="9"
							fontFamily="inherit"
							opacity="0.8"
						>
							peak
						</text>
						<circle cx={peakX} cy={peakY} r="2.5" fill="var(--fp-accent, #818cf8)" opacity="0.8" />
					</>
				)}
			</svg>

			{/* X-axis labels */}
			{buckets.length > 0 && (
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						marginTop: 4,
						fontSize: 10,
						color: "var(--fp-text-3, #64748b)",
						userSelect: "none",
						overflow: "hidden",
					}}
					aria-hidden="true"
				>
					{visibleLabels.map(({ label, index }) => (
						<span key={index} style={{ whiteSpace: "nowrap" }}>
							{label}
						</span>
					))}
				</div>
			)}
		</div>
	);
}
