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
  return {
    title: page.data.title,
    description: page.data.description,
  };
}
