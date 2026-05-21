import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import { ChevronDown } from "lucide-react";
import { type Adapter, AdapterToggle } from "@/features/adapter-switcher";
import { flowpanelVersion } from "@/shared/lib/version";
import { PageTreeNav } from "./PageTreeNav";

interface SidebarProps {
  tree: PageTreeRoot;
  adapter: Adapter;
}

/**
 * Left rail of the docs surface. Three blocks, top to bottom:
 *   1. Adapter toggle — cookie-driven Prisma ↔ Drizzle switcher.
 *      Drives `<AdapterTabs>` visibility across the page via CSS.
 *   2. Version chip — current package version, "latest" tag.
 *      Versioned docs are out of scope for v1.
 *   3. Nav tree — sections + pages from `source.pageTree`.
 */
export function Sidebar({ tree, adapter }: SidebarProps) {
  return (
    <nav aria-label="Documentation" className="flex flex-col gap-8 text-sm">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
          Adapter
        </p>
        <div className="mt-2">
          <AdapterToggle initial={adapter} />
        </div>
      </div>
      <SelectorChip label="Version" value={`v${flowpanelVersion}`} caption="latest" />
      <div className="border-t border-[var(--color-border)] pt-6">
        <PageTreeNav items={tree.children} />
      </div>
    </nav>
  );
}

interface SelectorChipProps {
  label: string;
  value: string;
  caption: string;
}

/**
 * Static disclosure-styled chip used for the Adapter and Version
 * selectors. Renders as a button to communicate "this will be
 * interactive eventually", but takes no action in v1.
 */
function SelectorChip({ label, value, caption }: SelectorChipProps) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        {label}
      </p>
      <button
        type="button"
        className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-left transition-colors hover:border-[var(--color-border-strong)]"
        aria-label={`${label}: ${value}`}
      >
        <span className="flex items-baseline gap-2 font-mono">
          <span className="font-medium text-[var(--color-fg)]">{value}</span>
          <span className="text-xs text-[var(--color-fg-subtle)]">· {caption}</span>
        </span>
        <ChevronDown aria-hidden className="h-4 w-4 text-[var(--color-fg-subtle)]" />
      </button>
    </div>
  );
}
