"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";

  // Until mounted, render what the server rendered so hydration does not mismatch.
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={mounted ? `Switch to ${next} theme` : "Toggle theme"}
      className="grid h-11 w-11 place-items-center rounded-md text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
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
