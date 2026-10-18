"use client";
import * as React from "react";
import { ChunkBoundary } from "../lib/chunk-boundary";
import { lazyRetry } from "../lib/lazy-retry";
import type { ShortcutsCheatsheetProps } from "./ShortcutsCheatsheet";
import { SHORTCUTS_EVENT, ShortcutsAvailable } from "./ShortcutsHint";

function typingIn(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

const ShortcutsCheatsheet = lazyRetry<ShortcutsCheatsheetProps>(() =>
  import("./ShortcutsCheatsheet").then((module) => ({ default: module.ShortcutsCheatsheet })),
);

/** Binds `?` to the cheat sheet and `/` to the page's search box, outside text fields. */
export function ShortcutsHost({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [opened, setOpened] = React.useState(false);
  if (open && !opened) setOpened(true);

  React.useEffect(() => {
    const show = () => setOpen(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (typingIn(event.target)) return;
      if (event.key === "?") {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "/") {
        const search = document.querySelector<HTMLInputElement>('main input[type="search"]');
        if (!search) return;
        event.preventDefault();
        search.focus();
      }
    };
    window.addEventListener(SHORTCUTS_EVENT, show);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(SHORTCUTS_EVENT, show);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <ShortcutsAvailable.Provider value={true}>
      {children}
      {opened ? (
        <ChunkBoundary floating>
          <React.Suspense fallback={null}>
            <ShortcutsCheatsheet open={open} onOpenChange={setOpen} />
          </React.Suspense>
        </ChunkBoundary>
      ) : null}
    </ShortcutsAvailable.Provider>
  );
}
