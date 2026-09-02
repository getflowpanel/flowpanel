"use client";
import { useCallback, useEffect, useState } from "react";

export interface AdminCommand {
  open: boolean;
  setOpen: (v: boolean) => void;
  openPalette: () => void;
  close: () => void;
}

/** Controls the ⌘K command palette. */
export function useAdminCommand(): AdminCommand {
  const [open, setOpen] = useState(false);

  const openPalette = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  return { open, setOpen, openPalette, close };
}
