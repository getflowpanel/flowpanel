"use client";

import { useSearchContext } from "fumadocs-ui/contexts/search";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Search trigger for the docs header. Opens the shared Fumadocs search
 * dialog (Orama-backed) and surfaces the ⌘K / Ctrl K hint.
 *
 * The dialog itself is mounted by `RootProvider` in the root layout.
 */
export function SearchTrigger() {
  const { setOpenSearch } = useSearchContext();
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
  }, []);

  return (
    <button
      type="button"
      className="group flex h-9 w-full max-w-[420px] items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-left font-mono text-sm text-[var(--color-fg-subtle)] transition-colors hover:border-[var(--color-border-strong)]"
      onClick={() => setOpenSearch(true)}
      aria-label="Search documentation"
    >
      <Search aria-hidden className="h-4 w-4" />
      <span className="flex-1">Search docs…</span>
      <kbd className="hidden rounded border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-fg-muted)] sm:inline">
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
