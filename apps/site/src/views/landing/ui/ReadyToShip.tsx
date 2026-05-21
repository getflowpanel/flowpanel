import { ArrowRight, Github } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/shared/lib/site-config";

export function ReadyToShip() {
  return (
    <section aria-labelledby="ready-title" className="py-28 text-center md:py-40">
      <div className="mx-auto max-w-[760px] px-6">
        <h2
          id="ready-title"
          className="text-balance text-4xl font-semibold tracking-tight md:text-5xl"
        >
          Ready to ship.
        </h2>
        <p className="mt-5 text-lg text-[var(--color-fg-muted)]">
          Open{" "}
          <code className="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--color-fg)]">
            localhost:3000/admin
          </code>{" "}
          in about a minute.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-fg)] px-5 py-3 font-mono text-sm text-[var(--color-bg)] transition-opacity hover:opacity-90"
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
    </section>
  );
}
