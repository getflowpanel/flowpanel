import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/shared/lib/site-config";
import { flowpanelVersion } from "@/shared/lib/version";
import { CodeBlock, PromptLine } from "@/shared/ui/code-block";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="border-b border-[var(--color-border)] py-28 md:py-40"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <p className="font-mono text-sm text-[var(--color-fg-muted)]">
          v{flowpanelVersion}
          <span className="mx-2 text-[var(--color-fg-subtle)]">·</span>
          pre-1.0
          <span className="mx-2 text-[var(--color-fg-subtle)]">·</span>
          <Link
            href="/changelog"
            className="underline-offset-4 transition-colors hover:text-[var(--color-fg)] hover:underline"
          >
            changelog
          </Link>
        </p>

        <h1
          id="hero-title"
          className="mt-8 max-w-[18ch] text-balance text-5xl font-semibold leading-[1.04] tracking-tight md:text-7xl"
        >
          The admin panel you don&apos;t have to build.
        </h1>

        <p className="mt-8 max-w-[58ch] text-lg leading-relaxed text-[var(--color-fg-muted)] md:text-xl">
          One config file becomes a typed{" "}
          <code className="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 font-mono text-[0.85em] text-[var(--color-fg)]">
            /admin
          </code>{" "}
          route for your Next.js app. Drizzle or Prisma. MIT.
        </p>

        <div className="mt-10 flex flex-wrap items-stretch gap-3">
          <CodeBlock className="min-w-0 flex-1 max-w-[480px]">
            <PromptLine command="pnpm flowpanel init" />
          </CodeBlock>
          <a
            href={siteConfig.links.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 font-mono text-sm text-[var(--color-fg)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-subtle)]"
          >
            <span>GitHub</span>
            <ArrowUpRight aria-hidden className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
