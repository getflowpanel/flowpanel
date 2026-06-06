import { ArrowRight, Github } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/shared/lib/site-config";
import { CopyButton } from "@/shared/ui/copy-button";

const INSTALL_CMD = "pnpm dlx @flowpanel/cli init";

export function ReadyToShip() {
  return (
    <section aria-labelledby="ready-title" className="py-28 md:py-36">
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-6 py-20 text-center shadow-[var(--shadow-cta)] md:px-12 md:py-24">
          <h2
            id="ready-title"
            className="text-balance text-4xl font-semibold tracking-[-0.02em] md:text-5xl"
          >
            Ready to ship.
          </h2>
          <p className="mx-auto mt-4 max-w-[46ch] text-lg text-[var(--color-fg-muted)]">
            One command scaffolds your <code className="font-mono">/admin</code>. You&apos;ll be
            looking at real data in about a minute.
          </p>

          <div className="mx-auto mt-9 flex w-full max-w-[420px] items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-left font-mono text-sm">
            <span className="truncate text-[var(--color-fg)]">
              <span className="text-[var(--color-fg-subtle)]">$ </span>
              {INSTALL_CMD}
            </span>
            <CopyButton text={INSTALL_CMD} />
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-3 font-mono text-sm font-medium text-[var(--color-accent-fg)] transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              <span>Read the docs</span>
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-3 font-mono text-sm text-[var(--color-fg)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-subtle)]"
            >
              <Github aria-hidden className="h-4 w-4" />
              <span>Star on GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
