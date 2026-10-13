"use client";
import * as React from "react";
import { useLabels } from "../provider/LabelsContext";

/** True under `ShortcutsHost`, which owns the sheet the hint opens. */
export const ShortcutsAvailable = React.createContext(false);

export const SHORTCUTS_EVENT = "flowpanel:shortcuts";

/** Opens the keyboard cheat sheet the admin shell mounts. */
export function openShortcuts(): void {
  window.dispatchEvent(new Event(SHORTCUTS_EVENT));
}

/** The quiet "Press ? for keyboard shortcuts" line under a list a keyboard can drive. */
export function ShortcutsHint() {
  const { shortcuts } = useLabels();
  if (!React.useContext(ShortcutsAvailable)) return null;
  return (
    <button
      type="button"
      onClick={openShortcuts}
      className="fp-hidden fp-shrink-0 fp-items-center fp-gap-1.5 fp-rounded-sm fp-px-4 fp-py-3 fp-text-xs fp-text-faint fp-transition-colors hover:fp-text-soft focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 lg:fp-inline-flex"
    >
      {shortcuts.hint}
    </button>
  );
}
