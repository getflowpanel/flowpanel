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
  const images = [{ url: docOgImagePath(page.slugs), width: 1200, height: 630, alt: title }];
  return {
    title,
    description: page.data.description,
    alternates: {
      canonical: page.url,
      types: { "text/markdown": `/api/md${page.url}` },
    },
    openGraph: {
      title: `${title} · FlowPanel`,
      description: page.data.description,
      url: page.url,
      siteName: "FlowPanel",
      type: "article",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · FlowPanel`,
      description: page.data.description,
      images,
    },
  };
}

export function docOgImagePath(slugs: string[]): string {
  return `/og/docs/${[...slugs, "image.png"].join("/")}`;
}
