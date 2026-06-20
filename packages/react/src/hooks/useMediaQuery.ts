"use client";
import * as React from "react";

/** Subscribe to a CSS media query and re-render when it flips. */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = React.useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  }, [query]);
  const getServerSnapshot = React.useCallback(() => false, []);
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
