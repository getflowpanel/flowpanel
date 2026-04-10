import type { FlowPanelConfig } from "@flowpanel/core";
import React, { useCallback, useEffect, useReducer, useState } from "react";
import type { Command } from "./components/CommandPalette.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { DemoBanner } from "./components/DemoBanner.js";
import { Drawer } from "./components/Drawer.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { ErrorPanel } from "./components/ErrorPanel.js";
import { Header } from "./components/Header.js";
import { KeyboardHelp } from "./components/KeyboardHelp.js";
import { MetricCard } from "./components/MetricCard.js";
import { RunChart } from "./components/RunChart.js";
import type { RunLogColumn } from "./components/RunTable.js";
import { RunTable } from "./components/RunTable.js";
import { SectionHeader } from "./components/SectionHeader.js";
import { StageCard } from "./components/StageCard.js";
import type { TabConfig } from "./components/Tabs.js";
import { Tabs } from "./components/Tabs.js";
import { ToastProvider } from "./components/Toast.js";
import { useFlowPanelStream } from "./hooks/useFlowPanelStream.js";
import { useKeyboard } from "./hooks/useKeyboard.js";
import { resolveTheme, themeToStyle } from "./theme/index.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunsState {
	runs: Record<string, unknown>[];
	nextCursor: string | null;
	bufferedNewRuns: Record<string, unknown>[];
}

type RunsAction =
	| { type: "SET_RUNS"; runs: Record<string, unknown>[]; nextCursor: string | null }
	| { type: "BUFFER_RUN"; run: Record<string, unknown> }
	| { type: "UPDATE_RUN"; runId: string; update: Partial<Record<string, unknown>> }
	| { type: "LOAD_MORE"; runs: Record<string, unknown>[]; nextCursor: string | null }
	| { type: "FLUSH_BUFFERED" };

function runsReducer(state: RunsState, action: RunsAction): RunsState {
	switch (action.type) {
		case "SET_RUNS":
			return { runs: action.runs, nextCursor: action.nextCursor, bufferedNewRuns: [] };
		case "BUFFER_RUN":
			return { ...state, bufferedNewRuns: [action.run, ...state.bufferedNewRuns] };
		case "UPDATE_RUN":
			return {
				...state,
				runs: state.runs.map((r) =>
					String(r["id"]) === action.runId ? { ...r, ...action.update } : r,
				),
				bufferedNewRuns: state.bufferedNewRuns.map((r) =>
					String(r["id"]) === action.runId ? { ...r, ...action.update } : r,
				),
			};
		case "LOAD_MORE":
			return { ...state, runs: [...state.runs, ...action.runs], nextCursor: action.nextCursor };
		case "FLUSH_BUFFERED":
			return {
				runs: [...state.bufferedNewRuns, ...state.runs],
				nextCursor: state.nextCursor,
				bufferedNewRuns: [],
			};
		default:
			return state;
	}
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface FlowPanelUIProps {
	config: FlowPanelConfig;
	trpcBaseUrl?: string;
	showDemoBanner?: boolean;
}

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
	const json = (await res.json()) as { result: { data: T } };
	return json.result.data;
}

/**
 * Main dashboard component. Renders the full FlowPanel admin UI.
 *
 * @example
 * ```tsx
 * <FlowPanelUI config={config} trpcBaseUrl="/api/trpc" />
 * ```
 */
