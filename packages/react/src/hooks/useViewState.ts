import { useCallback, useEffect, useState } from "react";

export interface ViewState {
  timeRange: string;
  stage: string | null;
  status: string | null;
  search: string;
  runId: string | null;
}

const DEFAULTS: ViewState = {
  timeRange: "24h",
  stage: null,
  status: null,
  search: "",
  runId: null,
};

function readFromURL(): Partial<ViewState> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    timeRange: params.get("t") ?? undefined,
    stage: params.get("stage") ?? undefined,
    status: params.get("status") ?? undefined,
    search: params.get("q") ?? undefined,
    runId: params.get("run") ?? undefined,
  };
}

function writeToURL(state: ViewState, method: "push" | "replace" = "replace") {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const params = url.searchParams;

  state.timeRange !== DEFAULTS.timeRange ? params.set("t", state.timeRange) : params.delete("t");
  state.stage ? params.set("stage", state.stage) : params.delete("stage");
  state.status ? params.set("status", state.status) : params.delete("status");
  state.search ? params.set("q", state.search) : params.delete("q");
  state.runId ? params.set("run", state.runId) : params.delete("run");

  const fn = method === "push" ? "pushState" : "replaceState";
  window.history[fn]({}, "", url.toString());
}

export function useViewState(defaultTimeRange = "24h"): {
  state: ViewState;
  setTimeRange: (t: string) => void;
  setStage: (s: string | null) => void;
  setStatus: (s: string | null) => void;
  setSearch: (q: string) => void;
  openRun: (id: string) => void;
  closeRun: () => void;
  clearFilters: () => void;
} {
  const [state, setState] = useState<ViewState>(() => {
    const fromURL = readFromURL();
    return {
      ...DEFAULTS,
      timeRange: defaultTimeRange,
      ...Object.fromEntries(Object.entries(fromURL).filter(([, v]) => v != null)),
    } as ViewState;
  });

  useEffect(() => {
    const handler = () => {
      const fromURL = readFromURL();
      setState((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.entries(fromURL).filter(([, v]) => v != null)),
        runId: fromURL.runId ?? null,
      }));
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const update = useCallback(
    (patch: Partial<ViewState>, method: "push" | "replace" = "replace") => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        writeToURL(next, method);
        return next;
      });
    },
    [],
  );

  return {
    state,
    setTimeRange: (t) => update({ timeRange: t }),
    setStage: (s) => update({ stage: s }),
    setStatus: (s) => update({ status: s }),
    setSearch: (q) => update({ search: q }),
    openRun: (id) => update({ runId: id }, "push"),
    closeRun: () => update({ runId: null }, "replace"),
    clearFilters: () => update({ stage: null, status: null, search: "" }),
  };
}
