"use client";
import { useCallback, useMemo } from "react";
import { useUrlState } from "./useUrlState";

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

/** Reads `?drawer=<resource>:<id>` and the drawer's own tab, `?drawerTab=<key>`; `?tab=` is the page's. */
export function useAdminDrawer(): AdminDrawer {
  const url = useUrlState();

  const state: AdminDrawerState = useMemo(() => {
    const tab = url.get("drawerTab");
    const raw = url.get("drawer");
    const sep = raw ? raw.indexOf(":") : -1;
    const resource = raw && sep > 0 ? raw.slice(0, sep) : "";
    const id = raw && sep > 0 ? raw.slice(sep + 1) : "";
    if (!resource || !id) return { resource: null, id: null, tab };
    return { resource, id, tab };
  }, [url]);

  const open = useCallback(
    ({ resource, id, tab }: OpenArgs) => {
      url.set({ drawer: `${resource}:${id}`, drawerTab: tab ?? null });
    },
    [url],
  );

  const close = useCallback(() => {
    url.set({ drawer: null, drawerTab: null });
  }, [url]);

  return { state, open, close };
}
