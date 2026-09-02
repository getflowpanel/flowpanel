"use client";
import * as React from "react";
import {
  applyThemeClass,
  readStoredTheme,
  resolveTheme,
  type ThemeChoice,
  type ThemeMode,
  toggleTheme as toggleThemeImpl,
  writeStoredTheme,
} from "../lib/theme";

export interface UseThemeOptions {
  /** Default mode when the user has not made an explicit choice. */
  defaultMode?: ThemeMode;
}

export interface UseTheme {
  theme: ThemeChoice;
  toggle: () => void;
  setTheme: (next: ThemeChoice) => void;
}

/** Read the current theme + a stable toggle that persists to localStorage. */
export function useTheme(opts: UseThemeOptions = {}): UseTheme {
  const defaultMode: ThemeMode = opts.defaultMode ?? "auto";
  const [theme, setThemeState] = React.useState<ThemeChoice>("light");

  React.useEffect(() => {
    const stored = readStoredTheme();
    const sysDark =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = resolveTheme(stored, defaultMode, sysDark);
    applyThemeClass(next);
    setThemeState(next);

    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readStoredTheme() != null) return;
      const resolved = resolveTheme(null, defaultMode, mq.matches);
      applyThemeClass(resolved);
      setThemeState(resolved);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [defaultMode]);

  const toggle = React.useCallback(() => {
    const next = toggleThemeImpl();
    setThemeState(next);
  }, []);

  const setTheme = React.useCallback((next: ThemeChoice) => {
    applyThemeClass(next);
    setThemeState(next);
    writeStoredTheme(next);
  }, []);

  return { theme, toggle, setTheme };
}
