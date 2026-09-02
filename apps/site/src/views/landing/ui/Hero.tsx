import { ArrowDown, ArrowUpRight } from "lucide-react";
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
            className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-6 py-3 font-mono text-sm font-medium text-[var(--color-accent-fg)] transition-[background-color,box-shadow] duration-200 hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] active:bg-[var(--color-accent-hover)]"
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
            className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-lg px-3 py-2 font-mono text-sm text-[var(--color-fg-muted)] transition-colors duration-200 hover:text-[var(--color-fg)] sm:justify-start"
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
            alt="FlowPanel admin — the Overview dashboard with metric cards, a live throughput group and a realtime crawl-rate chart"
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
