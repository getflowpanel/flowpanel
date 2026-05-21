"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Theme toggle — light ↔ dark via next-themes.
 * Renders a non-interactive placeholder until mounted to avoid a flash of
 * the wrong icon during hydration.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";

  // Gate everything that depends on the resolved theme behind `mounted`
  // so SSR and the first client render match. Otherwise the server emits
  // one aria-label (computed from undefined theme) and the client patches
  // it on hydration — a tree-mismatch warning we don't need.
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={mounted ? `Switch to ${next} theme` : "Toggle theme"}
      className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
    >
      {mounted ? (
        isDark ? (
          <Sun aria-hidden className="h-4 w-4" />
        ) : (
          <Moon aria-hidden className="h-4 w-4" />
        )
      ) : (
        <span aria-hidden className="h-4 w-4" />
      )}
    </button>
  );
}
