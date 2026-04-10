import type React from "react";
import { useEffect, useRef, useState } from "react";

export interface Command {
	id: string;
	label: string;
	action: () => void;
	description?: string;
	category?: string;
	shortcut?: string;
}

interface CommandPaletteProps {
	open: boolean;
	onClose: () => void;
	commands: Command[];
}

const RECENT_KEY = "fp-recent-commands";
const MAX_RECENT = 5;

function getRecentIds(): string[] {
	try {
		const raw = sessionStorage.getItem(RECENT_KEY);
		return raw ? (JSON.parse(raw) as string[]) : [];
	} catch {
		return [];
	}
}

function saveRecentId(id: string): void {
	try {
		const ids = getRecentIds().filter((x) => x !== id);
		ids.unshift(id);
		sessionStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
	} catch {
		// ignore storage errors
	}
}

function groupByCategory(cmds: Command[]): Array<{ category: string; commands: Command[] }> {
	const map = new Map<string, Command[]>();
	for (const cmd of cmds) {
		const cat = cmd.category ?? "Actions";
		if (!map.has(cat)) map.set(cat, []);
		map.get(cat)!.push(cmd);
	}
	return Array.from(map.entries()).map(([category, commands]) => ({ category, commands }));
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (open) {
			setQuery("");
			setSelected(0);
			// Small timeout to ensure DOM is ready
			setTimeout(() => inputRef.current?.focus(), 10);
		}
	}, [open]);

	if (!open) return null;

	const filtered = commands.filter(
		(c) =>
			c.label.toLowerCase().includes(query.toLowerCase()) ||
			(c.description ?? "").toLowerCase().includes(query.toLowerCase()),
	);

	// Build grouped display: when query is empty, prepend "Recent" section
	let groups: Array<{ category: string; commands: Command[] }>;
	if (query === "") {
		const recentIds = getRecentIds();
		const recentCmds = recentIds
			.map((id) => commands.find((c) => c.id === id))
			.filter((c): c is Command => c !== undefined);
		const mainGroups = groupByCategory(filtered);
		groups =
			recentCmds.length > 0
				? [{ category: "Recent", commands: recentCmds }, ...mainGroups]
				: mainGroups;
	} else {
		groups = groupByCategory(filtered);
	}

	// Flatten for keyboard navigation index
	const flatFiltered = groups.flatMap((g) => g.commands);

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Escape") {
			e.preventDefault();
			onClose();
			return;
		}
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setSelected((i) => Math.min(i + 1, flatFiltered.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setSelected((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			const cmd = flatFiltered[selected];
			if (cmd) {
				saveRecentId(cmd.id);
				cmd.action();
				onClose();
			}
		}
	}

	let flatIndex = 0;

	return (
		<>
			{/* Backdrop */}
			<div
				onClick={onClose}
				aria-hidden
				style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)" }}
			/>
			{/* Palette */}
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Command palette"
				style={{
					position: "fixed",
					top: "20vh",
					left: "50%",
					transform: "translateX(-50%)",
					width: 480,
					zIndex: 70,
					background: "var(--fp-surface-1)",
					border: "1px solid var(--fp-border-2)",
					borderRadius: 12,
					overflow: "hidden",
					boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
				}}
			>
				<input
					ref={inputRef}
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setSelected(0);
					}}
					onKeyDown={handleKeyDown}
					placeholder="Type to filter..."
					style={{
						width: "100%",
						padding: "14px 16px",
						background: "transparent",
						border: "none",
						borderBottom: "1px solid var(--fp-border-1)",
						color: "var(--fp-text-1)",
						fontSize: 14,
						outline: "none",
						boxSizing: "border-box",
					}}
					aria-autocomplete="list"
					aria-controls="fp-palette-list"
					aria-activedescendant={
						flatFiltered[selected] ? `fp-palette-item-${flatFiltered[selected]!.id}` : undefined
					}
				/>
				<div
					id="fp-palette-list"
					role="listbox"
					aria-label="Commands"
					style={{ maxHeight: 360, overflowY: "auto" }}
				>
					{flatFiltered.length === 0 ? (
						<div
							style={{
								padding: "20px 16px",
								color: "var(--fp-text-3)",
								fontSize: 13,
								textAlign: "center",
							}}
						>
							<div>No results for &ldquo;{query}&rdquo;</div>
							<div style={{ fontSize: 11, color: "var(--fp-text-4)", marginTop: 4 }}>
								Try a different search term
							</div>
						</div>
					) : (
						groups.map((group, groupIdx) => {
							const items = group.commands.map((cmd) => {
								const currentIndex = flatIndex++;
								const isSelected = currentIndex === selected;
								return (
									<div
										key={cmd.id}
										id={`fp-palette-item-${cmd.id}`}
										role="option"
										aria-selected={isSelected}
										onClick={() => {
											saveRecentId(cmd.id);
											cmd.action();
											onClose();
										}}
										style={{
											padding: "8px 16px",
											fontSize: 13,
											cursor: "pointer",
											background: isSelected ? "var(--fp-surface-2)" : undefined,
											color: "var(--fp-text-1)",
											transition: `background var(--fp-duration) ease`,
											display: "flex",
											alignItems: "center",
											gap: 8,
										}}
									>
										<div style={{ flex: 1, minWidth: 0 }}>
											<div style={{ display: "flex", alignItems: "center" }}>
												<span>{cmd.label}</span>
												{cmd.shortcut && (
													<span
														style={{
															marginLeft: "auto",
															fontSize: 10,
															fontFamily: "var(--fp-font-mono)",
															color: "var(--fp-text-4)",
														}}
													>
														{cmd.shortcut}
													</span>
												)}
											</div>
											{cmd.description && (
												<div
													style={{
														fontSize: 11,
														color: "var(--fp-text-4)",
														marginTop: 1,
													}}
												>
													{cmd.description}
												</div>
											)}
										</div>
									</div>
								);
							});

							return (
								<div key={group.category}>
									<div
										style={{
											fontSize: 10,
											fontWeight: 600,
											textTransform: "uppercase",
											letterSpacing: "0.06em",
											color: "var(--fp-text-5)",
											padding: `${groupIdx === 0 ? 8 : 16}px 16px 4px`,
										}}
									>
										{group.category}
									</div>
									{items}
								</div>
							);
						})
					)}
				</div>
				{/* Keyboard hint */}
				<div
					style={{
						padding: "8px 16px",
						borderTop: "1px solid var(--fp-border-1)",
						display: "flex",
						gap: 16,
						fontSize: 11,
						color: "var(--fp-text-3)",
					}}
				>
					<span>
						<kbd style={{ fontFamily: "inherit" }}>↑↓</kbd> navigate
					</span>
					<span>
						<kbd style={{ fontFamily: "inherit" }}>↵</kbd> select
					</span>
					<span>
						<kbd style={{ fontFamily: "inherit" }}>Esc</kbd> close
					</span>
				</div>
			</div>
		</>
	);
}
