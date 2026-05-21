import { DocsBody } from "fumadocs-ui/page";
import { changelog } from "@/.source/server";
import { getMDXComponents } from "@/shared/ui/mdx-components";
import { SiteFooter } from "@/widgets/site-footer";
import { SiteHeader } from "@/widgets/site-header";

/**
 * Renders the aggregated MDX produced by
 * `scripts/aggregate-changelog.mjs`. The script merges every
 * `packages/*\/CHANGELOG.md` into one file grouped by version.
 */
export function Changelog() {
  // Single-doc collection — the aggregator emits exactly one index.mdx.
  const page = changelog[0];
  const MDX = page?.body;
  const title = page?.title ?? "Changelog";
  const description = page?.description ?? "Per-package release notes.";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[820px] px-6 py-24">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">
          <span aria-hidden className="text-[var(--color-fg-subtle)]">
            ●
          </span>{" "}
          Releases
        </p>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
        <p className="mt-5 max-w-[60ch] text-lg text-[var(--color-fg-muted)]">{description}</p>
        {MDX ? (
          <DocsBody className="mt-12">
            <MDX components={getMDXComponents()} />
          </DocsBody>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
