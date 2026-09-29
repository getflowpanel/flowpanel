import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/shared/lib/site-config";
import { CopyButton } from "@/shared/ui/copy-button";
import { InlineCode } from "@/shared/ui/inline-code";
import { MediaFrame } from "@/shared/ui/media-frame";
import { TrustBar } from "./TrustBar";

const INSTALL_CMD = "pnpm dlx @flowpanel/cli init";

export function Hero() {
  const demo = siteConfig.links.demo;

  return (
    <section
      aria-labelledby="hero-title"
      className="border-b border-[var(--color-border)] pt-24 pb-20 md:pt-28 md:pb-28"
    >
      <div className="mx-auto max-w-[1120px] px-6">
        <Link
          href="/docs/guides/upgrade#upgrading-from-030-to-031"
          className="mb-6 inline-flex min-h-11 items-center gap-2 font-mono text-xs text-[var(--color-fg-muted)] transition-colors duration-200 hover:text-[var(--color-fg)]"
        >
          <span>0.3.1: typed widget reads, record pages and a calmer default look</span>
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
        <h1
          id="hero-title"
          className="max-w-[16ch] text-balance text-5xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-7xl"
        >
          The Next.js admin&nbsp;panel you don&apos;t have to build.
        </h1>

        <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-[var(--color-fg-muted)] md:text-xl">
          A typed config becomes a full <InlineCode>/admin</InlineCode> route for your Next.js app:
          lists, record pages, dashboards, queues and realtime. Drizzle or Prisma. Eject when you
          outgrow it.
        </p>

        <nav
          aria-label="Hero actions"
          className="mt-9 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4"
        >
          <a
            href={demo || "#demo"}
            {...(demo
              ? {
                  target: "_blank",
                  rel: "noopener noreferrer",
                  "aria-label": "Open the live FlowPanel demo in a new tab",
                }
              : {})}
            className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-lg bg-[var(--color-ink)] px-6 py-3 font-mono text-sm font-medium text-[var(--color-ink-fg)] transition-colors duration-200 hover:bg-[var(--color-ink-hover)] active:bg-[var(--color-ink-hover)]"
          >
            <span>{demo ? "Open live demo" : "Explore the demo"}</span>
            {demo ? (
              <ArrowUpRight aria-hidden className="h-4 w-4" />
            ) : (
              <ArrowDown aria-hidden className="h-4 w-4" />
            )}
          </a>
          <Link
            href="/docs"
            className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-lg border border-[var(--color-border-strong)] px-6 py-3 font-mono text-sm font-medium text-[var(--color-fg)] transition-colors duration-200 hover:bg-[var(--color-bg-subtle)] active:bg-[var(--color-bg-subtle)]"
          >
            <span>Read the docs</span>
            <ArrowUpRight aria-hidden className="h-4 w-4" />
          </Link>
        </nav>

        <section aria-label="Quick start" className="mt-8 min-w-0 w-full max-w-[640px]">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
            <span className="text-[var(--color-fg-subtle)]">Quick start</span>
            <span className="text-[var(--color-fg-muted)]">
              Detects your ORM and scaffolds /admin
            </span>
          </div>
          <div className="flex min-h-14 w-full items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-2 font-mono text-sm shadow-[var(--shadow-card)]">
            <span className="truncate text-[var(--color-fg)]">
              <span className="text-[var(--color-fg-subtle)]">$ </span>
              {INSTALL_CMD}
            </span>
            <CopyButton text={INSTALL_CMD} />
          </div>
        </section>

        <TrustBar />

        <div className="mt-14 md:mt-16">
          <MediaFrame
            srcDark="/admin-overview-dark.png"
            srcLight="/admin-overview-light.png"
            alt="FlowPanel admin in a Next.js app: the Overview dashboard with a date range, four metric cards and a live panel with a crawl-rate chart and a market activity feed"
            width={2880}
            height={1380}
            url="localhost:3000/admin"
            priority
          />
        </div>
      </div>
    </section>
  );
}
