import type React from "react";
import { useRef } from "react";

export interface TabConfig {
	id: string;
	label: string;
	icon?: string;
	count?: number;
}

interface TabsProps {
	tabs: TabConfig[];
	activeTab: string;
	onTabChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
	const tablistRef = useRef<HTMLDivElement>(null);

	// Arrow key navigation within tablist (ARIA pattern)
	function handleKeyDown(e: React.KeyboardEvent, currentIdx: number) {
		let nextIdx: number | null = null;
		if (e.key === "ArrowRight") {
			nextIdx = (currentIdx + 1) % tabs.length;
		} else if (e.key === "ArrowLeft") {
			nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
		} else if (e.key === "Home") {
			nextIdx = 0;
		} else if (e.key === "End") {
			nextIdx = tabs.length - 1;
		}

		if (nextIdx !== null) {
			e.preventDefault();
			const tab = tabs[nextIdx];
			if (tab) {
				onTabChange(tab.id);
				// Focus the newly activated tab button
				const btns = tablistRef.current?.querySelectorAll<HTMLButtonElement>("[role='tab']");
				btns?.[nextIdx]?.focus();
			}
		}
	}

	return (
		<div
			ref={tablistRef}
			role="tablist"
			aria-label="Admin sections"
			style={{
				display: "flex",
				gap: 0,
				padding: "0 24px",
				borderBottom: "1px solid var(--fp-border-1)",
			}}
		>
			{tabs.map((tab, i) => {
				const isActive = tab.id === activeTab;
				return (
					<button
						key={tab.id}
						role="tab"
						aria-selected={isActive}
						aria-controls={`fp-tabpanel-${tab.id}`}
						id={`fp-tab-${tab.id}`}
						tabIndex={isActive ? 0 : -1}
						onClick={() => onTabChange(tab.id)}
						onKeyDown={(e) => handleKeyDown(e, i)}
						style={{
							padding: "10px 16px",
							fontSize: 13,
							fontWeight: isActive ? 600 : 400,
							color: isActive ? "var(--fp-text-1)" : "var(--fp-text-3)",
							cursor: "pointer",
							background: "transparent",
							border: "none",
							borderBottom: isActive ? "2px solid var(--fp-accent)" : "2px solid transparent",
							marginBottom: -1,
							transition: `color var(--fp-duration) ease`,
						}}
					>
						{tab.label}
						{tab.count != null && (
							<span style={{ marginLeft: 6, fontSize: 11, color: "var(--fp-text-3)" }}>
								[{tab.count.toLocaleString()}]
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
