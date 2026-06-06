import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/shared/lib/site-config";
import { CopyButton } from "@/shared/ui/copy-button";
import { InlineCode } from "@/shared/ui/inline-code";
import { MediaFrame } from "@/shared/ui/media-frame";
import { TrustBar } from "./TrustBar";

const INSTALL_CMD = "pnpm dlx @flowpanel/cli init";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="border-b border-[var(--color-border)] pt-24 pb-20 md:pt-28 md:pb-28"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <h1
          id="hero-title"
          className="max-w-[16ch] text-balance text-5xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-7xl"
        >
          The admin panel you don&apos;t have to build.
        </h1>

        <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-[var(--color-fg-muted)] md:text-xl">
          One typed config becomes a full <InlineCode>/admin</InlineCode> route for your Next.js app
          — CRUD, dashboards, queues, realtime. Drizzle or Prisma. Eject when you outgrow it.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
          <div className="flex w-full items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-3 font-mono text-sm sm:min-w-0 sm:max-w-[460px] sm:flex-1">
            <span className="truncate text-[var(--color-fg)]">
              <span className="text-[var(--color-fg-subtle)]">$ </span>
              {INSTALL_CMD}
            </span>
            <CopyButton text={INSTALL_CMD} />
          </div>
          <Link
            href="/docs"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-3 font-mono text-sm font-medium text-[var(--color-accent-fg)] transition-colors hover:bg-[var(--color-accent-hover)] sm:justify-start"
          >
            <span>Read the docs</span>
            <ArrowUpRight aria-hidden className="h-4 w-4" />
          </Link>
          <a
            href={siteConfig.links.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 font-mono text-sm text-[var(--color-fg)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-subtle)] sm:justify-start"
          >
            <span>GitHub</span>
            <ArrowUpRight aria-hidden className="h-4 w-4" />
          </a>
        </div>

        <TrustBar />

        <div className="mt-14 md:mt-16">
          <MediaFrame
            srcDark="/admin-jobs-dark.png"
            srcLight="/admin-jobs-light.png"
            alt="FlowPanel admin — the Jobs list with search, filters, typed columns and resolved relations"
            width={2880}
            height={1240}
            url="localhost:3000/admin"
            priority
          />
        </div>
      </div>
    </section>
  );
}
