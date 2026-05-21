import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Reads a docs MDX file from disk and strips the frontmatter block.
 * Returns the body verbatim — keeps MDX directives unchanged so the
 * output stays usable as markdown for LLM consumers and humans alike.
 *
 * Server-only. Imports `node:fs/promises` so any caller is automatically
 * pinned to a Node runtime route.
 */
export async function readRawDocBody(slug: string[]): Promise<string | null> {
  const relative = `${slug.join("/")}.mdx`;
  const file = path.join(process.cwd(), "content/docs", relative);
  try {
    const raw = await readFile(file, "utf8");
    return stripFrontmatter(raw);
  } catch {
    return null;
  }
}

function stripFrontmatter(source: string): string {
  if (!source.startsWith("---")) return source;
  const end = source.indexOf("\n---", 3);
  if (end === -1) return source;
  return source.slice(end + 4).replace(/^\s+/, "");
}
