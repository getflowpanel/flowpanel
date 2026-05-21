import { siteConfig } from "@/shared/lib/site-config";
import { source } from "@/shared/lib/source";

/**
 * Static index per the llmstxt.org convention. Points LLM consumers at
 * the site, lists every top-level section, and offers `llms-full.txt`
 * for the bulk version.
 *
 * Rendered at request time (cheap), no `revalidate` needed — the page
 * tree is part of the compiled bundle.
 */
export function GET(): Response {
  const lines: string[] = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.description}`,
    "",
    `Source: ${siteConfig.repo.url}`,
    `Docs:   ${siteConfig.url}/docs`,
    `Full:   ${siteConfig.url}/llms-full.txt`,
    "",
    "## Sections",
    "",
  ];

  for (const node of source.pageTree.children) {
    if (node.type !== "folder") continue;
    lines.push(`### ${String(node.name)}`);
    lines.push("");
    for (const child of node.children) {
      if (child.type !== "page") continue;
      lines.push(`- [${String(child.name)}](${siteConfig.url}${child.url})`);
    }
    lines.push("");
  }

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
