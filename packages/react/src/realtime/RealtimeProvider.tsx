"use client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useLatest } from "../lib/use-latest";
import { useApiBase } from "../provider/ApiBaseContext";
import { RealtimeContext, type RealtimeProviderProps } from "./context";
import { RealtimeEngine } from "./engine";

/** Mounts a single shared EventSource for all descendant `useRealtimeRefresh(...)` calls. */
export function RealtimeProvider(props: RealtimeProviderProps): React.JSX.Element {
  const parent = React.useContext(RealtimeContext);
  if (parent) return <>{props.children}</>;
  return <RealtimeProviderInner {...props} />;
}

/**
 * Coalesces events into one `router.refresh()`, held while the tab is hidden and run once on
 * return, plus one after a dropped stream comes back.
 */
function useCoalescedRefresh(debounceMs: number) {
  const router = useRouter();
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const missed = React.useRef(false);
  const refresh = React.useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      missed.current = true;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      router.refresh();
    }, debounceMs);
  }, [router, debounceMs]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden" || !missed.current) return;
      missed.current = false;
      refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return refresh;
}

function RealtimeProviderInner({
  endpoint,
  reopenDebounceMs = 50,
  refreshDebounceMs = 400,
  children,
}: RealtimeProviderProps): React.JSX.Element {
  const apiBase = useApiBase();
  const streamUrl = endpoint ?? `${apiBase}/stream`;
  const refresh = useCoalescedRefresh(refreshDebounceMs);
  const refreshRef = useLatest(refresh);

  const engine = React.useMemo(
    () =>
      new RealtimeEngine({
        endpoint: streamUrl,
        reopenDebounceMs,
        onFrame: (_frame, shouldRefresh) => {
          if (shouldRefresh) refreshRef.current();
        },
        onReconnect: () => refreshRef.current(),
      }),
    [streamUrl, reopenDebounceMs, refreshRef],
  );

  React.useEffect(() => () => engine.close(), [engine]);

  return <RealtimeContext.Provider value={engine}>{children}</RealtimeContext.Provider>;
}
