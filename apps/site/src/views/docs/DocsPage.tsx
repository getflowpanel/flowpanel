import { DocsBody } from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { source } from "@/shared/lib/source";
import { docJsonLd } from "@/shared/lib/structured-data";
import { JsonLd } from "@/shared/ui/json-ld";
import { getMDXComponents } from "@/shared/ui/mdx-components";
import { buildDocBreadcrumbs, findDocSection } from "./lib/breadcrumbs";
import { docOgImagePath } from "./lib/meta";
import { Breadcrumbs } from "./ui/Breadcrumbs";
import { TocRail } from "./ui/TocRail";

interface DocsPageProps {
  slug: string[] | undefined;
}

const DOC_SOURCE_ROOT = "apps/site/content/docs";

export async function DocsPage({ slug }: DocsPageProps) {
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const crumbs = buildDocBreadcrumbs(page.url, page.data.title);
  const slugPath = slug?.join("/") ?? "index";
  const editPath = `${DOC_SOURCE_ROOT}/${slugPath}.mdx`;
  const rawMarkdownHref = `/api/md/docs/${slugPath}`;

  const jsonLd = docJsonLd({
    title: page.data.title,
    headline: page.data.metaTitle ?? page.data.title,
    description: page.data.description,
    url: page.url,
    image: docOgImagePath(page.slugs),
    section: findDocSection(page.url),
  });

  return (
    <>
      <JsonLd data={jsonLd} />
      <main id="main" className="min-w-0">
        <article>
          <Breadcrumbs items={crumbs} />
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            {page.data.title}
          </h1>
          {page.data.description ? (
            <p className="mt-4 max-w-[65ch] text-lg text-[var(--color-fg-muted)]">
              {page.data.description}
            </p>
          ) : null}
          <DocsBody className="mt-10">
            <MDX components={getMDXComponents()} />
          </DocsBody>
        </article>
      </main>
      <div className="hidden xl:block xl:sticky xl:top-20 xl:self-start">
        <TocRail toc={page.data.toc} editPath={editPath} rawMarkdownHref={rawMarkdownHref} />
      </div>
    </>
  );
}
