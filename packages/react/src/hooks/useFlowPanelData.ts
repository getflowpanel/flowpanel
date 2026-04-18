import type { FlowPanelConfig } from "@flowpanel/core";
import { useCallback, useEffect, useReducer, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StageBreakdown {
  stage: string;
  total: number;
  succeeded: number;
  failed: number;
  running: number;
  avgDurationMs: number | null;
}

export interface MetricResult {
  value?: string | number | null;
  trend?: { label: string; direction: "positive" | "negative" | "neutral" };
  sublabel?: string;
  sparkline?: number[];
}

export interface ChartData {
  buckets: Array<{ label: string; total: number; succeeded: number; failed: number }>;
  peakBucket: { label: string; total: number } | null;
}

export interface TopErrors {
  errors: Array<{ errorClass: string; count: number }>;
  totalFailed: number;
}

export interface DrawerResponse {
  sections: Array<{ type: string; data: unknown; error?: string }>;
  run?: Record<string, unknown>;
  actions?: Array<{ label: string; variant?: "default" | "danger"; onClick: string }>;
}

export interface RunsState {
  runs: Record<string, unknown>[];
  nextCursor: string | null;
  bufferedNewRuns: Record<string, unknown>[];
}

export type RunsAction =
  | { type: "SET_RUNS"; runs: Record<string, unknown>[]; nextCursor: string | null }
  | { type: "BUFFER_RUN"; run: Record<string, unknown> }
  | { type: "UPDATE_RUN"; runId: string; update: Partial<Record<string, unknown>> }
  | { type: "LOAD_MORE"; runs: Record<string, unknown>[]; nextCursor: string | null }
  | { type: "FLUSH_BUFFERED" };

export function runsReducer(state: RunsState, action: RunsAction): RunsState {
  switch (action.type) {
    case "SET_RUNS":
      return { runs: action.runs, nextCursor: action.nextCursor, bufferedNewRuns: [] };
    case "BUFFER_RUN":
      return { ...state, bufferedNewRuns: [action.run, ...state.bufferedNewRuns] };
    case "UPDATE_RUN":
      return {
        ...state,
        runs: state.runs.map((r) =>
          String(r.id) === action.runId ? { ...r, ...action.update } : r,
        ),
        bufferedNewRuns: state.bufferedNewRuns.map((r) =>
          String(r.id) === action.runId ? { ...r, ...action.update } : r,
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

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = (await res.json()) as { result: { data: T } };
  return json.result.data;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseFlowPanelDataOptions {
  config: FlowPanelConfig;
  baseUrl: string;
  timeRange: string;
  selectedStage: string | null;
}

export function useFlowPanelData({
  config: _config,
  baseUrl,
  timeRange,
  selectedStage,
}: UseFlowPanelDataOptions) {
  const [metrics, setMetrics] = useState<Record<string, unknown>>({});
  const [stageData, setStageData] = useState<StageBreakdown[]>([]);
  const [runsState, dispatchRuns] = useReducer(runsReducer, {
    runs: [],
    nextCursor: null,
    bufferedNewRuns: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [topErrors, setTopErrors] = useState<TopErrors | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsData, stagesData, runsData] = await Promise.all([
        fetchJson<Record<string, unknown>>(
          `${baseUrl}/flowpanel.metrics.current?input=${encodeURIComponent(
            JSON.stringify({ timeRange }),
          )}`,
        ),
        fetchJson<StageBreakdown[]>(
          `${baseUrl}/flowpanel.stages.breakdown?input=${encodeURIComponent(
            JSON.stringify({ timeRange }),
          )}`,
        ),
        fetchJson<{ runs: Record<string, unknown>[]; nextCursor: string | null }>(
          `${baseUrl}/flowpanel.runs.list?input=${encodeURIComponent(
            JSON.stringify({ timeRange, stage: selectedStage, limit: 50 }),
          )}`,
        ),
      ]);

      fetchJson<ChartData>(
        `${baseUrl}/flowpanel.runs.chart?input=${encodeURIComponent(
          JSON.stringify({ timeRange }),
        )}`,
      )
        .then(setChartData)
        .catch(() => {});

      fetchJson<TopErrors>(
        `${baseUrl}/flowpanel.runs.topErrors?input=${encodeURIComponent(
          JSON.stringify({ timeRange }),
        )}`,
      )
        .then(setTopErrors)
        .catch(() => {});

      setMetrics(metricsData);
      setStageData(stagesData);
      dispatchRuns({
        type: "SET_RUNS",
        runs: runsData.runs,
        nextCursor: runsData.nextCursor,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, timeRange, selectedStage]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const loadMore = useCallback(async () => {
    if (!runsState.nextCursor) return;
    try {
      const data = await fetchJson<{
        runs: Record<string, unknown>[];
        nextCursor: string | null;
      }>(
        `${baseUrl}/flowpanel.runs.list?input=${encodeURIComponent(
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
      const message = err instanceof Error ? err.message : "Failed to load more runs";
      setError(message);
    }
  }, [baseUrl, timeRange, selectedStage, runsState.nextCursor]);

  const resetDemo = useCallback(async () => {
    try {
      await fetch(`${baseUrl}/flowpanel.demo.reset`, { method: "POST" });
      void fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reset demo";
      setError(message);
    }
  }, [baseUrl, fetchData]);

  return {
    metrics,
    stageData,
    runsState,
    dispatchRuns,
    loading,
    error,
    chartData,
    topErrors,
    refresh: fetchData,
    loadMore,
    resetDemo,
  };
}
