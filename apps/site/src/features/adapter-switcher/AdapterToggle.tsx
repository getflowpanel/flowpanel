"use client";

import { useEffect, useState } from "react";
import {
  ADAPTER_COOKIE,
  ADAPTERS,
  type Adapter,
  DEFAULT_ADAPTER,
  isAdapter,
} from "@/shared/lib/adapter";

interface AdapterToggleProps {
  /** Server-resolved initial value — prevents flash on first paint. */
  initial: Adapter;
}

/**
 * Client island that exposes the adapter as a small button group.
 *
 * On mount we mirror `document.documentElement.dataset.adapter` (set by
 * the layout from the cookie) into state, then keep both in sync on
 * every change. The dataset attribute drives CSS visibility of
 * <AdapterTabs> branches across the whole page — no re-render needed.
 *
 * Used in the docs sidebar; can be reused in any docs surface that
 * wants to expose the toggle.
 */
export function AdapterToggle({ initial }: AdapterToggleProps) {
  const [adapter, setAdapter] = useState<Adapter>(initial);

  // Keep in sync if another instance (or a server navigation) updates
  // the dataset behind our back.
  useEffect(() => {
    const ds = document.documentElement.dataset.adapter;
    if (isAdapter(ds) && ds !== adapter) setAdapter(ds);
  }, [adapter]);

  function change(next: Adapter) {
    if (next === adapter) return;
    setAdapter(next);
    document.documentElement.dataset.adapter = next;
    // 1-year persistence; SameSite=Lax avoids leakage and works on top-level navs.
    // biome-ignore lint/suspicious/noDocumentCookie: state must round-trip to the SSR layout, which reads it via next/headers cookies().
    document.cookie = `${ADAPTER_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <fieldset
      aria-label="Adapter"
      className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5 font-mono text-sm"
    >
      {ADAPTERS.map((value) => {
        const isActive = value === adapter;
        return (
          <button
            key={value}
            type="button"
            onClick={() => change(value)}
            aria-pressed={isActive}
            className={[
              "rounded-md px-3 py-1 transition-colors",
              isActive
                ? "bg-[var(--color-bg-elevated)] text-[var(--color-fg)] shadow-sm"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
            ].join(" ")}
          >
            {labelFor(value)}
          </button>
        );
      })}
    </fieldset>
  );
}

function labelFor(adapter: Adapter): string {
  return adapter === "prisma" ? "Prisma" : "Drizzle";
}

export { DEFAULT_ADAPTER };
