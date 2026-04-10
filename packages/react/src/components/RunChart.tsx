import React, { useState } from "react";

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
	const [hoverIndex, setHoverIndex] = useState<number | null>(null);
	const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

	const toggleSeries = (key: string) => {
		setHiddenSeries((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	};

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
	const succeededVals = buckets.map((b) => b.succeeded);
	const failedVals = buckets.map((b) => b.failed);
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
		<div style={{ position: "relative", paddingLeft: 32 }}>
			{/* Y-axis labels */}
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					bottom: 24,
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					fontSize: 10,
					color: "var(--fp-text-4, #475569)",
					width: 28,
					textAlign: "right",
					paddingTop: 24,
					paddingBottom: 4,
				}}
			>
				<span>{maxVal}</span>
				<span>{Math.round(maxVal / 2)}</span>
				<span>0</span>
			</div>

			{/* Legend */}
			<div
				style={{
					display: "flex",
					gap: 4,
					marginBottom: 8,
					fontSize: 11,
					color: "var(--fp-text-2, #94a3b8)",
					userSelect: "none",
				}}
				aria-hidden="true"
			>
				{[
					{ key: "total", label: "Runs", color: "var(--fp-accent, #818cf8)" },
					{ key: "succeeded", label: "Succeeded", color: "var(--fp-ok, #34d399)" },
					{ key: "failed", label: "Failed", color: "var(--fp-err, #f87171)" },
				].map((s) => (
					<button
						key={s.key}
						onClick={() => toggleSeries(s.key)}
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 4,
							padding: "2px 8px",
							border: "none",
							background: "none",
							cursor: "pointer",
							fontSize: 11,
							color: "var(--fp-text-2, #94a3b8)",
							opacity: hiddenSeries.has(s.key) ? 0.35 : 1,
							textDecoration: hiddenSeries.has(s.key) ? "line-through" : "none",
						}}
					>
						<span
							style={{
								width: 6,
								height: 6,
								borderRadius: "50%",
								background: s.color,
								display: "inline-block",
							}}
						/>
						{s.label}
					</button>
				))}
			</div>

			{/* SVG Chart + Tooltip */}
			<div style={{ position: "relative" }}>
				<svg
					viewBox={`0 0 ${SVG_W} ${SVG_H}`}
					width="100%"
					height="80"
					preserveAspectRatio="none"
					aria-label="Run volume chart"
					role="img"
					onMouseMove={(e) => {
						const rect = e.currentTarget.getBoundingClientRect();
						const x = e.clientX - rect.left;
						setHoverIndex(
							Math.min(Math.floor((x / rect.width) * buckets.length), buckets.length - 1),
						);
					}}
					onMouseLeave={() => setHoverIndex(null)}
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
					{!hiddenSeries.has("total") && (
						<path d={areaPath(totals, maxVal, SVG_W, SVG_H)} fill="url(#grad-total)" />
					)}
					{!hiddenSeries.has("succeeded") && (
						<path d={areaPath(succeededVals, maxVal, SVG_W, SVG_H)} fill="url(#grad-succeeded)" />
					)}

					{/* Stroke lines */}
					{!hiddenSeries.has("total") && (
						<path
							d={linePath(totals, maxVal, SVG_W, SVG_H)}
							fill="none"
							stroke="var(--fp-accent, #818cf8)"
							strokeWidth="1"
						/>
					)}
					{!hiddenSeries.has("succeeded") && (
						<path
							d={linePath(succeededVals, maxVal, SVG_W, SVG_H)}
							fill="none"
							stroke="var(--fp-ok, #34d399)"
							strokeWidth="1"
						/>
					)}
					{!hiddenSeries.has("failed") && (
						<path
							d={linePath(failedVals, maxVal, SVG_W, SVG_H)}
							fill="none"
							stroke="var(--fp-err, #f87171)"
							strokeWidth="1"
							strokeDasharray="2 2"
						/>
					)}

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
							<circle
								cx={peakX}
								cy={peakY}
								r="2.5"
								fill="var(--fp-accent, #818cf8)"
								opacity="0.8"
							/>
						</>
					)}

					{/* Crosshair */}
					{hoverIndex !== null && (
						<line
							x1={hoverIndex * (SVG_W / buckets.length) + SVG_W / buckets.length / 2}
							y1={0}
							x2={hoverIndex * (SVG_W / buckets.length) + SVG_W / buckets.length / 2}
							y2={SVG_H}
							stroke="rgba(255,255,255,0.2)"
							strokeDasharray="2 2"
						/>
					)}
				</svg>

				{/* Hover tooltip */}
				{hoverIndex !== null && buckets[hoverIndex] && (
					<div
						style={{
							position: "absolute",
							left: `${((hoverIndex + 0.5) / buckets.length) * 100}%`,
							bottom: "calc(100% + 6px)",
							transform: "translateX(-50%)",
							background: "var(--fp-surface-3, #1e293b)",
							border: "1px solid var(--fp-border-2, rgba(255,255,255,0.1))",
							borderRadius: 6,
							padding: "6px 10px",
							fontSize: 11,
							whiteSpace: "nowrap",
							boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
							zIndex: 10,
							pointerEvents: "none",
							color: "var(--fp-text-1, #f1f5f9)",
						}}
					>
						<div style={{ fontWeight: 600, marginBottom: 2 }}>{buckets[hoverIndex]!.label}</div>
						<div>{buckets[hoverIndex]!.total} runs</div>
						<div style={{ color: "var(--fp-ok, #34d399)" }}>
							{buckets[hoverIndex]!.succeeded} ok
						</div>
						<div style={{ color: "var(--fp-err, #f87171)" }}>
							{buckets[hoverIndex]!.failed} failed
						</div>
					</div>
				)}
			</div>

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
