"use client";

import type { TOCItemType } from "fumadocs-core/toc";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { siteConfig } from "@/shared/lib/site-config";

interface TocRailProps {
  toc: TOCItemType[];
  /** Repo-relative path to the source MDX, for the edit link. */
  editPath?: string;
  /** Raw-markdown URL for this page; renders the "View as markdown" link. */
  rawMarkdownHref?: string;
}

/**
 * Right rail on docs pages: "On this page" with anchor links + an
 * "Edit this page on GitHub" affordance.
 *
 * Active heading tracks via IntersectionObserver. We rely on `data-`
 * attributes on the rendered anchors set by Fumadocs's heading components.
 */
export function TocRail({ toc, editPath, rawMarkdownHref }: TocRailProps) {
  const [activeId, setActiveId] = useState<string | null>(toc[0]?.url.replace(/^#/, "") ?? null);

  useEffect(() => {
    if (toc.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: [0, 1] },
    );
    for (const item of toc) {
      const id = item.url.replace(/^#/, "");
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [toc]);

  if (toc.length === 0) return null;

  const editUrl = editPath
    ? `${siteConfig.repo.url}/edit/${siteConfig.repo.branch}/${editPath}`
    : null;

  return (
    <nav aria-label="On this page" className="flex flex-col gap-4 text-sm">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        On this page
      </p>
      <ul className="flex flex-col gap-2">
        {toc.map((item) => {
          const id = item.url.replace(/^#/, "");
          const isActive = id === activeId;
          return (
            <li key={item.url} style={{ paddingLeft: `${(item.depth - 2) * 12}px` }}>
              <a
                href={item.url}
                className={[
                  "block border-l py-1 pl-3 -ml-px transition-colors",
                  isActive
                    ? "border-[var(--color-fg)] font-medium text-[var(--color-fg)]"
                    : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
                ].join(" ")}
              >
                {item.title}
              </a>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-col gap-2">
        {rawMarkdownHref ? (
          <a
            href={rawMarkdownHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            <span>View as markdown</span>
            <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
          </a>
        ) : null}
        {editUrl ? (
          <a
            href={editUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            <span>Edit this page on GitHub</span>
            <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </nav>
  );
}
