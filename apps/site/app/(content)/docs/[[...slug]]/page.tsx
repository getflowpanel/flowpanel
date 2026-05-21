import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DocsPage, generateDocsMetadata, generateDocsStaticParams } from "@/views/docs";

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  if (!slug || slug.length === 0) {
    redirect("/docs/introduction/getting-started");
  }
  return <DocsPage slug={slug} />;
}

export function generateStaticParams() {
  return generateDocsStaticParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return generateDocsMetadata({ slug });
}
