import Link from "next/link";
import { SearchTrigger } from "@/features/search-trigger";
import { ThemeToggle } from "@/features/theme-toggle";
import { siteConfig } from "@/shared/lib/site-config";
import { flowpanelVersion } from "@/shared/lib/version";
import { Logo } from "@/shared/ui/logo";
import { GitHubLink } from "./GitHubLink";

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

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-bg)_88%,transparent)] backdrop-blur-md">
      <div
        className={
          isDocs
            ? "mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 sm:gap-6 sm:px-6"
            : "mx-auto flex h-14 max-w-[1120px] items-center gap-3 px-4 sm:gap-6 sm:px-6"
        }
      >
        <div className="flex shrink-0 items-center gap-2.5 font-mono">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
            aria-label={`${siteConfig.name} home`}
          >
            <Logo size={24} className="text-[var(--color-accent)]" />
            <span className="text-base font-medium text-[var(--color-fg)]">{siteConfig.name}</span>
          </Link>
          <span className="hidden rounded-md border border-[var(--color-border)] px-1.5 py-0.5 text-xs text-[var(--color-fg-muted)] sm:inline-flex">
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
          className="flex shrink-0 items-center gap-0.5 font-mono text-sm text-[var(--color-fg-muted)] sm:gap-3"
        >
          <Link
            href="/docs"
            className="inline-flex min-h-11 items-center px-2 transition-colors hover:text-[var(--color-fg)]"
          >
            Docs
          </Link>
          <Link
            href="/changelog"
            className="hidden min-h-11 items-center px-2 transition-colors hover:text-[var(--color-fg)] sm:inline-flex"
          >
            Changelog
          </Link>
          <GitHubLink />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
