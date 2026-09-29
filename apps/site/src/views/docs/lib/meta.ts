import type { Metadata } from "next";
import { source } from "@/shared/lib/source";

interface MetaParams {
  slug: string[] | undefined;
}

export function generateDocsStaticParams() {
  return source.generateParams();
}

export function generateDocsMetadata({ slug }: MetaParams): Metadata {
  const page = source.getPage(slug);
  if (!page) return {};
  const title = page.data.metaTitle ?? page.data.title;
  return {
    title,
    description: page.data.description,
    alternates: { canonical: page.url },
    openGraph: {
      title: `${title} · FlowPanel`,
      description: page.data.description,
      url: page.url,
      siteName: "FlowPanel",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · FlowPanel`,
      description: page.data.description,
    },
  };
}
