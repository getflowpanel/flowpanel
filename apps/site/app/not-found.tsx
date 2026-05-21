import Link from "next/link";
import { SiteFooter } from "@/widgets/site-footer";
import { SiteHeader } from "@/widgets/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-[640px] flex-col items-center justify-center px-6 py-16 text-center">
        <p className="font-mono text-sm text-[var(--color-fg-subtle)]">404</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Page not found.</h1>
        <p className="mt-3 text-[var(--color-fg-muted)]">The link is dead or the page has moved.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 font-mono text-sm">
          <Link
            href="/"
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-subtle)]"
          >
            ← Home
          </Link>
          <Link
            href="/docs/introduction/getting-started"
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-subtle)]"
          >
            Read the docs
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
