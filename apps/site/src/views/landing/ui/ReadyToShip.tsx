import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/shared/ui/copy-button";

const INSTALL_CMD = "pnpm dlx @flowpanel/cli init";

export function ReadyToShip() {
  return (
    <section aria-labelledby="ready-title" className="py-20 md:py-24">
      <div className="mx-auto max-w-[1120px] px-6">
        <div className="grid gap-10 md:grid-cols-[minmax(0,0.85fr)_minmax(360px,1fr)] md:items-end md:gap-20">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
              Get started
            </p>
            <h2
              id="ready-title"
              className="mt-3 text-balance text-3xl font-semibold tracking-[-0.02em] md:text-4xl"
            >
              Start with the CLI.
            </h2>
            <p className="mt-4 max-w-[48ch] text-[var(--color-fg-muted)]">
              Run the initializer in your Next.js app. It detects Drizzle or Prisma, installs the
              packages, and writes your first typed config.
            </p>
          </div>

          <div className="min-w-0">
            <p className="font-mono text-xs text-[var(--color-fg-subtle)]">In your project</p>
            <div className="mt-3 flex min-h-14 items-center justify-between gap-4 border-y border-[var(--color-border)] py-3 font-mono text-sm">
              <span className="min-w-0 break-words text-[var(--color-fg)]">
                <span className="text-[var(--color-fg-subtle)]">$ </span>
                {INSTALL_CMD}
              </span>
              <CopyButton text={INSTALL_CMD} />
            </div>
            <Link
              href="/docs/introduction/getting-started"
              className="mt-3 inline-flex min-h-11 touch-manipulation items-center gap-2 font-mono text-sm text-[var(--color-fg-muted)] transition-colors duration-200 hover:text-[var(--color-fg)]"
            >
              <span>Read the getting started guide</span>
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
