import type { ReactNode } from "react";
import type { Adapter } from "@/shared/lib/adapter";

interface AdapterTabsProps {
  children: ReactNode;
}

/**
 * MDX-only block that pairs Prisma and Drizzle variants of the same
 * content. Both branches are server-rendered into the DOM at the same
 * time; CSS hides the inactive one based on `html[data-adapter]`.
 *
 * No JS is needed for the toggle to work — flipping the dataset
 * attribute via AdapterToggle re-resolves the CSS. This means SSR is
 * always correct on first paint and there is no flash.
 *
 * Usage in MDX:
 *
 *   <AdapterTabs>
 *     <AdapterTab adapter="prisma">...</AdapterTab>
 *     <AdapterTab adapter="drizzle">...</AdapterTab>
 *   </AdapterTabs>
 */
export function AdapterTabs({ children }: AdapterTabsProps) {
  return (
    <div className="not-prose my-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        <span>Adapter example</span>
        <span>Toggle in the sidebar</span>
      </header>
      <div className="p-4">{children}</div>
    </div>
  );
}

interface AdapterTabProps {
  adapter: Adapter;
  children: ReactNode;
}

/**
 * One branch inside <AdapterTabs>. The `data-adapter-tab` attribute is
 * the hook the CSS rule in globals.css uses to show/hide each branch.
 */
export function AdapterTab({ adapter, children }: AdapterTabProps) {
  return <div data-adapter-tab={adapter}>{children}</div>;
}
