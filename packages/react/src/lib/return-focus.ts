"use client";
import * as React from "react";
import { useLatest } from "./use-latest";

/** Gives focus back to what opened a dialog, or to `fallback` when that element is gone. */
export function useReturnFocus(fallback?: () => HTMLElement | null | undefined) {
  const opener = React.useRef<HTMLElement | null>(null);
  const fallbackRef = useLatest(fallback);
  const remember = React.useCallback(() => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, []);
  const restore = React.useCallback(
    (event: Event) => {
      const back = opener.current?.isConnected ? opener.current : null;
      opener.current = null;
      // Only a fallback, such as the row a URL named, may need scrolling to.
      const target = back ?? fallbackRef.current?.();
      if (!target) return;
      event.preventDefault();
      target.focus({ preventScroll: back !== null });
    },
    [fallbackRef],
  );
  return { remember, restore };
}
