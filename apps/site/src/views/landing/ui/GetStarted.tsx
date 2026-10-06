import Link from "next/link";
import { siteConfig } from "@/shared/lib/site-config";
import { CopyButton } from "@/shared/ui/copy-button";
import { InlineCode } from "@/shared/ui/inline-code";
import { Section } from "./Section";

const INSTALL_CMD = "pnpm dlx @flowpanel/cli init";

const linkClass =
  "font-medium text-[var(--color-fg)] underline decoration-[var(--color-border-strong)] underline-offset-4 transition-colors hover:decoration-[var(--color-fg)]";

export function GetStarted() {
  const [scraper, clerk] = siteConfig.examples;

  return (
    <Section
      id="start"
      title="Add it to your app"
      lead={
        <>
          Run this in a Next.js project. It detects Drizzle or Prisma, installs the packages and
          writes the config, the <InlineCode>/admin</InlineCode> page and its API route.
        </>
      }
    >
      <div className="flex min-h-14 items-center justify-between gap-4 rounded-lg bg-[var(--color-bg-subtle)] px-4 py-2 font-mono text-xs sm:px-5 sm:text-sm">
        <span className="min-w-0 break-words text-[var(--color-fg)]">
          <span className="select-none text-[var(--color-fg-subtle)]">$ </span>
          {INSTALL_CMD}
        </span>
        <CopyButton text={INSTALL_CMD} />
      </div>
      <p className="mt-4 text-sm text-[var(--color-fg-subtle)]">
        Requires Next.js 15.5 or 16, React 19, and Drizzle 0.45+ or Prisma 5–6.
      </p>

      <div className="mt-10 max-w-[58ch] space-y-4 leading-relaxed text-[var(--color-fg-muted)]">
        <p>
          Follow the{" "}
          <Link href="/docs/introduction/getting-started" className={linkClass}>
            getting started guide
          </Link>{" "}
          for the first resource, then{" "}
          <Link href="/docs/introduction/founder-admin" className={linkClass}>
            build a complete admin
          </Link>{" "}
          for dashboards and record pages.
        </p>
        <p>
          Two examples run locally with seeded data: ScrapeAI (
          <a href={scraper.url} target="_blank" rel="noreferrer" className={linkClass}>
            <InlineCode>{scraper.name}</InlineCode>
          </a>
          ), the live demo, and a small admin behind Clerk (
          <a href={clerk.url} target="_blank" rel="noreferrer" className={linkClass}>
            <InlineCode>{clerk.name}</InlineCode>
          </a>
          ).
        </p>
      </div>
    </Section>
  );
}
