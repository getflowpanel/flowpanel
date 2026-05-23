"use client";
import * as React from "react";

/**
 * Subscribe to a CSS media query and re-render when it flips.
 *
 * Built on `useSyncExternalStore` so it's SSR-safe — the server snapshot
 * is `false` (the safe default for "not matching") and the client wires
 * the real `MediaQueryList` listener on mount. No hydration mismatch.
 *
 * Used by `<DataTable>` to pick between the mobile card list and the
 * desktop table without rendering both DOM trees at once — testing-
 * library queries would otherwise find content in both.
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery("(max-width: 639px)");
 * return isMobile ? <MobileCardList ... /> : <Table ... />;
 * ```
 */
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
  // Server snapshot: always false. `<DataTable>` defaults to desktop on
  // the server (the more general layout), so the initial paint is
  // sensible even before the client picks up.
  const getServerSnapshot = React.useCallback(() => false, []);
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
