import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";
import { source } from "@/shared/lib/source";
import { OgCard, ogSize } from "@/shared/ui/og-card";
import { findDocSection } from "@/views/docs";

export const dynamicParams = false;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const page = slug.at(-1) === "image.png" ? source.getPage(slug.slice(0, -1)) : undefined;
  if (!page) notFound();
  const section = findDocSection(page.url)?.name;
  return new ImageResponse(
    <OgCard
      eyebrow={section ? `Docs · ${section}` : "Docs"}
      title={page.data.metaTitle ?? page.data.title}
      subtitle={page.data.description}
    />,
    ogSize,
  );
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({ slug: [...page.slugs, "image.png"] }));
}
