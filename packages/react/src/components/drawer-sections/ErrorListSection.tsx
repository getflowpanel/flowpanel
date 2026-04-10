import React from "react";

interface ErrorListItem {
	errorClass: string;
	count: number;
}

interface ErrorListSectionProps {
	data: Array<ErrorListItem>;
	limit?: number;
}

export function ErrorListSection({ data, limit = 10 }: ErrorListSectionProps) {
	if (!data || data.length === 0) {
		return (
			<div style={{ color: "var(--fp-text-4)", fontSize: 12, padding: "8px 0" }}>No errors</div>
		);
	}

	const items = data.slice(0, limit);
	const maxCount = Math.max(...items.map((d) => d.count), 1);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			{items.map((item, i) => {
				const pct = (item.count / maxCount) * 100;
				return (
					<div
						key={i}
						style={{
							display: "grid",
							gridTemplateColumns: "1fr 80px 40px",
							alignItems: "center",
							gap: 8,
						}}
					>
						{/* Error class */}
						<span
							style={{
								fontSize: 12,
								fontFamily: "var(--fp-font-mono, monospace)",
								color: "var(--fp-text-2)",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
							title={item.errorClass}
						>
							{item.errorClass}
						</span>

						{/* Proportional red bar */}
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
									background: "var(--fp-err)",
									transition: "width 300ms ease",
								}}
							/>
						</div>

						{/* Count badge */}
						<span
							style={{
								fontSize: 11,
								color: "var(--fp-err)",
								textAlign: "right",
								fontVariantNumeric: "tabular-nums",
								fontWeight: 600,
							}}
						>
							{item.count}
						</span>
					</div>
				);
			})}
		</div>
	);
}