export function FlowPanelUI({
	config,
	trpcBaseUrl = "/api/trpc",
	showDemoBanner = false,
}: FlowPanelUIProps) {
	const theme = resolveTheme(config);
	const themeStyle = themeToStyle(theme);

	// ── UI state ──────────────────────────────────────────────────────────────
	const firstTabId = config.tabs?.[0]?.id ?? "pipeline";
	const [activeTab, setActiveTab] = useState(firstTabId);
	const [timeRange, setTimeRange] = useState(config.timeRange?.default ?? "24h");
	const [selectedStage, setSelectedStage] = useState<string | null>(null);
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
	const [drawerState, setDrawerState] = useState<{
		open: boolean;
		type: string;
		runId?: string;
	}>({ open: false, type: "" });
	const [selectedRunId, setSelectedRunId] = useState<string | undefined>();
	const [drawerData, setDrawerData] = useState<{
		sections: Array<{ type: string; data: unknown; error?: string }>;
		run?: Record<string, unknown>;
		actions?: Array<{ label: string; variant?: "default" | "danger"; onClick: string }>;
	} | null>(null);
	const [drawerLoading, setDrawerLoading] = useState(false);

	// ── Server state ──────────────────────────────────────────────────────────
	const [metrics, setMetrics] = useState<Record<string, unknown>>({});
	const [stageData, setStageData] = useState<
		Array<{
			stage: string;
			total: number;
			succeeded: number;
			failed: number;
			running: number;
			avgDurationMs: number | null;
		}>
	>([]);
	const [runsState, dispatchRuns] = useReducer(runsReducer, {
		runs: [],
		nextCursor: null,
		bufferedNewRuns: [],
	});
	const [loading, setLoading] = useState(true);
	const [liveAnnouncement, setLiveAnnouncement] = useState("");
	const [chartData, setChartData] = useState<{
		buckets: Array<{ label: string; total: number; succeeded: number; failed: number }>;
		peakBucket: { label: string; total: number } | null;
	} | null>(null);
	const [topErrors, setTopErrors] = useState<{
		errors: Array<{ errorClass: string; count: number }>;
		totalFailed: number;
	} | null>(null);

	// ── Data fetching ─────────────────────────────────────────────────────────
	const fetchData = useCallback(async () => {
		setLoading(true);
		try {
			const [metricsData, stagesData, runsData] = await Promise.all([
				fetchJson<Record<string, unknown>>(
					`${trpcBaseUrl}/flowpanel.metrics.current?input=${encodeURIComponent(
						JSON.stringify({ timeRange }),
					)}`,
				),
				fetchJson<
					Array<{
						stage: string;
						total: number;
						succeeded: number;
						failed: number;
						running: number;
						avgDurationMs: number | null;
					}>
				>(
					`${trpcBaseUrl}/flowpanel.stages.breakdown?input=${encodeURIComponent(
						JSON.stringify({ timeRange }),
					)}`,
				),
				fetchJson<{
					runs: Record<string, unknown>[];
					nextCursor: string | null;
				}>(
					`${trpcBaseUrl}/flowpanel.runs.list?input=${encodeURIComponent(
						JSON.stringify({ timeRange, stage: selectedStage, limit: 50 }),
					)}`,
				),
			]);

			// Fetch chart data independently (non-blocking)
			fetchJson<{
				buckets: Array<{ label: string; total: number; succeeded: number; failed: number }>;
				peakBucket: { label: string; total: number } | null;
			}>(
				`${trpcBaseUrl}/flowpanel.runs.chart?input=${encodeURIComponent(
					JSON.stringify({ timeRange }),
				)}`,
			)
				.then(setChartData)
				.catch(() => {});

			// Fetch topErrors independently (non-blocking)
			fetchJson<{ errors: Array<{ errorClass: string; count: number }>; totalFailed: number }>(
				`${trpcBaseUrl}/flowpanel.runs.topErrors?input=${encodeURIComponent(
					JSON.stringify({ timeRange }),
				)}`,
			)
				.then(setTopErrors)
				.catch((err) => console.error("[FlowPanel] topErrors:", err));

			setMetrics(metricsData);
			setStageData(stagesData);
			dispatchRuns({
				type: "SET_RUNS",
				runs: runsData.runs,
				nextCursor: runsData.nextCursor,
			});
		} catch (err) {
			console.error("[FlowPanel] fetch error:", err);
		} finally {
			setLoading(false);
		}
	}, [trpcBaseUrl, timeRange, selectedStage]);

	useEffect(() => {
		void fetchData();
	}, [fetchData]);

	// ── Drawer data fetching ──────────────────────────────────────────────────
	useEffect(() => {
		if (!drawerState.open) {
			setDrawerData(null);
			return;
		}

		// Only fetch section data for config-driven drawers (not the built-in runDetail)
		const drawerId = drawerState.type === "runDetail" ? "run-detail" : drawerState.type;
		const drawerConfig = config.drawers?.[drawerId];
		if (!drawerConfig) return;

		let cancelled = false;
		setDrawerLoading(true);
		setDrawerData(null);

		const input: Record<string, unknown> = { drawerId };
		if (drawerState.runId) input["runId"] = drawerState.runId;

		fetchJson<{
			sections: Array<{ type: string; data: unknown; error?: string }>;
			run?: Record<string, unknown>;
		}>(`${trpcBaseUrl}/flowpanel.drawers.render?input=${encodeURIComponent(JSON.stringify(input))}`)
			.then((data) => {
				if (!cancelled) setDrawerData(data);
			})
			.catch((err) => {
				console.error("[FlowPanel] drawer fetch error:", err);
			})
			.finally(() => {
				if (!cancelled) setDrawerLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [drawerState.open, drawerState.type, drawerState.runId, config.drawers, trpcBaseUrl]);

	// ── SSE stream ────────────────────────────────────────────────────────────
	const { status: liveStatus } = useFlowPanelStream({
		url: `${trpcBaseUrl}/flowpanel.stream.connect`,
		onEvent: useCallback((event) => {
			if (event.event === "run.created") {
				dispatchRuns({ type: "BUFFER_RUN", run: event.data as Record<string, unknown> });
				setLiveAnnouncement("New run started");
			} else if (event.event === "run.finished" || event.event === "run.failed") {
				const data = event.data as Record<string, unknown>;
				dispatchRuns({
					type: "UPDATE_RUN",
					runId: String(data["id"]),
					update: { status: data["status"], duration_ms: data["durationMs"] },
				});
				if (event.event === "run.failed") setLiveAnnouncement("Run failed");
			} else if (event.event === "metrics.updated") {
				setMetrics(event.data as Record<string, unknown>);
			}
		}, []),
	});

	// ── Load more ─────────────────────────────────────────────────────────────
	const handleLoadMore = useCallback(async () => {
		if (!runsState.nextCursor) return;
		try {
			const data = await fetchJson<{
				runs: Record<string, unknown>[];
				nextCursor: string | null;
			}>(
				`${trpcBaseUrl}/flowpanel.runs.list?input=${encodeURIComponent(
					JSON.stringify({
						timeRange,
						stage: selectedStage,
						limit: 50,
						cursor: runsState.nextCursor,
					}),
				)}`,
			);
			dispatchRuns({ type: "LOAD_MORE", runs: data.runs, nextCursor: data.nextCursor });
		} catch (err) {
			console.error("[FlowPanel] load more error:", err);
		}
	}, [trpcBaseUrl, timeRange, selectedStage, runsState.nextCursor]);

	// ── Keyboard shortcuts ────────────────────────────────────────────────────
	// config.tabs entries have { id, label, icon, view } — map to TabConfig { id, label, icon? }
	const tabs: TabConfig[] = config.tabs?.map((t) => ({
		id: t.id,
		label: t.label,
		icon: t.icon,
	})) ?? [{ id: "pipeline", label: "Pipeline" }];

	useKeyboard([
		{
			key: "k",
			meta: true,
			handler: () => setPaletteOpen(true),
			description: "Open command palette",
		},
		{ key: "?", handler: () => setKeyboardHelpOpen(true) },
		{ key: "1", handler: () => setActiveTab(tabs[0]?.id ?? "pipeline") },
		{
			key: "2",
			handler: () => {
				if (tabs[1]) setActiveTab(tabs[1].id);
			},
		},
		{
			key: "3",
			handler: () => {
				if (tabs[2]) setActiveTab(tabs[2].id);
			},
		},
		{
			key: "Escape",
			handler: () => {
				if (keyboardHelpOpen) setKeyboardHelpOpen(false);
				else if (drawerState.open) setDrawerState({ open: false, type: "" });
				else if (paletteOpen) setPaletteOpen(false);
			},
		},
	]);

	// ── Run log columns ───────────────────────────────────────────────────────
	// config.runLog?.columns is RunLogColumn from core which has more format/render options
	// than RunTable's RunLogColumn — cast to ensure compatibility
	const runLogColumns: RunLogColumn[] = (config.runLog?.columns as RunLogColumn[] | undefined) ?? [
		{ field: "id", label: "Run ID", width: 90, mono: true },
		{ field: "stage", label: "Stage", width: 72, render: "stagePill" },
		{ field: "partition_key", label: "Target", flex: 1 },
		{ field: "duration_ms", label: "Duration", width: 80, format: "duration" },
		{ field: "status", label: "Status", width: 110, render: "statusTag" },
	];

	// ── Commands ──────────────────────────────────────────────────────────────
	const timePresets = config.timeRange?.presets ?? ["1h", "6h", "24h", "7d", "30d"];
	const builtinCommands: Command[] = [
		{
			id: "clear-filters",
			label: "Clear filters",
			category: "Actions",
			action: () => setSelectedStage(null),
		},
		{ id: "refresh", label: "Refresh data", category: "Actions", action: () => void fetchData() },
		{
			id: "keyboard-help",
			label: "Keyboard shortcuts",
			category: "Help",
			shortcut: "?",
			action: () => setKeyboardHelpOpen(true),
		},
		...timePresets.map((preset) => ({
			id: `time-${preset}`,
			label: `Set time range: ${preset}`,
			category: "Time Range",
			action: () => setTimeRange(preset),
		})),
	];

	// ── Drawer title ──────────────────────────────────────────────────────────
	const drawerConfigEntry = config.drawers?.[drawerState.type] as
		| { title?: string | ((...args: unknown[]) => string) }
		| undefined;
	const drawerTitle =
		drawerState.type === "runDetail"
			? `Run ${drawerState.runId ?? ""}`
			: typeof drawerConfigEntry?.title === "string"
				? drawerConfigEntry.title
				: drawerState.type || "Details";

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<ToastProvider>
			<div className="fp-root" style={{ ...themeStyle, minHeight: "100vh" }} data-testid="fp-root">
				<ErrorBoundary>
					{/* Skip link for accessibility */}
					<a
						href="#fp-main"
						style={{ position: "absolute", left: -9999, top: 0, zIndex: 100 }}
						onFocus={(e) => {
							(e.currentTarget as HTMLElement).style.left = "0";
						}}
						onBlur={(e) => {
							(e.currentTarget as HTMLElement).style.left = "-9999px";
						}}
					>
						Skip to main content
					</a>

					<Header
						appName={config.appName}
						timeRange={timeRange}
						onTimeRangeChange={setTimeRange}
						timeRangePresets={timePresets}
						liveStatus={liveStatus}
						onOpenPalette={() => setPaletteOpen(true)}
					/>

					{showDemoBanner && (
						<DemoBanner
							runCount={runsState.runs.length}
							realRunCount={0}
							onClear={async () => {
								try {
									await fetch(`${trpcBaseUrl}/flowpanel.demo.reset`, { method: "POST" });
									void fetchData();
								} catch (err) {
									console.error("[FlowPanel] demo reset error:", err);
								}
							}}
						/>
					)}

					<Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

					<main id="fp-main" style={{ padding: "24px" }}>
						{activeTab === "pipeline" && (
							<>
								{/* Metrics strip */}
								<ErrorBoundary>
									<section aria-label="Metrics" style={{ marginBottom: 24 }}>
										<SectionHeader
											label="Overview"
											meta={loading ? undefined : "Last updated just now"}
										/>
										<div
											style={{
												display: "grid",
												gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
												gap: 10,
											}}
										>
											{Object.entries(config.metrics ?? {}).map(([name, mc]) => {
												const result = metrics[name] as
													| {
															value?: string | number | null;
															trend?: {
																label: string;
																direction: "positive" | "negative" | "neutral";
															};
															sublabel?: string;
															sparkline?: number[];
													  }
													| undefined;

												return (
													<MetricCard
														key={name}
														label={mc.label}
														value={result?.value ?? null}
														trend={result?.trend}
														sublabel={result?.sublabel}
														sparkline={result?.sparkline}
														loading={loading}
														hasDrawer={!!mc.drawer}
														onClick={
															mc.drawer
																? () => setDrawerState({ open: true, type: mc.drawer! })
																: undefined
														}
													/>
												);
											})}
										</div>
									</section>
								</ErrorBoundary>

								{/* Stage cards */}
								{stageData.length > 0 &&
									(() => {
										const totalAllStages = stageData.reduce((s, d) => s + d.total, 0);
										return (
											<ErrorBoundary>
												<section aria-label="Pipeline stages" style={{ marginBottom: 24 }}>
													<SectionHeader
														label="Pipeline Stages"
														meta="Click to filter runs below"
													/>
													<div
														style={{
															display: "grid",
															gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
															gap: 10,
														}}
													>
														{stageData.map((s) => (
															<StageCard
																key={s.stage}
																stage={s.stage}
																color={theme.stageColors[s.stage] ?? "#818cf8"}
																total={s.total}
																totalAllStages={totalAllStages}
																succeeded={s.succeeded}
																failed={s.failed}
																running={s.running}
																avgDurationMs={s.avgDurationMs}
																selected={selectedStage === s.stage}
																loading={loading}
																onClick={() =>
																	setSelectedStage((prev) => (prev === s.stage ? null : s.stage))
																}
															/>
														))}
													</div>
												</section>
											</ErrorBoundary>
										);
									})()}

								{/* Error summary */}
								{topErrors && topErrors.totalFailed > 0 && (
									<ErrorBoundary>
										<section aria-label="Errors" style={{ marginBottom: 24 }}>
											<SectionHeader label="Errors" meta={`${topErrors.totalFailed} failed`} />
											<ErrorPanel
												errors={topErrors.errors}
												totalFailed={topErrors.totalFailed}
												loading={loading}
												onRetryAll={() => {
													// TODO: wire to bulk retry when available
												}}
												onErrorClick={(errorClass) => {
													setSelectedStage(null);
													console.log("[FlowPanel] filter by error class:", errorClass);
												}}
											/>
										</section>
									</ErrorBoundary>
								)}

								{/* Run volume chart */}
								{chartData && chartData.buckets.length > 0 && (
									<ErrorBoundary>
										<section aria-label="Run volume" style={{ marginBottom: 24 }}>
											<SectionHeader label="Run Volume" />
											<div className="fp-card" style={{ padding: 16 }}>
												<RunChart
													buckets={chartData.buckets}
													peakBucket={chartData.peakBucket}
													loading={loading}
												/>
											</div>
										</section>
									</ErrorBoundary>
								)}

								{/* Run log */}
								<ErrorBoundary>
									<section aria-label="Run log">
										<SectionHeader
											label="Run Log"
											meta={
												!loading && runsState.runs.length > 0
													? `${runsState.runs.length.toLocaleString()} total`
													: undefined
											}
										/>
										<div className="fp-card" style={{ overflow: "hidden" }}>
											<RunTable
												runs={runsState.runs}
												columns={runLogColumns}
												stageColors={theme.stageColors}
												loading={loading}
												hasNextPage={!!runsState.nextCursor}
												onLoadMore={handleLoadMore}
												newRunsBanner={
													runsState.bufferedNewRuns.length > 0
														? runsState.bufferedNewRuns.length
														: undefined
												}
												onScrollToTop={() => dispatchRuns({ type: "FLUSH_BUFFERED" })}
												onRowClick={(run) => {
													setSelectedRunId(String(run["id"]));
													setDrawerState({
														open: true,
														type: "runDetail",
														runId: String(run["id"]),
													});
												}}
												selectedRunId={selectedRunId}
											/>
										</div>
									</section>
								</ErrorBoundary>
							</>
						)}

						{/* Non-pipeline tabs */}
						{activeTab !== "pipeline" &&
							(() => {
								const tabConfig = tabs.find((t) => t.id === activeTab);
								return (
									<div
										id={`fp-tabpanel-${activeTab}`}
										role="tabpanel"
										aria-labelledby={`fp-tab-${activeTab}`}
										style={{
											color: "var(--fp-text-3)",
											padding: 40,
											textAlign: "center",
										}}
									>
										{tabConfig?.label ?? activeTab} view — coming soon
									</div>
								);
							})()}
					</main>

					{/* Drawers */}
					<Drawer
						open={drawerState.open}
						onClose={() => setDrawerState({ open: false, type: "" })}
						title={drawerTitle}
						sections={drawerData?.sections}
						run={drawerData?.run}
						actions={drawerData?.actions?.map((a) => ({
							...a,
							onClick: () => console.log("[FlowPanel] drawer action:", a.onClick),
						}))}
						loading={drawerLoading}
					>
						<div style={{ color: "var(--fp-text-3)", fontSize: 13 }}>
							{drawerState.type === "runDetail"
								? `Run details for ${drawerState.runId}`
								: "Loading drawer content..."}
						</div>
					</Drawer>

					{/* Command palette */}
					<CommandPalette
						open={paletteOpen}
						onClose={() => setPaletteOpen(false)}
						commands={builtinCommands}
					/>

					{/* Keyboard shortcuts help */}
					<KeyboardHelp open={keyboardHelpOpen} onClose={() => setKeyboardHelpOpen(false)} />

					{/* ARIA live region */}
					<div
						role="status"
						aria-live="assertive"
						aria-atomic="true"
						style={{
							position: "absolute",
							left: -9999,
							width: 1,
							height: 1,
							overflow: "hidden",
						}}
					>
						{liveAnnouncement}
					</div>

					{/* SSE reconnect banner */}
					{liveStatus === "reconnecting" && (
						<div
							role="status"
							aria-live="polite"
							style={{
								position: "fixed",
								top: 52,
								left: 0,
								right: 0,
								zIndex: 20,
								background: "var(--fp-warn)",
								color: "#000",
								padding: "8px 24px",
								textAlign: "center",
								fontSize: 13,
							}}
						>
							● Live updates paused — reconnecting...
						</div>
					)}
				</ErrorBoundary>
			</div>
		</ToastProvider>
	);
}
