import { Star } from "lucide-react";
import Link from "next/link";
import { SearchTrigger } from "@/features/search-trigger";
import { ThemeToggle } from "@/features/theme-toggle";
import { siteConfig } from "@/shared/lib/site-config";
import { flowpanelVersion } from "@/shared/lib/version";

interface SiteHeaderProps {
  variant?: "marketing" | "docs";
}

/**
 * Top navigation. Two variants:
 *   - marketing — landing/changelog (logo + version chip + nav)
 *   - docs      — wider; "docs" chip + inline search trigger
 *
 * Server-rendered; only ThemeToggle and SearchTrigger are client islands.
 */
export function SiteHeader({ variant = "marketing" }: SiteHeaderProps) {
  const isDocs = variant === "docs";
  const maxWidth = isDocs ? "max-w-[1280px]" : "max-w-[1120px]";

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-bg)_88%,transparent)] backdrop-blur-md">
      <div className={`mx-auto flex h-14 ${maxWidth} items-center gap-6 px-6`}>
        <div className="flex shrink-0 items-center gap-3 font-mono text-sm">
          <Link
            href="/"
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
            aria-label={`${siteConfig.name} home`}
          >
            <span
              aria-hidden
              className="grid h-7 w-7 place-items-center rounded-[6px] bg-[var(--color-fg)] font-bold text-[var(--color-bg)]"
            >
              f
            </span>
            <span className="font-medium text-[var(--color-fg)]">{siteConfig.name}</span>
          </Link>
          <span className="rounded-md border border-[var(--color-border)] px-1.5 py-0.5 text-xs text-[var(--color-fg-muted)]">
            {isDocs ? "docs" : `v${flowpanelVersion}`}
          </span>
        </div>

        {isDocs ? (
          <div className="hidden flex-1 justify-center md:flex">
            <SearchTrigger />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <nav
          aria-label="Primary"
          className="flex shrink-0 items-center gap-3 font-mono text-sm text-[var(--color-fg-muted)] sm:gap-5"
        >
          <Link href="/docs" className="transition-colors hover:text-[var(--color-fg)]">
            Docs
          </Link>
          <Link
            href="/changelog"
            className="hidden transition-colors hover:text-[var(--color-fg)] sm:inline"
          >
            Changelog
          </Link>
          <a
            href={siteConfig.links.github}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-[var(--color-fg)]"
            aria-label={`${siteConfig.name} on GitHub`}
          >
            <span className="hidden sm:inline">GitHub</span>
            <Star aria-hidden className="h-3.5 w-3.5 fill-current text-[var(--color-fg-subtle)]" />
            <span className="text-[var(--color-fg-subtle)]">1.2k</span>
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
