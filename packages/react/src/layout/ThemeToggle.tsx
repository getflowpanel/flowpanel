"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../utils/cn";

type Mode = "light" | "dark" | "system";

const STORAGE_KEY = "fp-theme";

function readStoredMode(): Mode {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

function applyMode(mode: Mode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("fp-light", "fp-dark");
  if (mode === "light") root.classList.add("fp-light");
  if (mode === "dark") root.classList.add("fp-dark");
}

/**
 * Three-state theme toggle (light / dark / system). Persists to localStorage,
 * applies via html.fp-light / html.fp-dark class — same classes the variables.css
 * file keys off. On first mount, reads stored preference and applies it.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    const stored = readStoredMode();
    setMode(stored);
    applyMode(stored);
  }, []);

  const cycle = useCallback(() => {
    setMode((prev) => {
      const next: Mode = prev === "system" ? "light" : prev === "light" ? "dark" : "system";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
      applyMode(next);
      return next;
    });
  }, []);

  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  const label =
    mode === "light"
      ? "Light mode"
      : mode === "dark"
        ? "Dark mode"
        : "System theme (click to change)";

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
