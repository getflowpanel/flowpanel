import React, { useState } from "react";

interface MetricCardProps {
	label: string;
	value: string | number | null;
	trend?: { label: string; direction: "positive" | "negative" | "neutral" };
	sublabel?: string;
	loading?: boolean;
	onClick?: () => void;
	hasDrawer?: boolean;
	expanded?: boolean;
	sparkline?: number[];
	sparklineColor?: string;
}

function Sparkline({ data, color }: { data: number[]; color?: string }) {
	const max = Math.max(...data, 1);
	return (
		<div
			style={{
				display: "flex",
				alignItems: "flex-end",
				gap: 2,
				height: 22,
				position: "absolute",
				bottom: 12,
				right: 16,
			}}
			aria-hidden="true"
		>
			{data.map((v, i) => (
				<div
					key={i}
					style={{
						width: 3,
						borderRadius: 1,
						background: color ?? "var(--fp-accent)",
						height: Math.max(1, (v / max) * 22) + "px",
					}}
				/>
			))}
		</div>
	);
}

function CardBody({
	label,
	value,
	trend,
	sublabel,
	sparkline,
	sparklineColor,
}: Pick<
	MetricCardProps,
	"label" | "value" | "trend" | "sublabel" | "sparkline" | "sparklineColor"
>) {
	const trendColor =
		trend?.direction === "positive"
			? "var(--fp-ok)"
			: trend?.direction === "negative"
				? "var(--fp-err)"
				: "var(--fp-text-3)";

	return (
		<>
			<div
				style={{
					fontSize: 11,
					fontWeight: 600,
					letterSpacing: "0.06em",
					textTransform: "uppercase",
					color: "var(--fp-text-2)",
					marginBottom: 8,
				}}
			>
				{label}
			</div>
			<div
				className="fp-mono"
				style={{
					fontSize: 28,
					fontWeight: 700,
					color: "var(--fp-text-1)",
					lineHeight: 1,
					fontVariantNumeric: "tabular-nums",
				}}
			>
				{value ?? "—"}
			</div>
			{trend && <div style={{ fontSize: 11, marginTop: 2, color: trendColor }}>{trend.label}</div>}
			{sublabel && (
				<div style={{ fontSize: 11, color: "var(--fp-text-3)", marginTop: 4 }}>{sublabel}</div>
			)}
			{sparkline && sparkline.length > 0 && <Sparkline data={sparkline} color={sparklineColor} />}
		</>
	);
}

export function MetricCard({
	label,
	value,
	trend,
	sublabel,
	loading,
	onClick,
	hasDrawer,
	expanded,
	sparkline,
	sparklineColor,
}: MetricCardProps) {
	const [hovered, setHovered] = useState(false);

	if (loading) {
		return (
			<div
				className="fp-card"
				style={{ padding: "20px 24px", minWidth: 160 }}
				aria-busy="true"
				aria-label="Loading metric"
			>
				<div className="fp-skeleton" style={{ height: 11, width: "60%", marginBottom: 12 }} />
				<div className="fp-skeleton" style={{ height: 28, width: "80%", marginBottom: 8 }} />
				<div className="fp-skeleton" style={{ height: 10, width: "40%" }} />
			</div>
		);
	}

	const isClickable = !!onClick && !!hasDrawer;

	const hoverBorderStyle =
		isClickable && hovered ? { borderTop: "2px solid var(--fp-accent)" } : {};

	if (isClickable) {
		return (
			<button
				className="fp-card"
				style={{
					position: "relative",
					padding: "20px 24px",
					minWidth: 160,
					cursor: "pointer",
					textAlign: "left",
					border: "1px solid var(--fp-border-1)",
					...hoverBorderStyle,
				}}
				onClick={onClick}
				onMouseEnter={() => setHovered(true)}
				onMouseLeave={() => setHovered(false)}
				aria-expanded={expanded ?? false}
				aria-haspopup="dialog"
			>
				{hovered && (
					<div
						style={{
							position: "absolute",
							top: 6,
							right: 10,
							fontSize: 9,
							color: "var(--fp-accent-text)",
							pointerEvents: "none",
						}}
					>
						Open breakdown ↗
					</div>
				)}
				<CardBody
					label={label}
					value={value}
					trend={trend}
					sublabel={sublabel}
					sparkline={sparkline}
					sparklineColor={sparklineColor}
				/>
			</button>
		);
	}

	return (
		<div
			className="fp-card"
			style={{
				position: "relative",
				padding: "20px 24px",
				minWidth: 160,
				textAlign: "left",
				border: "1px solid var(--fp-border-1)",
			}}
		>
			<CardBody
				label={label}
				value={value}
				trend={trend}
				sublabel={sublabel}
				sparkline={sparkline}
				sparklineColor={sparklineColor}
			/>
		</div>
	);
}
