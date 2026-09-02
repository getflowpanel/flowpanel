import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { DEFAULT_ADAPTER } from "@/features/adapter-switcher";
import { SiteFooter } from "@/widgets/site-footer";
import { SiteHeader } from "@/widgets/site-header";
import { Sidebar } from "./ui/Sidebar";

interface DocsLayoutShellProps {
  tree: PageTreeRoot;
  children: ReactNode;
}

/**
 * Composes the docs surface: docs-flavored header, then a three-column
 * grid (sidebar, content, toc) at `lg` and up. Below `lg` the layout
 * collapses to a single column and the sidebar moves into a
 * `<details>` disclosure at the top so navigation still works on
 * mobile.
 *
 * Caller renders the **content** + **toc** as two adjacent children
 * (they fill the 2nd and 3rd grid cells respectively). See `DocsPage`
 * for the canonical example.
 */
export function DocsLayoutShell({ tree, children }: DocsLayoutShellProps) {
  return (
    <>
      <SiteHeader variant="docs" />
      <details className="group mx-auto block max-w-[1280px] border-b border-[var(--color-border)] px-6 py-3 lg:hidden">
        <summary className="flex cursor-pointer items-center justify-between font-mono text-sm text-[var(--color-fg-muted)] [&::-webkit-details-marker]:hidden">
          <span>Browse documentation</span>
          <ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 pb-2">
          <Sidebar tree={tree} adapter={DEFAULT_ADAPTER} />
        </div>
      </details>
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_200px]">
        <aside className="docs-sidebar-scrollbar hidden lg:sticky lg:top-20 lg:block lg:w-[calc(100%+0.75rem)] lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-5 lg:[scrollbar-gutter:stable]">
          <Sidebar tree={tree} adapter={DEFAULT_ADAPTER} />
        </aside>
        {children}
      </div>
      <SiteFooter />
    </>
  );
}
