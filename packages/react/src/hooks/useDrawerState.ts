import type { FlowPanelConfig } from "@flowpanel/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DrawerResponse } from "./useFlowPanelData";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DrawerPosition {
  open: boolean;
  type: string;
  runId?: string;
}

interface UseDrawerStateOptions {
  config: FlowPanelConfig;
  baseUrl: string;
  /** Runs already fetched by the dashboard — used to build run detail without a server round-trip */
  allRuns?: Record<string, unknown>[];
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const json = (await res.json()) as { result: { data: T } };
  return json.result.data;
}

// ─── Client-side run detail builder ──────────────────────────────────────────

// Fields promoted to the stats row (shown large, formatted)
const STAT_FIELDS = new Set(["status", "stage", "duration_ms"]);

function buildRunDetailSections(run: Record<string, unknown>): DrawerResponse {
  const statData: Record<string, unknown> = {};
  const kvData: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(run)) {
    if (v == null) continue;
    if (STAT_FIELDS.has(k)) statData[k] = v;
    else kvData[k] = v;
  }

  const sections: Array<{ type: string; data: unknown }> = [];
  if (Object.keys(statData).length > 0) sections.push({ type: "stat-grid", data: statData });
  if (Object.keys(kvData).length > 0) sections.push({ type: "kv-grid", data: kvData });

  if (run.status === "failed" && (run.error_class || run.error_message)) {
    sections.push({
      type: "error-block",
      data: {
        errorClass: String(run.error_class ?? "Error"),
        errorMessage: String(run.error_message ?? "Run failed"),
        stackTrace: run.stack_trace ? String(run.stack_trace) : undefined,
      },
    });
  }

  return { sections, run };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDrawerState({ config, baseUrl, allRuns }: UseDrawerStateOptions) {
  const [drawerPosition, setDrawerPosition] = useState<DrawerPosition>({
    open: false,
    type: "",
  });
  const [drawerData, setDrawerData] = useState<DrawerResponse | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>();

  // Keep allRuns in a ref — changes to the runs list shouldn't re-trigger the drawer effect
  const allRunsRef = useRef(allRuns);
  useEffect(() => {
    allRunsRef.current = allRuns;
  });

  useEffect(() => {
    if (!drawerPosition.open) {
      setDrawerData(null);
      return;
    }

    const drawerId = drawerPosition.type === "runDetail" ? "run-detail" : drawerPosition.type;
    const drawerConfig = (config.drawers as Record<string, unknown> | undefined)?.[drawerId];

    // For run detail without a custom server config: build sections from locally available data
    if (drawerPosition.type === "runDetail" && !drawerConfig) {
      const run = allRunsRef.current?.find((r) => String(r.id) === drawerPosition.runId);
      if (run) {
        setDrawerData(buildRunDetailSections(run));
        setDrawerLoading(false);
      }
      return;
    }

    if (!drawerConfig) return;

    let cancelled = false;
    setDrawerLoading(true);
    setDrawerData(null);

    const input: Record<string, unknown> = { drawerId };
    if (drawerPosition.runId) input.runId = drawerPosition.runId;

    fetchJson<DrawerResponse>(
      `${baseUrl}/flowpanel.drawers.render?input=${encodeURIComponent(JSON.stringify(input))}`,
    )
      .then((data) => {
        if (!cancelled) setDrawerData(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDrawerLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [drawerPosition.open, drawerPosition.type, drawerPosition.runId, config.drawers, baseUrl]);

  const openDrawer = useCallback((type: string, runId?: string) => {
    if (runId) setSelectedRunId(runId);
    setDrawerPosition({ open: true, type, runId });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerPosition({ open: false, type: "" });
  }, []);

  const drawerTitle = (() => {
    if (drawerPosition.type === "runDetail") return `Run ${drawerPosition.runId ?? ""}`;
    const entry = (
      config.drawers as
        | Record<string, { title?: string | ((...args: unknown[]) => string) }>
        | undefined
    )?.[drawerPosition.type];
    if (typeof entry?.title === "string") return entry.title;
    return drawerPosition.type || "Details";
  })();

  return {
    isOpen: drawerPosition.open,
    type: drawerPosition.type,
    runId: drawerPosition.runId,
    drawerData,
    drawerLoading,
    drawerTitle,
    selectedRunId,
    openDrawer,
    closeDrawer,
  };
}
