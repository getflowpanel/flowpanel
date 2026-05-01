"use client";
import { useCallback, useMemo } from "react";
import { useUrlState } from "./useUrlState.js";

export interface AdminDrawerState {
  resource: string | null;
  id: string | null;
  tab: string | null;
}

export interface OpenArgs {
  resource: string;
  id: string;
  tab?: string;
}

export interface AdminDrawer {
  state: AdminDrawerState;
  open: (args: OpenArgs) => void;
  close: () => void;
}

/**
 * Reads `?drawer=<resource>:<id>` and `?tab=<key>` from the URL.
 * Writes via `useUrlState` — router.push keeps the page interactive.
 */
export function useAdminDrawer(): AdminDrawer {
  const url = useUrlState();

  const state: AdminDrawerState = useMemo(() => {
    const raw = url.get("drawer");
    if (!raw) return { resource: null, id: null, tab: url.get("tab") };
    const sep = raw.indexOf(":");
    if (sep < 0) return { resource: null, id: null, tab: url.get("tab") };
    const resource = raw.slice(0, sep);
    const id = raw.slice(sep + 1);
    if (!resource || !id) return { resource: null, id: null, tab: url.get("tab") };
    return { resource, id, tab: url.get("tab") };
  }, [url]);

  const open = useCallback(
    ({ resource, id, tab }: OpenArgs) => {
      url.set({ drawer: `${resource}:${id}`, tab: tab ?? null });
    },
    [url],
  );

  const close = useCallback(() => {
    url.set({ drawer: null, tab: null });
  }, [url]);

  return { state, open, close };
}
