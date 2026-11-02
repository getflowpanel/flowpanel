import type { ReactNode } from "react";
import type { Adapter } from "@/shared/lib/adapter";

interface AdapterTabsProps {
  children: ReactNode;
}

// Both branches render; CSS on html[data-adapter] hides the inactive one, so there is no flash.
export function AdapterTabs({ children }: AdapterTabsProps) {
  return (
    <div className="not-prose my-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2 font-mono text-xs text-[var(--color-fg-subtle)]">
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

export function AdapterTab({ adapter, children }: AdapterTabProps) {
  return <div data-adapter-tab={adapter}>{children}</div>;
}
