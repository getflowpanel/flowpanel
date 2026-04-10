import type React from "react";
import { useEffect } from "react";

export interface KeyboardHelpProps {
	open: boolean;
	onClose: () => void;
}

interface ShortcutRow {
	description: string;
	keys: string[];
}

interface ShortcutSection {
	title: string;
	shortcuts: ShortcutRow[];
}

const SECTIONS: ShortcutSection[] = [
	{
		title: "Global",
		shortcuts: [
			{ description: "Command palette", keys: ["⌘K"] },
			{ description: "Keyboard shortcuts", keys: ["?"] },
			{ description: "Close", keys: ["Esc"] },
			{ description: "Switch tabs", keys: ["1", "2", "3"] },
		],
	},
	{
		title: "Run Table",
		shortcuts: [
			{ description: "Navigate rows", keys: ["j", "k"] },
			{ description: "Open detail", keys: ["Enter"] },
			{ description: "Focus search", keys: ["/"] },
		],
	},
	{
		title: "Drawer",
		shortcuts: [{ description: "Close", keys: ["Esc"] }],
	},
];

const kbdStyle: React.CSSProperties = {
	background: "var(--fp-surface-3)",
	border: "1px solid var(--fp-border-2)",
	borderRadius: 4,
	fontFamily: "var(--fp-font-mono)",
	fontSize: 11,
	color: "var(--fp-text-3)",
	padding: "2px 6px",
	lineHeight: "1.4",
};

export function KeyboardHelp({ open, onClose }: KeyboardHelpProps) {
	useEffect(() => {
		if (!open) return;
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<>
			{/* Backdrop */}
			<div
				aria-hidden
				onClick={onClose}
				style={{
					position: "fixed",
					inset: 0,
					zIndex: 50,
					background: "rgba(0,0,0,0.5)",
					backdropFilter: "blur(4px)",
				}}
			/>
			{/* Dialog */}
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Keyboard shortcuts"
				style={{
					position: "fixed",
					top: "50%",
					left: "50%",
					transform: "translate(-50%, -50%)",
					zIndex: 51,
					width: 420,
					background: "var(--fp-surface-1)",
					border: "1px solid var(--fp-border-1)",
					borderRadius: "var(--fp-radius-card)",
					padding: 24,
					boxShadow: "var(--fp-shadow-md)",
				}}
			>
				{/* Header */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: 20,
					}}
				>
					<span style={{ fontSize: 14, fontWeight: 600, color: "var(--fp-text-1)" }}>
						Keyboard Shortcuts
					</span>
					<button
						onClick={onClose}
						aria-label="Close keyboard shortcuts"
						style={{
							background: "none",
							border: "none",
							cursor: "pointer",
							color: "var(--fp-text-3)",
							fontSize: 18,
							lineHeight: 1,
							padding: "0 2px",
							display: "flex",
							alignItems: "center",
						}}
					>
						×
					</button>
				</div>

				{/* Sections */}
				{SECTIONS.map((section, sectionIdx) => (
					<div key={section.title} style={{ marginTop: sectionIdx === 0 ? 0 : 16 }}>
						<div
							style={{
								fontSize: 10,
								fontWeight: 600,
								textTransform: "uppercase",
								letterSpacing: "0.06em",
								color: "var(--fp-text-5)",
								marginBottom: 8,
							}}
						>
							{section.title}
						</div>
						{section.shortcuts.map((row) => (
							<div
								key={row.description}
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									padding: "5px 0",
									borderBottom: "1px solid var(--fp-border-1)",
								}}
							>
								<span style={{ fontSize: 13, color: "var(--fp-text-2)" }}>{row.description}</span>
								<div style={{ display: "flex", gap: 4 }}>
									{row.keys.map((k) => (
										<kbd key={k} style={kbdStyle}>
											{k}
										</kbd>
									))}
								</div>
							</div>
						))}
					</div>
				))}
			</div>
		</>
	);
}
