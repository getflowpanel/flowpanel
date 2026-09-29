import Link from "next/link";
import { siteConfig } from "@/shared/lib/site-config";
import { InlineCode } from "@/shared/ui/inline-code";
import { MediaFrame } from "@/shared/ui/media-frame";

export function Hero() {
  const demo = siteConfig.links.demo;

  return (
    <section aria-labelledby="hero-title" className="pt-16 pb-16 md:pt-28 md:pb-24">
      <div className="mx-auto max-w-[1120px] px-6">
        <h1
          id="hero-title"
          className="max-w-[14ch] text-balance text-5xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-7xl"
        >
          A typed admin panel for Next.js
        </h1>

        <p className="mt-6 max-w-[54ch] text-lg leading-relaxed text-[var(--color-fg-muted)] md:text-xl">
          Describe your Drizzle or Prisma tables in one config file. FlowPanel serves lists, forms,
          record pages and dashboards at <InlineCode>/admin</InlineCode> inside your app.
        </p>

        <nav
          aria-label="Hero actions"
          className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:gap-8"
        >
          <a
            href={demo || "#start"}
            {...(demo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="inline-flex min-h-12 touch-manipulation items-center justify-center rounded-lg bg-[var(--color-ink)] px-6 py-3 text-sm font-medium text-[var(--color-ink-fg)] transition-colors duration-200 hover:bg-[var(--color-ink-hover)] active:bg-[var(--color-ink-hover)]"
          >
            {demo ? "Open the live demo" : "Get started"}
          </a>
          <Link
            href="/docs"
            className="inline-flex min-h-11 touch-manipulation items-center justify-center text-sm font-medium text-[var(--color-fg-muted)] underline decoration-[var(--color-border-strong)] underline-offset-4 transition-colors duration-200 hover:text-[var(--color-fg)] hover:decoration-[var(--color-fg)]"
          >
            Read the docs
          </Link>
        </nav>

        <div className="mt-16 md:mt-20">
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
