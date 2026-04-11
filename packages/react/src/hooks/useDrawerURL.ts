import { useCallback, useEffect, useState } from "react";

interface DrawerURLState {
  runId: string | null;
  open: (runId: string) => void;
  close: () => void;
}

export function useDrawerURL(): DrawerURLState {
  const [runId, setRunId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("run");
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setRunId(params.get("run"));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const open = useCallback((id: string) => {
    setRunId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("run", id);
    window.history.pushState({}, "", url.toString());
  }, []);

  const close = useCallback(() => {
    setRunId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("run");
    window.history.replaceState({}, "", url.toString());
  }, []);

  return { runId, open, close };
}
