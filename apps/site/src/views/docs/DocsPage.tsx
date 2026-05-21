import { DocsBody } from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { source } from "@/shared/lib/source";
import { getMDXComponents } from "@/shared/ui/mdx-components";
import { buildDocBreadcrumbs } from "./lib/breadcrumbs";
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
  const crumbs = buildDocBreadcrumbs(slug ?? [], page.data.title);
  const slugPath = slug?.join("/") ?? "index";
  const editPath = `${DOC_SOURCE_ROOT}/${slugPath}.mdx`;
  const rawMarkdownHref = `/api/md/docs/${slugPath}`;

  return (
    <>
      <article className="min-w-0">
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
      <aside className="hidden xl:block xl:sticky xl:top-20 xl:self-start">
        <TocRail toc={page.data.toc} editPath={editPath} rawMarkdownHref={rawMarkdownHref} />
      </aside>
    </>
  );
}
