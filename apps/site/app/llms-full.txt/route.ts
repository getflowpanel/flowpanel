import { readRawDocBody } from "@/shared/lib/raw-doc";
import { siteConfig } from "@/shared/lib/site-config";
import { source } from "@/shared/lib/source";

// Every doc body in one stream, built once: the image does not carry the sources.
export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const chunks: string[] = [
    `# ${siteConfig.name} — full documentation`,
    "",
    `Source: ${siteConfig.repo.url}`,
    "",
  ];

  for (const page of source.getPages()) {
    const body = await readRawDocBody(page.slugs);
    if (body === null) continue;
    chunks.push(`## ${page.data.title}`);
    chunks.push(`Source: ${siteConfig.url}${page.url}`);
    chunks.push("");
    chunks.push(body.trimEnd());
    chunks.push("");
  }

  return new Response(chunks.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
