import { DocsBody } from "fumadocs-ui/page";
import { changelog } from "@/.source/server";
import { getMDXComponents } from "@/shared/ui/mdx-components";

export function Changelog() {
  // Single-doc collection — the aggregator emits exactly one index.mdx.
  const page = changelog[0];
  const MDX = page?.body;
  const title = page?.title ?? "Changelog";
  const description = page?.description ?? "Per-package release notes.";

  return (
    <main className="mx-auto max-w-[820px] px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
      <p className="mt-5 max-w-[60ch] text-lg text-[var(--color-fg-muted)]">{description}</p>
      {MDX ? (
        <DocsBody className="mt-12 [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-base [&_li]:my-1">
          <MDX components={getMDXComponents()} />
        </DocsBody>
      ) : null}
    </main>
  );
}
