interface BreakdownItem {
	label: string;
	value: number;
	color?: string;
}

interface BreakdownSectionProps {
	data: Array<BreakdownItem>;
}

export function BreakdownSection({ data }: BreakdownSectionProps) {
	if (!data || data.length === 0) {
		return <div style={{ color: "var(--fp-text-4)", fontSize: 12, padding: "8px 0" }}>No data</div>;
	}

	const maxValue = Math.max(...data.map((d) => d.value), 1);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			{data.map((item, i) => {
				const pct = (item.value / maxValue) * 100;
				return (
					<div
						key={i}
						style={{
							display: "grid",
							gridTemplateColumns: "120px 1fr 48px",
							alignItems: "center",
							gap: 8,
						}}
					>
						{/* Label */}
						<span
							style={{
								fontSize: 13,
								color: "var(--fp-text-2)",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
							title={item.label}
						>
							{item.label}
						</span>

						{/* Bar track */}
						<div
							style={{
								height: 6,
								borderRadius: 3,
								background: "var(--fp-surface-2)",
								overflow: "hidden",
							}}
						>
							<div
								style={{
									height: "100%",
									width: `${pct}%`,
									borderRadius: 3,
									background: item.color ?? "var(--fp-accent)",
									transition: "width 300ms ease",
								}}
							/>
						</div>

						{/* Value badge */}
						<span
							style={{
								fontSize: 11,
								color: "var(--fp-text-3)",
								textAlign: "right",
								fontVariantNumeric: "tabular-nums",
							}}
						>
							{item.value.toLocaleString()}
						</span>
					</div>
				);
			})}
		</div>
	);
}
