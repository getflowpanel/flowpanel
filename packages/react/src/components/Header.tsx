import React from "react";
import type { LiveStatus } from "../hooks/useFlowPanelStream.js";

export type { LiveStatus };

interface HeaderProps {
	appName: string;
	timeRange: string;
	onTimeRangeChange: (range: string) => void;
	timeRangePresets: string[];
	liveStatus: LiveStatus;
	onOpenPalette?: () => void;
}

export function Header({
	appName,
	timeRange,
	onTimeRangeChange,
	timeRangePresets,
	liveStatus,
	onOpenPalette,
}: HeaderProps) {
	return (
		<header
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				padding: "0 24px",
				height: 52,
				borderBottom: "1px solid var(--fp-border-1)",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
				<span style={{ fontSize: 13, fontWeight: 600, color: "var(--fp-text-1)" }}>
					⚡ {appName}
				</span>
			</div>

			<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
				{/* Time range segmented control */}
				<div
					style={{
						display: "flex",
						background: "rgba(255,255,255,0.04)",
						border: "1px solid var(--fp-border-1)",
						borderRadius: "var(--fp-radius-sm)",
						overflow: "hidden",
					}}
				>
					{timeRangePresets.map((p) => (
						<button
							key={p}
							onClick={() => onTimeRangeChange(p)}
							style={{
								padding: "5px 9px",
								background: p === timeRange ? "rgba(255,255,255,0.07)" : "transparent",
								fontWeight: p === timeRange ? 600 : 400,
								color: p === timeRange ? "var(--fp-text-1)" : "var(--fp-text-4)",
								border: "none",
								cursor: "pointer",
								fontSize: 12,
								transition: "background var(--fp-duration) ease",
							}}
						>
							{p}
						</button>
					))}
				</div>

				{/* Live indicator */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 6,
						border: "1px solid var(--fp-border-1)",
						borderRadius: "var(--fp-radius-sm)",
						padding: "5px 9px",
					}}
					aria-live="polite"
					aria-label={`Connection: ${liveStatus}`}
				>
					<span
						style={{
							width: 7,
							height: 7,
							borderRadius: "50%",
							background:
								liveStatus === "live"
									? "var(--fp-ok)"
									: liveStatus === "reconnecting"
										? "var(--fp-warn)"
										: "var(--fp-text-4)",
							boxShadow: liveStatus === "live" ? "0 0 0 2px rgba(16,185,129,0.2)" : "none",
						}}
					/>
					<span style={{ fontSize: 12, color: "var(--fp-text-2)" }}>
						{liveStatus === "live"
							? "Live"
							: liveStatus === "reconnecting"
								? "Reconnecting"
								: "Polling"}
					</span>
				</div>

				{/* Command palette trigger */}
				{onOpenPalette && (
					<button
						onClick={onOpenPalette}
						aria-label="Open command palette"
						style={{
							padding: "5px 10px",
							background: "transparent",
							border: "1px solid var(--fp-border-1)",
							borderRadius: "var(--fp-radius-sm)",
							color: "var(--fp-text-4)",
							cursor: "pointer",
							fontSize: 11,
							fontFamily: "var(--fp-font-mono)",
						}}
					>
						⌘K
					</button>
				)}
			</div>
		</header>
	);
}
